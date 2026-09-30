/* ==========================================================
   main.js — 앱 진입점, 각 모듈을 불러와 연결
   모든 이벤트 흐름의 중심: 사진 → 색 추출 → 칩 표시 → 목업 → 프롬프트
   ========================================================== */

import { state, setState, subscribe } from './state.js';
import { initUpload, setOnImageLoaded }            from './upload.js';
import { extractColors, pickDistinct }             from './extract.js';
import { adjustLightness, adjustContrast }          from './color.js';
import { assignRoles, shuffleRoles, readabilityWarning } from './roles.js';
import { renderChips, initEyedropperOverlay,
         setOnEyedropperPick, setOnMyPickRemove,
         deactivateEyedropper } from './chips.js';
import { renderMockups, applyMode }                from './mockups.js';
import { initPrompt, showPromptSection, setActiveTab } from './prompt.js';
import { initSaveButton, initDrawer,
         setOnCardLoaded, onStateChange,
         renderHomePalettes }                      from './storage.js';

/* ==========================================================
   초기화
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  /* 상태 변경 감지 → 저장 버튼 활성화 */
  subscribe(onStateChange);

  /* 사진 올리기 모듈 초기화 */
  initUpload();
  setOnImageLoaded(handleImageLoaded);

  /* 스포이드 오버레이 초기화 */
  initEyedropperOverlay();
  setOnEyedropperPick(handleEyedropperPick);
  setOnMyPickRemove(handleMyPickRemove);

  /* 홈 버튼 (앱 타이틀 클릭 → 초기 화면으로 리셋) */
  document.getElementById('app-title')
    .addEventListener('click', handleHomeClick);

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

  /* 슬라이드 좌우 내비게이션 초기화 */
  initSlideViewer();

  /* 홈 화면 저장된 팔레트 목록 초기 렌더 */
  renderHomePalettes();

  /* 저장 안 된 작업이 있을 때 탭 닫기·새로고침 시 경고 */
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

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
  updateWarning(displayRoles.text, displayRoles.bg);
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
    <div style="
      display:inline-flex;align-items:center;gap:6px;
      padding:4px 10px;border-radius:99px;
      border:1px solid #e0e0e0;font-size:12px;
    ">
      <span style="
        width:12px;height:12px;border-radius:50%;
        background:${hex};border:1px solid rgba(0,0,0,0.1);
        display:inline-block;flex-shrink:0;
      "></span>
      <span style="color:#666">${label}</span>
      <span style="font-weight:500">${hex}</span>
    </div>
  `).join('');
}

/**
 * 가독성 경고 업데이트
 */
function updateWarning(textHex, bgHex) {
  const { warn, message } = readabilityWarning(textHex, bgHex);
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
  const { palette, myPicks, paletteHistory, contrastOffset } = state;
  if (!palette.length) return;

  const warningEl = document.getElementById('keep-warning');
  const btn       = document.getElementById('btn-keep');

  /* 화면에 보이는 팔레트(슬라이더 적용된 색)를 보관 */
  const effectivePalette = contrastOffset !== 0
    ? palette.map((hex) => adjustContrast(hex, contrastOffset))
    : [...palette];

  /* 이미 같은 팔레트가 보관되어 있으면 무시 */
  const isDuplicate = paletteHistory.some(
    (entry) => entry.palette.join() === effectivePalette.join()
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
    { palette: effectivePalette, myPicks: [...myPicks] },
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

/** 랜덤 섞기: 5색 안에서 역할 무작위 재배정 */
function handleShuffle() {
  const { palette } = state;
  const roles = shuffleRoles(palette);
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
  updateWarning(roles.text, roles.bg);
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
  updateWarning(displayRoles.text, displayRoles.bg);
}

/** 라이트·다크 전환 */
function handleModeChange(mode) {
  setState({ mode, isDirty: true });

  document.getElementById('btn-light').classList.toggle('active', mode === 'light');
  document.getElementById('btn-dark').classList.toggle('active', mode === 'dark');

  applyMode(mode);

  const displayRoles = applyContrastToRoles(state.roles, state.contrastOffset);
  updateWarning(
    mode === 'dark' ? displayRoles.textDark : displayRoles.text,
    mode === 'dark' ? displayRoles.bgDark   : displayRoles.bg,
  );
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
    thumbnail:      null,
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

  /* 라이트·다크 버튼 상태 복원 */
  const mode = card.mode ?? 'light';
  document.getElementById('btn-light').classList.toggle('active', mode === 'light');
  document.getElementById('btn-dark').classList.toggle('active', mode === 'dark');

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
/**
 * 역할별 색에 대비 오프셋을 적용한 표시용 roles 반환
 * state.roles는 변경하지 않음
 */
/**
 * 역할별 색에 대비 오프셋을 적용한 표시용 roles 반환
 * bg / bgDark 는 건드리지 않음 — 팔레트 색조 기반 화이트/블랙으로 고정
 */
function applyContrastToRoles(roles, offset) {
  if (!roles || offset === 0) return roles;
  return {
    bg:       roles.bg,       /* 배경은 고정 */
    bgDark:   roles.bgDark,   /* 다크 배경도 고정 */
    text:     adjustContrast(roles.text,     offset),
    main:     adjustContrast(roles.main,     offset),
    point:    adjustContrast(roles.point,    offset),
    sub:      adjustContrast(roles.sub,      offset),
    textDark: adjustContrast(roles.textDark, offset),
  };
}

function setReadonlyView(readonly) {
  document.getElementById('repick-row').hidden      = readonly;
  document.getElementById('palette-history').hidden = readonly;
  document.getElementById('tools-section').hidden   = readonly; /* 역할 섞기 */
}

/** 워크스페이스 화면으로 전환 (홈 화면 숨김) */
function showWorkspace() {
  document.getElementById('home-screen').hidden = true;
  document.getElementById('workspace').hidden   = false;
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
 * 슬라이드 탭 내 좌우 내비게이션 초기화
 * 한 번에 한 장씩 표시, 도트 + 화살표로 페이지 전환
 */
function initSlideViewer() {
  const SLIDE_IDS = ['mockup-slide-cover', 'mockup-slide-body', 'mockup-slide-chart'];
  let current = 0;

  const prevBtn = document.getElementById('slide-prev');
  const nextBtn = document.getElementById('slide-next');
  const dots    = document.querySelectorAll('.slide-dot');

  function update() {
    /* 현재 슬라이드만 보이기 */
    SLIDE_IDS.forEach((id, i) => {
      document.getElementById(id).hidden = i !== current;
    });

    /* 도트 활성화 */
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));

    /* 첫 장이면 이전 화살표 숨김, 마지막 장이면 다음 화살표 숨김 */
    prevBtn.hidden = current === 0;
    nextBtn.hidden = current === SLIDE_IDS.length - 1;
  }

  prevBtn.addEventListener('click', () => { if (current > 0) { current--; update(); } });
  nextBtn.addEventListener('click', () => { if (current < SLIDE_IDS.length - 1) { current++; update(); } });

  update();
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
  const { palette, candidateColors, myPicks } = state;

  /* 나머지 4색 (교체될 칩 제외) */
  const remaining = palette.filter((_, i) => i !== chipIdx);

  /* 후보색 중 나머지 4색과 가장 멀리 떨어진 색 1개 고르기
     pickDistinct(candidates, fixed, count) 활용:
     fixed = 나머지 4색, count = 5 → 5번째가 새 색 */
  const candidates = candidateColors.length > 0 ? candidateColors : palette;
  const picked = pickDistinct(candidates, new Set(remaining), remaining.length + 1);
  const newColor = picked[remaining.length] ?? candidates[0];

  /* 팔레트 교체 */
  const newPalette = [...palette];
  newPalette[chipIdx] = newColor;

  /* my pick 해제 */
  const newMyPicks = new Set(myPicks);
  newMyPicks.delete(chipIdx);

  const roles = assignRoles(newPalette);
  setState({ palette: newPalette, myPicks: newMyPicks, roles, isDirty: true });
  updateUI();
}

/**
 * 홈 버튼 클릭 → 초기 화면으로 완전 리셋
 */
function handleHomeClick() {
  /* 상태 초기화 */
  setState({
    image: null,
    thumbnail: null,
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
  document.getElementById('tools-section').hidden          = true;
  document.getElementById('mockup-viewer-footer').hidden   = true;
  /* 프롬프트 아이콘 버튼 숨김 */
  const promptBtn = document.getElementById('btn-prompt-icon');
  if (promptBtn) promptBtn.hidden = true;

  /* 슬라이더·모드 버튼 리셋 */
  document.getElementById('contrast-slider').value = 0;
  document.getElementById('btn-light').classList.add('active');
  document.getElementById('btn-dark').classList.remove('active');

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
