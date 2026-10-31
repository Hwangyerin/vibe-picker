/* ==========================================================
   view.js — 첫 화면 ↔ 작업 화면 전환, 캔버스 화면 전환, 뒤로 가기
   ========================================================== */

import { afterAnimation } from './ui/dialog.js';

const WORK_HASH = '#work';
const HOME_URL = location.pathname + location.search;

/**
 * 첫 화면과 작업 화면 사이를 오간다
 * 나가는 화면은 짧게 사라지고, 들어오는 화면은 8px 올라오며 나타난다
 * @param {'home'|'work'} to
 * @param {object} [opts]
 * @param {boolean} [opts.push] - 방문 기록에 남길지 (뒤로 가기로 돌아오려면 true)
 */
export function showView(to, { push = true } = {}) {
  const home = document.getElementById('home');
  const work = document.getElementById('workspace');
  const [enter, leave] = to === 'work' ? [work, home] : [home, work];

  document.getElementById('header-work').hidden = to !== 'work';

  if (!leave.hidden) {
    leave.classList.add('view-leave');
    afterAnimation(leave, () => {
      leave.hidden = true;
      leave.classList.remove('view-leave');
      reveal(enter);
    });
  } else {
    reveal(enter);
  }

  if (to === 'work' && push && location.hash !== WORK_HASH) history.pushState(null, '', WORK_HASH);
  if (to === 'home' && location.hash === WORK_HASH) history.replaceState(null, '', HOME_URL);
}

function reveal(el) {
  el.hidden = false;
  el.classList.remove('view-enter');
  void el.offsetWidth; /* 애니메이션을 처음부터 다시 */
  el.classList.add('view-enter');
  afterAnimation(el, () => el.classList.remove('view-enter'));
}

/** 주소가 작업 화면(#work)인지 */
export const isWorkHash = () => location.hash === WORK_HASH;

/** 방문 기록을 작업 화면으로 다시 채움 (뒤로 가기를 취소했을 때) */
export const pushWorkHash = () => history.pushState(null, '', WORK_HASH);

/** 주소에서 #work 지우기 */
export const clearWorkHash = () => {
  if (location.hash === WORK_HASH) history.replaceState(null, '', HOME_URL);
};

/**
 * 캔버스 화면 전환 (브랜드 보드 · 모바일 웹 · 슬라이드)
 * @param {'board'|'mobile'|'slides'} name
 */
export function showCanvasView(name) {
  document.querySelectorAll('.canvas__view').forEach((v) => {
    const on = v.dataset.view === name;
    if (on && v.hidden) {
      v.hidden = false;
      v.classList.remove('view-enter');
      void v.offsetWidth;
      v.classList.add('view-enter');
    } else if (!on) {
      v.hidden = true;
    }
  });
}
