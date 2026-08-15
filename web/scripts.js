const simulateButton = document.getElementById("simulateButton");
const motorcycle = document.getElementById("motorcycle");
const status = document.getElementById("simulationStatus");

simulateButton.addEventListener("click", simulate);

async function simulate() {
    const mass = Number(document.getElementById("mass").value);
    const initialSpeedKmh = Number(document.getElementById("speed").value);
    const friction = Number(document.getElementById("friction").value);
    const brakeForce = Number(document.getElementById("brakeForce").value);

    status.textContent = "Contacting backend...";

    const payload = { mass, speed: initialSpeedKmh, friction, brakeForce };

    try {
        const resp = await fetch('https://vehicle-braking-worker.godwin-veh-sim.workers.dev/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

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
        document.getElementById("deceleration").textContent = json.deceleration.toFixed(2);
        document.getElementById("actualBrakeForce").textContent = json.actualBrakeForce.toFixed(0);

        animateMotorcycle(initialSpeed, deceleration, stoppingTime);
        drawGraph(initialSpeed, deceleration, stoppingTime);

    } catch (err) {
        status.textContent = 'Request failed';
        console.error(err);
    }
}

function animateMotorcycle(initialSpeed, deceleration, stoppingTime) {
    status.textContent = "Braking...";
    motorcycle.style.left = "20px";

    const startTime = performance.now();

    function animationFrame(currentTime) {
        const elapsed = (currentTime - startTime) / 1000;
        const t = Math.min(elapsed, stoppingTime);

        const position = initialSpeed * t - 0.5 * deceleration * t * t;

        const denom = initialSpeed * stoppingTime - 0.5 * deceleration * stoppingTime * stoppingTime;
        const normalizedPosition = denom > 0 ? position / denom : 0;

        const roadWidth = document.querySelector(".road").clientWidth;
        const motorcycleWidth = motorcycle.offsetWidth;

        const x = 20 + normalizedPosition * (roadWidth - motorcycleWidth - 80);
        motorcycle.style.left = `${x}px`;

        if (elapsed < stoppingTime) {
            requestAnimationFrame(animationFrame);
        } else {
            status.textContent = "Vehicle stopped 🛑";
        }
    }

    requestAnimationFrame(animationFrame);
}

function drawGraph(initialSpeed, deceleration, stoppingTime) {
    const canvas = document.getElementById("velocityGraph");
    const ctx = canvas.getContext("2d");

    const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();

    for (let i = 0; i <= 100; i++) {
        const t = stoppingTime * i / 100;
        const velocity = Math.max(initialSpeed - deceleration * t, 0);

        const x = (t / stoppingTime) * (width - 60) + 40;
        const y = height - 40 - (velocity / initialSpeed) * (height - 80);

        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.font = "16px Arial";
    ctx.fillText("Velocity (km/h)", 20, 25);
    ctx.fillText("Time (s)", width - 80, height - 10);
}