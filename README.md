Vehicle Braking Simulator
=========================

Quick setup and run instructions

1) Build & run (C++ executable)

```bash
cmake -S . -B build
cmake --build build --parallel
./build/vehicle_simulator
```

2) Python tooling (pandas / matplotlib)

This repository uses Python for plotting or data analysis. The system Python is "externally managed" on some systems, so to install `pandas` and `matplotlib` without sudo we recommend using Miniforge (local install).

- Install Miniforge (local, no sudo):

```bash
curl -fsSL -o /tmp/Miniforge3.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh
bash /tmp/Miniforge3.sh -b -p $HOME/.miniforge
export PATH="$HOME/.miniforge/bin:$PATH"
```

- Create and activate the environment with `pandas` and `matplotlib`:

```bash
conda create -n venv python=3.11 pandas matplotlib -y
conda activate venv
python -c "import pandas, matplotlib; print('OK')"
```

Alternate (system packages, requires sudo):

```bash
# sudo apt update
# sudo apt install -y python3-pip python3-venv
# python3 -m venv .venv
# . .venv/bin/activate
# python -m pip install --upgrade pip setuptools wheel
# python -m pip install pandas matplotlib
```

3) Notes

- The C++ project is configured with CMake and uses C++17.
- If you prefer to install Python packages system-wide, use your distro package manager (e.g. `sudo apt install python3-pandas python3-matplotlib`).

---

Deployment and CI
-----------------

This repository includes additional files to help deploy the C++ backend as a containerized service:

- `Dockerfile` — multi-stage build that compiles the C++ `cpp_server` and copies the `web/` static files into the image.
- `.github/workflows/ci.yml` — GitHub Actions workflow that builds the Docker image and pushes it to GitHub Container Registry (GHCR).
- `fly.toml` — sample Fly.io configuration for deploying the image (replace `OWNER` in the image reference before use).

Recommended hosted runtime (free + scalable): Fly.io. It supports deploying Docker images, provides persistent public endpoints, and has a free tier suitable for small services.

Quick deploy notes

1. Create a GitHub repository and push this project (I'll help if you want).  
2. Optionally enable GitHub Pages to host the static UI (`web/`) for quick testing — it will be read-only and cannot run the C++ server.  
3. Configure the GitHub Actions `ci.yml` to run on pushes to `main`/`master` — the workflow will publish the built image to `ghcr.io/OWNER/REPO:latest`.  
4. Create a Fly.io app and set the `image` field in `fly.toml` to the GHCR image. Use `flyctl deploy` or configure a GitHub Action to deploy using `FLY_API_TOKEN` as a secret.

Deploy using `flyctl` (manual):

```bash
# install flyctl, then:
flyctl apps create vehicle-braking-simulator
# update fly.toml or use flyctl deploy with an image
flyctl deploy --image ghcr.io/OWNER/vehicle-braking-simulator:latest
```

Notes about GitHub Pages vs backend

- GitHub Pages, Netlify, Vercel: free and excellent for serving the frontend only. They cannot run your C++ backend.  
- To make the web UI interact with the C++ backend, either host the backend on the same origin (recommended) or configure CORS on the backend and call it from the frontend origin.

