🏍️ Motorcycle Braking Simulator 🖥️ 

A web-based motorcycle braking study that explores braking force, deceleration, stopping time, stopping distance, sensor telemetry, load transfer, lean angle, and a simplified dual-channel ABS controller.



---

🌐 Live Demo

Web Application:
https://godwingeorge.github.io/Motorcycle-braking-simulator/


## Using the GUI

Open the live demo, 
1. Choose Motorcycle mode: City Ride, Wet Road, or Track Day.
2. Adjust motorcycle mass, initial speed, road friction, and brake force.
3. Select Run Simulation.
4. Watch the motorcycle, wheel motion, brake light, telemetry, stopping marks, and velocity graph update.
5. Review stopping time, distance, deceleration, and actual brake force in the result cards.

The local GUI sends simulation requests to the local C++ API at `http://localhost:18080/simulate`. Start the `vehicle_simulator` executable before running the frontend. The hosted GUI uses the deployed API when available and falls back to the browser model, including sensor telemetry, when the API is unavailable.


## Publishing the GUI

The published webpage is served from the `gh-pages` branch. After changing files in `web/`, copy the updated `web/index.html`, `web/scripts.js`, and `web/style.css` to the root of that branch, commit, and push it. GitHub Pages may take a short time to refresh after the push.

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
- m = vehicle mass
- g = gravitational acceleration
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

[
t = \frac{v_0}{|a|}
]

Stopping distance

[
d = \frac{v_0^2}{2|a|}
]

The displayed stopping distance and time come from the integrated trajectory, not from assuming constant acceleration. The fall check uses the modelled centre-of-mass height:

$$h_{CG}=0.62+(r-0.31), \qquad \theta_{limit}=\tan^{-1}\left(\frac{0.62}{h_{CG}}\right)$$

where $r$ is wheel radius. The model reports a fall when $\theta > \theta_{limit}$. This is an educational stability heuristic, not a complete motorcycle rollover model; it does not model wheelbase, steering, suspension, or lateral tyre-force sharing.

where:

- v_0 = initial velocity
- a = braking deceleration
- t = stopping time
- d = stopping distance

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

---

📁 Project Structure

Motorcycle-braking-simulator/
│
├── src/
│   ├── VehicleModel.cpp
│   └── VehicleModel.h
│
├── web/
│   ├── index.html
│   ├── scripts.js
│   └── style.css
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
├── cpp_server.cpp
├── CMakeLists.txt
├── README.md
└── ...

"src/"

Contains the motorcycle/braking physics implementation.

"cpp_server.cpp"

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
  "mass": 1500,
  "initialSpeed": 100,
  "frictionCoefficient": 0.7,
  "brakeForce": 10000
}

Response

{
  "actualBrakeForce": 10000,
  "deceleration": -6.6666666667,
  "stoppingDistance": 57.8703703704,
  "stoppingTime": 4.1666666667
}



🧪 Example

For a vehicle with:

Mass                  = 1500 kg
Initial speed         = 100 km/h
Friction coefficient  = 0.7
Brake force           = 10000 N

the simulator determines whether the requested braking force exceeds the available tyre-road friction.

The final braking force is then used to calculate the vehicle's deceleration and stopping performance.

---


👨‍💻 Author

Godwin George


📜 License

This project is intended for learning, experimentation, and personal knowledge improvemens.

See the repository license for usage and distribution terms.
