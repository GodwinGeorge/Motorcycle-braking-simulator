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
