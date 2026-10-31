/* ==========================================================
   mockups.js — 적용 화면: 모바일 웹 3화면 · 발표 슬라이드 3장 (v2)
   가상 서비스: 팀 프로젝트 일정 관리 서비스 (이름은 브랜드 워드마크)
   실제 크기(휴대폰 390×844, 슬라이드 960×540)로 그린 뒤 캔버스에 맞춰 줄인다.
   색·서체·둥글기는 --b-* 변수로만 칠하므로, 설정이 바뀌어도 다시 그리지 않고 바로 바뀐다.
   다시 그리는 건 글자(워드마크)·심볼·아이콘 세트가 바뀔 때뿐이다.
   ========================================================== */

import { icon } from './ui/icon.js';

const KINDS = {
  mobile: { w: 390, h: 844, names: ['랜딩', '오늘 일정', '일정 추가'], render: [mobileLanding, mobileToday, mobileAdd] },
  slides: { w: 960, h: 540, names: ['표지', '문제와 해결', '성과'], render: [slideCover, slideProblem, slideResult] },
};

const viewers = {}; /* kind → { root, index, contentKey } */

/**
 * 적용 화면 그리기
 * @param {'mobile'|'slides'} kind
 * @param {HTMLElement} root - .canvas__view
 * @param {object} p
 * @param {object} p.brand
 * @param {Map<string,string>|null} p.icons
 */
export function renderMockup(kind, root, { brand, icons }) {
  let v = viewers[kind];
  if (!v || v.root !== root) {
    v = viewers[kind] = { root, index: 0, contentKey: '' };
    root.innerHTML = viewerMarkup(kind);
    root.querySelector('.viewer__prev').addEventListener('click', () => go(kind, v.index - 1));
    root.querySelector('.viewer__next').addEventListener('click', () => go(kind, v.index + 1));
    root.querySelector('.viewer__dots').addEventListener('click', (e) => {
      const d = e.target.closest('[data-go]');
      if (d) go(kind, Number(d.dataset.go));
    });
    observeSize(kind);
  }

  const key = `${brand.wordmark}|${brand.symbol ? brand.symbol.length : 0}|${icons ? icons.size + brand.iconSet + brand.iconWeight : 'none'}`;
  if (key !== v.contentKey) {
    v.contentKey = key;
    const ctx = makeCtx(brand, icons);
    root.querySelector('.viewer__track').innerHTML = KINDS[kind].render
      .map((fn, i) => `<div class="viewer__screen ${kind === 'mobile' ? 'phone' : 'slide'}" aria-hidden="${i !== v.index}">${fn(ctx)}</div>`)
      .join('');
  }
  fit(kind);
  paintNav(kind);
}

/** 키보드 ←→로 넘기기 (main.js가 지금 보이는 종류를 넘겨 준다) */
export function stepMockup(kind, dir) {
  const v = viewers[kind];
  if (v) go(kind, v.index + dir);
}

/* ==========================================================
   보는 틀: 화살표 · 점 · 크기 맞추기
   ========================================================== */

function viewerMarkup(kind) {
  const { w, h, names } = KINDS[kind];
  return `
    <div class="viewer viewer--${kind}" style="--w: ${w}px; --h: ${h}px">
      <div class="viewer__stage">
        <button type="button" class="viewer__nav viewer__prev btn btn--secondary btn--icon" aria-label="이전 화면">${icon('chevron-left')}</button>
        <div class="viewer__frame">
          <div class="viewer__scale">
            <div class="viewer__track"></div>
          </div>
        </div>
        <button type="button" class="viewer__nav viewer__next btn btn--secondary btn--icon" aria-label="다음 화면">${icon('chevron-right')}</button>
      </div>
      <div class="viewer__foot">
        <div class="viewer__dots" role="tablist" aria-label="화면 고르기">
          ${names.map((n, i) => `<button type="button" role="tab" data-go="${i}" aria-label="${i + 1}. ${n}"></button>`).join('')}
        </div>
        <p class="viewer__caption" aria-live="polite"></p>
      </div>
    </div>`;
}

function go(kind, i) {
  const v = viewers[kind];
  const n = KINDS[kind].names.length;
  const next = Math.max(0, Math.min(n - 1, i));
  if (next === v.index) return;
  v.index = next;
  paintNav(kind);
}

function paintNav(kind) {
  const v = viewers[kind];
  const { names } = KINDS[kind];
  const root = v.root;
  root.querySelector('.viewer__track').style.setProperty('--i', v.index);
  root.querySelectorAll('.viewer__screen').forEach((s, i) => s.setAttribute('aria-hidden', String(i !== v.index)));
  root.querySelectorAll('.viewer__dots [data-go]').forEach((d, i) => d.setAttribute('aria-selected', String(i === v.index)));
  root.querySelector('.viewer__prev').disabled = v.index === 0;
  root.querySelector('.viewer__next').disabled = v.index === names.length - 1;
  root.querySelector('.viewer__caption').innerHTML =
    `<span class="num">${v.index + 1} / ${names.length}</span> ${names[v.index]}`;
}

/** 캔버스 크기에 맞춰 축소 비율 계산 */
function fit(kind) {
  const v = viewers[kind];
  const stage = document.getElementById('canvas-stage');
  if (!stage || v.root.hidden) return;
  const { w, h } = KINDS[kind];
  const navSpace = 2 * (36 + 16) + 32;   /* 양쪽 화살표 + 여백 */
  const footSpace = 72;                   /* 점·설명 */
  const availW = Math.max(160, stage.clientWidth - navSpace);
  const availH = Math.max(200, stage.clientHeight - footSpace - 48);
  const scale = Math.min(availW / w, availH / h, kind === 'mobile' ? 0.9 : 1);
  v.root.querySelector('.viewer').style.setProperty('--s', scale.toFixed(4));
}

function observeSize(kind) {
  const stage = document.getElementById('canvas-stage');
  if (!stage || observeSize.done?.has(kind)) return;
  observeSize.done = observeSize.done ?? new Set();
  observeSize.done.add(kind);
  new ResizeObserver(() => fit(kind)).observe(stage);
}

/** 보이지 않던 화면을 보이게 했을 때 크기를 다시 맞춘다 */
export function refitMockup(kind) {
  if (viewers[kind]) fit(kind);
}

/* ==========================================================
   그리기 도우미
   ========================================================== */

function makeCtx(brand, icons) {
  const name = esc(brand.wordmark.trim() || 'Planit');
  const ic = (n, cls = '') => {
    const svg = icons?.get(n) ?? '<span class="b-icon"></span>';
    return cls ? svg.replace('class="b-icon"', `class="b-icon ${cls}"`) : svg;
  };
  const letter = esc([...(brand.wordmark.trim() || 'P')][0].toUpperCase());
  const symbol = (size) => (brand.symbol
    ? `<span class="m-symbol m-symbol--img" style="--size: ${size}px"><img src="${brand.symbol}" alt="" /></span>`
    : `<span class="m-symbol" style="--size: ${size}px"><span>${letter}</span><i></i></span>`);
  return { name, ic, symbol };
}

/* 팀원 (아바타 색은 브랜드 색에서) */
const PEOPLE = [
  { n: '지수', c: 'primary' }, { n: '민호', c: 'point' }, { n: '하린', c: 'sub' }, { n: '도윤', c: 'tertiary' },
];
const avatar = (p, size = 28) =>
  `<span class="m-avatar m-avatar--${p.c}" style="--size: ${size}px">${p.n.slice(0, 1)}</span>`;
const avatars = (list, size) => `<span class="m-avatars">${list.map((p) => avatar(p, size)).join('')}</span>`;

const statusBar = (ic) => `
  <div class="m-status">
    <span class="num">9:41</span>
    <span class="m-status__icons"><i></i><i></i><i></i><b></b></span>
  </div>`;

/* ==========================================================
   모바일 웹 ① 랜딩
   ========================================================== */

function mobileLanding({ name, ic, symbol }) {
  return `
    <div class="m-screen m-landing">
      ${statusBar(ic)}
      <header class="m-topbar">
        <span class="m-brand">${symbol(28)}<b>${name}</b></span>
        <span class="m-iconbtn">${ic('menu')}</span>
      </header>

      <section class="m-hero">
        <p class="m-eyebrow">팀 프로젝트 일정 관리</p>
        <h1 class="m-display">회의는 짧게,<br />마감은 같이</h1>
        <p class="m-lead">누가 언제 무엇을 하는지 한 화면에서 봅니다. 마감 하루 전에는 담당자에게 알림이 갑니다.</p>
        <div class="m-actions">
          <span class="m-btn m-btn--primary m-btn--block">팀 만들고 시작하기</span>
          <span class="m-btn m-btn--ghost m-btn--block">이미 팀이 있어요 ${ic('arrow-right')}</span>
        </div>
      </section>

      <section class="m-preview">
        <div class="m-preview__card">
          <span class="m-preview__day"><b class="num">31</b>금</span>
          <span class="m-preview__body">
            <b>중간발표 리허설</b>
            <span>${ic('clock')} 오후 4:30 · 전원</span>
          </span>
          ${avatars(PEOPLE.slice(0, 3), 22)}
        </div>
        <div class="m-preview__card m-preview__card--soft">
          <span class="m-preview__day"><b class="num">3</b>월</span>
          <span class="m-preview__body">
            <b>디자인 시안 제출</b>
            <span>${ic('bell')} 하루 전 알림 · 하린</span>
          </span>
        </div>
      </section>

      <section class="m-features">
        <div class="m-feature">${ic('calendar')}<span><b>한 화면 일정</b>팀원 일정을 겹쳐 봐요</span></div>
        <div class="m-feature">${ic('bell')}<span><b>마감 알림</b>하루 전, 한 시간 전</span></div>
        <div class="m-feature">${ic('users')}<span><b>담당자 표시</b>누가 맡았는지 바로</span></div>
      </section>
    </div>`;
}

/* ==========================================================
   모바일 웹 ② 오늘 일정
   ========================================================== */

const TODAY = [
  { t: '09:30', end: '09:45', title: '스탠드업', tag: '회의', tone: 'sub', place: '온라인', who: [0, 1, 2, 3], done: true },
  { t: '11:00', end: '12:00', title: 'API 명세 리뷰', tag: '개발', tone: 'point', place: '3층 회의실', who: [1, 2], done: true },
  { t: '14:00', end: '15:30', title: '사용자 인터뷰 2건', tag: '리서치', tone: 'secondary', place: '학생회관', who: [3] },
  { t: '16:30', end: '17:30', title: '중간발표 리허설', tag: '발표', tone: 'primary', place: '공학관 204호', who: [0, 1, 2, 3], now: true },
];

function mobileToday({ ic, symbol }) {
  const days = [['월', 27], ['화', 28], ['수', 29], ['목', 30], ['금', 31], ['토', 1], ['일', 2]];
  return `
    <div class="m-screen m-today">
      ${statusBar(ic)}
      <header class="m-head">
        <div>
          <p class="m-caption">10월 31일 금요일</p>
          <h1 class="m-title">오늘 일정</h1>
        </div>
        <span class="m-head__right">${ic('bell')}${avatar(PEOPLE[0], 34)}</span>
      </header>

      <div class="m-week">
        ${days.map(([d, n]) => `<span class="m-day ${n === 31 ? 'is-today' : ''}"><small>${d}</small><b class="num">${n}</b>${[28, 31, 2].includes(n) ? '<i></i>' : ''}</span>`).join('')}
      </div>

      <div class="m-progress">
        <div class="m-progress__top"><b>오늘 할 일</b><span class="num">2 / 4</span></div>
        <div class="m-progress__bar"><i style="width: 50%"></i></div>
        <p>다음 일정까지 <b class="num">1시간 20분</b></p>
      </div>

      <ol class="m-list">
        ${TODAY.map((e) => `
          <li class="m-event ${e.done ? 'is-done' : ''} ${e.now ? 'is-now' : ''}">
            <span class="m-event__time num">${e.t}<small>${e.end}</small></span>
            <span class="m-event__card">
              <span class="m-tag m-tag--${e.tone}">${e.tag}</span>
              <b>${e.title}</b>
              <span class="m-event__meta">${ic('map-pin')}${e.place}</span>
              ${avatars(e.who.map((i) => PEOPLE[i]), 22)}
              ${e.done ? `<span class="m-event__check">${ic('check')}</span>` : ''}
            </span>
          </li>`).join('')}
      </ol>

      <span class="m-fab">${ic('plus')}</span>
      ${tabbar(ic, 0)}
    </div>`;
}

function tabbar(ic, active) {
  const tabs = [['home', '홈'], ['calendar', '달력'], ['chat', '대화'], ['user', '나']];
  return `<nav class="m-tabbar">${tabs.map(([n, l], i) =>
    `<span class="m-tab ${i === active ? 'is-active' : ''}">${ic(n)}<small>${l}</small></span>`).join('')}</nav>`;
}

/* ==========================================================
   모바일 웹 ③ 일정 추가
   ========================================================== */

function mobileAdd({ ic }) {
  const tags = [['회의', ''], ['개발', ''], ['리서치', ''], ['발표', 'is-on']];
  return `
    <div class="m-screen m-add">
      ${statusBar(ic)}
      <header class="m-navbar">
        <span class="m-iconbtn">${ic('chevron-left')}</span>
        <b>일정 추가</b>
        <span class="m-link">임시 저장</span>
      </header>

      <div class="m-form">
        <label class="m-field">
          <span>제목</span>
          <span class="m-input is-focus">중간발표 리허설<i class="m-caret"></i></span>
        </label>

        <div class="m-field">
          <span>날짜와 시간</span>
          <span class="m-input">${ic('calendar')}11월 3일 월요일</span>
          <span class="m-timepair">
            <span class="m-input m-input--sm num">${ic('clock')}16:30</span>
            <span class="m-timepair__dash"></span>
            <span class="m-input m-input--sm num">17:30</span>
          </span>
        </div>

        <div class="m-field">
          <span>분류</span>
          <span class="m-chips">${tags.map(([t, on]) => `<span class="m-chip ${on}">${on ? ic('check') : ''}${t}</span>`).join('')}</span>
        </div>

        <div class="m-field">
          <span>담당자</span>
          <span class="m-people">${PEOPLE.map((p) => avatar(p, 36)).join('')}<span class="m-avatar m-avatar--add" style="--size: 36px">${ic('plus')}</span></span>
        </div>

        <div class="m-row">
          <span><b>하루 전 알림</b><small>담당자 모두에게 보내요</small></span>
          <span class="m-switch is-on"><i></i></span>
        </div>

        <label class="m-field">
          <span>메모</span>
          <span class="m-input m-input--area">발표 자료 최종본은 일요일 밤까지 공유 폴더에 올려 주세요.</span>
        </label>
      </div>

      <div class="m-bottom">
        <span class="m-btn m-btn--primary m-btn--block">일정 추가</span>
      </div>
    </div>`;
}

/* ==========================================================
   슬라이드 ① 표지
   ========================================================== */

function slideCover({ name, symbol }) {
  return `
    <div class="s-slide s-cover">
      <div class="s-cover__main">
        <span class="s-brand">${symbol(36)}<b>${name}</b></span>
        <div>
          <p class="s-eyebrow">졸업작품 3팀 · 중간 발표</p>
          <h1 class="s-display">팀 프로젝트 일정을<br />한곳에 모으다</h1>
          <p class="s-lead">단톡방에 흩어진 회의와 마감을 한 화면으로</p>
        </div>
        <p class="s-meta"><span class="num">2026. 10. 31</span><span>김지수 · 이민호 · 박하린 · 최도윤</span></p>
      </div>
      <div class="s-cover__art" aria-hidden="true">
        <span class="s-cover__big">${symbol(220)}</span>
        <span class="s-cover__ring"></span>
        <span class="s-cover__dot s-cover__dot--a"></span>
        <span class="s-cover__dot s-cover__dot--b"></span>
      </div>
    </div>`;
}

/* ==========================================================
   슬라이드 ② 문제와 해결
   ========================================================== */

function slideProblem({ name, ic }) {
  const problems = [
    ['단톡방에 묻히는 일정', '공지 하나가 대화 200개 아래로 내려간다'],
    ['누가 맡았는지 모름', '회의에서 정한 일이 담당자 없이 끝난다'],
    ['마감 직전에야 안다', '제출 전날 밤에 처음 확인하는 일이 반복된다'],
  ];
  const fixes = [
    ['calendar', '한 화면 일정', '팀원 일정을 겹쳐 보고 빈 시간을 찾는다'],
    ['users', '담당자 표시', '모든 일정에 담당자가 붙는다'],
    ['bell', '마감 알림', '하루 전, 한 시간 전에 담당자에게'],
  ];
  return `
    <div class="s-slide s-problem">
      <header class="s-head">
        <p class="s-eyebrow">02 · 문제와 해결</p>
        <h2 class="s-title">일정은 대화가 아니라 화면에 있어야 한다</h2>
      </header>
      <div class="s-cols">
        <ol class="s-problems">
          ${problems.map(([t, d], i) => `<li><span class="num">0${i + 1}</span><span><b>${t}</b>${d}</span></li>`).join('')}
        </ol>
        <span class="s-arrow">${ic('arrow-right')}</span>
        <div class="s-fixes">
          ${fixes.map(([n, t, d]) => `<div class="s-fix">${ic(n)}<span><b>${t}</b>${d}</span></div>`).join('')}
        </div>
      </div>
      ${slideFoot(name, 2)}
    </div>`;
}

/* ==========================================================
   슬라이드 ③ 성과
   ========================================================== */

function slideResult({ name }) {
  const weeks = [['1주', 62], ['2주', 71], ['3주', 84], ['4주', 91]];
  const kpis = [['91%', '마감을 지킨 일정', '1주 차 62%'], ['38%', '줄어든 회의 시간', '주당 3.4 → 2.1시간'], ['4.6', '팀원 만족도', '5점 만점, 16명']];
  return `
    <div class="s-slide s-result">
      <header class="s-head">
        <p class="s-eyebrow">03 · 4주 동안 써 보니</p>
        <h2 class="s-title">마감을 지킨 일정이 <em>62%에서 91%로</em></h2>
      </header>
      <div class="s-result__body">
        <div class="s-chart" role="img" aria-label="주차별 마감 준수율 62, 71, 84, 91퍼센트">
          <div class="s-chart__grid"><i></i><i></i><i></i><i></i></div>
          ${weeks.map(([w, v], i) => `
            <div class="s-bar ${i === weeks.length - 1 ? 'is-last' : ''}" style="--v: ${v}">
              <b class="num">${v}%</b><i></i><small>${w}</small>
            </div>`).join('')}
        </div>
        <div class="s-kpis">
          ${kpis.map(([v, l, d]) => `<div class="s-kpi"><b class="num">${v}</b><span>${l}</span><small>${d}</small></div>`).join('')}
        </div>
      </div>
      ${slideFoot(name, 3)}
    </div>`;
}

function slideFoot(name, n) {
  return `<footer class="s-foot"><span>${name}</span><span class="num">${n} / 3</span></footer>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
