/* ==========================================================
   theme.js — 사진에 물드는 UI
   지금 팔레트에서 VibePicker 자체의 강조색과 중립색 색조를 정한다.
   - 강조색: 브랜드 메인 색에서 출발해, 흰 글자와 대비 4.5:1 이상이 되도록 밝기만 내린다
   - 중립색: 강조색의 색조를 아주 살짝 머금는다 (--tint-h, --tint-c)
   - 화면 모드(라이트·다크·시스템)도 여기서 관리한다
   ========================================================== */

import { contrastRatio } from '../color.js';
import { hexToOklch, oklchToHex, hueDistance } from '../oklab.js';

const root = document.documentElement;

/* 위험색(--danger)의 색조. 강조색이 이 근처면 주요 버튼과 지우기 버튼이 같아 보인다 */
const DANGER_HUE = 27;

/* 강조색이 되려면 이 정도 채도는 있어야 한다 (이보다 낮으면 회색에 가까움) */
const MIN_ACCENT_CHROMA = 0.04;

const WHITE = '#FFFFFF';

/**
 * 팔레트·역할로 UI 색을 바꾼다
 * @param {{ main: string, point: string, sub: string }} roles - 지금 화면에 쓰이는 라이트 역할 색
 * @param {string} [primary] - 사용자가 고른 브랜드 강조색 (있으면 이 색을 따른다)
 */
export function applyPaletteTheme(roles, primary) {
  if (!roles) return resetPaletteTheme();

  /* 1. 강조색: 브랜드 Primary. 회색에 가까우면 메인 → 포인트 → 보조 중 채도가 충분한 첫 색 */
  const source = [primary, roles.main, roles.point, roles.sub]
    .filter(Boolean)
    .find((hex) => hexToOklch(hex)[1] >= MIN_ACCENT_CHROMA) ?? primary ?? roles.main;

  const accent = readableAccent(source);
  const [, C, h] = hexToOklch(accent);

  /* 2. 중립색 색조: 채도가 높은 사진일수록 조금 더 물들지만 0.013을 넘지 않는다 */
  const tintC = Math.min(0.013, 0.004 + Math.min(C, 0.15) * 0.06);

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-fg', WHITE);
  root.style.setProperty('--tint-h', h.toFixed(1));
  root.style.setProperty('--tint-c', (C < 0.02 ? 0.004 : tintC).toFixed(4));

  /* 3. 강조색이 빨강 계열이면 지우기 버튼을 다른 모양으로 (components.css) */
  const nearDanger = C > 0.08 && hueDistance(h, DANGER_HUE) < 30;
  root.toggleAttribute('data-accent-near-danger', nearDanger);
}

/** 사진이 없는 첫 화면: 기본 색으로 */
export function resetPaletteTheme() {
  ['--accent', '--accent-fg', '--tint-h', '--tint-c'].forEach((p) => root.style.removeProperty(p));
  root.removeAttribute('data-accent-near-danger');
}

/**
 * 흰 글자를 올려도 읽히는(4.5:1) 강조색
 * 색조·채도는 그대로 두고 밝기(L)만 조금씩 내린다
 * @param {string} hex
 * @returns {string}
 */
export function readableAccent(hex) {
  let [L, C, h] = hexToOklch(hex);
  let out = hex;
  for (let i = 0; i < 40 && contrastRatio(out, WHITE) < 4.5; i++) {
    L -= 0.01;
    out = oklchToHex([L, C, h]);
  }
  return out;
}

/* ==========================================================
   화면 모드: 'system' | 'light' | 'dark'
   사용자가 고른 값은 이 브라우저에만 기억한다
   ========================================================== */

const MODE_KEY = 'vibepicker:ui-mode';

export function getUiMode() {
  try {
    return localStorage.getItem(MODE_KEY) ?? 'system';
  } catch {
    return 'system';
  }
}

export function setUiMode(mode) {
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* 저장이 막힌 브라우저에서도 화면은 바뀐다 */
  }
}

/** 지금 실제로 보이는 모드 (시스템 설정 반영) */
export function resolvedUiMode() {
  const mode = getUiMode();
  if (mode !== 'system') return mode;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
