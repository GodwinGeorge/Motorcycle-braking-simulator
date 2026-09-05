The Study Lab - Motorcycle Braking Simulator

A web-based motorcycle braking study that explores braking force, deceleration, stopping time, stopping distance, reaction time, sensor telemetry, load transfer, lean angle, a dog obstacle, and a simplified dual-channel ABS controller.



---

🌐 Live Demo

Web Application:
https://godwingeorge.github.io/Motorcycle-braking-simulator/


## Using the GUI

Open the live demo:
1. Choose a road profile: City, Wet, or Track.
2. Enter the motorcycle mass, initial speed, road friction, and brake force manually. Presets are shortcuts and can be edited afterward.
3. Set the reaction time used to calculate the distance traveled before braking.
4. Set the dog distance to place the dog obstacle on the road.
5. Choose whether to request a rear-wheel lift. ABS prevents the request; manual braking only lifts the wheel when the front force reaches the physical threshold.
6. Select Run Simulation.
7. Watch the motorcycle, wheel motion, brake light, telemetry, stopping marks, dog state, and velocity graph update.
8. Review reaction distance, braking distance, total stopping distance, and the physical brake results.

The local GUI sends simulation requests to the local C++ API at `http://localhost:18080/simulate`. Start the `vehicle_simulator` executable before running the frontend. The hosted GUI uses the deployed API when available and falls back to the browser model, including sensor telemetry, when the API is unavailable.


## Publishing the GUI

The published webpage is served from the `gh-pages` branch. The published root contains copies of `web/index.html`, `web/scripts.js`, `web/style.css`, `web/cover.svg`, and `web/cover.png`. After changing these files, copy the updated assets to the root of `gh-pages`, commit, and push. GitHub Pages may take a short time to refresh.

Pushing to `master` runs `.github/workflows/deploy-cf.yml`, which publishes `workers/simulate/index.js` to Cloudflare Workers using the `CF_API_TOKEN` repository secret.

---

✨ Features

- C++ implementation using the Crow HTTP framework
- REST API interface
- Browser-based user interface
- Cloudflare Worker API implementation
- GitHub-based project and deployment workflow

---

🧠 Physics Model

The simulator uses a simplified motorcycle braking model for education and experimentation. It is not certified safety software and does not replace measured vehicle validation.

Motorcycle-specific study inputs include lean-angle grip reduction, forward load transfer, front/rear brake bias, wheel-speed signals, and optional independent ABS force limiting. The same `load-transfer-v1` equations are implemented in the C++ server, Cloudflare Worker, browser fallback, Python adapter, and serverless adapters. The ABS controller is intentionally simplified: it is not a production implementation and does not model hydraulic valves, pressure dynamics, tyre force curves, or a complete vehicle state estimator.

Maximum tyre-road braking force

The maximum available braking force first accounts for lean angle:

$$F_{grip} = \mu m g \max(0.05, \cos(\theta))$$

where:

- $F_{grip}$ = total available tyre-road braking force
- $\mu$ = coefficient of friction
- $m$ = vehicle mass
- $g$ = gravitational acceleration
- $\theta$ = lean angle

The requested brake force is split by front brake bias. Forward load transfer changes the axle loads, and each channel is limited by its available grip. In Dual ABS mode, wheel-speed slip feedback reduces a channel when its estimated slip exceeds the target range. Manual mode models reduced usable grip during wheel lock.

$$F_{front} \leq \mu N_{front}\max(0.05, \cos(\theta)), \qquad F_{rear} \leq \mu N_{rear}\max(0.05, \cos(\theta))$$

For each timestep, braking acceleration transfers load forward using the shared wheelbase $L=1.4$ m and centre-of-mass height $h$:

$$N_{front}=\frac{mg}{2}+\frac{m|a|h}{L}, \qquad N_{rear}=\max\left(0,\frac{mg}{2}-\frac{m|a|h}{L}\right)$$

When $N_{rear}=0$, the rear wheel is lifted and rear braking force is zero. The force and load equations are solved for eight short iterations at each timestep so brake bias and rear lift affect the actual deceleration.

Vehicle deceleration

Using Newton's second law at each simulation step:

$$a_k = -\frac{F_{front,k}+F_{rear,k}}{m}$$

The state is integrated with timestep $\Delta t$:

$$v_{k+1}=\max(0,v_k+a_k\Delta t)$$

$$x_{k+1}=x_k+v_k\Delta t+\frac{1}{2}a_k\Delta t^2$$

Stopping time

For a constant-deceleration special case only:

$$t = \frac{v_0}{|a|}$$

Stopping distance

$$d = \frac{v_0^2}{2|a|}$$

Reaction distance

Reaction distance is separate from the braking trajectory. The user-selected reaction time is clamped to 0-5 seconds and applied before braking begins:

$$d_{reaction}=v_0 t_{reaction}, \qquad d_{total}=d_{reaction}+d_{braking}$$

The default reaction time is 1 second. It affects only the reaction and total distances, not tyre load transfer or wheel lift during braking.

Dog collision check

The dog is placed at the user-selected distance. The model compares that distance with total stopping distance:

$$dogHit = dogDistance \leq d_{total}$$

If the dog is reached, the response reports `dogHit: true` and estimates the remaining impact speed after the reaction phase and braking distance traveled. The UI marks the dog as dead, turns on the motorcycle hazard lights, and displays a clear warning. If the dog is beyond the total stopping distance, it remains safe and no collision warning is shown. This is an educational obstacle check, not a safety system.

Track mode sets `dogEnabled: false`, so no dog is displayed or included in the collision calculation.

Rear-wheel lift

The `rearWheelLiftRequested` input represents a rider request to unload the rear wheel. With ABS enabled, the request is rejected and `rearWheelLiftPreventedByAbs` is true. With ABS disabled, rear braking is removed and the front force is tested against the lift threshold:

$$a_{lift}=\frac{gL}{2h}$$

The rear wheel lifts only when the transferred rear load reaches zero. The animation uses the calculated `rearWheelLift` result; it never shows a lift when physics did not produce one.

The displayed stopping distance and time come from the integrated trajectory, not from assuming constant acceleration. The fall check uses the modelled centre-of-mass height:

$$h_{CG}=0.62+(r-0.31), \qquad \theta_{limit}=\tan^{-1}\left(\frac{0.62}{h_{CG}}\right)$$

where $r$ is wheel radius. The model reports a fall when $\theta > \theta_{limit}$. This is an educational stability heuristic, not a complete motorcycle rollover model; it does not model wheelbase, steering, suspension, or lateral tyre-force sharing.

where:

- $v_0$ = initial velocity
- $a$ = braking deceleration
- $t$ = stopping time
- $d$ = stopping distance

---

🏗️ System Architecture

                    ┌─────────────────────┐
                    │      Web Browser    │
                    │                     │
                    │ HTML + CSS + JS     │
                    └──────────┬──────────┘
                               │
                               │ POST /simulate
                               ▼
                    ┌─────────────────────┐
                    │   Simulation API    │
                    │                     │
                    │ Cloudflare Worker   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Braking Model     │
                    │                     │
                    │ Friction            │
                    │ Brake Force         │
                    │ Deceleration        │
                    │ Stopping Distance   │
                    └─────────────────────┘

The repository also contains a C++ implementation using Crow, which can be used as a local backend.

The hosted frontend calls the Cloudflare Worker at:

`https://vehicle-braking-worker.godwin-veh-sim.workers.dev/simulate`

---

📁 Project Structure

Motorcycle-braking-simulator/
│
├── src/
│   ├── VehicleModel.cpp
│   └── vehicleModel.hpp
│
├── web/
│   ├── index.html
│   ├── scripts.js
│   ├── style.css
│   ├── cover.svg
│   └── cover.png
│
├── workers/
│   └── simulate/
│       └── index.js

├── api/
│   └── simulate.js

├── netlify/
│   └── functions/
│       └── simulate.js
│
├── CMakeLists.txt
├── README.md
└── ...

"src/"

Contains the motorcycle/braking physics implementation.

"src/main.cpp"

Implements the local HTTP server using Crow and exposes the simulation through a REST endpoint.

"web/"

Contains the browser-based frontend.

"workers/"

Contains the Cloudflare Worker implementation used for the hosted API.

"api/" and "netlify/functions/"

Contain compatible serverless adapters for deployments that use Vercel-style API routes or Netlify Functions. The production GitHub Pages GUI does not call these adapters; it calls the Cloudflare Worker directly.

---

🚀 Running Locally

1. Clone the repository

git clone https://github.com/GodwinGeorge/Motorcycle-braking-simulator.git

cd Motorcycle-braking-simulator

---

2. Build the C++ backend

The C++ backend uses:

- C++
- Crow
- Asio
- CMake

Configure and build the project using your installed C++ toolchain.

Example:

mkdir build
cd build

cmake ..
cmake --build .

Run the generated server executable.

The server exposes the simulation API through:

POST /simulate

---

🔌 API

"POST /simulate"

Calculates braking performance for the supplied vehicle parameters.

Request

{
  "mass": 200,
  "speed": 80,
  "friction": 0.8,
  "brakeForce": 5000,
  "sensorRate": 100,
  "sensorNoise": 0.02,
  "gpsNoise": 1.5,
  "wheelRadius": 0.31,
  "leanAngle": 0,
  "frontBrakeBias": 70,
  "reactionTime": 1,
  "dogDistance": 25,
  "dogEnabled": true,
  "rearWheelLiftRequested": false,
  "absEnabled": true
}

Response (core fields)

{
  "actualBrakeForce": 1569.6,
  "deceleration": -6.80,
  "stoppingDistance": 31.46,
  "stoppingTime": 2.84,
  "reactionTime": 1.0,
  "dogDistance": 25,
  "dogHit": true,
  "impactSpeedKmh": 76.9,
  "dogEnabled": true,
  "rearWheelLiftRequested": false,
  "rearWheelLiftPreventedByAbs": false,
  "reactionDistance": 22.22,
  "totalStoppingDistance": 53.68,
  "frontBrakeForce": 1340.9,
  "rearBrakeForce": 228.7,
  "rearWheelLift": false,
  "absActive": true,
  "leanLimit": 45.0,
  "fallen": false
}

The Cloudflare response includes `sensors` and `trajectory` arrays. The C++ response uses `sensors` and `data`. These recorded samples drive browser playback and the velocity graph.



🧪 Example

For the default motorcycle setup:

Mass                  = 200 kg
Initial speed         = 80 km/h
Friction coefficient  = 0.8
Brake force           = 5000 N

the simulator determines whether the requested braking force exceeds the available tyre-road friction and axle limits.

The permitted front and rear forces are integrated over time to calculate deceleration, stopping time, and stopping distance.

Wheel radius also changes braking inertia. The model assumes the two wheels together have $4\%$ of vehicle mass and keeps their reference rotational inertia at radius $0.31\,m$:

$$I_{ref}=2\left(\frac{1}{2}(0.02m)(0.31)^2\right), \qquad m_{eff}=m+\frac{2I_{ref}}{r^2}$$

The current unified braking acceleration uses $a=-(F_{front}+F_{rear})/m$. The reported effective-mass value is retained as a reference telemetry field; the shared force and load-transfer calculation uses vehicle mass consistently across the C++, Worker, and browser models.

---


👨‍💻 Author

Godwin George 


📜 License

This project is intended for learning, experimentation, and personal knowledge improvement.

See the repository license for usage and distribution terms.
