/* ==========================================================
   main.js — 앱 진입점, 각 모듈을 불러와 연결
   모든 이벤트 흐름의 중심: 사진 → 색 추출 → 칩 표시 → 목업 → 프롬프트
   ========================================================== */

import { state, setState, subscribe } from './state.js';
import { initUpload, setOnImageLoaded }            from './upload.js';
import { extractColors, pickDistinct }             from './extract.js';
import { adjustLightness }                         from './color.js';
import { assignRoles, shuffleRoles, readabilityWarning } from './roles.js';
import { renderChips, initEyedropperOverlay,
         setOnEyedropperPick, setOnMyPickRemove,
         deactivateEyedropper } from './chips.js';
import { renderMockups, applyMode }                from './mockups.js';
import { initPrompt, showPromptSection }           from './prompt.js';
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
  /* 읽기 전용 뷰였으면 해제 (서랍에서 불러온 뒤 새 사진 올릴 때) */
  setReadonlyView(false);

  /* 사진 업로드 화면에서만 보이는 저장 팔레트 목록 숨김 */
  document.getElementById('home-palettes-section').hidden = true;

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

  /* 대비 오프셋이 있으면 표시용 팔레트에 적용 (원본 palette는 보존) */
  const displayPalette = contrastOffset !== 0
    ? palette.map((hex) => adjustLightness(hex, contrastOffset))
    : palette;

  /* 칩 렌더링 */
  renderChips(displayPalette, myPicks);

  /* 도구 섹션 표시 */
  document.getElementById('tools-section').hidden = false;

  /* 역할 배지 업데이트 */
  renderRolesBadges(roles);

  /* 목업 렌더링 */
  renderMockups(roles, mode);

  /* 프롬프트 섹션 표시 */
  showPromptSection();

  /* 가독성 경고 */
  updateWarning(roles.text, roles.bg);
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
    ? palette.map((hex) => adjustLightness(hex, contrastOffset))
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
  const slider = document.getElementById('contrast-slider');
  slider.value = 0;
  setState({ contrastOffset: 0, isDirty: true });

  const roles = assignRoles(state.palette);
  setState({ roles });
  renderChips(state.palette, state.myPicks);
  renderMockups(roles, state.mode);
  renderRolesBadges(roles);
  updateWarning(roles.text, roles.bg);
}

/** 대비 슬라이더: 색조 유지하며 명도 대비 조절 */
function handleContrastSlider(e) {
  const offset = parseInt(e.target.value, 10);
  setState({ contrastOffset: offset, isDirty: true });

  /* 원본 팔레트에 명도 오프셋 적용 */
  const adjusted = state.palette.map((hex) => adjustLightness(hex, offset));
  const roles = assignRoles(adjusted);
  setState({ roles });

  renderChips(adjusted, state.myPicks);
  renderMockups(roles, state.mode);
  renderRolesBadges(roles);
  updateWarning(roles.text, roles.bg);
}

/** 라이트·다크 전환 */
function handleModeChange(mode) {
  setState({ mode, isDirty: true });

  /* 버튼 활성 상태 토글 */
  document.getElementById('btn-light').classList.toggle('active', mode === 'light');
  document.getElementById('btn-dark').classList.toggle('active', mode === 'dark');

  applyMode(mode);
  updateWarning(
    mode === 'dark' ? state.roles.textDark : state.roles.text,
    mode === 'dark' ? state.roles.bgDark   : state.roles.bg,
  );
}

/**
 * 서랍에서 카드 불러오기
 * 이미지는 저장하지 않으므로 팔레트·역할 정보만 복원 (읽기 전용)
 */
function handleCardLoaded(card, key) {
  if (!card.palette?.length) return;

  const offset = card.contrastOffset ?? 0;

  /* 원본 palette와 offset을 기반으로 roles를 재계산 */
  const adjustedPalette = offset !== 0
    ? card.palette.map((hex) => adjustLightness(hex, offset))
    : card.palette;
  const roles = assignRoles(adjustedPalette);

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

  /* 업로드 영역 통째로 숨김, 버튼·도구 영역 숨김, 저장 팔레트 목록 숨김 */
  document.getElementById('home-palettes-section').hidden = true;
  setReadonlyView(true);

  updateUI();
}

/**
 * 읽기 전용 뷰 진입 / 해제
 * - true : 서랍에서 불러온 상태 — 업로드·편집 버튼 모두 숨김
 * - false: 사진 업로드 후 정상 편집 상태
 */
function setReadonlyView(readonly) {
  document.getElementById('upload-section').hidden  = readonly;
  document.getElementById('repick-row').hidden      = readonly;
  document.getElementById('palette-history').hidden = readonly;
  document.getElementById('tools-controls').hidden  = readonly;
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

  /* 읽기 전용 뷰 해제 */
  setReadonlyView(false);

  /* UI 초기화 */
  document.getElementById('upload-placeholder').hidden = false;
  document.getElementById('image-display').hidden      = true;
  document.getElementById('chips-section').hidden      = true;
  document.getElementById('tools-section').hidden      = true;
  document.getElementById('mockups-section').hidden    = true;
  document.getElementById('prompt-section').hidden     = true;

  /* 슬라이더·모드 버튼 리셋 */
  document.getElementById('contrast-slider').value = 0;
  document.getElementById('btn-light').classList.add('active');
  document.getElementById('btn-dark').classList.remove('active');

  /* 히스토리 카드 DOM 비우기 + 보관 경고 숨김 */
  const historyEl = document.getElementById('palette-history');
  if (historyEl) historyEl.innerHTML = '';
  document.getElementById('keep-warning').hidden = true;

  /* 홈 화면 팔레트 목록 갱신 */
  renderHomePalettes();

  /* 진행 중이던 스포이드 모드 해제 */
  deactivateEyedropper();
}
