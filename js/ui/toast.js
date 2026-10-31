/* ==========================================================
   toast.js — 짧은 알림 ("복사됨", "저장됨")
   화면 아래 가운데에 잠깐 떴다 사라지고, 스크린 리더가 읽는다
   ========================================================== */

import { icon } from './icon.js';
import { afterAnimation } from './dialog.js';

const MAX_TOASTS = 3;
let region = null;

/** 알림이 쌓일 영역 (처음 쓸 때 만든다) */
function getRegion() {
  if (region && document.body.contains(region)) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
}

/**
 * 알림 띄우기
 * @param {string} message
 * @param {object} [opts]
 * @param {'default'|'success'} [opts.tone]
 * @param {string} [opts.icon] - 아이콘 이름 (success면 기본 check)
 * @param {number} [opts.duration] - ms (기본 1800)
 */
export function toast(message, { tone = 'default', icon: iconName, duration = 1800 } = {}) {
  const root = getRegion();

  /* 너무 많이 쌓이면 가장 오래된 것부터 지운다 */
  while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();

  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  const name = iconName ?? (tone === 'success' ? 'check' : null);
  el.innerHTML = `${name ? icon(name) : ''}<span></span>`;
  el.querySelector('span').textContent = message;
  root.appendChild(el);

  setTimeout(() => {
    el.setAttribute('data-leaving', '');
    afterAnimation(el, () => el.remove());
  }, duration);
}

/* ==========================================================
   스크린 리더에만 읽히는 안내 (화면에는 안 보인다)
   다시 뽑기처럼 화면 여러 곳이 한꺼번에 바뀔 때, 무엇이 바뀌었는지 말로 알린다
   ========================================================== */

let srRegion = null;

/** @param {string} message */
export function announce(message) {
  if (!srRegion || !document.body.contains(srRegion)) {
    srRegion = document.createElement('div');
    srRegion.className = 'sr-only';
    srRegion.setAttribute('role', 'status');
    srRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(srRegion);
  }
  /* 같은 문장이 연달아 와도 다시 읽도록 비웠다가 넣는다 */
  srRegion.textContent = '';
  requestAnimationFrame(() => { srRegion.textContent = message; });
}
