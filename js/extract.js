/* ==========================================================
   extract.js — 사진에서 후보 색 뽑기 (v2)
   1. 사진을 긴 변 200px 격자로 평균 내어 픽셀을 읽는다 (축소를 직접 해서 어디서나 같은 결과)
   2. 픽셀을 OKLab(사람 눈 기준 색공간)으로 바꾼다
   3. k-means++로 비슷한 색끼리 16묶음으로 나눈다
   v1은 RGB 공간에서 무작위로 시작해 같은 사진도 매번 결과가 달랐다.
   v2는 사진 픽셀로 만든 시드를 써서 같은 사진이면 첫 결과가 항상 같다.
   사진은 브라우저 밖으로 보내지 않는다.
   ========================================================== */

import { rgbToOklab, oklabToOklch, oklabToHex, deltaE } from './oklab.js';

const SAMPLE_LONG_SIDE = 200;  /* 픽셀을 읽을 크기 (긴 변) */
const CANDIDATE_COUNT = 16;    /* 후보 색 수 */
const MAX_ITER = 24;           /* k-means 반복 상한 */
const MERGE_DE = 0.025;        /* 이보다 가까운 후보는 하나로 합친다 */

/**
 * @typedef {object} Candidate
 * @property {string} hex
 * @property {number[]} lab - [L, a, b]
 * @property {number[]} lch - [L, C, h]
 * @property {number} area - 사진에서 차지하는 비율 (0~1)
 */

/**
 * 사진에서 후보 색 뽑기
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {number} [attempt] - 0이면 사진마다 항상 같은 결과, 1 이상이면 다른 시작점(다시 뽑기)
 * @returns {Candidate[]} 면적이 큰 순
 */
export function extractCandidates(img, attempt = 0) {
  const { points, weights, seed } = samplePixels(img);
  const rng = mulberry32(seed + attempt * 7919);
  const clusters = kmeansPP(points, weights, CANDIDATE_COUNT, rng);
  return mergeClose(clusters).sort((a, b) => b.area - a.area);
}

/* ==========================================================
   1. 픽셀 읽기
   ========================================================== */

function samplePixels(img) {
  const w0 = img.naturalWidth ?? img.width;
  const h0 = img.naturalHeight ?? img.height;

  /* 브라우저의 drawImage 축소는 캔버스 종류(GPU/CPU)에 따라 결과가 조금씩 달라서
     같은 사진이 페이지마다 다른 색을 냈다. 그래서 원래 크기 그대로 그리고(축소 없음),
     줄이는 건 아래에서 직접 평균을 내어 한다 → 어디서 열어도 같은 결과 */
  const src = document.createElement('canvas');
  src.width = w0;
  src.height = h0;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const { data } = sctx.getImageData(0, 0, w0, h0);

  /* 긴 변 200px 격자로 칸마다 평균 */
  const scale = Math.min(1, SAMPLE_LONG_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const sum = new Float64Array(w * h * 4); /* r, g, b, 개수 */

  for (let y = 0; y < h0; y++) {
    const ty = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < w0; x++) {
      const i = (y * w0 + x) * 4;
      if (data[i + 3] < 128) continue; /* 투명한 픽셀은 버린다 */
      const t = (ty * w + Math.min(w - 1, Math.floor(x * scale))) * 4;
      sum[t] += data[i];
      sum[t + 1] += data[i + 1];
      sum[t + 2] += data[i + 2];
      sum[t + 3]++;
    }
  }

  const n = w * h;
  const points = new Float64Array(n * 3);
  const weights = new Float64Array(n);
  let count = 0;
  let hash = 2166136261; /* FNV-1a: 사진 픽셀로 시드를 만든다 */

  for (let t = 0; t < sum.length; t += 4) {
    const k = sum[t + 3];
    if (k === 0) continue;
    const r = Math.round(sum[t] / k);
    const g = Math.round(sum[t + 1] / k);
    const b = Math.round(sum[t + 2] / k);
    hash = Math.imul(hash ^ r, 16777619);
    hash = Math.imul(hash ^ g, 16777619);
    hash = Math.imul(hash ^ b, 16777619);

    const [L, A, B] = rgbToOklab([r, g, b]);
    points[count * 3] = L;
    points[count * 3 + 1] = A;
    points[count * 3 + 2] = B;
    /* 거의 흰색·검정(하늘 날림, 그림자)은 면적만 크고 분위기를 덜 말해 주므로 덜 센다 */
    weights[count] = L > 0.96 || L < 0.06 ? 0.35 : 1;
    count++;
  }

  return {
    points: points.subarray(0, count * 3),
    weights: weights.subarray(0, count),
    seed: hash >>> 0,
  };
}

/* ==========================================================
   2. k-means++ (가중치 포함)
   시작점을 서로 멀리 떨어진 곳에서 고르므로 작은 강조색도 놓치지 않는다
   ========================================================== */

function kmeansPP(points, weights, k, rng) {
  const n = weights.length;
  if (n === 0) return [];
  k = Math.min(k, n);

  const centers = [];
  const dist = new Float64Array(n).fill(Infinity);

  /* 첫 시작점: 면적(가중치)에 비례해 하나 */
  centers.push(pickWeighted(weights, rng, n, points));

  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = sq(points, i, c);
      if (d < dist[i]) dist[i] = d;
      total += dist[i] * weights[i];
    }
    if (total === 0) break;
    /* 다음 시작점: 이미 고른 점들과 먼 픽셀일수록 뽑힐 확률이 높다 */
    let r = rng() * total;
    let idx = n - 1;
    for (let i = 0; i < n; i++) {
      r -= dist[i] * weights[i];
      if (r <= 0) { idx = i; break; }
    }
    centers.push([points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]]);
  }

  const assign = new Int32Array(n);
  const sums = centers.map(() => [0, 0, 0, 0]);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    /* 각 픽셀을 가장 가까운 중심에 */
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const d = sq(points, i, centers[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      assign[i] = best;
    }
    /* 중심을 가중 평균으로 다시 */
    sums.forEach((s) => s.fill(0));
    for (let i = 0; i < n; i++) {
      const s = sums[assign[i]], w = weights[i];
      s[0] += points[i * 3] * w;
      s[1] += points[i * 3 + 1] * w;
      s[2] += points[i * 3 + 2] * w;
      s[3] += w;
    }
    let moved = 0;
    centers.forEach((c, j) => {
      const s = sums[j];
      if (s[3] === 0) return;
      const next = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      moved = Math.max(moved, deltaE(c, next));
      centers[j] = next;
    });
    if (moved < 0.002) break;
  }

  const totalW = sums.reduce((a, s) => a + s[3], 0) || 1;
  return centers
    .map((lab, j) => ({ lab, area: sums[j][3] / totalW }))
    .filter((c) => c.area > 0);
}

/** 가까운 후보끼리 합친다 (면적 가중 평균) */
function mergeClose(clusters) {
  const out = [];
  [...clusters].sort((a, b) => b.area - a.area).forEach((c) => {
    const near = out.find((o) => deltaE(o.lab, c.lab) < MERGE_DE);
    if (near) {
      const w = near.area + c.area;
      near.lab = near.lab.map((v, i) => (v * near.area + c.lab[i] * c.area) / w);
      near.area = w;
    } else {
      out.push({ lab: [...c.lab], area: c.area });
    }
  });
  return out.map((c) => ({
    lab: c.lab,
    lch: oklabToOklch(c.lab),
    hex: oklabToHex(c.lab),
    area: c.area,
  }));
}

/* ---------- 작은 도우미 ---------- */

function sq(points, i, c) {
  const dL = points[i * 3] - c[0];
  const dA = points[i * 3 + 1] - c[1];
  const dB = points[i * 3 + 2] - c[2];
  return dL * dL + dA * dA + dB * dB;
}

function pickWeighted(weights, rng, n, points) {
  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i];
  let r = rng() * total;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) { idx = i; break; }
  }
  return [points[idx * 3], points[idx * 3 + 1], points[idx * 3 + 2]];
}

/**
 * 시드로 만드는 난수 (같은 시드 → 같은 순서)
 * @param {number} seed
 * @returns {() => number} 0~1
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
