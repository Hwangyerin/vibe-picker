/* ==========================================================
   color.js — 색 변환·대비 계산·밝기 조절 유틸리티
   HEX ↔ RGB 변환, WCAG 명도 대비, 라이트·다크 배경 생성
   ========================================================== */

/* ---------- HEX / RGB 변환 ---------- */

/**
 * HEX 문자열 → [r, g, b] 배열
 * @param {string} hex - '#31AAA9' 또는 '31AAA9' 형태
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  /* 앞의 # 제거 */
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * [r, g, b] 배열 → HEX 문자열 (#RRGGBB, 대문자)
 * @param {[number, number, number]} rgb
 * @returns {string}
 */
export function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n)))
    .toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * HEX 문자열 → 'rgb(r, g, b)' 표시 문자열
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgbString(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ---------- WCAG 명도 대비 ---------- */

/**
 * 한 채널(0~255)의 선형 값 계산 (WCAG 2.1)
 * @param {number} c - 0~255
 * @returns {number}
 */
function linearize(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * HEX 색의 상대 휘도(0~1) 계산 (WCAG 2.1)
 * @param {string} hex
 * @returns {number}
 */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * 두 색 사이의 WCAG 명도 대비 비율 (1~21)
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 대비가 WCAG AA 기준(4.5:1 일반 텍스트)을 통과하는지 확인
 * @param {string} fg - 글자색 HEX
 * @param {string} bg - 배경색 HEX
 * @returns {boolean}
 */
export function isReadable(fg, bg) {
  return contrastRatio(fg, bg) >= 4.5;
}

/* ---------- 밝기 조절 ---------- */

/**
 * HEX 색의 HSL을 구해 명도(L)만 조절한 뒤 HEX로 반환
 * @param {string} hex
 * @param {number} amount - 명도 증감량 (-100~100)
 * @returns {string}
 */
export function adjustLightness(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  /* RGB → HSL */
  const [h, s, l] = rgbToHsl(r, g, b);
  /* 명도 클램프 (0~100) */
  const newL = Math.max(0, Math.min(100, l + amount));
  /* HSL → RGB → HEX */
  return rgbToHex(hslToRgb(h, s, newL));
}

/* ---------- HSL 변환 헬퍼 ---------- */

/**
 * RGB(0~255) → HSL(h: 0~360, s: 0~100, l: 0~100)
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * HSL(h: 0~360, s: 0~100, l: 0~100) → [r, g, b] (0~255)
 */
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

/* ---------- 라이트·다크 배경 생성 ---------- */

/**
 * 팔레트 메인 색의 색조를 살짝 머금은 라이트 배경색 생성
 * - 순수 흰색 대신 메인 색의 채도를 낮추고 명도를 높임
 * @param {string} mainHex - 메인 색 HEX
 * @returns {string} 배경 HEX
 */
export function makeLightBg(mainHex) {
  const [r, g, b] = hexToRgb(mainHex);
  const [h, , ] = rgbToHsl(r, g, b);
  /* 채도 5%, 명도 97% → 색조를 살짝만 남긴 거의 흰 색 */
  return rgbToHex(hslToRgb(h, 5, 97));
}

/**
 * 팔레트 메인 색의 색조를 머금은 다크 배경색 생성
 * - 순수 검정 대신 메인 색조가 남은 어두운 색
 * @param {string} mainHex - 메인 색 HEX
 * @returns {string} 배경 HEX
 */
export function makeDarkBg(mainHex) {
  const [r, g, b] = hexToRgb(mainHex);
  const [h, , ] = rgbToHsl(r, g, b);
  /* 채도 15%, 명도 10% → 색조가 남은 짙은 색 */
  return rgbToHex(hslToRgb(h, 15, 10));
}

/**
 * 두 색 중 더 밝은 쪽(명도 기준)을 반환
 * @param {string} hex1
 * @param {string} hex2
 * @returns {string}
 */
export function lighter(hex1, hex2) {
  return luminance(hex1) >= luminance(hex2) ? hex1 : hex2;
}

/**
 * 두 색 중 더 어두운 쪽을 반환
 * @param {string} hex1
 * @param {string} hex2
 * @returns {string}
 */
export function darker(hex1, hex2) {
  return luminance(hex1) < luminance(hex2) ? hex1 : hex2;
}
