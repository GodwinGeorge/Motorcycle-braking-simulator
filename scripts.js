if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const simulateButton = document.getElementById("simulateButton");
const motorcycle = document.getElementById("motorcycle");
const dog = document.getElementById("dog");
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
    city: { mass: 200, speed: 60, friction: 0.8, brakeForce: 5000, sensorRate: 100, sensorNoise: 0.02, gpsNoise: 1.5, wheelRadius: 0.31, leanAngle: 0, frontBrakeBias: 70, reactionTime: 1, rearWheelLiftRequested: false, absEnabled: true },
    wet: { mass: 200, speed: 80, friction: 0.45, brakeForce: 5000, sensorRate: 100, sensorNoise: 0.04, gpsNoise: 2.5, wheelRadius: 0.31, leanAngle: 0, frontBrakeBias: 70, reactionTime: 1, rearWheelLiftRequested: false, absEnabled: true },
    track: { mass: 190, speed: 140, friction: 1.2, brakeForce: 6500, sensorRate: 100, sensorNoise: 0.03, gpsNoise: 1.0, wheelRadius: 0.31, leanAngle: 0, frontBrakeBias: 70, reactionTime: 1, rearWheelLiftRequested: false, absEnabled: true }
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
    wheelRadius: "Wheel radius",
    leanAngle: "Lean angle",
    frontBrakeBias: "Front brake bias",
    reactionTime: "Reaction time",
    dogDistance: "Dog distance",
    rearWheelLiftRequested: "Rear wheel lift"
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
        dog.classList.toggle("is-track-hidden", button.dataset.preset === "track");
        document.getElementById("dogDistance").disabled = button.dataset.preset === "track";
        syncLiftControl(values.absEnabled);
        setConfigurationHint(`${button.querySelector("strong").textContent} profile selected · values update instantly`);
    });
});

document.querySelectorAll(".sensor-option").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.input);
        input.value = button.dataset.value;
        if (button.dataset.input === "absEnabled") {
            syncLiftControl(button.dataset.value === "true");
        }
        button.closest(".sensor-options").querySelectorAll(".sensor-option").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        setConfigurationHint(`${button.closest(".sensor-control").querySelector("label").textContent}: ${button.querySelector("small").textContent}`);
    });
});

function syncLiftControl(absEnabled) {
    const liftInput = document.getElementById("rearWheelLiftRequested");
    const liftButtons = document.querySelectorAll('[data-input="rearWheelLiftRequested"]');
    if (absEnabled) liftInput.value = "false";
    liftButtons.forEach((button) => {
        button.disabled = absEnabled;
        button.classList.toggle("is-active", button.dataset.value === liftInput.value);
    });
}

syncLiftControl(true);

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
    const leanAngle = Number(document.getElementById("leanAngle").value);
    const frontBrakeBias = Number(document.getElementById("frontBrakeBias").value);
    const reactionTime = Number(document.getElementById("reactionTime").value);
    const dogDistance = Number(document.getElementById("dogDistance").value);
    const absEnabled = document.getElementById("absEnabled").value === "true";
    const rearWheelLiftRequested = document.getElementById("rearWheelLiftRequested").value === "true";
    const dogEnabled = document.body.dataset.road !== "track";

    status.textContent = "Contacting backend...";
    simulateButton.disabled = true;
    simulateButton.querySelector("span").textContent = "Running simulation";

    const payload = { mass, speed: initialSpeedKmh, friction, brakeForce, sensorRate, sensorNoise, gpsNoise, wheelRadius, leanAngle, frontBrakeBias, reactionTime, dogDistance, dogEnabled, rearWheelLiftRequested, absEnabled };

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
    dog.classList.toggle("is-track-hidden", json.dogEnabled === false);

    document.getElementById("stoppingTime").textContent = stoppingTime.toFixed(2);
    document.getElementById("stoppingDistance").textContent = json.stoppingDistance.toFixed(2);
    document.getElementById("reactionDistance").textContent = json.reactionDistance.toFixed(2);
    document.getElementById("totalStoppingDistance").textContent = json.totalStoppingDistance.toFixed(2);
    document.getElementById("deceleration").textContent = deceleration.toFixed(2);
    document.getElementById("actualBrakeForce").textContent = json.actualBrakeForce.toFixed(0);
    setConfigurationHint(json.rearWheelLiftPreventedByAbs
        ? "ABS is active · rear wheel lift request prevented"
        : json.dogHit
        ? `Collision predicted · the motorcycle will hit the dog at ${json.dogDistance.toFixed(1)} m`
        : json.rearWheelLift
        ? "Rear wheel lift detected · front load is carrying the brake force"
        : json.absActive
            ? "Dual-channel ABS is modulating the front/rear force limits"
            : "Simulation complete · no ABS modulation required");
    document.getElementById("resultExplanation").textContent = json.dogHit
        ? `You will hit the dog at ${json.dogDistance.toFixed(1)} m with approximately ${json.impactSpeedKmh.toFixed(1)} km/h remaining. Hazard lights are on and the dog has died.`
        : json.dogEnabled === false
            ? "Track mode · dog obstacle disabled."
            : `The dog is ${json.dogDistance.toFixed(1)} m away, beyond the ${json.totalStoppingDistance.toFixed(1)} m total stopping distance. ${json.rearWheelLift ? "The rear wheel lifts because rear load reached zero." : json.rearWheelLiftRequested ? "The lift request did not reach the physical lift threshold." : "Both wheels remain loaded."}`;
    // The Cloudflare Worker returns recorded samples. Other compatible APIs only
    // return the physics result, so generate a matching local telemetry stream.
    const sensors = Array.isArray(json.sensors) && json.sensors.length
        ? json.sensors
        : buildBrowserSimulation(payload).sensors;
    const trajectory = Array.isArray(json.trajectory) && json.trajectory.length
        ? json.trajectory
        : Array.isArray(json.data) && json.data.length
            ? json.data
        : buildBrowserSimulation(payload).trajectory;
    animateMotorcycle(initialSpeed, deceleration, stoppingTime, json.stoppingDistance, json.actualBrakeForce, sensors, sensorRate, payload, json.leanLimit, trajectory, json.rearWheelLift, json.dogHit, json.dogDistance, json.totalStoppingDistance);
    drawGraph(initialSpeed, deceleration, stoppingTime, trajectory);
}

function buildBrowserSimulation({ mass, speed, friction, brakeForce, sensorRate, sensorNoise, gpsNoise, wheelRadius, leanAngle = 0, frontBrakeBias = 70, reactionTime = 1, dogDistance = 25, dogEnabled = true, rearWheelLiftRequested = false, absEnabled = true }) {
    const initialSpeed = speed / 3.6;
    const g = 9.81;
    const dt = 0.01;
    const grip = Math.max(0.05, Math.cos(leanAngle * Math.PI / 180));
    const cgHeight = 0.62 + (wheelRadius - 0.31);
    const leanLimit = Math.atan(0.62 / cgHeight) * 180 / Math.PI;
    const wheelMass = mass * 0.04;
    const referenceWheelInertia = 0.5 * wheelMass * 0.31 ** 2;
    const effectiveMass = mass + (2 * referenceWheelInertia) / wheelRadius ** 2;
    const requestedFront = brakeForce * frontBrakeBias / 100;
    const requestedRear = brakeForce - requestedFront;
    const maxBrakeForce = friction * mass * g * grip;
    const manualScale = brakeForce > maxBrakeForce ? maxBrakeForce * 0.7 / brakeForce : 1;
    const sensorStep = Math.max(1, Math.round((1 / sensorRate) / dt));
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    const noise = (seed, amplitude = sensorNoise) => (Math.sin(seed * 12.9898 + 78.233) * 43758.5453 % 1 - 0.5) * 2 * amplitude;
    const sensors = [];
    const trajectory = [{ time: 0, velocity: initialSpeed, position: 0, acceleration: 0 }];
    let velocity = initialSpeed;
    let position = 0;
    let time = 0;
    let previousAcceleration = 0;
    let fusedSpeed = initialSpeed;
    let frontWheelSpeed = initialSpeed / wheelRadius;
    let rearWheelSpeed = initialSpeed / wheelRadius;
    let gpsLatitude = 51.5074;
    let gpsLongitude = -0.1278;
    let gpsSpeed = initialSpeed;
    let actualFrontForce = 0;
    let actualRearForce = 0;
    let absActive = false;
    let frontLoad = mass * g / 2;
    let rearLoad = mass * g / 2;
    let rearWheelLift = false;

    for (let step = 0; velocity > 0 && step < 30000; step += 1) {
        let forceAcceleration = previousAcceleration;
        for (let iteration = 0; iteration < 8; iteration += 1) {
            const transfer = mass * Math.max(0, -forceAcceleration) * cgHeight / 1.4;
            frontLoad = mass * g / 2 + transfer;
            rearLoad = Math.max(0, mass * g / 2 - transfer);
            const frontLimit = friction * grip * frontLoad;
            const rearLimit = friction * grip * rearLoad;
            const liftForce = mass * g * 1.4 / (2 * cgHeight);
            const liftAttempt = rearWheelLiftRequested && !absEnabled;
            actualFrontForce = liftAttempt ? Math.min(frontLimit, Math.max(requestedFront, liftForce)) : Math.min(requestedFront, absEnabled ? frontLimit : frontLimit * 0.7);
            actualRearForce = liftAttempt ? 0 : Math.min(requestedRear, absEnabled ? rearLimit : rearLimit * 0.7);
            forceAcceleration = -(actualFrontForce + actualRearForce) / mass;
        }
        absActive = absActive || (absEnabled && (actualFrontForce < requestedFront || actualRearForce < requestedRear));
        rearWheelLift = rearLoad <= 1e-6 && rearWheelLiftRequested && !absEnabled;
        const actualBrakeForce = actualFrontForce + actualRearForce;
        const acceleration = -actualBrakeForce / mass;
        position += Math.max(0, velocity * dt + 0.5 * acceleration * dt * dt);
        velocity = Math.max(0, velocity + acceleration * dt);
        time += dt;
        previousAcceleration = acceleration;
        trajectory.push({ time, velocity, position, acceleration });
        const frontWheelSlip = requestedFront > friction * grip * frontLoad ? clamp((requestedFront - friction * grip * frontLoad) / requestedFront, 0, 0.25) : 0;
        const rearWheelSlip = requestedRear > friction * grip * rearLoad ? clamp((requestedRear - friction * grip * rearLoad) / requestedRear, 0, 0.25) : 0;
        frontWheelSpeed = Math.max(0, velocity * (1 - frontWheelSlip) / wheelRadius + noise(step + 1));
        rearWheelSpeed = Math.max(0, velocity * (1 - rearWheelSlip) / wheelRadius + noise(step + 2));
        const imuAcceleration = acceleration + noise(step + 3);
        fusedSpeed = Math.max(0, fusedSpeed + imuAcceleration * dt);
        if (step % 100 === 0) {
            const positionNoise = noise(step + 1000, gpsNoise);
            gpsLatitude = 51.5074 + positionNoise / 111111;
            gpsLongitude = -0.1278 + (position + positionNoise) / 69400;
            gpsSpeed = Math.max(0, velocity + noise(step + 2000, gpsNoise) * 0.05);
            fusedSpeed = 0.85 * fusedSpeed + 0.15 * gpsSpeed;
        }
        if (step % sensorStep === 0 || sensors.length === 0) {
            sensors.push({
                frontWheelSpeed, rearWheelSpeed, longitudinalAcceleration: imuAcceleration,
                pitchRate: -Math.abs(acceleration) * 0.015 + noise(step + 7) * 0.1,
                yawRate: noise(step + 8) * 0.1, rollRate: noise(step + 6) * 0.1,
                gpsSpeed, gpsLatitude, gpsLongitude, gpsFix: true
            });
        }
    }
    const actualBrakeForce = actualFrontForce + actualRearForce;
    const deceleration = position > 0 ? (initialSpeed * initialSpeed) / (2 * position) : 0;
    reactionTime = Math.min(5, Math.max(0, Number(reactionTime) || 0));
    const reactionDistance = initialSpeed * reactionTime;
    const normalizedDogDistance = Math.min(200, Math.max(1, Number(dogDistance) || 25));
    const totalStoppingDistance = position + reactionDistance;
    const dogHit = dogEnabled && normalizedDogDistance <= totalStoppingDistance;
    const impactSpeedKmh = dogHit
        ? Math.max(0, initialSpeed - Math.max(0, normalizedDogDistance - reactionDistance) * deceleration)
        : 0;
    return { stoppingTime: time, stoppingDistance: position, totalStoppingDistance, reactionTime, reactionDistance, dogDistance: normalizedDogDistance, dogEnabled, dogHit, impactSpeedKmh, rearWheelLiftRequested: rearWheelLiftRequested && !absEnabled, rearWheelLiftPreventedByAbs: rearWheelLiftRequested && absEnabled, deceleration: -deceleration, actualBrakeForce, frontBrakeForce: actualFrontForce, rearBrakeForce: actualRearForce, frontLoad, rearLoad, rearWheelLift, effectiveMass, sensors, trajectory, absActive: absEnabled && absActive, fallen: leanAngle > leanLimit, leanLimit };
}

checkCloudflareConnection();

function updateMotorcycleWheels(wheelRadius) {
    const scale = wheelRadius / 0.31;
    const wheelGeometry = [
        [".rear-wheel-spin, .rear-disc, .rear-tone-ring", 48, 91],
        [".front-wheel-spin, .brake-disc:not(.rear-disc)", 190, 91]
    ];
    motorcycle.querySelectorAll(".wheel").forEach((wheel, index) => {
        wheel.setAttribute("r", String(24 * scale));
        wheel.style.transformBox = "view-box";
        wheel.style.transformOrigin = `${index === 0 ? 48 : 190}px 91px`;
        wheel.style.transform = "";
    });
    motorcycle.querySelectorAll(".hub").forEach((hub, index) => {
        hub.setAttribute("r", String(7 * scale));
        hub.style.transformBox = "view-box";
        hub.style.transformOrigin = `${index === 0 ? 48 : 190}px 91px`;
        hub.style.transform = "";
    });
    wheelGeometry.forEach(([selector, x, y]) => {
        motorcycle.querySelectorAll(selector).forEach((part) => {
            part.style.transformBox = "view-box";
            part.style.transformOrigin = `${x}px ${y}px`;
            part.dataset.wheelScale = scale;
        });
    });
}

function animateMotorcycle(initialSpeed, deceleration, stoppingTime, stoppingDistance, actualBrakeForce, sensors, sensorRate, payload, leanLimit, trajectory, rearWheelLift, dogHit, dogDistance, totalStoppingDistance) {
    status.textContent = "Braking...";
    status.className = "status-pill is-running";
    motorcycle.style.left = "20px";
    motorcycle.style.transform = "translateY(-50%)";
    const visualLean = Math.min(payload.leanAngle, 45) * 0.18;
    motorcycle.querySelector(".leaning-body").style.transform = `rotateZ(${visualLean}deg)`;
    updateMotorcycleWheels(payload.wheelRadius);
    motorcycle.classList.remove("is-fallen");
    motorcycle.classList.toggle("is-rear-lift", Boolean(rearWheelLift));
    motorcycle.classList.toggle("is-hazard", Boolean(dogHit));
    dog.classList.remove("is-hit", "is-dead", "is-safe");
    dog.classList.add(dogHit ? "is-dead" : "is-safe");
    dog.classList.add("is-jumping");
    window.setTimeout(() => dog.classList.remove("is-jumping"), 1150);
    motorcycle.classList.add("is-braking");
    motorcycle.classList.add("is-moving");
    brakeImpressions.classList.remove("is-visible");

    const startTime = performance.now();
    let wheelRotation = 0;
    let previousPosition = 0;

    function animationFrame(currentTime) {
        const elapsed = (currentTime - startTime) / 1000;
        const t = Math.min(elapsed, stoppingTime);

        if (payload.leanAngle > leanLimit && elapsed > Math.min(0.55, stoppingTime)) {
            motorcycle.classList.remove("is-braking", "is-moving");
            motorcycle.classList.add("is-fallen");
            status.textContent = "Fallen";
            status.className = "status-pill is-complete";
            return;
        }

        const sampleIndex = Math.min(Math.floor((t / stoppingTime) * (trajectory.length - 1)), trajectory.length - 1);
        const sample = trajectory[Math.max(0, sampleIndex)] || trajectory[trajectory.length - 1];
        const position = sample.position;
        const wheelRadius = Number(payload.wheelRadius) || 0.31;
        wheelRotation += Math.max(0, position - previousPosition) / wheelRadius;
        previousPosition = position;
        motorcycle.querySelectorAll(".wheel-spin").forEach((wheel) => {
            wheel.style.transform = `rotate(${wheelRotation}rad) scale(${wheel.dataset.wheelScale || 1})`;
        });

        const denom = initialSpeed * stoppingTime - 0.5 * deceleration * stoppingTime * stoppingTime;
        const normalizedPosition = denom > 0 ? position / denom : 0;

        const roadWidth = road.clientWidth;
        const motorcycleWidth = motorcycle.offsetWidth;
        const dogProgress = totalStoppingDistance > 0 ? dogDistance / totalStoppingDistance : 1;
        const dogX = 20 + dogProgress * (roadWidth - motorcycleWidth - 80);
        dog.style.left = `${Math.min(roadWidth - 58, Math.max(20, dogX))}px`;

        const x = 20 + normalizedPosition * (roadWidth - motorcycleWidth - 80);
        motorcycle.style.left = `${x}px`;
        if (dogHit && position + initialSpeed * payload.reactionTime >= dogDistance) {
            status.textContent = "Dog hit · hazards on";
            status.className = "status-pill is-complete is-danger";
        }
        telemetry.velocity.innerHTML = `${(Math.max(sample.velocity, 0) * 3.6).toFixed(1)} <small>km/h</small>`;
        telemetry.distance.innerHTML = `${Math.max(position, 0).toFixed(1)} <small>m</small>`;
        telemetry.time.innerHTML = `${t.toFixed(2)} <small>s</small>`;
        telemetry.force.innerHTML = `${actualBrakeForce.toFixed(0)} <small>N</small>`;
        const sensorIndex = Math.min(Math.floor(t * sensorRate), Math.max(sensors.length - 1, 0));
        updateSensorReadout(sensors[sensorIndex], sensorIndex, sensors.length);
        if (dogHit && position + initialSpeed * payload.reactionTime >= dogDistance) {
            status.textContent = "Dog hit · hazards on";
            status.className = "status-pill is-complete is-danger";
        }

        if (elapsed < stoppingTime) {
            requestAnimationFrame(animationFrame);
        } else {
            brakeImpressions.style.left = `${x + motorcycleWidth * 0.12}px`;
            brakeImpressions.classList.add("is-visible");
            motorcycle.classList.remove("is-braking");
            motorcycle.classList.remove("is-moving");
            status.textContent = dogHit ? "Dog hit · hazards on" : "Stopped";
            status.className = dogHit ? "status-pill is-complete is-danger" : "status-pill is-complete";
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

function drawGraph(initialSpeed, deceleration, stoppingTime, trajectory) {
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
            const sample = trajectory[Math.min(Math.floor(i / 100 * (trajectory.length - 1)), trajectory.length - 1)];
            const t = sample.time;
            const velocity = Math.max(sample.velocity, 0);
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
