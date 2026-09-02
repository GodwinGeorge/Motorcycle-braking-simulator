if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const simulateButton = document.getElementById("simulateButton");
const motorcycle = document.getElementById("motorcycle");
const brakeImpressions = document.getElementById("brakeImpressions");
const status = document.getElementById("simulationStatus");
const apiState = document.getElementById("apiState");
const configurationHint = document.getElementById("configurationHint");
const road = document.querySelector(".road");
const telemetry = {
    velocity: document.getElementById("telemetryVelocity"),
    distance: document.getElementById("telemetryDistance"),
    time: document.getElementById("telemetryTime"),
    force: document.getElementById("telemetryForce")
};
const sensorTelemetry = {
    frontWss: document.getElementById("sensorFrontWss"),
    rearWss: document.getElementById("sensorRearWss"),
    accel: document.getElementById("sensorAccel"),
    gyro: document.getElementById("sensorGyro"),
    gpsSpeed: document.getElementById("sensorGpsSpeed"),
    gpsPosition: document.getElementById("sensorGpsPosition"),
    gpsFix: document.getElementById("sensorGpsFix"),
    sampleLabel: document.getElementById("sensorSampleLabel")
};

const presets = {
    city: { mass: 200, speed: 60, friction: 0.8, brakeForce: 5000, sensorRate: 100, sensorNoise: 0.02, gpsNoise: 1.5, wheelRadius: 0.31 },
    wet: { mass: 200, speed: 80, friction: 0.45, brakeForce: 5000, sensorRate: 100, sensorNoise: 0.04, gpsNoise: 2.5, wheelRadius: 0.31 },
    track: { mass: 190, speed: 140, friction: 1.2, brakeForce: 6500, sensorRate: 100, sensorNoise: 0.03, gpsNoise: 1.0, wheelRadius: 0.31 }
};

const cloudEndpoint = 'https://vehicle-braking-worker.godwin-veh-sim.workers.dev';
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const inputLabels = {
    mass: "Motorcycle mass",
    speed: "Initial speed",
    friction: "Road friction",
    brakeForce: "Brake force",
    sensorRate: "Sensor rate",
    sensorNoise: "IMU / WSS noise",
    gpsNoise: "GPS position noise",
    wheelRadius: "Wheel radius"
};

function setConfigurationHint(message, isError = false) {
    configurationHint.textContent = message;
    configurationHint.classList.toggle("is-error", isError);
}

function validateInputs() {
    for (const [id, label] of Object.entries(inputLabels)) {
        const input = document.getElementById(id);
        if (input.value.trim() === "" || !input.validity.valid || !Number.isFinite(Number(input.value))) {
            setConfigurationHint(`${label} needs a valid value.`, true);
            input.focus();
            return false;
        }
    }
    return true;
}

async function checkCloudflareConnection() {
    if (isLocalHost) {
        apiState.innerHTML = '<span class="live-dot"></span>Local API mode';
        return;
    }

    try {
        const response = await fetch(`${cloudEndpoint}/health`);
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        apiState.innerHTML = '<span class="live-dot"></span>Cloudflare connected';
    } catch (error) {
        apiState.innerHTML = '<span class="live-dot is-offline"></span>Cloudflare unavailable';
        console.error(error);
    }
}

document.querySelectorAll(".preset").forEach((button) => {
    button.addEventListener("click", () => {
        const values = presets[button.dataset.preset];
        Object.entries(values).forEach(([key, value]) => {
            document.getElementById(key).value = value;
        });
        document.querySelectorAll(".sensor-option").forEach((option) => {
            option.classList.toggle("is-active", option.dataset.value === String(values[option.dataset.input]));
        });
        document.querySelectorAll(".preset").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        document.querySelectorAll(".preset").forEach((item) => item.setAttribute("aria-checked", String(item === button)));
        document.body.dataset.road = button.dataset.preset;
        setConfigurationHint(`${button.querySelector("strong").textContent} profile selected · values update instantly`);
    });
});

document.querySelectorAll(".sensor-option").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.input);
        input.value = button.dataset.value;
        button.closest(".sensor-options").querySelectorAll(".sensor-option").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        setConfigurationHint(`${button.closest(".sensor-control").querySelector("label").textContent}: ${button.querySelector("small").textContent}`);
    });
});

Object.keys(inputLabels).forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
        if (["sensorNoise", "gpsNoise", "wheelRadius"].includes(id)) {
            document.querySelectorAll(`[data-input="${id}"]`).forEach((option) => {
                option.classList.toggle("is-active", Number(option.dataset.value) === Number(document.getElementById(id).value));
            });
        }
        setConfigurationHint("Custom configuration · ready to simulate");
    });
});

simulateButton.addEventListener("click", simulate);

async function simulate() {
    if (!validateInputs()) return;

    const mass = Number(document.getElementById("mass").value);
    const initialSpeedKmh = Number(document.getElementById("speed").value);
    const friction = Number(document.getElementById("friction").value);
    const brakeForce = Number(document.getElementById("brakeForce").value);
    const sensorRate = Number(document.getElementById("sensorRate").value);
    const sensorNoise = Number(document.getElementById("sensorNoise").value);
    const gpsNoise = Number(document.getElementById("gpsNoise").value);
    const wheelRadius = Number(document.getElementById("wheelRadius").value);

    status.textContent = "Contacting backend...";
    simulateButton.disabled = true;
    simulateButton.querySelector("span").textContent = "Running simulation";

    const payload = { mass, speed: initialSpeedKmh, friction, brakeForce, sensorRate, sensorNoise, gpsNoise, wheelRadius };

    try {
        const endpoint = isLocalHost
            ? 'http://localhost:18080/simulate'
            : `${cloudEndpoint}/simulate`;
        const opts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };

        const resp = await fetch(endpoint, opts);

        if (!resp.ok) {
            const error = await resp.json().catch(() => null);
            throw new Error(error?.error || `Server error: ${resp.status}`);
        }

        const json = await resp.json();
        apiState.innerHTML = `<span class="live-dot"></span>${endpoint.includes("workers.dev") ? "Cloudflare connected" : "Local API connected"}`;
        renderSimulation(json, initialSpeedKmh, sensorRate, payload);

    } catch (err) {
        const fallback = buildBrowserSimulation(payload);
        apiState.innerHTML = '<span class="live-dot is-offline"></span>Browser calculation mode';
        setConfigurationHint('API unavailable · using the built-in braking model', true);
        renderSimulation(fallback, initialSpeedKmh, sensorRate, payload);
        console.error(err);
    } finally {
        simulateButton.disabled = false;
        simulateButton.querySelector("span").textContent = "Run simulation";
    }
}

function renderSimulation(json, initialSpeedKmh, sensorRate, payload) {
    const initialSpeed = initialSpeedKmh / 3.6;
    const deceleration = Math.abs(json.deceleration);
    const stoppingTime = json.stoppingTime;

    document.getElementById("stoppingTime").textContent = stoppingTime.toFixed(2);
    document.getElementById("stoppingDistance").textContent = json.stoppingDistance.toFixed(2);
    document.getElementById("deceleration").textContent = deceleration.toFixed(2);
    document.getElementById("actualBrakeForce").textContent = json.actualBrakeForce.toFixed(0);
    // The Cloudflare Worker returns recorded samples. Other compatible APIs only
    // return the physics result, so generate a matching local telemetry stream.
    const sensors = Array.isArray(json.sensors) && json.sensors.length
        ? json.sensors
        : buildBrowserSimulation(payload).sensors;
    animateMotorcycle(initialSpeed, deceleration, stoppingTime, json.stoppingDistance, json.actualBrakeForce, sensors, sensorRate);
    drawGraph(initialSpeed, deceleration, stoppingTime);
}

function buildBrowserSimulation({ mass, speed, friction, brakeForce, sensorRate, sensorNoise, gpsNoise, wheelRadius }) {
    const initialSpeed = speed / 3.6;
    const actualBrakeForce = Math.min(brakeForce, friction * mass * 9.81);
    const deceleration = actualBrakeForce / mass;
    const stoppingTime = initialSpeed / deceleration;
    const stoppingDistance = (initialSpeed * initialSpeed) / (2 * deceleration);
    const interval = 1 / sensorRate;
    const sensors = Array.from({ length: Math.ceil(stoppingTime / interval) }, (_, index) => {
        const time = Math.min((index + 1) * interval, stoppingTime);
        const velocity = Math.max(0, initialSpeed - deceleration * time);
        const position = Math.max(0, initialSpeed * time - 0.5 * deceleration * time * time);
        const wobble = Math.sin(index * 12.9898) * sensorNoise;
        const positionWobble = Math.sin(index * 8.13) * gpsNoise;
        return {
            frontWheelSpeed: Math.max(0, velocity * 1.12 / wheelRadius + wobble), rearWheelSpeed: Math.max(0, velocity * .92 / wheelRadius + wobble),
            longitudinalAcceleration: -deceleration + wobble, pitchRate: -deceleration * .015 + wobble, yawRate: wobble * .1, rollRate: wobble * .1,
            gpsSpeed: Math.max(0, velocity + wobble * .05), gpsLatitude: 51.5074 + positionWobble / 111111,
            gpsLongitude: -0.1278 + (position + positionWobble) / 69400, gpsFix: true
        };
    });
    return { stoppingTime, stoppingDistance, deceleration: -deceleration, actualBrakeForce, sensors };
}

checkCloudflareConnection();

function animateMotorcycle(initialSpeed, deceleration, stoppingTime, stoppingDistance, actualBrakeForce, sensors, sensorRate) {
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
        const sensorIndex = Math.min(Math.floor(t * sensorRate), Math.max(sensors.length - 1, 0));
        updateSensorReadout(sensors[sensorIndex], sensorIndex, sensors.length);

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

function updateSensorReadout(sample, index, total) {
    if (!sample) return;
    sensorTelemetry.frontWss.innerHTML = `${sample.frontWheelSpeed.toFixed(2)} <small>rad/s</small>`;
    sensorTelemetry.rearWss.innerHTML = `${sample.rearWheelSpeed.toFixed(2)} <small>rad/s</small>`;
    sensorTelemetry.accel.innerHTML = `${sample.longitudinalAcceleration.toFixed(2)} <small>m/s²</small>`;
    sensorTelemetry.gyro.innerHTML = `${sample.pitchRate.toFixed(2)} / ${sample.yawRate.toFixed(2)} / ${sample.rollRate.toFixed(2)} <small>rad/s</small>`;
    sensorTelemetry.gpsSpeed.innerHTML = `${sample.gpsSpeed.toFixed(2)} <small>m/s</small>`;
    sensorTelemetry.gpsPosition.textContent = `${sample.gpsLatitude.toFixed(5)}, ${sample.gpsLongitude.toFixed(5)}`;
    sensorTelemetry.gpsFix.textContent = sample.gpsFix ? "LOCKED" : "LOST";
    sensorTelemetry.sampleLabel.textContent = `${index + 1} / ${total} samples`;
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

        ctx.strokeStyle = "#2f6b4f";
        ctx.lineWidth = 3 * window.devicePixelRatio;
        ctx.stroke();
        ctx.fillStyle = "#7a7770";
        ctx.fillText("km/h", 8, 14);
        ctx.fillText("time (s)", width - 70, height - 10);
        if (progress < 1) requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}
