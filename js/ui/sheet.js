/* ==========================================================
   sheet.js — 바텀 시트 (640px 이하에서 패널 대신)
   손잡이·제목 줄을 끌어 내리면 닫힌다. Esc, 배경 누르기로도 닫힌다
   ========================================================== */

import { icon } from './icon.js';
import { afterAnimation } from './dialog.js';

/* 이 거리(px)보다 많이, 또는 이 속도(px/ms)보다 빠르게 내리면 닫는다 */
const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 0.5;

/**
 * 시트 열기. content는 원래 자리에서 시트로 옮겨졌다가, 닫히면 제자리로 돌아간다
 * @param {object} opts
 * @param {string} opts.title
 * @param {HTMLElement} opts.content
 * @param {() => void} [opts.onClose]
 * @returns {{ close: () => void }}
 */
export function openSheet({ title, content, onClose }) {
  const returnFocus = document.activeElement;

  /* content가 있던 자리를 표시해 두고 닫을 때 돌려놓는다 */
  const marker = document.createComment('sheet-content');
  content.parentNode?.insertBefore(marker, content);

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.innerHTML = `
    <div class="sheet__handle" aria-hidden="true"></div>
    <header class="sheet__header">
      <h2 class="sheet__title"></h2>
      <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="닫기">${icon('x')}</button>
    </header>
    <div class="sheet__body"></div>`;
  sheet.querySelector('.sheet__title').textContent = title;
  sheet.querySelector('.sheet__body').appendChild(content);

  document.body.append(backdrop, sheet);
  document.body.style.overflow = 'hidden';
  afterAnimation(sheet, () => sheet.setAttribute('data-opened', ''));

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    sheet.style.transform = '';
    sheet.removeAttribute('data-dragging');
    sheet.setAttribute('data-leaving', '');
    backdrop.setAttribute('data-leaving', '');
    document.removeEventListener('keydown', onKey);

    /* 시트가 내려가는 전환이 끝나면 정리 */
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      marker.parentNode?.replaceChild(content, marker);
      sheet.remove();
      backdrop.remove();
      document.body.style.overflow = '';
      returnFocus?.focus?.();
      onClose?.();
    };
    const fallback = setTimeout(finish, 400); /* 전환이 없을 때(움직임 줄이기) 대비 */
    sheet.addEventListener('transitionend', () => { clearTimeout(fallback); finish(); }, { once: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', close);
  sheet.querySelector('.sheet__header .btn').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  /* ---------- 끌어 내리기 ---------- */
  let startY = 0;
  let startT = 0;
  let dy = 0;

  function onDown(e) {
    if (e.target.closest('button')) return;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    sheet.setAttribute('data-dragging', '');
    sheet.setPointerCapture(e.pointerId);
    sheet.addEventListener('pointermove', onMove);
    sheet.addEventListener('pointerup', onUp, { once: true });
    sheet.addEventListener('pointercancel', onUp, { once: true });
  }

  function onMove(e) {
    dy = Math.max(0, e.clientY - startY); /* 위로는 끌리지 않는다 */
    sheet.style.transform = `translateY(${dy}px)`;
  }

  function onUp() {
    sheet.removeEventListener('pointermove', onMove);
    const velocity = dy / Math.max(1, performance.now() - startT);
    sheet.removeAttribute('data-dragging');
    if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) return close();
    /* 제자리로 돌아가기 */
    sheet.style.transition = 'transform var(--dur-base) var(--ease-sheet)';
    sheet.style.transform = '';
    sheet.addEventListener('transitionend', () => { sheet.style.transition = ''; }, { once: true });
  }

  sheet.querySelector('.sheet__handle').addEventListener('pointerdown', onDown);
  sheet.querySelector('.sheet__header').addEventListener('pointerdown', onDown);

  /* 처음 포커스는 닫기 버튼 대신 내용의 첫 요소 */
  const first = content.querySelector('button, input, [tabindex="0"], select, a[href]');
  (first ?? sheet.querySelector('.sheet__header .btn')).focus({ preventScroll: true });

  return { close };
}
