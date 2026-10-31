/* ==========================================================
   oklab.js — sRGB ↔ OKLab ↔ OKLCH 변환, 색 차이(ΔE)
   OKLab은 사람 눈이 느끼는 밝기·색 차이에 가깝게 만든 색공간이다.
   RGB 거리로는 "비슷해 보이는 색"을 잘 못 고르기 때문에 v2에서 도입했다.
   참고: Björn Ottosson, "A perceptual color space for image processing" (2020)
   ========================================================== */

import { hexToRgb, rgbToHex } from './color.js';

/* ---------- sRGB 감마 ---------- */

/** sRGB 채널(0~1) → 선형 값 */
function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 선형 값 → sRGB 채널(0~1) */
function fromLinear(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/* ---------- RGB ↔ OKLab ---------- */

/**
 * [r, g, b] (0~255) → [L, a, b]  (L: 0~1, a·b: 대략 -0.4~0.4)
 * @param {number[]} rgb
 * @returns {number[]}
 */
export function rgbToOklab([r, g, b]) {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/**
 * [L, a, b] → [r, g, b] 선형이 아닌 sRGB 0~1 값 (범위 밖일 수 있음)
 */
function oklabToRgbUnclamped([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return [
    fromLinear(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

/** 화면에 표시할 수 있는 색(sRGB 범위 안)인지 */
function inGamut(rgb01) {
  return rgb01.every((c) => c >= -0.0005 && c <= 1.0005);
}

/**
 * [L, a, b] → [r, g, b] (0~255)
 * 화면에 표시할 수 없는 색이면 색조·밝기는 두고 채도만 줄여 범위 안으로 넣는다
 * (단순히 잘라내면 색조가 틀어지기 때문)
 */
export function oklabToRgb(lab) {
  let rgb = oklabToRgbUnclamped(lab);
  if (!inGamut(rgb)) {
    const [L, C, h] = oklabToOklch(lab);
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToRgbUnclamped(oklchToOklab([L, mid, h])))) lo = mid;
      else hi = mid;
    }
    rgb = oklabToRgbUnclamped(oklchToOklab([L, lo, h]));
  }
  return rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
}

/* ---------- OKLab ↔ OKLCH ---------- */

/**
 * [L, a, b] → [L, C, h]  (C: 채도 0~0.37, h: 색조 각도 0~360)
 */
export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

/** [L, C, h] → [L, a, b] */
export function oklchToOklab([L, C, h]) {
  const rad = (h * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/* ---------- HEX 편의 함수 ---------- */

export const hexToOklab = (hex) => rgbToOklab(hexToRgb(hex));
export const hexToOklch = (hex) => oklabToOklch(hexToOklab(hex));
export const oklabToHex = (lab) => rgbToHex(oklabToRgb(lab));
export const oklchToHex = (lch) => oklabToHex(oklchToOklab(lch));

/* ---------- 색 차이 ---------- */

/**
 * 두 OKLab 색 사이의 거리 (ΔE OK). 0.02 이하면 거의 같은 색, 0.08 이상이면 확실히 다른 색
 * @param {number[]} lab1
 * @param {number[]} lab2
 */
export function deltaE(lab1, lab2) {
  return Math.hypot(lab1[0] - lab2[0], lab1[1] - lab2[1], lab1[2] - lab2[2]);
}

/** 두 HEX 색의 ΔE */
export const deltaEHex = (h1, h2) => deltaE(hexToOklab(h1), hexToOklab(h2));

/**
 * 두 색조 각도의 차이 (0~180)
 */
export function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}
