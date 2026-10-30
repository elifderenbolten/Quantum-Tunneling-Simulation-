/**
 * Quick sanity checks for rectangular-barrier matching (teaching numerics).
 * Run: node scripts/check-physics.mjs
 */

function c(re, im = 0) {
  return { re, im }
}
function cadd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im }
}
function csub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im }
}
function cmul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}
function cdiv(a, b) {
  const den = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / den,
    im: (a.im * b.re - a.re * b.im) / den,
  }
}
function cscale(a, s) {
  return { re: a.re * s, im: a.im * s }
}
function cexp(theta) {
  const mag = Math.exp(theta.re)
  return { re: mag * Math.cos(theta.im), im: mag * Math.sin(theta.im) }
}
function cabs2(a) {
  return a.re * a.re + a.im * a.im
}

function solve4(A, b) {
  const n = 4
  const M = A.map((row, i) => [...row, b[i]])
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
    for (let cIdx = col; cIdx <= n; cIdx++) M[col][cIdx] = cdiv(M[col][cIdx], diag)
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

function solveUnder(k, kappa, L) {
  const ik = c(0, k)
  const kap = c(kappa, 0)
  const mkap = c(-kappa, 0)
  const eKapL = cexp(c(kappa * L, 0))
  const eMKapL = cexp(c(-kappa * L, 0))
  const eIkL = cexp(c(0, k * L))
  const A = [
    [c(1), c(-1), c(-1), c(0)],
    [cscale(ik, -1), cscale(kap, -1), kap, c(0)],
    [c(0), eKapL, eMKapL, cscale(eIkL, -1)],
    [c(0), cmul(kap, eKapL), cmul(mkap, eMKapL), cscale(cmul(ik, eIkL), -1)],
  ]
  const b = [c(-1), cscale(ik, -1), c(0), c(0)]
  const [B, , , F] = solve4(A, b)
  return { T: cabs2(F), R: cabs2(B) }
}

function solveOver(k, q, L) {
  const ik = c(0, k)
  const iq = c(0, q)
  const miq = c(0, -q)
  const eIqL = cexp(c(0, q * L))
  const eMIqL = cexp(c(0, -q * L))
  const eIkL = cexp(c(0, k * L))
  const A = [
    [c(1), c(-1), c(-1), c(0)],
    [cscale(ik, -1), cscale(iq, -1), iq, c(0)],
    [c(0), eIqL, eMIqL, cscale(eIkL, -1)],
    [c(0), cmul(iq, eIqL), cmul(miq, eMIqL), cscale(cmul(ik, eIkL), -1)],
  ]
  const b = [c(-1), cscale(ik, -1), c(0), c(0)]
  const [B, , , F] = solve4(A, b)
  return { T: cabs2(F), R: cabs2(B) }
}

function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) process.exitCode = 1
}

// Thick under-barrier → T ~ 0, R ~ 1
{
  const m = 1,
    E = 1,
    V0 = 8,
    L = 4
  const k = Math.sqrt(2 * m * E)
  const kappa = Math.sqrt(2 * m * (V0 - E))
  const { T, R } = solveUnder(k, kappa, L)
  check(`thick barrier T≈0 (T=${T.toFixed(4)})`, T < 0.05)
  check(`thick barrier R≈1 (R=${R.toFixed(4)})`, Math.abs(R - 1) < 0.05)
  check(`thick barrier R+T≈1`, Math.abs(R + T - 1) < 0.02)
}

// Thin / low under-barrier → larger T
{
  const m = 1,
    E = 4,
    V0 = 5,
    L = 0.5
  const k = Math.sqrt(2 * m * E)
  const kappa = Math.sqrt(2 * m * (V0 - E))
  const thick = solveUnder(k, kappa, 3)
  const thin = solveUnder(k, kappa, L)
  check(`thinner barrier transmits more (${thin.T.toFixed(3)} > ${thick.T.toFixed(3)})`, thin.T > thick.T)
  check(`thin barrier R+T≈1`, Math.abs(thin.R + thin.T - 1) < 0.02)
}

// Over-barrier unitarity
{
  const m = 1,
    E = 8,
    V0 = 3,
    L = 2
  const k = Math.sqrt(2 * m * E)
  const q = Math.sqrt(2 * m * (E - V0))
  const { T, R } = solveOver(k, q, L)
  check(`over-barrier R+T≈1 (T=${T.toFixed(3)}, R=${R.toFixed(3)})`, Math.abs(R + T - 1) < 0.02)
  check(`over-barrier T > 0.5`, T > 0.5)
}

console.log('done')
