/* ==========================================================
   icon.js — UI 아이콘 스프라이트(assets/icons.svg) 쓰기
   이 모듈 위치를 기준으로 경로를 풀어서, 어느 페이지에서 불러도 같은 파일을 가리킨다
   ========================================================== */

const SPRITE = new URL('../../assets/icons.svg', import.meta.url).href;

/**
 * 아이콘 SVG 문자열
 * @param {string} name - 스프라이트의 symbol id (copy, check, x …)
 * @param {string} [size] - 'sm' | 'lg' (기본은 16px)
 * @returns {string}
 */
export function icon(name, size) {
  const cls = size ? `icon icon--${size}` : 'icon';
  return `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE}#${name}"/></svg>`;
}
