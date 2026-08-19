const simulateButton = document.getElementById("simulateButton");
const motorcycle = document.getElementById("motorcycle");
const brakeImpressions = document.getElementById("brakeImpressions");
const status = document.getElementById("simulationStatus");
const road = document.querySelector(".road");
const telemetry = {
    velocity: document.getElementById("telemetryVelocity"),
    distance: document.getElementById("telemetryDistance"),
    time: document.getElementById("telemetryTime"),
    force: document.getElementById("telemetryForce")
};

const presets = {
    city: { mass: 200, speed: 60, friction: 0.8, brakeForce: 5000 },
    wet: { mass: 200, speed: 80, friction: 0.45, brakeForce: 5000 },
    track: { mass: 190, speed: 140, friction: 1.2, brakeForce: 6500 }
};

document.querySelectorAll(".preset").forEach((button) => {
    button.addEventListener("click", () => {
        const values = presets[button.dataset.preset];
        Object.entries(values).forEach(([key, value]) => {
            document.getElementById(key).value = value;
        });
        document.querySelectorAll(".preset").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        document.body.dataset.road = button.dataset.preset;
    });
});

simulateButton.addEventListener("click", simulate);

async function simulate() {
    const mass = Number(document.getElementById("mass").value);
    const initialSpeedKmh = Number(document.getElementById("speed").value);
    const friction = Number(document.getElementById("friction").value);
    const brakeForce = Number(document.getElementById("brakeForce").value);

    status.textContent = "Contacting backend...";

    const payload = { mass, speed: initialSpeedKmh, friction, brakeForce };

    try {
        const workerEndpoint = 'https://vehicle-braking-worker.godwin-veh-sim.workers.dev/simulate';
        const opts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };

        // Cloud-only: always call the deployed Cloudflare Worker
        const resp = await fetch(workerEndpoint, opts);

        if (!resp.ok) {
            status.textContent = `Server error: ${resp.status}`;
            return;
        }

        const json = await resp.json();

        const initialSpeed = initialSpeedKmh / 3.6;
        const deceleration = Math.abs(json.deceleration);
        const stoppingTime = json.stoppingTime;

        document.getElementById("stoppingTime").textContent = stoppingTime.toFixed(2);
        document.getElementById("stoppingDistance").textContent = json.stoppingDistance.toFixed(2);
        document.getElementById("deceleration").textContent = deceleration.toFixed(2);
        document.getElementById("actualBrakeForce").textContent = json.actualBrakeForce.toFixed(0);

        animateMotorcycle(initialSpeed, deceleration, stoppingTime, json.stoppingDistance, json.actualBrakeForce);
        drawGraph(initialSpeed, deceleration, stoppingTime);

    } catch (err) {
        status.textContent = 'Request failed';
        console.error(err);
    }
}

function animateMotorcycle(initialSpeed, deceleration, stoppingTime, stoppingDistance, actualBrakeForce) {
    status.textContent = "Braking...";
    status.className = "status-pill is-running";
    motorcycle.style.left = "20px";
    motorcycle.classList.add("is-braking");
    motorcycle.classList.add("is-moving");
    brakeImpressions.classList.remove("is-visible");

    const startTime = performance.now();

    function animationFrame(currentTime) {
        const elapsed = (currentTime - startTime) / 1000;
        const t = Math.min(elapsed, stoppingTime);

        const position = initialSpeed * t - 0.5 * deceleration * t * t;

        const denom = initialSpeed * stoppingTime - 0.5 * deceleration * stoppingTime * stoppingTime;
        const normalizedPosition = denom > 0 ? position / denom : 0;

        const roadWidth = road.clientWidth;
        const motorcycleWidth = motorcycle.offsetWidth;

        const x = 20 + normalizedPosition * (roadWidth - motorcycleWidth - 80);
        motorcycle.style.left = `${x}px`;
        telemetry.velocity.innerHTML = `${(Math.max(initialSpeed - deceleration * t, 0) * 3.6).toFixed(1)} <small>km/h</small>`;
        telemetry.distance.innerHTML = `${Math.max(position, 0).toFixed(1)} <small>m</small>`;
        telemetry.time.innerHTML = `${t.toFixed(2)} <small>s</small>`;
        telemetry.force.innerHTML = `${actualBrakeForce.toFixed(0)} <small>N</small>`;

        if (elapsed < stoppingTime) {
            requestAnimationFrame(animationFrame);
        } else {
            brakeImpressions.style.left = `${x + motorcycleWidth * 0.12}px`;
            brakeImpressions.classList.add("is-visible");
            motorcycle.classList.remove("is-braking");
            motorcycle.classList.remove("is-moving");
            status.textContent = "Stopped";
            status.className = "status-pill is-complete";
        }
    }

    requestAnimationFrame(animationFrame);
}

function drawGraph(initialSpeed, deceleration, stoppingTime) {
    const canvas = document.getElementById("velocityGraph");
    const ctx = canvas.getContext("2d");

    const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
    const startedAt = performance.now();

    const padding = { top: 22, right: 24, bottom: 34, left: 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    function render(currentTime) {
        const progress = Math.min((currentTime - startedAt) / (stoppingTime * 1000), 1);
        ctx.clearRect(0, 0, width, height);
        ctx.font = `${12 * window.devicePixelRatio}px 'DM Mono', monospace`;
        ctx.fillStyle = "#7a7770";
        ctx.strokeStyle = "#dedbd3";
        ctx.lineWidth = window.devicePixelRatio;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * i) / 4;
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
            ctx.fillText(`${Math.round((initialSpeed * 3.6) * (1 - i / 4))}`, 8, y + 4);
        }

        ctx.beginPath();
        for (let i = 0; i <= Math.max(1, Math.round(progress * 100)); i++) {
            const t = stoppingTime * i / 100;
            const velocity = Math.max(initialSpeed - deceleration * t, 0);
            const x = (t / stoppingTime) * plotWidth + padding.left;
            const y = padding.top + plotHeight - (velocity / initialSpeed) * plotHeight;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = "#e4572e";
        ctx.lineWidth = 3 * window.devicePixelRatio;
        ctx.stroke();
        ctx.fillStyle = "#7a7770";
        ctx.fillText("km/h", 8, 14);
        ctx.fillText("time (s)", width - 70, height - 10);
        if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}