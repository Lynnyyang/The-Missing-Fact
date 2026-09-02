export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function normal(rand: () => number, mu = 0, sd = 1) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** 两样本均值差与 95% 近似置信区间 */
export function diffMeans(a: number[], b: number[]) {
  const d = mean(a) - mean(b);
  const se = Math.sqrt(sd(a) ** 2 / Math.max(a.length, 1) + sd(b) ** 2 / Math.max(b.length, 1));
  return { diff: d, se, lo: d - 1.96 * se, hi: d + 1.96 * se, coversZero: d - 1.96 * se <= 0 && d + 1.96 * se >= 0 };
}

/** 双重差分四格 */
export function did(t0: number, t1: number, c0: number, c1: number) {
  const counterfactual = t0 + (c1 - c0);
  return {
    treatedChange: t1 - t0,
    controlChange: c1 - c0,
    counterfactual,
    att: t1 - counterfactual,
  };
}

/** 线性趋势外推 y = a + b*x */
export function fitLine(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return { a: ys[0] ?? 0, b: 0 };
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const y = ys[i] ?? 0;
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

export const rmse = (a: number[], b: number[]) =>
  Math.sqrt(mean(a.map((v, i) => (v - (b[i] ?? 0)) ** 2)));

/** 合成控制：非负权重、和为 1，投影梯度搜索拟合处理前轨迹 */
export function fitSynth(target: number[], donors: number[][], iters = 4000, step = 0.06) {
  const k = donors.length;
  if (!k) return { weights: [] as number[], rmse: 0 };
  let w = new Array(k).fill(1 / k);
  const path = () => target.map((_, t) => donors.reduce((s, d, j) => s + (w[j] ?? 0) * (d[t] ?? 0), 0));
  for (let it = 0; it < iters; it++) {
    const p = path();
    const grad = donors.map((d) => mean(p.map((v, t) => 2 * (v - (target[t] ?? 0)) * (d[t] ?? 0))));
    w = w.map((v, j) => v - step * (grad[j] ?? 0));
    // 投影到单纯形
    w = w.map((v) => Math.max(v, 0));
    const s = w.reduce((a, b) => a + b, 0);
    w = s > 0 ? w.map((v) => v / s) : new Array(k).fill(1 / k);
  }
  return { weights: w, rmse: rmse(path(), target) };
}

export const fmt = (x: number, d = 2) =>
  (Number.isFinite(x) ? x : 0).toLocaleString("zh-CN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
