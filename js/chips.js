/* ==========================================================
   chips.js — 사진 영역, 팔레트 칩, 복사, 스포이드
   - 칩 색 면을 누르면 스포이드: 사진을 눌러 그 칩 색을 바꾼다 (my pick)
   - HEX·RGB를 누르면 복사
   ========================================================== */

import { hexToRgb, rgbToHex, onColor } from './color.js';
import { icon } from './ui/icon.js';
import { toast } from './ui/toast.js';

const ROLE_ORDER_HINT = ['첫', '두', '세', '네', '다섯'];

let onPick = null;     /* (hex, index) => void */
let onUnpick = null;   /* (index) => void */
let pickingIndex = null;
let readonly = false;
let format = 'hex';      /* 칩 아래 표기: 'hex' | 'rgb' */
let lastRender = null;   /* 표기를 바꾸면 같은 색으로 다시 그리기 위해 */

/**
 * @param {object} handlers
 * @param {(hex: string, index: number) => void} handlers.onPick - 스포이드로 색을 골랐을 때
 * @param {(index: number) => void} handlers.onUnpick - my pick을 풀었을 때
 */
export function initChips(handlers) {
  onPick = handlers.onPick;
  onUnpick = handlers.onUnpick;

  const palette = document.getElementById('palette');

  palette.addEventListener('click', (e) => {
    const unpick = e.target.closest('.chip__pick');
    if (unpick) {
      e.stopPropagation();
      onUnpick?.(Number(unpick.closest('.chip').dataset.index));
      return;
    }
    const swatch = e.target.closest('.chip__swatch');
    if (swatch && !readonly) {
      const i = Number(swatch.closest('.chip').dataset.index);
      setPicking(pickingIndex === i ? null : i);
    }
  });

  /* HEX·RGB 복사는 칩과 색 역할 목록이 함께 쓴다 */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip__copy');
    if (btn) copyValue(btn);
  });

  initEyedropper();
}

/**
 * 팔레트 칩 그리기
 * @param {string[]} colors - 화면에 보일 5색 (대비 조절이 적용된 값)
 * @param {Set<number>} myPicks
 * @param {object} [opts]
 * @param {boolean} [opts.readonly] - 사진이 없어 스포이드를 쓸 수 없을 때
 */
export function renderPalette(colors, myPicks, { readonly: ro = false } = {}) {
  readonly = ro;
  const list = document.getElementById('palette');
  list.removeAttribute('data-loading');

  /* 칩 다섯 개는 처음 한 번만 만들고, 이후에는 색만 바꿔 차례로 바뀌는 모션이 보이게 한다 */
  lastRender = { colors, myPicks, readonly: ro };
  if (list.querySelectorAll('.chip__copy--value').length !== 5) {
    list.innerHTML = colors.map((_, i) => `
      <li class="chip" data-index="${i}" style="--i: ${i}">
        <button type="button" class="chip__swatch">${icon('pipette')}</button>
        <span class="chip__meta">
          <button type="button" class="chip__copy chip__copy--value"></button>
        </span>
      </li>`).join('');
  }

  [...list.children].forEach((li, i) => {
    const hex = colors[i];
    const [r, g, b] = hexToRgb(hex);
    const swatch = li.querySelector('.chip__swatch');
    li.style.setProperty('--c', hex);
    li.style.setProperty('--on-c', onColor(hex));
    swatch.disabled = readonly;
    swatch.setAttribute('aria-label', readonly
      ? `${ROLE_ORDER_HINT[i]} 번째 색 ${hex}`
      : `${ROLE_ORDER_HINT[i]} 번째 색 ${hex}. 누르고 사진을 눌러 색 바꾸기`);

    /* HEX는 한 줄, RGB는 세 숫자를 세로로 (좁은 칸에서도 잘리지 않게) */
    const btn = li.querySelector('.chip__copy--value');
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const value = format === 'rgb' ? rgb : hex;
    btn.dataset.format = format;
    btn.dataset.copy = value;
    btn.setAttribute('aria-label', `${value} 복사`);
    btn.innerHTML = format === 'rgb'
      ? `<span>${r}</span><span>${g}</span><span>${b}</span>`
      : hex;

    /* my pick 표시 */
    let pick = li.querySelector('.chip__pick');
    if (myPicks.has(i) && !pick) {
      li.insertAdjacentHTML('beforeend', `
        <button type="button" class="chip__pick" aria-label="my pick 풀기" data-tooltip="my pick 풀기">
          ${icon('pipette').replace('class="icon"', 'class="icon icon--pick"')}
          ${icon('x').replace('class="icon"', 'class="icon icon--x"')}
        </button>`);
    } else if (!myPicks.has(i) && pick) {
      pick.remove();
    }
  });

  if (readonly) setPicking(null);
}

/**
 * 칩 아래 색 표기 바꾸기
 * @param {'hex'|'rgb'} next
 */
export function setChipFormat(next) {
  format = next;
  if (lastRender) renderPalette(lastRender.colors, lastRender.myPicks, { readonly: lastRender.readonly });
}

/** 사진을 처리하는 동안 칩 자리에 빛이 지나가는 상태 */
export function showPaletteLoading() {
  const list = document.getElementById('palette');
  list.setAttribute('data-loading', '');
  if (list.children.length !== 5) {
    list.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<li class="chip" style="--i: ${i}"><span class="chip__swatch"></span></li>`).join('');
  }
}

/** 칩을 다시 그려야 할 때 (사진이 바뀌면 칩 구조를 새로) */
export function resetPalette() {
  document.getElementById('palette').innerHTML = '';
  setPicking(null);
}

/* ==========================================================
   사진 영역
   ========================================================== */

/**
 * 사진 그리기. null이면 "사진 없음" 안내
 * @param {HTMLImageElement|HTMLCanvasElement|null} img
 */
export function drawPhoto(img) {
  const canvas = document.getElementById('photo-canvas');
  const empty = document.getElementById('photo-empty');
  canvas.hidden = !img;
  empty.hidden = Boolean(img);
  if (!img) return;
  canvas.width = img.naturalWidth ?? img.width;
  canvas.height = img.naturalHeight ?? img.height;
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
}

/* ==========================================================
   스포이드
   ========================================================== */

function setPicking(index) {
  pickingIndex = index;
  const photo = document.getElementById('photo');
  const hint = document.getElementById('eyedropper-hint');

  document.querySelectorAll('#palette .chip').forEach((li) => {
    li.toggleAttribute('data-picking', Number(li.dataset.index) === index);
  });

  if (index === null) {
    photo.removeAttribute('data-eyedropper');
    hint.hidden = true;
    document.getElementById('eyedropper-loupe').hidden = true;
    return;
  }
  photo.setAttribute('data-eyedropper', '');
  hint.textContent = `사진을 눌러 ${ROLE_ORDER_HINT[index]} 번째 색을 바꿔요 · Esc 취소`;
  hint.hidden = false;
}

/** 스포이드 끄기 (Esc 등) — 켜져 있었으면 true */
export function cancelEyedropper() {
  if (pickingIndex === null) return false;
  setPicking(null);
  return true;
}

function initEyedropper() {
  const canvas = document.getElementById('photo-canvas');
  const loupe = document.getElementById('eyedropper-loupe');
  const photo = document.getElementById('photo');

  /* 화면 좌표 → 캔버스 픽셀 색 */
  const colorAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * canvas.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * canvas.height);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    const [cr, cg, cb] = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    return rgbToHex([cr, cg, cb]);
  };

  canvas.addEventListener('pointermove', (e) => {
    if (pickingIndex === null) return;
    const hex = colorAt(e);
    if (!hex) return;
    const pr = photo.getBoundingClientRect();
    loupe.hidden = false;
    loupe.style.setProperty('--c', hex);
    loupe.style.setProperty('--x', `${e.clientX - pr.left}px`);
    loupe.style.setProperty('--y', `${e.clientY - pr.top}px`);
  });

  canvas.addEventListener('pointerleave', () => { loupe.hidden = true; });

  canvas.addEventListener('click', (e) => {
    if (pickingIndex === null) return;
    const hex = colorAt(e);
    if (!hex) return;
    const index = pickingIndex;
    setPicking(null);
    onPick?.(hex, index);
  });
}

/* ==========================================================
   복사
   ========================================================== */

async function copyValue(btn) {
  const value = btn.dataset.copy;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* 클립보드 권한이 없는 환경: 임시 입력창으로 복사 */
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn.setAttribute('data-copied', '');
  setTimeout(() => btn.removeAttribute('data-copied'), 1200);
  toast(`${value} 복사했어요`, { tone: 'success' });
}
