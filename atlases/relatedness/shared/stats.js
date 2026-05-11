// atlases/relatedness/shared/stats.js
// =============================================================================
// Statistical primitives shared by the Inversions (transmission test on each
// candidate) and Mendelian (dyad / triad / cohort tests) pages.
// Extracted from legacy Relatedness_atlas.js §9 (lines 2004-2065).
//
//   logChoose(n, k)              — log(C(n,k)); Stirling-ish accumulation
//   binomialPValueTwoSided(k,n,p)— exact two-sided binomial P-value
//   chiSquarePValue(x, df)       — chi-square upper-tail via Wilson-Hilferty
//   expectedOffspringPrior(p1,p2)— probability vector [P(0/0),P(0/1),P(1/1)]
//                                  for the cross p1 × p2; returns null if
//                                  either parent karyotype is missing/NA
// =============================================================================

export function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

export function binomialPValueTwoSided(k, n, p) {
  if (n === 0) return 1.0;
  function pmf(j) {
    return Math.exp(logChoose(n, j) + j * Math.log(p) + (n - j) * Math.log(1 - p));
  }
  const p_obs = pmf(k);
  let pval = 0;
  for (let j = 0; j <= n; j++) {
    const pj = pmf(j);
    if (pj <= p_obs + 1e-12) pval += pj;
  }
  return Math.min(1.0, pval);
}

export function chiSquarePValue(x, df) {
  if (x <= 0) return 1.0;
  if (df <= 0) return NaN;
  const t = Math.cbrt(x / df) - (1 - 2 / (9 * df));
  const z = t / Math.sqrt(2 / (9 * df));
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p_ = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const xz = Math.abs(z) / Math.SQRT2;
  const t_ = 1 / (1 + p_ * xz);
  const y = 1 - (((((a5 * t_ + a4) * t_) + a3) * t_ + a2) * t_ + a1) * t_ * Math.exp(-xz * xz);
  const phi = 0.5 * (1 + sign * y);
  return Math.max(0, Math.min(1, 1 - phi));
}

export function expectedOffspringPrior(p1, p2) {
  if (!p1 || !p2 || p1 === 'NA' || p2 === 'NA') return null;
  const a = p1.split('/').map(Number);
  const b = p2.split('/').map(Number);
  const probs = [0, 0, 0];
  for (const a1 of a) for (const b1 of b) {
    const sum = a1 + b1;
    probs[sum] += 0.25;
  }
  return probs;
}
