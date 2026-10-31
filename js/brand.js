/* ==========================================================
   brand.js — 브랜드 설정 → 브랜드 토큰
   설정 패널의 값(강조색, 톤, 서체, 아이콘, 둥글기 …)과 팔레트 역할 색으로
   보드·목업·내보내기가 함께 쓰는 값(--b-*)을 계산한다.
   ========================================================== */

import { hexToOklch, oklchToHex, deltaEHex } from './oklab.js';
import { contrastRatio, onColor, liftForDark } from './color.js';
import { fontById, fontStack } from './fonts.js';
import { ICON_WEIGHTS } from './icons.js';

/** 둥글기 단계 (px) */
export const RADIUS_CARD = { none: 0, sm: 6, md: 12, lg: 20 };
export const RADIUS_CONTROL = { none: 0, sm: 4, md: 8, lg: 12, full: 999 };

/** 기본 설정 — 워드마크는 목업의 가상 서비스(팀 일정 관리) 이름 */
export function defaultBrand() {
  return {
    wordmark: 'Planit',
    symbol: null,            /* 올린 이미지(data URL). 없으면 모노그램 */
    accentIndex: null,       /* 팔레트에서 고른 칸. null이면 자동(메인 역할) */
    accentLight: 0,          /* 밝기 미세 조정 -20 ~ 20 */
    accentChroma: 0,         /* 채도 미세 조정 -20 ~ 20 */
    tone: 20,                /* 회색이 강조색 색조를 머금는 정도 0~100 */
    fontDisplay: null,       /* null이면 사진 분위기 추천 1순위 */
    fontBody: 'pretendard',
    iconSet: 'lucide',
    iconWeight: 'regular',
    radiusCard: 'md',
    radiusControl: 'lg',
  };
}

/**
 * 브랜드 토큰 계산
 * @param {object} brand - 설정
 * @param {object} roles - 대비 조절이 적용된 역할 색 { bg, text, main, point, sub, bgDark, textDark }
 * @param {string[]} palette - 대비 조절이 적용된 팔레트 5색
 * @param {'light'|'dark'} mode - 미리보기 모드
 * @param {string} autoFont - 서체를 고르지 않았을 때 쓸 추천 1순위 id
 */
export function brandTokens(brand, roles, palette, mode, autoFont) {
  const dark = mode === 'dark';

  /* ---------- 강조색 (Primary) ---------- */
  let primary = brandPrimary(brand, roles, palette);
  const [, C, h] = hexToOklch(primary);

  const bg = dark ? roles.bgDark : roles.bg;
  const text = dark ? roles.textDark : roles.text;
  if (dark) primary = liftForDark(primary, bg); /* 어두운 바탕에 묻히지 않게 */

  /* ---------- 바탕·면 ---------- */
  const [bgL, bgC, bgH] = hexToOklch(bg);
  const surface = oklchToHex(dark ? [bgL + 0.045, bgC, bgH] : [Math.min(1, bgL + 0.02), bgC * 0.5, bgH]);

  /* ---------- 회색 5단계 (톤만큼 강조색 색조를 머금는다) ---------- */
  const toneC = (brand.tone / 100) * 0.035;
  const grayL = [0.97, 0.86, 0.66, 0.44, 0.22];
  const grays = grayL.map((gl) => oklchToHex([gl, toneC * (gl > 0.9 ? 0.5 : 1), h]));

  /* 글자 옆 보조 글자와 경계선도 톤을 따른다 */
  const muted = oklchToHex(dark ? [0.72, toneC, h] : [0.5, toneC, h]);
  const border = oklchToHex(dark ? [bgL + 0.12, toneC * 0.8, h] : [Math.max(0, bgL - 0.09), toneC * 0.8, h]);

  /* ---------- Secondary: 강조색의 옅은 면 ---------- */
  const secondary = oklchToHex(dark ? [0.32, C * 0.45, h] : [0.94, Math.min(C * 0.35, 0.05), h]);
  const onSecondary = oklchToHex(dark ? [0.88, Math.min(C, 0.08), h] : [0.38, Math.min(C, 0.12), h]);

  /* ---------- 서체·아이콘·둥글기 ---------- */
  const display = fontById(brand.fontDisplay ?? autoFont);
  const body = fontById(brand.fontBody);

  const modeRoles = dark
    ? { point: liftForDark(roles.point, bg), sub: liftForDark(roles.sub, bg) }
    : { point: roles.point, sub: roles.sub };

  /* 심볼의 작은 점: 강조색과 가장 다른 역할 색 (같은 색이면 점이 사라진다) */
  const symbolDot = [modeRoles.point, modeRoles.sub, roles.main]
    .sort((a, b) => deltaEHex(b, primary) - deltaEHex(a, primary))[0];

  return {
    mode,
    primary,
    symbolDot,
    primaryFg: onColor(primary),
    primaryContrast: contrastRatio(primary, onColor(primary)),
    secondary,
    onSecondary,
    tertiary: text,
    point: modeRoles.point,
    sub: modeRoles.sub,
    bg,
    surface,
    text,
    muted,
    border,
    grays,
    fontDisplay: display,
    fontBody: body,
    radiusCard: RADIUS_CARD[brand.radiusCard],
    radiusControl: RADIUS_CONTROL[brand.radiusControl],
    iconStroke: ICON_WEIGHTS[brand.iconWeight].stroke,
  };
}

/**
 * 라이트 기준 강조색 (팔레트 칸 + 밝기·채도 미세 조정)
 * VibePicker UI의 강조색도 이 값을 따른다
 */
export function brandPrimary(brand, roles, palette) {
  const base = brand.accentIndex === null ? roles.main : palette[brand.accentIndex];
  let [L, C, h] = hexToOklch(base);
  L = clamp(L + brand.accentLight * 0.01, 0.15, 0.95);
  C = Math.max(0, C * (1 + brand.accentChroma / 25));
  return oklchToHex([L, C, h]);
}

/**
 * 토큰을 CSS 변수(--b-*)로 붙인다. 보드와 목업은 이 변수만 쓴다
 * @param {HTMLElement} el
 * @param {ReturnType<typeof brandTokens>} t
 */
export function applyBrandTokens(el, t) {
  const vars = {
    '--b-primary': t.primary,
    '--b-primary-fg': t.primaryFg,
    '--b-secondary': t.secondary,
    '--b-on-secondary': t.onSecondary,
    '--b-tertiary': t.tertiary,
    '--b-point': t.point,
    '--b-point-fg': onColor(t.point),
    '--b-sub-fg': onColor(t.sub),
    '--b-tertiary-fg': onColor(t.tertiary),
    '--b-symbol-dot': t.symbolDot,
    '--b-sub': t.sub,
    '--b-bg': t.bg,
    '--b-surface': t.surface,
    '--b-text': t.text,
    '--b-muted': t.muted,
    '--b-border': t.border,
    '--b-font-display': fontStack(t.fontDisplay),
    '--b-font-body': fontStack(t.fontBody),
    '--b-display-weight': t.fontDisplay.heading,
    '--b-radius-card': `${t.radiusCard}px`,
    '--b-radius-control': `${t.radiusControl}px`,
    '--b-icon-stroke': t.iconStroke,
  };
  t.grays.forEach((g, i) => { vars[`--b-gray-${i + 1}`] = g; });
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  el.dataset.brandMode = t.mode;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
