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
         setOnEyedropperPick, deactivateEyedropper } from './chips.js';
import { renderMockups, applyMode }                from './mockups.js';
import { initPrompt, showPromptSection }           from './prompt.js';
import { initSaveButton, initDrawer,
         setOnCardLoaded, onStateChange }          from './storage.js';

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

  /* 다시 뽑기 버튼 */
  document.getElementById('btn-repick')
    .addEventListener('click', handleRepick);

  /* 랜덤 섞기 버튼 */
  document.getElementById('btn-shuffle')
    .addEventListener('click', handleShuffle);

  /* 대비 슬라이더 */
  document.getElementById('contrast-slider')
    .addEventListener('input', handleContrastSlider);

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
  /* 1. 후보 색 10~12개 추출 */
  const candidates = extractColors(img);
  setState({ candidateColors: candidates, myPicks: new Set() });

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
 */
function updateUI() {
  const { palette, myPicks, roles, mode } = state;

  /* 칩 렌더링 */
  renderChips(palette, myPicks);

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

/** 다시 뽑기: 후보 중 다른 5색 선택 (my pick 칩 유지) */
function handleRepick() {
  const { candidateColors, myPicks, palette } = state;

  /* my pick으로 고정된 색의 HEX 집합 */
  const myPickColors = new Set(
    [...myPicks].map((i) => palette[i])
  );

  /* 새 5색 선택 */
  const newPalette = pickDistinct(candidateColors, myPickColors, 5);

  /* my pick 인덱스를 새 팔레트에 맞게 재매핑 */
  const newMyPicks = new Set();
  [...myPickColors].forEach((hex) => {
    const idx = newPalette.indexOf(hex);
    if (idx !== -1) newMyPicks.add(idx);
  });

  const roles = assignRoles(newPalette);
  setState({ palette: newPalette, myPicks: newMyPicks, roles, isDirty: true });
  updateUI();
}

/** 랜덤 섞기: 5색 안에서 역할 무작위 재배정 */
function handleShuffle() {
  const { palette } = state;
  const roles = shuffleRoles(palette);
  setState({ roles, isDirty: true });
  updateUI();
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

/** 서랍에서 카드 불러오기 */
function handleCardLoaded(card, key) {
  /* 저장된 이미지(썸네일)를 화면에 보여줌 */
  if (card.thumbnail) {
    const img = new Image();
    img.onload = () => {
      setState({
        image: img,
        thumbnail: card.thumbnail,
        palette: card.palette,
        myPicks: new Set(card.myPicks),
        roles: card.roles,
        contrastOffset: card.contrastOffset ?? 0,
        mode: card.mode ?? 'light',
        loadedCardKey: key,
        isDirty: false,
      });

      /* 대비 슬라이더 값 복원 */
      document.getElementById('contrast-slider').value = card.contrastOffset ?? 0;

      /* 업로드 placeholder를 숨기고 이미지 캔버스 표시 */
      const placeholder  = document.getElementById('upload-placeholder');
      const imageDisplay = document.getElementById('image-display');
      const canvas       = document.getElementById('image-canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      placeholder.hidden  = true;
      imageDisplay.hidden = false;

      updateUI();
    };
    img.src = card.thumbnail;
  }
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
