/* ==========================================================
   rail.js — 레일의 색 역할 목록, 가독성 경고, 대비 슬라이더, 시안 그리기
   이벤트 연결은 main.js가 한다
   ========================================================== */

import { icon } from './ui/icon.js';
import { applyContrastToPalette } from './roles.js';

const ROLE_LABELS = [
  ['bg', '배경'],
  ['text', '글자'],
  ['main', '메인'],
  ['point', '포인트'],
  ['sub', '보조'],
];

/**
 * 색 역할 목록
 * @param {{ bg, text, main, point, sub }} roles - 지금 미리보기 모드에서 실제로 쓰이는 색
 * @param {'light'|'dark'} mode
 */
export function renderRoles(roles, mode) {
  const list = document.getElementById('roles');
  if (list.children.length !== ROLE_LABELS.length) {
    list.innerHTML = ROLE_LABELS.map(([key, label], i) => `
      <li class="role" data-role="${key}" style="--i: ${i}">
        <span class="role__dot" aria-hidden="true"></span>
        <span class="role__name">${label}<small></small></span>
        <button type="button" class="chip__copy"></button>
      </li>`).join('');
  }

  ROLE_LABELS.forEach(([key, label]) => {
    const li = list.querySelector(`[data-role="${key}"]`);
    const hex = roles[key];
    li.style.setProperty('--c', hex);
    li.querySelector('small').textContent = key === 'bg' || key === 'text'
      ? (mode === 'dark' ? '다크' : '라이트')
      : '';
    const btn = li.querySelector('.chip__copy');
    btn.textContent = hex;
    btn.dataset.copy = hex;
    btn.setAttribute('aria-label', `${label} ${hex} 복사`);
  });
}

/**
 * 글자-배경 대비 경고
 * @param {{ warn: boolean, ratio: number }} result - roles.readabilityWarning() 결과
 */
export function renderWarning({ warn, ratio }) {
  const el = document.getElementById('roles-warning');
  if (!warn) {
    el.hidden = true;
    return;
  }
  el.innerHTML = `${icon('alert')}<span>글자와 배경 대비가 <b class="num">${ratio.toFixed(1)} : 1</b>이에요. 본문 글자는 4.5 : 1 이상이어야 잘 읽혀요. 역할 섞기나 대비로 고쳐 보세요.</span>`;
  el.hidden = false;
}

/**
 * 대비 슬라이더 위치와 채움 (가운데 0에서 손잡이까지)
 * @param {number} offset - -30 ~ 30
 */
export function renderContrast(offset) {
  const input = document.getElementById('contrast-slider');
  input.value = offset;
  const pct = ((offset - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.style.setProperty('--from', `${Math.min(50, pct)}%`);
  input.style.setProperty('--to', `${Math.max(50, pct)}%`);
  document.getElementById('contrast-value').textContent = offset > 0 ? `+${offset}` : String(offset);
  document.getElementById('btn-contrast-reset').disabled = offset === 0;
  document.getElementById('palette-note').hidden = offset === 0;
}

/**
 * 보관한 시안 목록
 * @param {Array<{ palette: string[], roles: object, contrastOffset: number }>} history
 * @param {number} currentIndex - 지금 화면과 같은 시안 (-1이면 없음)
 */
export function renderKept(history, currentIndex) {
  const wrap = document.getElementById('kept');
  wrap.hidden = history.length === 0;
  document.getElementById('kept-count').textContent = `${history.length}/5`;

  document.getElementById('kept-list').innerHTML = history.map((entry, i) => {
    const colors = applyContrastToPalette(entry.palette, entry.roles, entry.contrastOffset);
    return `
      <li class="kept__item" ${i === currentIndex ? 'data-current' : ''}>
        <button type="button" class="kept__load" data-kept="${i}" aria-label="시안 ${i + 1} 불러오기">
          ${colors.map((c) => `<i style="--c: ${c}"></i>`).join('')}
        </button>
        <button type="button" class="kept__remove" data-kept-remove="${i}" aria-label="시안 ${i + 1} 지우기">${icon('x')}</button>
      </li>`;
  }).join('');
}

/** 레일의 편집 도구를 쓸 수 있는지 (사진이 없으면 다시 뽑기·보관을 막는다) */
export function setPhotoTools(enabled) {
  const repick = document.getElementById('btn-repick');
  const keep = document.getElementById('btn-keep');
  repick.disabled = !enabled;
  keep.disabled = !enabled;
  const why = enabled ? null : '사진이 없어 쓸 수 없어요';
  [repick, keep].forEach((b) => {
    if (why) b.setAttribute('data-tooltip', why);
    else if (b === keep) b.setAttribute('data-tooltip', '시안으로 보관');
    else b.removeAttribute('data-tooltip');
  });
}
