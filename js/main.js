/* ==========================================================
   main.js — 앱 진입점 (v2)
   사진 → 후보 색 → 팔레트 5색 → 색 역할 → 화면 갱신 흐름을 잇는다
   ========================================================== */

import { state, setState, subscribe } from './state.js';
import { initUpload, setOnImage, makePreview, restoreImage } from './upload.js';
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
import { defaultBrand, brandTokens, applyBrandTokens, brandPrimary } from './brand.js';
import { renderBoard } from './board.js';
import { renderMockup, stepMockup, refitMockup } from './mockups.js';
import { openExportDialog } from './export-dialog.js';
import { saveCard, saveSession, loadSession } from './storage.js';
import { initDrawer, refreshDrawerCount, renderHomeSaved } from './drawer.js';
import { initPanel, renderPanel } from './panel.js';
import { paletteMood, rankFonts, loadFont, loadPreviews } from './fonts.js';
import { loadIconSet, ICON_SETS, ICON_WEIGHTS } from './icons.js';

const MAX_KEPT = 5;

/* 다 받아진 서체 (안 받아진 서체는 받는 동안 이전 서체를 그대로 보여 깜빡임을 막는다) */
const readyFonts = new Set(['pretendard']);
const loadingFonts = new Set();
let shownFonts = { display: 'pretendard', body: 'pretendard' };

/* 아이콘: "세트/굵기" → 받아 둔 SVG */
const iconMaps = new Map();
const loadingIcons = new Set();

let previewTimer = 0;

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

  setState({ brand: defaultBrand() });
  initPanel(handleBrandChange);
  initDrawer(handleCardLoad);

  /* 저장 */
  document.getElementById('btn-save').addEventListener('click', handleSave);

  /* 상태가 바뀔 때마다 저장 버튼 상태와 새로고침 복원용 임시 보관 */
  subscribe(() => {
    syncSaveButton();
    saveSession(sessionSnapshot());
  });
  window.addEventListener('pagehide', () => saveSession(sessionSnapshot(), true));

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
      if (v !== 'board') refitMockup(v);
    },
  });

  modeSeg = initSegmented(document.getElementById('preview-mode-seg'), {
    onChange: (v) => {
      /* 라이트·다크는 두 화면이 겹쳐 사라지듯(크로스페이드) 바뀐다 (지원하는 브라우저만) */
      const apply = () => {
        setState({ mode: v, isDirty: true });
        updateUI();
      };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(apply);
      } else {
        apply();
      }
    },
  });

  /* 내보내기: 지금 보고 있는 화면(모바일 웹·슬라이드)에 맞춘 프롬프트부터 */
  document.getElementById('btn-export').addEventListener('click', () => {
    openExportDialog(exportInput, state.canvasView === 'slides' ? 'slides' : 'mobile');
  });

  /* 로고 → 첫 화면 */
  document.getElementById('logo').addEventListener('click', (e) => {
    e.preventDefault();
    goHome();
  });

  window.addEventListener('popstate', handlePopState);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancelEyedropper();
    /* ←→: 모바일 웹·슬라이드 넘기기 (입력창·슬라이더·세그먼트 위에서는 그쪽이 쓴다) */
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.view === 'work'
        && state.canvasView !== 'board' && !document.querySelector('dialog[open]')
        && !e.target.closest('input, textarea, [role="radiogroup"], [role="listbox"], .select')) {
      e.preventDefault();
      stepMockup(state.canvasView, e.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  /* 새로고침 전에 하던 작업이 있으면 되살린다 */
  restoreSession();
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
      /* 새 사진이면 팔레트 칸이 바뀌므로 강조색 선택만 처음으로 (워드마크·서체 등은 그대로) */
      brand: { ...state.brand, accentIndex: null, accentLight: 0, accentChroma: 0 },
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
  document.getElementById('btn-export').disabled = false;

  /* VibePicker 자체가 지금 브랜드 강조색과 팔레트로 물든다 */
  applyPaletteTheme(rolesForMode(displayRoles, 'light'), brandPrimary(state.brand, displayRoles, displayPalette));
  paintLogo(displayPalette);

  renderBrand(displayRoles, displayPalette);
}

/* ==========================================================
   브랜드 — 보드와 설정 패널
   ========================================================== */

function renderBrand(displayRoles, displayPalette) {
  const { brand, mode } = state;

  /* 사진 분위기 → 서체 추천 */
  const mood = paletteMood(displayPalette);
  const displayRank = rankFonts(mood);
  const bodyRank = rankFonts(mood, { body: true });
  const autoFont = displayRank[0].font.id;

  /* 고른 서체가 아직 안 받아졌으면 받는 동안 이전 서체로 */
  const wantDisplay = brand.fontDisplay ?? autoFont;
  const wantBody = brand.fontBody;
  if (readyFonts.has(wantDisplay)) shownFonts.display = wantDisplay; else requestFont(wantDisplay);
  if (readyFonts.has(wantBody)) shownFonts.body = wantBody; else requestFont(wantBody);

  const tokens = brandTokens(
    { ...brand, fontDisplay: shownFonts.display, fontBody: shownFonts.body },
    displayRoles, displayPalette, mode, autoFont,
  );
  applyBrandTokens(document.getElementById('canvas-stage'), tokens);

  const icons = currentIcons(brand);
  renderBoard(document.getElementById('board-root'), { tokens, brand, palette: displayPalette, icons });
  renderMockup('mobile', document.getElementById('mobile-root'), { brand, icons });
  renderMockup('slides', document.getElementById('slides-root'), { brand, icons });

  const autoAccent = Math.max(0, displayPalette.indexOf(displayRoles.main));
  renderPanel(brand, { palette: displayPalette, autoAccent, primary: tokens.primary, displayRank, bodyRank, autoFont });

  /* 서체 목록 미리보기용 글자 (워드마크를 칠 때마다가 아니라 잠깐 멈췄을 때) */
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => loadPreviews(brand.wordmark || 'Planit'), 400);
}

function requestFont(id) {
  if (loadingFonts.has(id)) return;
  loadingFonts.add(id);
  loadFont(id).then(() => {
    readyFonts.add(id);
    loadingFonts.delete(id);
    if (state.roles) updateUI();
  });
}

/** 내보내기에 쓸 값: 라이트·다크 토큰을 화면과 같은 방식으로 계산 */
function exportInput() {
  const { brand, roles, palette, contrastOffset } = state;
  const displayRoles = applyContrastToRoles(roles, contrastOffset);
  const displayPalette = applyContrastToPalette(palette, roles, contrastOffset);
  const autoFont = rankFonts(paletteMood(displayPalette))[0].font.id;
  /* 내보내기는 받는 중인 서체가 아니라 사용자가 고른 서체 그대로 */
  const chosen = { ...brand, fontDisplay: brand.fontDisplay ?? autoFont };
  return {
    brand,
    light: brandTokens(chosen, displayRoles, displayPalette, 'light', autoFont),
    dark: brandTokens(chosen, displayRoles, displayPalette, 'dark', autoFont),
  };
}

/** 지금 설정의 아이콘 (아직 안 받아졌으면 받기 시작하고 null) */
function currentIcons(brand) {
  const key = `${brand.iconSet}/${ICON_SETS[brand.iconSet].stroke ? 'regular' : ICON_WEIGHTS[brand.iconWeight].phosphor}`;
  if (iconMaps.has(key)) return iconMaps.get(key);
  if (!loadingIcons.has(key)) {
    loadingIcons.add(key);
    loadIconSet(brand.iconSet, brand.iconWeight).then((map) => {
      iconMaps.set(key, map);
      loadingIcons.delete(key);
      if (state.roles) updateUI();
    });
  }
  return null;
}

/** 설정 패널에서 무언가 바뀌었을 때 */
function handleBrandChange(patch) {
  setState({ brand: { ...state.brand, ...patch }, isDirty: true });
  if (state.roles) updateUI();
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
   저장 · 서랍 · 새로고침 복원
   ========================================================== */

/** 서랍에 넣을 카드 (사진은 넣지 않는다) */
function cardSnapshot() {
  const { palette, myPicks, roles, contrastOffset, mode, paletteStyle, brand } = state;
  return { palette, myPicks: [...myPicks], roles, contrastOffset, mode, paletteStyle, brand };
}

let savedTimer = 0;

function handleSave() {
  if (!state.roles) return;
  const result = saveCard(cardSnapshot(), state.loadedCardKey);
  if (!result.ok) {
    toast(result.reason === 'full'
      ? '서랍이 가득 찼어요 (20개). 서랍에서 오래된 브랜드를 지운 뒤 저장해 주세요'
      : '브라우저 저장 공간이 부족해 저장하지 못했어요. 심볼 이미지를 빼고 다시 해 보세요', { icon: 'alert', duration: 3200 });
    return;
  }
  const overwrite = Boolean(state.loadedCardKey);
  setState({ loadedCardKey: result.key, isDirty: false });
  refreshDrawerCount();
  renderHomeSaved();

  /* 버튼이 잠깐 "저장됨"으로 */
  const btn = document.getElementById('btn-save');
  btn.dataset.state = 'done';
  btn.querySelector('use').setAttribute('href', btn.querySelector('use').getAttribute('href').replace('#bookmark', '#check'));
  btn.lastChild.textContent = '저장됨';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    delete btn.dataset.state;
    btn.querySelector('use').setAttribute('href', btn.querySelector('use').getAttribute('href').replace('#check', '#bookmark'));
    btn.lastChild.textContent = '저장';
  }, 1600);
  toast(overwrite ? '서랍의 브랜드를 고친 내용으로 바꿨어요' : '서랍에 저장했어요', { tone: 'success' });
}

/** 저장할 변경이 있을 때만 저장 버튼을 켠다 */
function syncSaveButton() {
  const btn = document.getElementById('btn-save');
  if (btn.dataset.state === 'done') return;
  btn.disabled = !(state.roles && state.isDirty);
}

/** 서랍(또는 첫 화면)에서 카드 불러오기 */
async function handleCardLoad(key, card) {
  if (state.view === 'work' && state.isDirty && key !== state.loadedCardKey) {
    const ok = await confirmDialog({
      title: '저장하지 않은 작업이 있어요',
      body: '불러오면 지금 화면의 팔레트와 브랜드 설정이 사라져요.',
      confirmText: '불러오기',
      cancelText: '계속 작업하기',
    });
    if (!ok) return;
  }
  cancelEyedropper();
  resetPalette();
  drawPhoto(null);
  setState({
    view: 'work',
    image: null,
    previewImage: null,
    candidates: [],
    attempt: 0,
    recentSignatures: [],
    palette: card.palette,
    myPicks: new Set(card.myPicks ?? []),
    roles: card.roles ?? assignRoles(card.palette),
    contrastOffset: card.contrastOffset ?? 0,
    mode: card.mode ?? 'light',
    paletteStyle: card.paletteStyle ?? 'natural',
    /* v1 카드에는 브랜드 설정이 없다 → 기본값 */
    brand: { ...defaultBrand(), ...(card.brand ?? {}) },
    paletteHistory: [],
    loadedCardKey: key,
    isDirty: false,
  });
  syncSegments();
  showView('work');
  updateUI();
  toast(card.brand ? `${card.brand.wordmark || '브랜드'}를 불러왔어요` : '실습 때 저장한 팔레트를 불러왔어요. 브랜드 설정은 기본값이에요', { icon: 'drawer' });
}

/** 새로고침 복원용 상태 (첫 화면이면 비운다) */
function sessionSnapshot() {
  if (state.view !== 'work' || !state.roles) return null;
  const s = state;
  return {
    ...cardSnapshot(),
    previewImage: s.image ? s.previewImage : null,
    candidates: s.candidates,
    attempt: s.attempt,
    recentSignatures: s.recentSignatures,
    paletteHistory: s.paletteHistory,
    loadedCardKey: s.loadedCardKey,
    isDirty: s.isDirty,
    canvasView: s.canvasView,
  };
}

async function restoreSession() {
  const saved = loadSession();
  if (!saved?.palette?.length || !saved.roles) {
    clearWorkHash();
    return;
  }
  const img = saved.previewImage ? await restoreImage(saved.previewImage) : null;
  drawPhoto(img);
  setState({
    view: 'work',
    image: img,
    previewImage: img ? saved.previewImage : null,
    candidates: img ? saved.candidates ?? [] : [],
    attempt: saved.attempt ?? 0,
    recentSignatures: saved.recentSignatures ?? [],
    palette: saved.palette,
    myPicks: new Set(saved.myPicks ?? []),
    roles: saved.roles,
    contrastOffset: saved.contrastOffset ?? 0,
    mode: saved.mode ?? 'light',
    paletteStyle: saved.paletteStyle ?? 'natural',
    brand: { ...defaultBrand(), ...(saved.brand ?? {}) },
    paletteHistory: saved.paletteHistory ?? [],
    loadedCardKey: saved.loadedCardKey ?? null,
    isDirty: Boolean(saved.isDirty),
    canvasView: saved.canvasView ?? 'board',
  });
  syncSegments();
  showView('work', { push: !isWorkHash() });
  showCanvasView(state.canvasView);
  updateUI();
  if (state.canvasView !== 'board') refitMockup(state.canvasView);
}

/** 세그먼트들을 상태에 맞춘다 (불러오기·복원 뒤) */
function syncSegments() {
  styleSeg.set(state.paletteStyle);
  modeSeg.set(state.mode);
  canvasSeg.set(state.canvasView);
  showCanvasView(state.canvasView);
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
  renderHomeSaved();
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
