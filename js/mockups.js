/* ==========================================================
   mockups.js — 예시 화면 그리기, 라이트·다크 전환
   뽑은 색이 입혀진 슬라이드·웹사이트·앱 목업
   ========================================================== */

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
 */
function injectCssVars({ bg, text, main, point, sub, bgDark, textDark }) {
  const root = document.documentElement;
  root.style.setProperty('--mk-bg',        bg);
  root.style.setProperty('--mk-text',      text);
  root.style.setProperty('--mk-main',      main);
  root.style.setProperty('--mk-point',     point);
  root.style.setProperty('--mk-sub',       sub);
  root.style.setProperty('--mk-bg-dark',   bgDark);
  root.style.setProperty('--mk-text-dark', textDark);
}

/* ---------- 목업 DOM 빌더 ---------- */

/** 슬라이드 표지 목업 */
function buildSlideCover() {
  document.getElementById('mockup-slide-cover').innerHTML = `
    <span class="slide-cover-tag">PROJECT 2026</span>
    <h2 class="slide-cover-title">첫인상은<br>색이 정한다</h2>
    <p class="slide-cover-sub">VibePicker · 황예린</p>
  `;
}

/** 슬라이드 본문 목업 */
function buildSlideBody() {
  document.getElementById('mockup-slide-body').innerHTML = `
    <div class="slide-body-header">
      <div class="slide-body-dot"></div>
      <span class="slide-body-title">색이 만드는 첫인상</span>
    </div>
    <div class="slide-body-content">
      <div class="slide-body-line"></div>
      <div class="slide-body-line"></div>
      <div class="slide-body-line"></div>
      <span class="slide-body-highlight">사진 → 색 → 화면</span>
    </div>
  `;
}

/** 슬라이드 차트 목업 (막대 그래프 + 통계) */
function buildSlideChart() {
  document.getElementById('mockup-slide-chart').innerHTML = `
    <div class="slide-chart-header">
      <div class="slide-chart-dot"></div>
      <span class="slide-chart-title">성과 분석</span>
    </div>
    <div class="slide-chart-body">
      <div class="slide-bar-chart">
        <div class="slide-bar">
          <div class="slide-bar-fill" style="height:52%"></div>
          <span class="slide-bar-label">1Q</span>
        </div>
        <div class="slide-bar">
          <div class="slide-bar-fill" style="height:68%"></div>
          <span class="slide-bar-label">2Q</span>
        </div>
        <div class="slide-bar">
          <div class="slide-bar-fill" style="height:45%"></div>
          <span class="slide-bar-label">3Q</span>
        </div>
        <div class="slide-bar highlight">
          <div class="slide-bar-fill" style="height:88%"></div>
          <span class="slide-bar-label">4Q</span>
        </div>
        <div class="slide-bar">
          <div class="slide-bar-fill" style="height:74%"></div>
          <span class="slide-bar-label">목표</span>
        </div>
      </div>
      <div class="slide-stats">
        <div class="slide-stat">
          <span class="slide-stat-val">+38%</span>
          <span class="slide-stat-label">성장률</span>
        </div>
        <div class="slide-stat">
          <span class="slide-stat-val">1,240</span>
          <span class="slide-stat-label">사용자</span>
        </div>
      </div>
    </div>
  `;
}

/** 웹사이트 랜딩 목업 */
function buildWeb() {
  document.getElementById('mockup-web').innerHTML = `
    <nav class="web-nav">
      <span class="web-nav-logo">VibePicker</span>
      <div class="web-nav-links">
        <span class="web-nav-link">소개</span>
        <span class="web-nav-link">시작하기</span>
      </div>
    </nav>
    <div class="web-hero">
      <p class="web-hero-eyebrow">Color from Photo</p>
      <h2 class="web-hero-title">사진 한 장으로<br>완성되는 팔레트</h2>
      <p class="web-hero-desc">마음에 드는 사진을 올리면 어울리는 색 다섯 가지와 예시 화면이 바로 나옵니다.</p>
      <span class="web-cta">사진 올리기</span>
    </div>
  `;
}

/** 모바일 앱 목업 */
function buildApp() {
  document.getElementById('mockup-app').innerHTML = `
    <div class="app-topbar">VibePicker</div>
    <div class="app-body">
      <div class="app-card">
        오늘의 팔레트
        <div class="app-card-sub">사진에서 뽑은 5가지 색</div>
      </div>
      <div class="app-list-item">
        <div class="app-list-dot"></div>
        <div class="app-list-text">
          <div class="app-list-line" style="width:80%"></div>
          <div class="app-list-line"></div>
        </div>
      </div>
      <div class="app-list-item">
        <div class="app-list-dot"></div>
        <div class="app-list-text">
          <div class="app-list-line" style="width:65%"></div>
          <div class="app-list-line"></div>
        </div>
      </div>
    </div>
    <div class="app-tabbar">
      <div class="app-tab active">
        <div class="app-tab-icon"></div>
        홈
      </div>
      <div class="app-tab">
        <div class="app-tab-icon"></div>
        서랍
      </div>
      <div class="app-tab">
        <div class="app-tab-icon"></div>
        설정
      </div>
    </div>
  `;
}
