Vehicle Braking Simulator
=========================

This project uses a C++ backend (`cpp_server`) to perform vehicle braking simulations and a static frontend under `web/`.

Key points
- Backend: C++ (`cpp_server`) built with CMake and using the bundled `Crow` headers for a small HTTP server.
- Frontend: static files in `web/` (HTML, CSS, JS). The frontend prefers the Cloudflare Worker endpoint but will fall back to a local C++ server if necessary.
- No Python is required to run the application.

Fast local run (recommended for development)
-------------------------------------------
Build and run the C++ server which serves the `web/` UI and exposes the `/simulate` API on port 18080:

```bash
mkdir -p build
cd build
cmake ..
cmake --build . --parallel
./cpp_server
```

Then open the UI in your browser:

- Visit: http://localhost:18080/

Cloud deployment (Cloudflare Worker)
-----------------------------------
We also publish a Cloudflare Worker that provides the `/simulate` API at:

https://vehicle-braking-worker.godwin-veh-sim.workers.dev/simulate

The frontend on `gh-pages` is configured to try the Cloudflare Worker first and fall back to `http://localhost:18080/simulate` if the worker is unreachable.

Publishing frontend
-------------------
The `web/` folder is deployed to `gh-pages` (GitHub Pages) for static hosting. The static site uses the worker-first fetch logic so the live site should call the Cloudflare Worker.

CI and repository notes
-----------------------
- There's a `Dockerfile` and CI workflows for containerized builds if you prefer to deploy the C++ server as a container.
- The repository includes a `Crow` submodule reference in `.gitmodules` (used for header files); CI no longer errors on missing submodule URLs.

If anything here is out-of-date or you want the frontend to always use only the Cloudflare Worker (no local fallback), tell me and I'll update `web/scripts.js` and redeploy the static site.

Contact / Next steps
--------------------
Tell me whether you want:
- the frontend to be cloud-only (remove local fallback), or
- the workflow updated to deploy the C++ server container automatically.
I'll make the requested change and push it.
Notes about GitHub Pages vs backend
- GitHub Pages, Netlify, Vercel: free and excellent for serving the frontend only. They cannot run your C++ backend.  
- To make the web UI interact with the C++ backend, either host the backend on the same origin (recommended) or configure CORS on the backend and call it from the frontend origin.
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

Free hosted backend options (no billing)
-------------------------------------

If you don't want to add billing to Fly.io or create a Cloudflare account, you can use free serverless platforms for the backend:

- Vercel: connect this GitHub repo and the `/api/simulate` endpoint will be available under `https://<your-deployment>.vercel.app/api/simulate`.
- Netlify: connect this repo and the Netlify Function at `/netlify/functions/simulate` will be available; Netlify also supports deploys from GitHub for free.

I've added the following files to this repo so you can deploy immediately without extra code changes:

- `api/simulate.js` — Vercel serverless function (POST `/api/simulate`).
- `netlify/functions/simulate.js` — Netlify Function (POST `/netlify/functions/simulate`).

To deploy on Vercel (recommended):

1. Go to https://vercel.com and sign in with your GitHub account.
2. Import the repository `GodwinGeorge/vehicle-braking-simulator` and deploy the `main` branch.
3. After deployment, the simulate endpoint will be at: `https://<your-app>.vercel.app/api/simulate`.

To deploy on Netlify:

1. Go to https://app.netlify.com and sign in with GitHub.
2. Create a new site from Git and choose this repository.
3. The Netlify Functions endpoint will be available at `https://<your-site>.netlify.app/.netlify/functions/simulate`.

Update the frontend to call the appropriate URL (or keep using the worker URL if you used Cloudflare). The frontend included in `web/scripts.js` posts to `http://localhost:18080/simulate` by default — change that to the deployed function URL to use the hosted backend.

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

