🏍️ Motorcycle Braking Simulator 🖥️ 

A web-based vehicle braking simulator that calculates braking force, deceleration, stopping time, and stopping distance using a physics-based longitudinal braking model.



---

🌐 Live Demo

Web Application:
https://godwingeorge.github.io/Motorcycle-braking-simulator/


## Using the GUI

Open the live demo, or run the frontend locally from the repository root:

```bash
python3 -m http.server 8000 --directory web
```

Then open http://localhost:8000 in a browser.

1. Choose a preset: City Ride, Wet Road, or Track Day.
2. Adjust motorcycle mass, initial speed, road friction, and brake force if needed.
3. Select Run Simulation.
4. Watch the motorcycle, wheel motion, brake light, telemetry, stopping marks, and velocity graph update.
5. Review stopping time, distance, deceleration, and actual brake force in the result cards.

The GUI sends simulation requests to the deployed Cloudflare Worker. An internet connection is required when using the hosted API.


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

The simulator currently uses a simplified longitudinal braking model.

Maximum tyre-road braking force

The maximum available braking force is calculated using:

[
F_{max} = \mu m g
]

where:

- F_{max} = maximum available braking force
- \mu = coefficient of friction
- m = vehicle mass
- g = gravitational acceleration

The actual braking force is limited by the available tyre-road friction:

[
F_{actual} = \min(F_{brake}, F_{max})
]

Vehicle deceleration

Using Newton's second law:

[
a = \frac{F_{actual}}{m}
]

During braking, the acceleration is negative:

[
a = -\frac{F_{actual}}{m}
]

Stopping time

For constant deceleration:

[
t = \frac{v_0}{|a|}
]

Stopping distance

[
d = \frac{v_0^2}{2|a|}
]

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
