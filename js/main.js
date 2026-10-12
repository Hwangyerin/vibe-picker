/* ==========================================================
   main.js — 앱 진입점, 각 모듈을 불러와 연결
   모든 이벤트 흐름의 중심: 사진 → 색 추출 → 칩 표시 → 목업 → 프롬프트
   ========================================================== */

import { state, setState, subscribe } from './state.js';
import { initUpload, setOnImageLoaded,
         restoreImage }                            from './upload.js';
import { extractColors, pickDistinct }             from './extract.js';
import { assignRoles, shuffleRoles, readabilityWarning,
         applyContrastToRoles }                    from './roles.js';
import { renderChips, initEyedropperOverlay,
         setOnEyedropperPick, setOnMyPickRemove,
         deactivateEyedropper } from './chips.js';
import { renderMockups, applyMode }                from './mockups.js';
import { initPrompt, showPromptSection, setActiveTab,
         closePromptModal }                        from './prompt.js';
import { initSaveButton, initDrawer,
         setOnCardLoaded, onStateChange,
         renderHomePalettes, closeDrawer,
         saveSession, loadSession }                from './storage.js';

/* 작업 화면일 때 주소 뒤에 붙는 표시 — 브라우저 뒤로가기로 홈에 돌아올 수 있게 함 */
const WORK_HASH = '#work';
const HOME_URL  = location.pathname + location.search;

/* ==========================================================
   초기화
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  /* 상태 변경 감지 → 저장 버튼 활성화 */
  subscribe(onStateChange);

  /* 상태 변경 감지 → 작업 중인 화면 임시 보관 (새로고침 대비) */
  subscribe((s) => saveSession(s));

  /* 사진 올리기 모듈 초기화 */
  initUpload();
  setOnImageLoaded(handleImageLoaded);

  /* 스포이드 오버레이 초기화 */
  initEyedropperOverlay();
  setOnEyedropperPick(handleEyedropperPick);
  setOnMyPickRemove(handleMyPickRemove);

  /* 홈 버튼 (앱 타이틀 클릭 → 초기 화면으로 리셋) */
  const appTitle = document.getElementById('app-title');
  appTitle.addEventListener('click', handleHomeClick);
  /* 키보드로도 누를 수 있게 (Enter / Space) */
  appTitle.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleHomeClick();
  });

  /* Esc: 프롬프트 모달 → 서랍 → 스포이드 순으로 열려 있는 것 하나를 닫음 */
  document.addEventListener('keydown', handleEscape);

  /* 브라우저 뒤로가기·앞으로가기 */
  window.addEventListener('popstate', handlePopState);

  /* 다시 뽑기 버튼 */
  document.getElementById('btn-repick')
    .addEventListener('click', handleRepick);

  /* 보관 버튼: 현재 팔레트를 히스토리에 담음 */
  document.getElementById('btn-keep')
    .addEventListener('click', handleKeep);

  /* 랜덤 섞기 버튼 */
  document.getElementById('btn-shuffle')
    .addEventListener('click', handleShuffle);

  /* 대비 슬라이더 */
  document.getElementById('contrast-slider')
    .addEventListener('input', handleContrastSlider);

  /* 대비 초기화 버튼 */
  document.getElementById('btn-contrast-reset')
    .addEventListener('click', handleContrastReset);

  /* 라이트·다크 전환 버튼 */
  document.getElementById('btn-light')
    .addEventListener('click', () => handleModeChange('light'));
  document.getElementById('btn-dark')
    .addEventListener('click', () => handleModeChange('dark'));

  /* AI 프롬프트 복사 버튼 */
  initPrompt();

  /* 저장 버튼·서랍 */
  initSaveButton();
  initDrawer();
  setOnCardLoaded(handleCardLoaded);

  /* 목업 탭 네비게이션 초기화 */
  initMockupTabs();

  /* 슬라이드·웹·앱 탭 좌우 내비게이션 초기화 */
  initSlideViewer();
  initPageViewer('web');
  initPageViewer('app');

  /* 홈 화면 저장된 팔레트 목록 초기 렌더 */
  renderHomePalettes();

  /* 새로고침 전에 하던 작업이 있으면 되살림 */
  restoreSession();

  /* 저장 안 된 작업이 있을 때 탭 닫기·새로고침 시 경고 */
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* 페이지를 떠나기 직전 상태를 바로 기록 (0.3초 대기 중인 변경까지 포함) */
  window.addEventListener('pagehide', () => saveSession(state, true));

  console.log('VibePicker 초기화 완료');
});

/* ==========================================================
   사진 로드 후 색 추출 파이프라인
   ========================================================== */

/**
 * 사진이 올라왔을 때 실행
 * 후보 색 추출 → 대표색 5개 선택 → 역할 배정 → UI 업데이트
 */
function handleImageLoaded(img) {
  /* 워크스페이스로 전환 + 읽기 전용 해제 */
  showWorkspace();
  setReadonlyView(false);

  /* 사진 캔버스 영역 표시 */
  document.getElementById('image-display').hidden = false;

  /* 1. 후보 색 10~12개 추출 */
  const candidates = extractColors(img);
  setState({ candidateColors: candidates, myPicks: new Set(), paletteHistory: [] });

  /* 히스토리 DOM 비우기 (다른 사진으로 넘어갈 때 이전 히스토리 사라짐) */
  renderPaletteHistory();

  /* 2. 후보 중 서로 멀리 떨어진 5개 선택 */
  const palette = pickDistinct(candidates, new Set(), 5);
  setState({ palette, isDirty: true });

  /* 3. 색 역할 자동 배정 */
  const roles = assignRoles(palette);
  setState({ roles });

  /* 4. UI 업데이트 */
  updateUI();
}

/* ==========================================================
   UI 업데이트 (색이 바뀔 때마다 호출)
   ========================================================== */

/**
 * 현재 state를 바탕으로 칩·목업·경고·버튼 상태를 갱신
 * - 대비 슬라이더 오프셋이 있으면 칩 표시에도 반영
 */
function updateUI() {
  const { palette, myPicks, roles, mode, contrastOffset } = state;

  /* 칩은 원본 팔레트 그대로 표시 — 대비 조정은 목업(역할)에만 반영 */
  const displayPalette = palette;
  const displayRoles = contrastOffset !== 0
    ? applyContrastToRoles(roles, contrastOffset)
    : roles;

  /* 칩 렌더링 */
  renderChips(displayPalette, myPicks);

  /* 칩 섹션 표시 (tools-section은 setReadonlyView가 제어) */
  document.getElementById('chips-section').hidden = false;

  /* 뷰어 하단 컨트롤 표시 */
  document.getElementById('mockup-viewer-footer').hidden = false;

  /* 역할 배지 업데이트 */
  renderRolesBadges(displayRoles);

  /* 목업 렌더링 */
  renderMockups(displayRoles, mode);

  /* 프롬프트 섹션 표시 */
  showPromptSection();

  /* 가독성 경고 */
  updateWarning(displayRoles);
}

/**
 * 역할별 색 배지를 #roles-display 안에 표시
 */
function renderRolesBadges(roles) {
  const container = document.getElementById('roles-display');
  const labels = [
    ['배경', roles.bg],
    ['글자', roles.text],
    ['메인', roles.main],
    ['포인트', roles.point],
    ['보조', roles.sub],
  ];
  container.innerHTML = labels.map(([label, hex]) => `
    <div class="role-badge">
      <span class="role-dot" style="background-color:${hex}"></span>
      <span class="role-name">${label}</span>
      <span class="role-hex">${hex}</span>
    </div>
  `).join('');
}

/**
 * 가독성 경고 업데이트 — 지금 보고 있는 모드(라이트·다크)의 글자·배경 기준
 */
function updateWarning(roles) {
  const isDark = state.mode === 'dark';
  const { warn, message } = readabilityWarning(
    isDark ? roles.textDark : roles.text,
    isDark ? roles.bgDark   : roles.bg,
  );
  const warningEl = document.getElementById('readability-warning');
  const warningText = document.getElementById('warning-text');

  if (warn) {
    warningEl.hidden = false;
    warningText.textContent = message;
  } else {
    warningEl.hidden = true;
  }
}

/* ==========================================================
   버튼 핸들러
   ========================================================== */

/** 다시 뽑기: 사진에서 새로 추출한 후보 중 다른 5색 선택 (횟수 제한 없음) */
function handleRepick() {
  const { image, myPicks, palette } = state;
  if (!image) return;

  /* 사진에서 후보색을 새로 추출 → 누를 때마다 k-means 초기값이 달라져 다른 결과 */
  const freshCandidates = extractColors(image);
  setState({ candidateColors: freshCandidates });

  /* my pick으로 고정된 색의 HEX 집합 */
  const myPickColors = new Set(
    [...myPicks].map((i) => palette[i])
  );

  /* 풀 셔플 + 고정색 보존으로 매번 다른 5색 선택 */
  const newPalette = pickDistinct(freshCandidates, myPickColors, 5);

  /* my pick 인덱스를 새 팔레트 위치에 맞게 재매핑 */
  const newMyPicks = new Set();
  [...myPickColors].forEach((hex) => {
    const idx = newPalette.indexOf(hex);
    if (idx !== -1) newMyPicks.add(idx);
  });

  const roles = assignRoles(newPalette);
  setState({ palette: newPalette, myPicks: newMyPicks, roles, isDirty: true });
  updateUI();
}

/**
 * 보관 버튼: 현재 팔레트를 히스토리에 추가
 * - 다시 뽑기해도 히스토리는 유지됨 (시안 비교용)
 * - 이미 보관된 동일 팔레트는 중복 추가하지 않음
 */
const MAX_HISTORY = 5;

function handleKeep() {
  const { palette, myPicks, paletteHistory } = state;
  if (!palette.length) return;

  const warningEl = document.getElementById('keep-warning');
  const btn       = document.getElementById('btn-keep');

  /* 이미 같은 팔레트가 보관되어 있으면 무시 */
  const isDuplicate = paletteHistory.some(
    (entry) => entry.palette.join() === palette.join()
  );
  if (isDuplicate) return;

  /* 최대 5개 초과 시 경고 + 버튼 흔들기 */
  if (paletteHistory.length >= MAX_HISTORY) {
    warningEl.hidden = false;
    btn.classList.remove('shaking');
    void btn.offsetWidth; /* reflow: 애니메이션 재시작을 위해 필요 */
    btn.classList.add('shaking');
    btn.addEventListener('animationend', () => btn.classList.remove('shaking'), { once: true });
    return;
  }

  /* 저장 성공 시 경고 숨김 */
  warningEl.hidden = true;

  const newHistory = [
    ...paletteHistory,
    /* 칩에 보이는 색 그대로 보관 (대비 슬라이더는 목업에만 적용되므로 제외) */
    { palette: [...palette], myPicks: [...myPicks] },
  ];
  setState({ paletteHistory: newHistory });
  renderPaletteHistory();
}

/**
 * 히스토리 카드 렌더링
 * — 보관된 팔레트들을 5색 직사각형 카드로 표시
 */
function renderPaletteHistory() {
  const container = document.getElementById('palette-history');
  if (!container) return;
  container.innerHTML = '';

  state.paletteHistory.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.title = '클릭하면 이 팔레트로 복원';

    /* 내부 래퍼: border-radius + overflow:hidden 을 여기서만 처리해
       X 버튼이 카드 바깥으로 걸칠 수 있게 함 */
    const inner = document.createElement('div');
    inner.className = 'history-card-inner';

    /* 5색 블록 (패딩 없이 가로로 꽉 채움) */
    const colors = document.createElement('div');
    colors.className = 'history-card-colors';
    entry.palette.forEach((hex) => {
      const block = document.createElement('div');
      block.className = 'history-color-block';
      block.style.backgroundColor = hex;
      colors.appendChild(block);
    });
    inner.appendChild(colors);
    card.appendChild(inner);

    /* X 버튼: 호버 시 우측 상단 표시, 클릭 시 삭제 */
    const removeBtn = document.createElement('button');
    removeBtn.className = 'history-card-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = '보관 목록에서 삭제';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHistoryRemove(idx);
    });
    card.appendChild(removeBtn);

    /* 카드 클릭 → 해당 팔레트를 현재 작업 화면으로 복원 */
    card.addEventListener('click', () => handleHistoryRestore(idx));

    container.appendChild(card);
  });
}

/** 히스토리 카드 클릭 → 해당 팔레트를 현재 팔레트로 복원 (히스토리는 유지) */
function handleHistoryRestore(idx) {
  const entry = state.paletteHistory[idx];
  if (!entry) return;

  const myPicks = new Set(entry.myPicks);
  const roles = assignRoles(entry.palette);
  setState({ palette: entry.palette, myPicks, roles, contrastOffset: 0, isDirty: true });
  document.getElementById('contrast-slider').value = 0;
  updateUI();
}

/** 히스토리 카드 X → 해당 항목 삭제 */
function handleHistoryRemove(idx) {
  const newHistory = state.paletteHistory.filter((_, i) => i !== idx);
  setState({ paletteHistory: newHistory });
  renderPaletteHistory();
}

/** 랜덤 섞기: 같은 5색 안에서 역할만 무작위 재배정
 * (색 자체를 바꾸는 건 "다시 뽑기"의 몫 — my pick 유무와 상관없이 동작이 같음)
 */
function handleShuffle() {
  const roles = shuffleRoles(state.palette);
  setState({ roles, isDirty: true });
  updateUI();
}

/** 대비 초기화: 슬라이더를 0으로 되돌리고 원본 팔레트 색으로 복원 */
function handleContrastReset() {
  document.getElementById('contrast-slider').value = 0;
  setState({ contrastOffset: 0, isDirty: true });

  /* 역할은 유지, 대비 조정 없이 그대로 표시 */
  const { roles } = state;
  renderChips(state.palette, state.myPicks);
  renderMockups(roles, state.mode);
  renderRolesBadges(roles);
  updateWarning(roles);
}

/**
 * 대비 슬라이더
 * - 역할(roles)은 원본 그대로 유지 — state.roles 재배정 없음
 * - 밝은 색 ↔ 어두운 색을 양방향으로 조절 (adjustContrast)
 */
function handleContrastSlider(e) {
  const offset = parseInt(e.target.value, 10);
  setState({ contrastOffset: offset, isDirty: true });

  const displayRoles = applyContrastToRoles(state.roles, offset);

  /* 칩은 원본 팔레트 그대로 — 대비 조정은 목업에만 반영 */
  renderChips(state.palette, state.myPicks);
  renderMockups(displayRoles, state.mode);
  renderRolesBadges(displayRoles);
  updateWarning(displayRoles);
}

/** 라이트·다크 전환 */
function handleModeChange(mode) {
  setState({ mode, isDirty: true });
  syncModeButtons(mode);
  applyMode(mode);

  updateWarning(applyContrastToRoles(state.roles, state.contrastOffset));
}

/**
 * 서랍에서 카드 불러오기
 * 이미지는 저장하지 않으므로 팔레트·역할 정보만 복원 (읽기 전용)
 */
function handleCardLoaded(card, key) {
  if (!card.palette?.length) return;

  const offset = card.contrastOffset ?? 0;

  /* 저장된 roles를 그대로 사용 (없으면 원본 팔레트로 재계산) */
  const roles = card.roles ?? assignRoles(card.palette);

  setState({
    image:          null,
    previewImage:   null,
    palette:        card.palette,
    myPicks:        new Set(card.myPicks ?? []),
    roles,
    contrastOffset: offset,
    mode:           card.mode ?? 'light',
    loadedCardKey:  key,
    isDirty:        false,
    paletteHistory: [],
  });

  /* 히스토리 DOM 비우기 */
  renderPaletteHistory();

  /* 대비 슬라이더 위치 복원 */
  document.getElementById('contrast-slider').value = offset;

  /* 라이트·다크 버튼 상태 복원 */
  syncModeButtons(card.mode ?? 'light');

  /* 워크스페이스 전환 + 읽기 전용 (이미지 없음, 편집 버튼 숨김) */
  showWorkspace();
  document.getElementById('image-display').hidden = true;
  setReadonlyView(true);

  updateUI();
}

/**
 * 읽기 전용 뷰 진입 / 해제
 * - true : 서랍에서 불러온 상태 — 업로드·편집 버튼 모두 숨김
 * - false: 사진 업로드 후 정상 편집 상태
 */
function setReadonlyView(readonly) {
  document.getElementById('repick-row').hidden      = readonly;
  document.getElementById('palette-history').hidden = readonly;
}

/** 라이트·다크 버튼의 눌린 표시를 현재 모드에 맞춤 */
function syncModeButtons(mode) {
  document.getElementById('btn-light').classList.toggle('active', mode === 'light');
  document.getElementById('btn-dark').classList.toggle('active', mode === 'dark');
}

/** 워크스페이스 화면으로 전환 (홈 화면 숨김) */
function showWorkspace() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('workspace').hidden   = false;

  /* 방문 기록에 작업 화면을 한 칸 추가 → 뒤로가기를 누르면 홈으로 */
  if (location.hash !== WORK_HASH) history.pushState(null, '', WORK_HASH);
}

/** 홈 화면으로 전환 (워크스페이스 숨김) */
function showHomeScreen() {
  document.getElementById('workspace').hidden   = true;
  document.getElementById('home-screen').hidden = false;
}

/** 목업 탭 네비게이션 초기화 */
function initMockupTabs() {
  document.querySelectorAll('.mockup-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      /* 탭 버튼 활성 상태 */
      document.querySelectorAll('.mockup-tab-btn')
        .forEach((b) => b.classList.toggle('active', b === btn));

      /* 탭 패널 표시/숨김 */
      document.querySelectorAll('.mockup-tab-pane').forEach((pane) => {
        pane.hidden = pane.id !== `mockup-pane-${tab}`;
      });

      /* 프롬프트 탭 컨텍스트 업데이트 */
      setActiveTab(tab);
    });
  });
}

/**
 * 화살표 + 점으로 한 장씩 넘기는 뷰어 (슬라이드 탭·웹 탭 공용)
 * @param {{ prevId: string, nextId: string, dotsId: string, count: number,
 *           show: (index: number) => void }} options
 *   - show: index번째 화면만 보이게 만드는 함수
 */
function initCarousel({ prevId, nextId, dotsId, count, show }) {
  let current = 0;

  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  const dots    = document.getElementById(dotsId).querySelectorAll('.slide-dot');

  function update() {
    show(current);

    /* 도트 활성화 */
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));

    /* 첫 장이면 이전 화살표 숨김, 마지막 장이면 다음 화살표 숨김 */
    prevBtn.hidden = current === 0;
    nextBtn.hidden = current === count - 1;
  }

  prevBtn.addEventListener('click', () => { if (current > 0) { current--; update(); } });
  nextBtn.addEventListener('click', () => { if (current < count - 1) { current++; update(); } });

  update();
}

/** 슬라이드 탭: 표지 · 본문 · 차트 중 한 장만 표시 */
function initSlideViewer() {
  const SLIDE_IDS = ['mockup-slide-cover', 'mockup-slide-body', 'mockup-slide-chart'];

  initCarousel({
    prevId: 'slide-prev',
    nextId: 'slide-next',
    dotsId: 'slide-dots',
    count:  SLIDE_IDS.length,
    show:   (index) => SLIDE_IDS.forEach((id, i) => {
      document.getElementById(id).hidden = i !== index;
    }),
  });
}

/**
 * 웹 탭(홈 · 제품 · 요금)·앱 탭(홈 · 분석 · 카드): 한 목업 안에서 화면 전환
 * 실제 표시는 mockups.css가 카드의 data-page 값으로 처리
 * @param {'web'|'app'} name
 */
function initPageViewer(name) {
  initCarousel({
    prevId: `${name}-prev`,
    nextId: `${name}-next`,
    dotsId: `${name}-dots`,
    count:  3,
    show:   (index) => { document.getElementById(`mockup-${name}`).dataset.page = index; },
  });
}

/** 스포이드로 색 선택됐을 때 */
function handleEyedropperPick(hex, chipIdx) {
  const newPalette = [...state.palette];
  newPalette[chipIdx] = hex;

  const newMyPicks = new Set(state.myPicks);
  newMyPicks.add(chipIdx);

  const roles = assignRoles(newPalette);
  setState({ palette: newPalette, myPicks: newMyPicks, roles, isDirty: true });
  updateUI();
}

/**
 * my pick X 버튼을 눌렀을 때
 * - 해당 칩의 my pick 해제
 * - 후보색 중 나머지 4색과 가장 다른 색으로 교체
 */
function handleMyPickRemove(chipIdx) {
  const { myPicks } = state;

  /* 색은 그대로 두고 my pick 상태만 해제 */
  const newMyPicks = new Set(myPicks);
  newMyPicks.delete(chipIdx);

  setState({ myPicks: newMyPicks, isDirty: true });
  updateUI();
}

/**
 * 저장 안 된 작업이 있으면 홈으로 가도 되는지 확인 (카드 불러오기와 같은 방식)
 * @returns {boolean} 가도 되면 true
 */
function confirmLeaveWorkspace() {
  if (!state.isDirty) return true;
  return window.confirm(
    '저장하지 않은 작업이 있어요.\n처음 화면으로 가면 현재 작업이 사라집니다. 계속할까요?'
  );
}

/** 홈 버튼(앱 타이틀) 클릭 */
function handleHomeClick() {
  if (!confirmLeaveWorkspace()) return;
  resetToHome();
  /* 주소의 작업 화면 표시 제거 */
  if (location.hash === WORK_HASH) history.replaceState(null, '', HOME_URL);
}

/**
 * 브라우저 뒤로가기·앞으로가기
 * - 작업 화면에서 뒤로가기 → 홈으로 (저장 안 된 작업이 있으면 확인)
 * - 홈에서 앞으로가기 → 되살릴 작업이 없으므로 홈에 머무름
 */
function handlePopState() {
  const inWorkspace = !document.getElementById('workspace').hidden;

  if (location.hash === WORK_HASH) {
    if (!inWorkspace) history.replaceState(null, '', HOME_URL);
    return;
  }
  if (!inWorkspace) return;

  if (!confirmLeaveWorkspace()) {
    /* 취소: 작업 화면에 그대로 — 방금 빠져나온 기록을 다시 채움 */
    history.pushState(null, '', WORK_HASH);
    return;
  }
  resetToHome();
}

/** Esc: 프롬프트 모달 → 서랍 → 스포이드 순으로 열려 있는 것 하나를 닫음 */
function handleEscape(e) {
  if (e.key !== 'Escape') return;

  if (!document.getElementById('prompt-modal').hidden) {
    closePromptModal();
  } else if (!document.getElementById('drawer-panel').hidden) {
    closeDrawer();
  } else {
    deactivateEyedropper();
  }
}

/**
 * 새로고침 전에 하던 작업을 되살림 (storage.js가 sessionStorage에 보관해 둔 상태)
 * - 사진을 올려 작업하던 중이었으면 사진까지, 서랍 카드를 보던 중이었으면 읽기 전용으로
 */
function restoreSession() {
  const saved = loadSession();

  if (!saved?.palette?.length || !saved.roles) {
    /* 되살릴 작업이 없는데 주소만 작업 화면이면 홈 주소로 정리 */
    if (location.hash === WORK_HASH) history.replaceState(null, '', HOME_URL);
    return;
  }

  const apply = (img) => {
    setState({
      image:           img,
      previewImage:    img ? saved.previewImage : null,
      candidateColors: saved.candidateColors ?? [],
      palette:         saved.palette,
      myPicks:         new Set(saved.myPicks ?? []),
      roles:           saved.roles,
      contrastOffset:  saved.contrastOffset ?? 0,
      mode:            saved.mode ?? 'light',
      loadedCardKey:   saved.loadedCardKey ?? null,
      paletteHistory:  saved.paletteHistory ?? [],
      isDirty:         Boolean(saved.isDirty),
    });

    document.getElementById('contrast-slider').value = state.contrastOffset;
    syncModeButtons(state.mode);

    showWorkspace();
    document.getElementById('image-display').hidden = !img;
    setReadonlyView(!img);   /* 사진이 없으면 서랍 카드처럼 읽기 전용 */
    renderPaletteHistory();
    updateUI();
  };

  if (saved.previewImage) restoreImage(saved.previewImage, apply);
  else apply(null);
}

/**
 * 초기 화면으로 완전 리셋
 */
function resetToHome() {
  /* 상태 초기화 */
  setState({
    image: null,
    previewImage: null,
    candidateColors: [],
    palette: [],
    myPicks: new Set(),
    roles: null,
    contrastOffset: 0,
    mode: 'light',
    loadedCardKey: null,
    isDirty: false,
    paletteHistory: [],
  });

  /* 홈 화면으로 전환 */
  showHomeScreen();

  /* 워크스페이스 내부 상태 초기화 */
  document.getElementById('upload-placeholder').hidden     = false;
  document.getElementById('image-display').hidden          = true;
  document.getElementById('chips-section').hidden          = true;
  document.getElementById('mockup-viewer-footer').hidden   = true;
  /* 프롬프트 아이콘 버튼 숨김 */
  const promptBtn = document.getElementById('btn-prompt-icon');
  if (promptBtn) promptBtn.hidden = true;

  /* 슬라이더·모드 버튼 리셋 */
  document.getElementById('contrast-slider').value = 0;
  syncModeButtons('light');

  /* 히스토리 카드 DOM 비우기 + 보관 경고 숨김 */
  const historyEl = document.getElementById('palette-history');
  if (historyEl) historyEl.innerHTML = '';
  document.getElementById('keep-warning').hidden = true;

  /* 읽기 전용 뷰 해제 */
  setReadonlyView(false);

  /* 홈 화면 팔레트 목록 갱신 */
  renderHomePalettes();

  /* 진행 중이던 스포이드 모드 해제 */
  deactivateEyedropper();
}
