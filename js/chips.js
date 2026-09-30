/* ==========================================================
   chips.js — 컬러칩 표시, 복사, 스포이드
   참고 이미지: docs/reference-colorchip.png
   ========================================================== */

import { hexToRgbString } from './color.js';
import { state, setState } from './state.js';

/* 스포이드 모드가 켜졌을 때 선택 대기 중인 칩 인덱스 */
let eyedropperTargetIdx = null;

/* 커서 색 링 DOM 요소 (initEyedropperOverlay에서 생성) */
let eyedropperRing = null;

/* 스포이드로 픽셀을 집었을 때 호출할 콜백 (main.js에서 등록) */
let onEyedropperPick = null;

/* my pick X 버튼을 눌렀을 때 호출할 콜백 (main.js에서 등록) */
let onMyPickRemove = null;

/**
 * 스포이드 콜백 등록
 * @param {(hex: string, chipIdx: number) => void} fn
 */
export function setOnEyedropperPick(fn) {
  onEyedropperPick = fn;
}

/**
 * my pick 해제 콜백 등록
 * @param {(chipIdx: number) => void} fn
 */
export function setOnMyPickRemove(fn) {
  onMyPickRemove = fn;
}

/**
 * 컬러칩 5개를 #chips-row 안에 그림
 * @param {string[]} palette - HEX 문자열 5개 배열
 * @param {Set<number>} myPicks - my pick 칩 인덱스 집합
 */
export function renderChips(palette, myPicks = new Set()) {
  const row = document.getElementById('chips-row');
  row.innerHTML = ''; /* 기존 칩 지우고 새로 그림 */

  palette.forEach((hex, i) => {
    const chip = buildChip(hex, i, myPicks.has(i));
    row.appendChild(chip);
  });

  /* 칩 섹션 표시 */
  document.getElementById('chips-section').hidden = false;
}

/* ---------- 내부 함수 ---------- */

/**
 * 칩 DOM 요소 생성
 * @param {string} hex
 * @param {number} idx - 0~4
 * @param {boolean} isMyPick
 * @returns {HTMLElement}
 */
function buildChip(hex, idx, isMyPick) {
  const rgb = hexToRgbString(hex);

  /* 칩 전체 래퍼 */
  const chip = document.createElement('div');
  chip.className = isMyPick ? 'color-chip is-mypick' : 'color-chip';
  chip.dataset.index = idx;

  /* ── 동그란 색 원 영역 ── */
  const swatchRow = document.createElement('div');
  swatchRow.className = 'chip-swatch-row';

  const swatch = document.createElement('div');
  swatch.className = 'chip-swatch';
  swatch.style.backgroundColor = hex;
  swatchRow.appendChild(swatch);

  /* my pick 뱃지 + 호버 시 나타나는 X 해제 버튼 */
  if (isMyPick) {
    const badge = document.createElement('span');
    badge.className = 'chip-mypick';
    badge.textContent = 'my pick';
    swatchRow.appendChild(badge);

    /* X 버튼: 호버 시 표시, 클릭하면 my pick 해제 후 어울리는 색으로 교체 */
    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip-mypick-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = 'my pick 해제 — 어울리는 색으로 교체됩니다';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); /* 칩 클릭(스포이드 활성화)과 충돌 방지 */
      onMyPickRemove?.(idx);
    });
    swatchRow.appendChild(removeBtn);
  }

  /* ── HEX 줄 ── */
  const hexRow = document.createElement('div');
  hexRow.className = 'chip-hex-row';

  const hexText = document.createElement('span');
  hexText.className = 'chip-hex';
  hexText.textContent = hex;
  hexText.title = '클릭하면 복사됩니다';
  hexText.addEventListener('click', () => copyAndFlash(hex, hexText));
  hexRow.appendChild(hexText);

  /* ── RGB 줄 ── */
  const rgbRow = document.createElement('div');
  rgbRow.className = 'chip-rgb-row';

  const rgbText = document.createElement('span');
  rgbText.className = 'chip-rgb';
  rgbText.textContent = rgb;
  rgbText.title = '클릭하면 복사됩니다';
  rgbText.addEventListener('click', () => copyAndFlash(rgb, rgbText));
  rgbRow.appendChild(rgbText);

  /* ── 칩 조립 ── */
  chip.appendChild(swatchRow);
  chip.appendChild(hexRow);
  chip.appendChild(rgbRow);

  /* ── 스포이드 모드: my pick 칩은 클릭해도 활성화 안 됨 ── */
  chip.addEventListener('click', (e) => {
    if (e.target === hexText || e.target === rgbText) return;
    if (isMyPick) return;   /* my pick 상태면 X 버튼으로 해제 후 픽 가능 */
    activateEyedropper(idx, chip);
  });

  return chip;
}

/**
 * 텍스트를 클립보드에 복사하고 "복사됨" 표시를 잠깐 보여줌
 * @param {string} text
 * @param {HTMLElement} el - 복사됨 뱃지를 붙일 요소
 */
function copyAndFlash(text, el) {
  navigator.clipboard.writeText(text).then(() => {
    /* 기존 뱃지 제거 후 새로 추가 */
    const old = el.parentElement.querySelector('.chip-copied');
    if (old) old.remove();

    const badge = document.createElement('span');
    badge.className = 'chip-copied';
    badge.textContent = '복사됨';
    el.parentElement.appendChild(badge);

    /* 1.5초 뒤 제거 (CSS 애니메이션과 타이밍 맞춤) */
    setTimeout(() => badge.remove(), 1500);
  }).catch(() => {
    /* Clipboard API가 안 되는 환경 대비 (드물지만) */
    fallbackCopy(text);
  });
}

/**
 * Clipboard API를 쓸 수 없을 때 사용하는 복사 방법
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/**
 * 스포이드 모드 활성화
 * - 해당 칩을 selected 상태로 표시
 * - 사진 캔버스 위에 클릭 오버레이를 활성화
 * @param {number} idx - 칩 인덱스
 * @param {HTMLElement} chipEl
 */
function activateEyedropper(idx, chipEl) {
  /* 이미 선택된 칩을 다시 누르면 스포이드 모드 해제 */
  if (eyedropperTargetIdx === idx) {
    deactivateEyedropper();
    return;
  }

  /* 기존 selected 상태 제거 */
  document.querySelectorAll('.color-chip.selected')
    .forEach((el) => el.classList.remove('selected'));

  eyedropperTargetIdx = idx;
  chipEl.classList.add('selected');

  /* 사진 캔버스 오버레이 표시 (클릭 이벤트 받기용) */
  const overlay = document.getElementById('eyedropper-overlay');
  if (overlay) overlay.hidden = false;

  /* 모든 칩에 eyedropper-mode 클래스 추가 (커서 변경) */
  document.querySelectorAll('.color-chip')
    .forEach((el) => el.classList.add('eyedropper-mode'));
}

/**
 * 스포이드 모드 해제
 */
export function deactivateEyedropper() {
  eyedropperTargetIdx = null;

  document.querySelectorAll('.color-chip.selected')
    .forEach((el) => el.classList.remove('selected'));
  document.querySelectorAll('.color-chip.eyedropper-mode')
    .forEach((el) => el.classList.remove('eyedropper-mode'));

  const overlay = document.getElementById('eyedropper-overlay');
  if (overlay) overlay.hidden = true;

  /* 색 링 숨김 */
  if (eyedropperRing) eyedropperRing.hidden = true;
}

/**
 * 뷰포트 좌표 → 캔버스 픽셀 색 읽기
 * 3×3 픽셀 평균을 내어 CSS 축소 렌더링과 실제 픽셀 간 오차를 줄임
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @returns {string|null} HEX 색 (#RRGGBB) 또는 null (캔버스 밖)
 */
function sampleColor(canvas, clientX, clientY) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = Math.round((clientX - rect.left) * scaleX);
  const cy = Math.round((clientY - rect.top)  * scaleY);

  if (cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) return null;

  /* 3×3 영역 샘플링 (경계 처리) */
  const ctx    = canvas.getContext('2d');
  const sx     = Math.max(0, cx - 1);
  const sy     = Math.max(0, cy - 1);
  const sw     = Math.min(3, canvas.width  - sx);
  const sh     = Math.min(3, canvas.height - sy);
  const { data } = ctx.getImageData(sx, sy, sw, sh);

  let R = 0, G = 0, B = 0;
  const n = sw * sh;
  for (let i = 0; i < n; i++) {
    R += data[i * 4];
    G += data[i * 4 + 1];
    B += data[i * 4 + 2];
  }
  return '#' + [Math.round(R / n), Math.round(G / n), Math.round(B / n)]
    .map((v) => v.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

/**
 * 스포이드 오버레이 초기화
 * - 마우스 이동 시 색 링 커서 표시
 * - 클릭 시 색 읽어 콜백 전달
 */
export function initEyedropperOverlay() {
  const overlay = document.getElementById('eyedropper-overlay');
  const canvas  = document.getElementById('image-canvas');

  /* 색 링 커서 DOM 생성 (body에 붙여 position:fixed로 자유롭게 이동) */
  eyedropperRing = document.createElement('div');
  eyedropperRing.className = 'eyedropper-ring';
  eyedropperRing.hidden = true;
  document.body.appendChild(eyedropperRing);

  /* 마우스 이동 → 링 위치·색 업데이트 */
  overlay.addEventListener('mousemove', (e) => {
    if (eyedropperTargetIdx === null) return;
    eyedropperRing.hidden = false;
    eyedropperRing.style.left = `${e.clientX}px`;
    eyedropperRing.style.top  = `${e.clientY}px`;

    const hex = sampleColor(canvas, e.clientX, e.clientY);
    if (hex) eyedropperRing.style.borderColor = hex;
  });

  /* 커서가 오버레이를 벗어나면 링 숨김 */
  overlay.addEventListener('mouseleave', () => {
    eyedropperRing.hidden = true;
  });

  /* 클릭 → 색 읽어 콜백 */
  overlay.addEventListener('click', (e) => {
    if (eyedropperTargetIdx === null) return;

    const hex = sampleColor(canvas, e.clientX, e.clientY);
    if (!hex) return;

    onEyedropperPick?.(hex, eyedropperTargetIdx);
    deactivateEyedropper();
  });
}
