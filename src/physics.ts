/**
 * Rectangular barrier scattering states (ħ = 1).
 * Barrier: V(x) = V0 for 0 < x < L, else 0.
 * Incident amplitude A = 1 from the left.
 */

export type Params = {
  E: number
  V0: number
  L: number
  m: number
}

export type Complex = { re: number; im: number }

export type WaveSolution = {
  k: number
  kappa: number
  q: number
  regime: 'tunneling' | 'over-barrier' | 'resonant'
  B: Complex
  C: Complex
  D: Complex
  F: Complex
  T: number
  R: number
}

const EPS = 1e-8

export function c(re: number, im = 0): Complex {
  return { re, im }
}

export function cadd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

export function csub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im }
}

export function cmul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}

export function cdiv(a: Complex, b: Complex): Complex {
  const den = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / den,
    im: (a.im * b.re - a.re * b.im) / den,
  }
}

export function cscale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s }
}

export function cexp(theta: Complex): Complex {
  // exp(re + i im) = e^re (cos im + i sin im)
  const mag = Math.exp(theta.re)
  return { re: mag * Math.cos(theta.im), im: mag * Math.sin(theta.im) }
}

export function cabs2(a: Complex): number {
  return a.re * a.re + a.im * a.im
}

export function ceval(a: Complex): number {
  return Math.hypot(a.re, a.im)
}

/** Solve 4×4 complex linear system Ax = b via Gaussian elimination. */
function solve4(A: Complex[][], b: Complex[]): Complex[] {
  const n = 4
  const M: Complex[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let pivot = col
    let best = cabs2(M[col][col])
    for (let r = col + 1; r < n; r++) {
      const v = cabs2(M[r][col])
      if (v > best) {
        best = v
        pivot = r
      }
    }
    if (pivot !== col) {
      const tmp = M[col]
      M[col] = M[pivot]
      M[pivot] = tmp
    }

    const diag = M[col][col]
    for (let cIdx = col; cIdx <= n; cIdx++) {
      M[col][cIdx] = cdiv(M[col][cIdx], diag)
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col]
      for (let cIdx = col; cIdx <= n; cIdx++) {
        M[r][cIdx] = csub(M[r][cIdx], cmul(factor, M[col][cIdx]))
      }
    }
  }

  return M.map((row) => row[n])
}

export function solveBarrier(p: Params): WaveSolution {
  const { E, V0, L, m } = p
  const k = Math.sqrt(Math.max(2 * m * E, EPS))
  const delta = V0 - E

  // Near E ≈ V0 use a tiny offset to avoid singular κ/q → 0
  let regime: WaveSolution['regime']
  let kappa = 0
  let q = 0

  if (Math.abs(delta) < 1e-4) {
    regime = 'resonant'
    // Treat as slightly under-barrier for continuity of UI messaging
    kappa = Math.sqrt(Math.max(2 * m * Math.abs(delta), 1e-6))
    return solveUnderBarrier(k, kappa, L, regime)
  }

  if (E < V0) {
    regime = 'tunneling'
    kappa = Math.sqrt(2 * m * delta)
    return solveUnderBarrier(k, kappa, L, regime)
  }

  regime = 'over-barrier'
  q = Math.sqrt(2 * m * (E - V0))
  return solveOverBarrier(k, q, L, regime)
}

function solveUnderBarrier(
  k: number,
  kappa: number,
  L: number,
  regime: WaveSolution['regime'],
): WaveSolution {
  // Unknowns: B, C, D, F
  // ψ_I  = e^{ikx} + B e^{-ikx}
  // ψ_II = C e^{κx} + D e^{-κx}
  // ψ_III = F e^{ikx}
  const ik = c(0, k)
  const kap = c(kappa, 0)
  const mkap = c(-kappa, 0)

  const eKapL = cexp(c(kappa * L, 0))
  const eMKapL = cexp(c(-kappa * L, 0))
  const eIkL = cexp(c(0, k * L))

  // Row order: continuity ψ(0), ψ'(0), ψ(L), ψ'(L)
  // Columns: B, C, D, F
  const A: Complex[][] = [
    // 1 + B = C + D  →  B - C - D = -1
    [c(1), c(-1), c(-1), c(0)],
    // ik(1 - B) = κ(C - D)  →  -ik B - κ C + κ D = -ik
    [cscale(ik, -1), cscale(kap, -1), kap, c(0)],
    // C e^{κL} + D e^{-κL} = F e^{ikL}
    [c(0), eKapL, eMKapL, cscale(eIkL, -1)],
    // κ(C e^{κL} - D e^{-κL}) = ik F e^{ikL}
    [
      c(0),
      cmul(kap, eKapL),
      cmul(mkap, eMKapL),
      cscale(cmul(ik, eIkL), -1),
    ],
  ]

  const b: Complex[] = [c(-1), cscale(ik, -1), c(0), c(0)]
  const [B, C, D, F] = solve4(A, b)
  const T = cabs2(F)
  const R = cabs2(B)

  return { k, kappa, q: 0, regime, B, C, D, F, T, R }
}

function solveOverBarrier(
  k: number,
  q: number,
  L: number,
  regime: WaveSolution['regime'],
): WaveSolution {
  // ψ_II = C e^{iqx} + D e^{-iqx}
  const ik = c(0, k)
  const iq = c(0, q)
  const miq = c(0, -q)

  const eIqL = cexp(c(0, q * L))
  const eMIqL = cexp(c(0, -q * L))
  const eIkL = cexp(c(0, k * L))

  const A: Complex[][] = [
    // 1 + B = C + D
    [c(1), c(-1), c(-1), c(0)],
    // ik(1 - B) = iq(C - D) → -ik B - iq C + iq D = -ik
    [cscale(ik, -1), cscale(iq, -1), iq, c(0)],
    // C e^{iqL} + D e^{-iqL} - F e^{ikL} = 0
    [c(0), eIqL, eMIqL, cscale(eIkL, -1)],
    // iq(C e^{iqL} - D e^{-iqL}) - ik F e^{ikL} = 0
    [
      c(0),
      cmul(iq, eIqL),
      cmul(miq, eMIqL),
      cscale(cmul(ik, eIkL), -1),
    ],
  ]

  const b: Complex[] = [c(-1), cscale(ik, -1), c(0), c(0)]
  const [B, C, D, F] = solve4(A, b)
  const T = cabs2(F)
  const R = cabs2(B)

  return { k, kappa: 0, q, regime, B, C, D, F, T, R }
}

export function waveAt(
  x: number,
  sol: WaveSolution,
  p: Params,
  t = 0,
): Complex {
  const { k, kappa, q, B, C, D, F, regime } = sol
  const { L, E } = p
  // Global time phase e^{-iEt}
  const phase = cexp(c(0, -E * t))

  let psi: Complex
  if (x < 0) {
    const inc = cexp(c(0, k * x))
    const ref = cmul(B, cexp(c(0, -k * x)))
    psi = cadd(inc, ref)
  } else if (x <= L) {
    if (regime === 'over-barrier') {
      psi = cadd(cmul(C, cexp(c(0, q * x))), cmul(D, cexp(c(0, -q * x))))
    } else {
      psi = cadd(cmul(C, cexp(c(kappa * x, 0))), cmul(D, cexp(c(-kappa * x, 0))))
    }
  } else {
    psi = cmul(F, cexp(c(0, k * x)))
  }

  return cmul(psi, phase)
}

export function sampleWave(
  p: Params,
  sol: WaveSolution,
  xMin: number,
  xMax: number,
  n: number,
  t = 0,
): { x: number; re: number; im: number; dens: number }[] {
  const out = []
  for (let i = 0; i < n; i++) {
    const x = xMin + ((xMax - xMin) * i) / (n - 1)
    const psi = waveAt(x, sol, p, t)
    out.push({
      x,
      re: psi.re,
      im: psi.im,
      dens: cabs2(psi),
    })
  }
  return out
}
