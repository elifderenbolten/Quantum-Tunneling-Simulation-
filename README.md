# Quantum Tunneling Simulation

Interactive browser demo of **quantum tunneling through a finite square barrier**, aimed at a 2nd-year physics student.

The 3D scene (Three.js) shows a stationary scattering state for a rectangular barrier of height \(V_0\) and width \(L\):

- **Blue** — incident + reflected region (\(x < 0\))
- **Amber** — barrier interior (\(0 < x < L\)); exponential decay when \(E < V_0\)
- **Green** — transmitted region (\(x > L\))

Surface height is the probability density \(|\psi|^2\). The white ribbon is \(\mathrm{Re}(\psi)\) evolving with the global phase \(e^{-iEt/\hbar}\). Yellow markers at the barrier faces are the classical turning points when \(E < V_0\).

Units use \(\hbar = 1\). Numerics are teaching-grade analytical matching at the interfaces — not a research solver.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Build

```bash
npm run build
npm run preview
```

## Controls

| Slider | Effect |
| --- | --- |
| Energy \(E\) | Incident particle energy |
| Barrier height \(V_0\) | Potential of the rectangular barrier |
| Barrier width \(L\) | Thickness of the classically forbidden region |
| Mass \(m\) | Particle mass (enters \(k=\sqrt{2mE}\), \(\kappa=\sqrt{2m(V_0-E)}\)) |

Drag to orbit the camera; scroll to zoom. Watch transmission \(T\) rise as you raise \(E\), lower \(V_0\), or thin the barrier.

## Stack

- Vite + TypeScript
- Three.js (WebGL) with orbit controls
