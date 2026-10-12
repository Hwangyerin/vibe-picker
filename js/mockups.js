/* ==========================================================
   mockups.js — 예시 화면 그리기, 라이트·다크 전환
   뽑은 색이 입혀진 슬라이드·웹사이트·앱 목업

   각 목업은 실제 크기(슬라이드 960×540, 웹 1200×750, 앱 390×844)로
   그린 뒤 뷰어 크기에 맞춰 통째로 축소한다.
   → 글자·여백 비율이 실제 화면과 똑같이 유지됨
   ========================================================== */

import { onColor, liftForDark } from './color.js';

/* 목업 카드 id → 실제 디자인 너비(px) */
const DESIGN_WIDTH = {
  'mockup-slide-cover': 960,
  'mockup-slide-body':  960,
  'mockup-slide-chart': 960,
  'mockup-web':         1200,
  'mockup-app':         390,
};

/**
 * 팔레트 역할 배정 결과를 CSS 변수로 주입하고 목업 내용을 채움
 * @param {{ bg, text, main, point, sub, bgDark, textDark }} roles
 * @param {'light'|'dark'} mode
 */
export function renderMockups(roles, mode = 'light') {
  /* CSS 변수로 색 주입 (목업 전체에 한 번에 적용) */
  injectCssVars(roles);

  /* 목업 DOM 채우기 (처음 한 번만, 이후에는 색만 바뀜) */
  if (!document.getElementById('mockup-slide-cover').dataset.built) {
    buildSlideCover();
    buildSlideBody();
    buildSlideChart();
    buildWeb();
    buildApp();
    initFit();
    /* 한 번 빌드됐다는 표시 */
    document.getElementById('mockup-slide-cover').dataset.built = '1';
  }

  /* 라이트·다크 모드 적용 */
  applyMode(mode);
}

/**
 * 라이트·다크 전환 (디졸브는 CSS transition으로 처리)
 * @param {'light'|'dark'} mode
 */
export function applyMode(mode) {
  const cards = document.querySelectorAll('.mockup-card');
  cards.forEach((card) => {
    if (mode === 'dark') {
      card.classList.add('dark');
    } else {
      card.classList.remove('dark');
    }
  });
}

/* ---------- CSS 변수 주입 ---------- */

/**
 * :root에 --mk-* 변수를 주입해 목업 전체 색을 한 번에 바꿈
 * - on-main / on-point: 색 버튼 위에 올라가는 글자색 (흰색·검정 중 잘 읽히는 쪽)
 * - *-dark: 다크 배경에서 묻히는 색은 밝기만 올려서 사용
 */
function injectCssVars({ bg, text, main, point, sub, bgDark, textDark }) {
  const mainDark  = liftForDark(main,  bgDark);
  const pointDark = liftForDark(point, bgDark);
  const subDark   = liftForDark(sub,   bgDark);

  const vars = {
    '--mk-bg':            bg,
    '--mk-text':          text,
    '--mk-main':          main,
    '--mk-point':         point,
    '--mk-sub':           sub,
    '--mk-bg-dark':       bgDark,
    '--mk-text-dark':     textDark,
    '--mk-main-dark':     mainDark,
    '--mk-point-dark':    pointDark,
    '--mk-sub-dark':      subDark,
    '--mk-on-main':       onColor(main),
    '--mk-on-point':      onColor(point),
    '--mk-on-sub':        onColor(sub),
    '--mk-on-main-dark':  onColor(mainDark),
    '--mk-on-point-dark': onColor(pointDark),
    '--mk-on-sub-dark':   onColor(subDark),
  };

  const root = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
}

/* ---------- 실제 크기 → 뷰어 크기 축소 ---------- */

/**
 * 카드 크기가 바뀔 때마다 안쪽 캔버스를 비율대로 축소
 * (숨겨진 탭은 너비가 0이라 건너뛰고, 탭이 열리면 다시 호출됨)
 */
function initFit() {
  const observer = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => fit(target));
  });
  Object.keys(DESIGN_WIDTH).forEach((id) => observer.observe(document.getElementById(id)));
}

function fit(card) {
  const canvas = card.firstElementChild;
  const width  = card.clientWidth;
  if (!canvas || !width) return;
  canvas.style.transform = `scale(${width / DESIGN_WIDTH[card.id]})`;
}

/* ---------- 아이콘 ---------- */

/** 선 아이콘 SVG (색은 currentColor를 따라감) */
const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONS = {
  home:     icon('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  chart:    icon('<path d="M5 20V11M12 20V4M19 20v-7"/>'),
  card:     icon('<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>'),
  user:     icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  bell:     icon('<path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>'),
  send:     icon('<path d="M7 17 17 7M8 7h9v9"/>'),
  plus:     icon('<path d="M12 5v14M5 12h14"/>'),
  swap:     icon('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  scan:     icon('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>'),
  coffee:   icon('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>'),
  bag:      icon('<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>'),
  bus:      icon('<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 17v3M16 17v3"/>'),
  income:   icon('<path d="M12 4v14M6 12l6 6 6-6"/>'),
  check:    icon('<path d="m5 12 5 5 9-10"/>'),
  calendar: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  bolt:     icon('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  lock:     icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  play:     icon('<path d="m8 5 11 7-11 7z"/>'),
  back:     icon('<path d="m15 5-7 7 7 7"/>'),
  forward:  icon('<path d="m9 5 7 7-7 7"/>'),
  reload:   icon('<path d="M20 11a8 8 0 1 0-2.3 6M20 5v6h-6"/>'),
};

/* ---------- 목업 DOM 빌더 ---------- */

/** 슬라이드 공통 하단 줄 (로고 + 문서명 + 쪽 번호) */
const slideFooter = (page) => `
  <div class="sl-footer">
    <span class="sl-footer-brand"><i class="sl-logo-mark"></i>Brewing Lab</span>
    <span>2026 상반기 구독 서비스 성과 보고</span>
    <span>${page} / 12</span>
  </div>
`;

/** 슬라이드 표지 목업 */
function buildSlideCover() {
  document.getElementById('mockup-slide-cover').innerHTML = `
    <div class="mk-canvas sl sl-cover">
      <div class="sl-cover-main">
        <div class="sl-cover-brand"><i class="sl-logo-mark"></i>BREWING LAB</div>
        <div class="sl-cover-heading">
          <span class="sl-pill">2026 H1 Business Review</span>
          <div class="sl-cover-title">한 잔의 습관을<br>데이터로 읽다</div>
          <div class="sl-cover-sub">원두 정기구독 서비스 상반기 성과와 하반기 전략</div>
        </div>
        <div class="sl-cover-meta">
          <span>브랜드전략팀 김도윤</span>
          <span>2026. 07. 14</span>
        </div>
      </div>
      <div class="sl-cover-side">
        <div class="sl-cover-side-label">상반기 한눈에 보기</div>
        <div class="sl-cover-stat"><b>12,480</b><span>누적 구독자</span></div>
        <div class="sl-cover-stat"><b>87%</b><span>3개월 재구독률</span></div>
        <div class="sl-cover-stat"><b>62</b><span>고객 추천 지수(NPS)</span></div>
      </div>
    </div>
  `;
}

/** 슬라이드 본문 목업 */
function buildSlideBody() {
  const points = [
    ['01', '취향 진단 도입', '가입 첫 화면에서 6문항으로 원두를 추천해 첫 주문 전환이 크게 올랐습니다.', '+31%', '첫 주문 전환율'],
    ['02', '배송 주기 자율화', '1·2·4주 중 고객이 직접 고르게 바꾸자 해지 사유 1위가 사라졌습니다.', '−42%', '월 해지 건수'],
    ['03', '로스터리 협업', '지역 로스터리 8곳과 한정 원두를 내면서 객단가가 함께 올랐습니다.', '₩23,800', '평균 주문 금액'],
  ];

  document.getElementById('mockup-slide-body').innerHTML = `
    <div class="mk-canvas sl sl-page">
      <div class="sl-head">
        <span class="sl-head-no">02</span>
        <div>
          <div class="sl-head-title">상반기에 달라진 세 가지</div>
          <div class="sl-head-sub">핵심 요약 · 2026년 1월 – 6월</div>
        </div>
      </div>
      <div class="sl-points">
        ${points.map(([no, title, desc, value, label]) => `
          <div class="sl-point">
            <span class="sl-point-no">${no}</span>
            <div class="sl-point-title">${title}</div>
            <div class="sl-point-desc">${desc}</div>
            <div class="sl-point-metric"><b>${value}</b><span>${label}</span></div>
          </div>
        `).join('')}
      </div>
      <div class="sl-takeaway">
        <b>하반기 과제</b>
        <span>재구독 고객을 위한 멤버십 등급을 9월까지 출시하고, 해지 직전 고객에게 주기 변경을 먼저 제안합니다.</span>
      </div>
      ${slideFooter('02')}
    </div>
  `;
}

/** 슬라이드 차트 목업 (막대 그래프 + 지표 카드) */
function buildSlideChart() {
  /* [월, 누적 구독자(천 명)] — 세로축 최대 15 */
  const data = [['1월', 7.2], ['2월', 8.1], ['3월', 9.0], ['4월', 10.2], ['5월', 10.9], ['6월', 12.5]];
  const MAX = 15;

  document.getElementById('mockup-slide-chart').innerHTML = `
    <div class="mk-canvas sl sl-page">
      <div class="sl-head">
        <span class="sl-head-no">03</span>
        <div>
          <div class="sl-head-title">월별 누적 구독자 추이</div>
          <div class="sl-head-sub">단위: 천 명 · 6월에 연간 목표의 83% 달성</div>
        </div>
      </div>
      <div class="sl-chart-row">
        <div class="sl-chart">
          <div class="sl-plot">
            ${[15, 10, 5, 0].map((tick) => `
              <div class="sl-grid" style="bottom:${(tick / MAX) * 100}%"><span>${tick}</span></div>
            `).join('')}
            <div class="sl-target" style="bottom:${(12 / MAX) * 100}%"><span>상반기 목표 12.0</span></div>
            <div class="sl-bars">
              ${data.map(([, value], i) => `
                <div class="sl-bar${i === data.length - 1 ? ' is-peak' : ''}">
                  <div class="sl-bar-fill" style="height:${(value / MAX) * 100}%"><span>${value.toFixed(1)}</span></div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="sl-axis">${data.map(([month]) => `<span>${month}</span>`).join('')}</div>
        </div>
        <div class="sl-kpis">
          <div class="sl-kpi"><span>반기 성장률</span><b>+73.6%</b><em>전년 동기 +41.2%</em></div>
          <div class="sl-kpi"><span>월 평균 신규</span><b>1,060명</b><em>6월 1,240명으로 최고</em></div>
          <div class="sl-kpi"><span>유료 전환율</span><b>38.4%</b><em>체험 구독 → 정기 구독</em></div>
        </div>
      </div>
      ${slideFooter('03')}
    </div>
  `;
}

/** 웹사이트 목업: 브라우저 창 안의 SaaS 랜딩 페이지 (안쪽 스크롤 가능) */
function buildWeb() {
  const columns = [
    ['할 일', 3, [
      ['온보딩 화면 카피 수정', '디자인', 'sub', '7월 18일'],
      ['결제 실패 알림 메일', '개발', 'main', '7월 21일'],
    ]],
    ['진행 중', 2, [
      ['3분기 로드맵 공유 자료', '기획', 'point', '오늘'],
      ['검색 속도 개선', '개발', 'main', '7월 17일'],
    ]],
    ['완료', 5, [
      ['사용자 인터뷰 8건 정리', '리서치', 'sub', '완료'],
    ]],
  ];

  const features = [
    ['calendar', '일정이 알아서 맞춰집니다', '팀원 캘린더를 읽어 모두가 비는 시간을 먼저 제안합니다.'],
    ['bolt', '회의록은 AI가 정리', '회의가 끝나면 결정 사항과 담당자를 할 일로 바로 옮깁니다.'],
    ['lock', '기업용 보안', 'SSO와 감사 로그, 국내 리전 저장을 기본으로 제공합니다.'],
  ];

  document.getElementById('mockup-web').innerHTML = `
    <div class="mk-canvas web">
      <div class="web-chrome">
        <div class="web-dots"><i></i><i></i><i></i></div>
        <div class="web-chrome-nav">${ICONS.back}${ICONS.forward}${ICONS.reload}</div>
        <div class="web-url">${ICONS.lock}<span>planit.team</span></div>
      </div>

      <div class="web-nav">
        <div class="web-logo"><i></i>Planit</div>
        <div class="web-links"><span>제품</span><span>솔루션</span><span>요금</span><span>고객 사례</span><span>블로그</span></div>
        <div class="web-nav-actions">
          <span class="web-login">로그인</span>
          <span class="web-btn web-btn-primary web-btn-sm">무료로 시작</span>
        </div>
      </div>

      <div class="web-page">
        <div class="web-hero">
          <div class="web-hero-copy">
            <div class="web-badge"><i></i>새 기능 · AI 회의록 요약 출시</div>
            <div class="web-h1">팀의 일정이<br>한 화면에 모이는 곳</div>
            <div class="web-lead">할 일, 회의, 마감을 따로 관리하지 마세요. Planit은 팀의 한 주를 하나의 보드로 정리해 줍니다.</div>
            <div class="web-hero-actions">
              <span class="web-btn web-btn-primary">14일 무료 체험</span>
              <span class="web-btn web-btn-ghost">${ICONS.play}2분 데모 보기</span>
            </div>
            <div class="web-proof">
              <div class="web-avatars"><i>지</i><i>민</i><i>서</i><i>+</i></div>
              <span><b>★ 4.9</b> · 2,300개 팀이 매일 사용합니다</span>
            </div>
          </div>

          <div class="web-board">
            <div class="web-board-head">
              <b>7월 3주차 스프린트</b>
              <span class="web-board-tabs"><em class="is-on">보드</em><em>캘린더</em><em>타임라인</em></span>
            </div>
            <div class="web-board-cols">
              ${columns.map(([name, count, tasks]) => `
                <div class="web-col">
                  <div class="web-col-head">${name}<span>${count}</span></div>
                  ${tasks.map(([title, tag, tone, due]) => `
                    <div class="web-task">
                      <span class="web-tag tone-${tone}">${tag}</span>
                      <div class="web-task-title">${title}</div>
                      <div class="web-task-meta">${ICONS.calendar}${due}</div>
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="web-logos">
          <span>함께하는 팀</span>
          <b>NORDIK</b><b>모아랩</b><b>Fieldnote</b><b>오브제 스튜디오</b><b>LUMEN</b>
        </div>

        <div class="web-features">
          ${features.map(([name, title, desc]) => `
            <div class="web-feature">
              <div class="web-feature-icon">${ICONS[name]}</div>
              <div class="web-feature-title">${title}</div>
              <div class="web-feature-desc">${desc}</div>
            </div>
          `).join('')}
        </div>

        <div class="web-cta">
          <div>
            <div class="web-cta-title">이번 주 회의부터 줄여 보세요</div>
            <div class="web-cta-desc">카드 등록 없이 5분이면 팀 보드가 만들어집니다.</div>
          </div>
          <span class="web-btn web-btn-invert">무료로 시작하기</span>
        </div>

        <div class="web-footer">
          <span>© 2026 Planit Inc.</span>
          <span>이용약관 · 개인정보처리방침 · 고객센터</span>
        </div>
      </div>
    </div>
  `;
}

/** 모바일 앱 목업: 가계부 앱 홈 화면 */
function buildApp() {
  const actions = [['send', '송금'], ['plus', '충전'], ['swap', '환전'], ['scan', '스캔']];

  const history = [
    ['coffee', 'main',  '프릳츠 원서점',   '카페 · 오후 2:14',  '−5,500원'],
    ['income', 'point', '7월 급여',        '입금 · 오전 9:00',  '+3,240,000원'],
    ['bag',    'sub',   '마켓컬리',        '식비 · 어제',       '−38,900원'],
    ['bus',    'main',  '후불 교통카드',   '교통 · 어제',       '−2,800원'],
  ];

  const tabs = [['home', '홈'], ['chart', '분석'], ['card', '카드'], ['user', '내 정보']];

  document.getElementById('mockup-app').innerHTML = `
    <div class="mk-canvas app">
      <div class="app-screen">
        <div class="app-status">
          <span>9:41</span>
          <i class="app-island"></i>
          <span class="app-status-icons">
            <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
            <svg viewBox="0 0 27 13" fill="none"><rect x=".5" y=".5" width="22" height="12" rx="3.5" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor"/><path d="M24.5 4.5v4c.8-.3 1.5-1 1.5-2s-.7-1.7-1.5-2z" fill="currentColor" opacity=".5"/></svg>
          </span>
        </div>

        <div class="app-top">
          <div>
            <div class="app-hello">안녕하세요, 서연님</div>
            <div class="app-date">7월 14일 화요일</div>
          </div>
          <div class="app-bell">${ICONS.bell}<i></i></div>
        </div>

        <div class="app-balance">
          <div class="app-balance-top">
            <span>이번 달 지출</span>
            <span class="app-balance-chip">지난달보다 −12%</span>
          </div>
          <div class="app-balance-amount">1,284,500<small>원</small></div>
          <div class="app-progress"><i style="width:64%"></i></div>
          <div class="app-balance-foot"><span>예산 2,000,000원</span><span>64% 사용</span></div>
        </div>

        <div class="app-actions">
          ${actions.map(([name, label]) => `
            <div class="app-action"><div class="app-action-icon">${ICONS[name]}</div>${label}</div>
          `).join('')}
        </div>

        <div class="app-section-head"><b>최근 내역</b><span>전체 보기</span></div>
        <div class="app-history">
          ${history.map(([name, tone, title, meta, amount]) => `
            <div class="app-item">
              <div class="app-item-icon tone-${tone}">${ICONS[name]}</div>
              <div class="app-item-text"><b>${title}</b><span>${meta}</span></div>
              <div class="app-item-amount${amount.startsWith('+') ? ' is-income' : ''}">${amount}</div>
            </div>
          `).join('')}
        </div>

        <div class="app-tabbar">
          ${tabs.map(([name, label], i) => `
            <div class="app-tab${i === 0 ? ' is-on' : ''}">${ICONS[name]}${label}</div>
          `).join('')}
        </div>
        <i class="app-home-indicator"></i>
      </div>
    </div>
  `;
}
