/* ==========================================================
   main.js — 앱 진입점 (v2)
   사진 → 후보 색 → 팔레트 5색 → 색 역할 → 화면 갱신 흐름을 잇는다
   ========================================================== */

import { state, setState } from './state.js';
import { initUpload, setOnImage, makePreview } from './upload.js';
import { extractCandidates } from './extract.js';
import { composePalette } from './palette.js';
import {
  assignRoles, shuffleRoles, readabilityWarning,
  applyContrastToRoles, applyContrastToPalette, rolesForMode,
} from './roles.js';
import {
  initChips, renderPalette, showPaletteLoading, resetPalette,
  drawPhoto, cancelEyedropper, setChipFormat,
} from './chips.js';
import { renderRoles, renderWarning, renderContrast, renderKept, setPhotoTools } from './rail.js';
import { showView, showCanvasView, isWorkHash, pushWorkHash, clearWorkHash } from './view.js';
import { icon } from './ui/icon.js';
import { initSegmented } from './ui/segmented.js';
import { confirmDialog } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { applyPaletteTheme, resetPaletteTheme, getUiMode, setUiMode } from './ui/theme.js';

const MAX_KEPT = 5;

let canvasSeg = null;
let modeSeg = null;
let styleSeg = null;

/* ==========================================================
   초기화
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(document);
  initUiModeButton();

  initUpload();
  setOnImage(handleImage);

  initChips({ onPick: handleEyedropperPick, onUnpick: handleUnpick });

  document.getElementById('btn-repick').addEventListener('click', handleRepick);
  document.getElementById('btn-keep').addEventListener('click', handleKeep);
  document.getElementById('btn-shuffle').addEventListener('click', handleShuffle);
  document.getElementById('btn-contrast-reset').addEventListener('click', () => setContrast(0));

  /* 대비 슬라이더: 끄는 동안 여러 번 불리므로 한 프레임에 한 번만 다시 그린다 */
  let frame = 0;
  document.getElementById('contrast-slider').addEventListener('input', (e) => {
    const offset = Number(e.target.value);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setContrast(offset));
  });

  /* 시안 불러오기·지우기 */
  document.getElementById('kept-list').addEventListener('click', (e) => {
    const remove = e.target.closest('[data-kept-remove]');
    if (remove) return handleKeptRemove(Number(remove.dataset.keptRemove));
    const load = e.target.closest('[data-kept]');
    if (load) handleKeptRestore(Number(load.dataset.kept));
  });

  initSegmented(document.getElementById('format-seg'), { onChange: setChipFormat });
  styleSeg = initSegmented(document.getElementById('style-seg'), { onChange: handleStyle });

  canvasSeg = initSegmented(document.getElementById('canvas-seg'), {
    onChange: (v) => {
      setState({ canvasView: v });
      showCanvasView(v);
    },
  });

  modeSeg = initSegmented(document.getElementById('preview-mode-seg'), {
    onChange: (v) => {
      setState({ mode: v, isDirty: true });
      updateUI();
    },
  });

  /* 로고 → 첫 화면 */
  document.getElementById('logo').addEventListener('click', (e) => {
    e.preventDefault();
    goHome();
  });

  window.addEventListener('popstate', handlePopState);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancelEyedropper();
  });

  /* 새로고침 복원은 13단계. 지금은 작업 주소로 열리면 첫 화면으로 정리 */
  clearWorkHash();
});

/* ==========================================================
   사진 → 팔레트
   ========================================================== */

function handleImage(img) {
  cancelEyedropper();
  resetPalette();
  drawPhoto(img);
  showPaletteLoading();
  showView('work');

  /* 칩 자리의 불러오는 표시가 먼저 그려지도록 한 프레임 쉰 뒤 색을 뽑는다 */
  requestAnimationFrame(() => setTimeout(() => {
    const candidates = extractCandidates(img, 0);
    const { colors: palette, signature } = composePalette(candidates, { style: state.paletteStyle });
    setState({
      view: 'work',
      image: img,
      previewImage: makePreview(img),
      candidates,
      attempt: 0,
      recentSignatures: [signature],
      palette,
      myPicks: new Set(),
      roles: assignRoles(palette),
      contrastOffset: 0,
      paletteHistory: [],
      loadedCardKey: null,
      isDirty: true,
    });
    updateUI();
  }, 0));
}

/* ==========================================================
   화면 갱신 — 색이 바뀔 때마다
   ========================================================== */

function updateUI() {
  const { palette, roles, myPicks, contrastOffset, mode, image } = state;
  if (!roles) return;

  const displayRoles = applyContrastToRoles(roles, contrastOffset);
  const displayPalette = applyContrastToPalette(palette, roles, contrastOffset);
  const modeRoles = rolesForMode(displayRoles, mode);

  renderPalette(displayPalette, myPicks, { readonly: !image });
  renderRoles(modeRoles, mode);
  renderWarning(readabilityWarning(modeRoles.text, modeRoles.bg));
  renderContrast(contrastOffset);
  renderKept(state.paletteHistory, currentKeptIndex());
  setPhotoTools(Boolean(image));
  styleSeg.setDisabled(!image);

  /* VibePicker 자체가 지금 팔레트로 물든다 */
  applyPaletteTheme(rolesForMode(displayRoles, 'light'));
  paintLogo(displayPalette);
}

/** 로고의 다섯 줄을 지금 팔레트 색으로 */
function paintLogo(colors) {
  const mark = document.querySelector('.logo__mark');
  colors.forEach((c, i) => mark.style.setProperty(`--p${i}`, c));
}

function clearLogo() {
  const mark = document.querySelector('.logo__mark');
  [0, 1, 2, 3, 4].forEach((i) => mark.style.removeProperty(`--p${i}`));
}

/* ==========================================================
   레일 버튼
   ========================================================== */

/** my pick 칩 위치 → 그 색 */
function fixedColors() {
  return new Map([...state.myPicks].map((i) => [i, state.palette[i]]));
}

/**
 * 다시 뽑기: 다른 시작점으로 후보를 새로 뽑고, 조화 점수 상위 조합 중 최근에 보지 않은 것
 * my pick은 같은 칸에 그대로 남는다
 */
function handleRepick() {
  const { image, paletteStyle, recentSignatures } = state;
  if (!image) return;

  const attempt = state.attempt + 1;
  const candidates = extractCandidates(image, attempt);
  const { colors, signature } = composePalette(candidates, {
    style: paletteStyle,
    attempt,
    fixed: fixedColors(),
    avoid: recentSignatures,
  });

  setState({
    candidates,
    attempt,
    recentSignatures: [...recentSignatures, signature].slice(-6),
    palette: colors,
    roles: assignRoles(colors),
    isDirty: true,
  });
  updateUI();
}

/** 팔레트 스타일 바꾸기: 같은 후보에서 그 스타일로 다시 고르고 다듬는다 */
function handleStyle(style) {
  setState({ paletteStyle: style });
  if (!state.image || !state.candidates.length) return;
  const { colors, signature } = composePalette(state.candidates, {
    style,
    attempt: state.attempt,
    fixed: fixedColors(),
  });
  setState({
    palette: colors,
    roles: assignRoles(colors),
    recentSignatures: [...state.recentSignatures, signature].slice(-6),
    isDirty: true,
  });
  updateUI();
}

/** 역할 섞기: 같은 5색 안에서 역할만 다시 */
function handleShuffle() {
  setState({ roles: shuffleRoles(state.palette), isDirty: true });
  updateUI();
}

function setContrast(offset) {
  if (offset === state.contrastOffset) return renderContrast(offset);
  setState({ contrastOffset: offset, isDirty: true });
  updateUI();
}

/* ---------- 스포이드 ---------- */

function handleEyedropperPick(hex, index) {
  const palette = [...state.palette];
  palette[index] = hex;
  const myPicks = new Set(state.myPicks).add(index);
  setState({ palette, myPicks, roles: assignRoles(palette), isDirty: true });
  updateUI();
  toast(`${index + 1}번째 색을 ${hex}로 바꿨어요`, { icon: 'pipette' });
}

function handleUnpick(index) {
  const myPicks = new Set(state.myPicks);
  myPicks.delete(index);
  setState({ myPicks, isDirty: true });
  updateUI();
}

/* ---------- 시안 ---------- */

function snapshot() {
  const { palette, myPicks, roles, contrastOffset, paletteStyle } = state;
  return { palette: [...palette], myPicks: [...myPicks], roles, contrastOffset, paletteStyle };
}

function currentKeptIndex() {
  const now = JSON.stringify(snapshot());
  return state.paletteHistory.findIndex((e) => JSON.stringify(e) === now);
}

function handleKeep() {
  if (!state.palette.length) return;
  if (currentKeptIndex() !== -1) return toast('이미 보관한 시안이에요');
  if (state.paletteHistory.length >= MAX_KEPT) {
    return toast(`시안은 ${MAX_KEPT}개까지 보관할 수 있어요. 하나를 지운 뒤 보관해 주세요`, { icon: 'info' });
  }
  setState({ paletteHistory: [...state.paletteHistory, snapshot()] });
  updateUI();
  toast('시안으로 보관했어요', { icon: 'bookmark' });
}

function handleKeptRestore(i) {
  const e = state.paletteHistory[i];
  if (!e) return;
  setState({
    palette: [...e.palette],
    myPicks: new Set(e.myPicks),
    roles: e.roles,
    contrastOffset: e.contrastOffset,
    paletteStyle: e.paletteStyle ?? 'natural',
    isDirty: true,
  });
  styleSeg.set(state.paletteStyle);
  updateUI();
}

function handleKeptRemove(i) {
  setState({ paletteHistory: state.paletteHistory.filter((_, j) => j !== i) });
  updateUI();
}

/* ==========================================================
   첫 화면으로
   ========================================================== */

async function confirmLeave() {
  if (!state.isDirty) return true;
  return confirmDialog({
    title: '처음 화면으로 갈까요?',
    body: '지금 만든 팔레트와 시안은 저장되지 않았어요.',
    confirmText: '처음 화면으로',
    cancelText: '계속 작업하기',
  });
}

async function goHome() {
  if (state.view !== 'work') return;
  if (!(await confirmLeave())) return;
  resetToHome();
}

/** 브라우저 뒤로 가기 */
async function handlePopState() {
  if (isWorkHash() || state.view !== 'work') return;
  if (!(await confirmLeave())) {
    pushWorkHash(); /* 취소: 빠져나온 기록을 다시 채운다 */
    return;
  }
  resetToHome();
}

function resetToHome() {
  cancelEyedropper();
  setState({
    view: 'home',
    image: null,
    previewImage: null,
    candidates: [],
    attempt: 0,
    recentSignatures: [],
    palette: [],
    myPicks: new Set(),
    roles: null,
    contrastOffset: 0,
    paletteHistory: [],
    loadedCardKey: null,
    isDirty: false,
  });
  resetPaletteTheme();
  clearLogo();
  showView('home');
  clearWorkHash();
  /* 새 화면이므로 이전 화면의 포커스(로고 링 등)를 지운다 */
  document.activeElement?.blur?.();
}

/* ==========================================================
   아이콘·화면 모드
   ========================================================== */

/** data-icon 속성을 실제 아이콘으로 채운다 */
function hydrateIcons(root) {
  root.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
  root.querySelectorAll('[data-icon-only]').forEach((el) => { el.innerHTML = icon(el.dataset.iconOnly); });
  root.querySelectorAll('[data-i]').forEach((el) => { el.outerHTML = icon(el.dataset.i); });
}

const UI_MODES = {
  system: { icon: 'contrast', label: '화면: 시스템 설정 따름' },
  light:  { icon: 'sun',      label: '화면: 라이트' },
  dark:   { icon: 'moon',     label: '화면: 다크' },
};
const NEXT_MODE = { system: 'light', light: 'dark', dark: 'system' };

function initUiModeButton() {
  const btn = document.getElementById('btn-ui-mode');
  const render = (mode) => {
    btn.innerHTML = icon(UI_MODES[mode].icon);
    btn.setAttribute('aria-label', `${UI_MODES[mode].label}. 눌러서 바꾸기`);
    btn.setAttribute('data-tooltip', UI_MODES[mode].label);
  };
  render(getUiMode());
  btn.addEventListener('click', () => {
    const next = NEXT_MODE[getUiMode()];
    setUiMode(next);
    render(next);
  });
}
