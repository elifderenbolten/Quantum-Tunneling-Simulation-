import './style.css'
import { solveBarrier, type Params } from './physics'
import { TunnelScene } from './scene'

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node as T
}

const eSlider = el<HTMLInputElement>('e-slider')
const vSlider = el<HTMLInputElement>('v-slider')
const lSlider = el<HTMLInputElement>('l-slider')
const mSlider = el<HTMLInputElement>('m-slider')

const eOut = el<HTMLOutputElement>('e-out')
const vOut = el<HTMLOutputElement>('v-out')
const lOut = el<HTMLOutputElement>('l-out')
const mOut = el<HTMLOutputElement>('m-out')

const tValue = el<HTMLElement>('t-value')
const rValue = el<HTMLElement>('r-value')
const tBar = el<HTMLElement>('t-bar')
const rBar = el<HTMLElement>('r-bar')

const regimeBanner = el<HTMLElement>('regime-banner')
const regimeLabel = el<HTMLElement>('regime-label')
const regimeText = el<HTMLElement>('regime-text')
const hudMode = el<HTMLElement>('hud-mode')

function readParams(): Params {
  return {
    E: Number(eSlider.value),
    V0: Number(vSlider.value),
    L: Number(lSlider.value),
    m: Number(mSlider.value),
  }
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits)
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(Math.max(p, 0), 1.05)
}

function updateUI(params: Params) {
  eOut.textContent = fmt(params.E)
  vOut.textContent = fmt(params.V0)
  lOut.textContent = fmt(params.L)
  mOut.textContent = fmt(params.m)

  const sol = solveBarrier(params)

  // Normalize mild numerical drift so R+T ~ 1 for display
  let T = clampProb(sol.T)
  let R = clampProb(sol.R)
  const sum = T + R
  if (sum > 1e-6) {
    T /= sum
    R /= sum
  }

  tValue.textContent = fmt(T, 3)
  rValue.textContent = fmt(R, 3)
  tBar.style.width = `${(T * 100).toFixed(1)}%`
  rBar.style.width = `${(R * 100).toFixed(1)}%`

  if (sol.regime === 'tunneling' || sol.regime === 'resonant') {
    regimeBanner.classList.remove('over')
    regimeLabel.textContent = sol.regime === 'resonant' ? 'Near E ≈ V₀' : 'Tunneling'
    regimeText.textContent =
      sol.regime === 'resonant'
        ? 'Energy sits near the barrier top. Transmission rises quickly as E approaches V₀ — watch the exponential region shrink.'
        : `E < V₀: classically the particle reflects with certainty. Quantum mechanics allows an exponentially decaying amplitude inside the barrier and a transmitted wave beyond it (T ≈ ${fmt(T, 3)}).`
    hudMode.textContent = 'E < V₀ · tunneling'
  } else {
    regimeBanner.classList.add('over')
    regimeLabel.textContent = 'Over-barrier'
    regimeText.textContent = `E > V₀: the particle can pass classically, but quantum reflection still occurs (R ≈ ${fmt(R, 3)}). Inside the barrier the wave oscillates with wave number q = √[2m(E−V₀)].`
    hudMode.textContent = 'E > V₀ · over-barrier'
  }

  return { params, sol }
}

const canvas = el<HTMLCanvasElement>('c')
const initial = updateUI(readParams())
const scene = new TunnelScene(canvas, initial.params, initial.sol)
scene.updatePhysics(initial.params, initial.sol)

function onChange() {
  const { params, sol } = updateUI(readParams())
  scene.updatePhysics(params, sol)
}

for (const slider of [eSlider, vSlider, lSlider, mSlider]) {
  slider.addEventListener('input', onChange)
}

function frame() {
  scene.render()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
