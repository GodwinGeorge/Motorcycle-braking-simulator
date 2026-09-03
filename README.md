The Study Lab - Motorcycle Braking Simulator

A web-based motorcycle braking study that explores braking force, deceleration, stopping time, stopping distance, sensor telemetry, load transfer, lean angle, and a simplified dual-channel ABS controller.



---

🌐 Live Demo

Web Application:
https://godwingeorge.github.io/Motorcycle-braking-simulator/


## Using the GUI

Open the live demo:
1. Choose a road profile: City, Wet, or Track.
2. Adjust motorcycle mass, initial speed, road friction, and brake force.
3. Select Run Simulation.
4. Watch the motorcycle, wheel motion, brake light, telemetry, stopping marks, and velocity graph update.
5. Review stopping time, stopping distance, average deceleration, and actual brake force in the result cards.

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

Motorcycle-specific study inputs include lean-angle grip reduction, approximate forward load transfer, front/rear brake bias, wheel-speed signals, and optional independent ABS force limiting. The ABS controller is intentionally simplified: it is not a production implementation and does not model hydraulic valves, pressure dynamics, tyre force curves, or a complete vehicle state estimator.

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
  "absEnabled": true
}

Response (core fields)

{
  "actualBrakeForce": 1569.6,
  "deceleration": -6.80,
  "stoppingDistance": 31.46,
  "stoppingTime": 2.84,
  "absActive": true,
  "leanLimit": 45.0,
  "fallen": false,
  "frontBrakeForce": 973.15,
  "rearBrakeForce": 596.45
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

The braking acceleration uses $a=-(F_{front}+F_{rear})/m_{eff}$. This is a simplified wheel-inertia model; real wheel, tyre, and drivetrain inertia should be measured for a production model.

---


👨‍💻 Author
Godwin George 


📜 License

This project is intended for learning, experimentation, and personal knowledge improvement.

See the repository license for usage and distribution terms.
