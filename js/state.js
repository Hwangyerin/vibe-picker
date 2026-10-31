/* ==========================================================
   state.js — 작업 상태 (앱 전체가 함께 읽는 단 하나의 원천)
   직접 바꾸지 말고 setState()로 바꾼다. 바뀌면 subscribe한 함수가 불린다
   ========================================================== */

const state = {
  /* 화면: 'home' | 'work' */
  view: 'home',

  /* 올라온 사진 (HTMLImageElement). 서랍에서 불러온 브랜드면 null */
  image: null,

  /* 새로고침 뒤 되살리기용 사진 (base64, 긴 변 800px) */
  previewImage: null,

  /* 사진에서 뽑은 후보 색 [{ hex, lab, lch, area }] (extract.js) */
  candidates: [],

  /* 팔레트 스타일: 'natural' | 'vivid' | 'muted' | 'raw' */
  paletteStyle: 'natural',

  /* 다시 뽑기 횟수 (0이면 사진마다 항상 같은 첫 결과) */
  attempt: 0,

  /* 최근에 보여 준 조합 서명 (다시 뽑기에서 같은 조합을 피한다) */
  recentSignatures: [],

  /* 지금 팔레트 5색 (HEX 배열, 대비 조절 전 원본) */
  palette: [],

  /* 스포이드로 고른 칩 위치 (다시 뽑기에도 남는다) */
  myPicks: new Set(),

  /* 색 역할 { bg, text, main, point, sub, bgDark, textDark } */
  roles: null,

  /* 대비 슬라이더 (-30 ~ 30) */
  contrastOffset: 0,

  /* 미리보기 모드: 'light' | 'dark' (VibePicker UI 모드와는 따로) */
  mode: 'light',

  /* 캔버스에 보이는 화면: 'board' | 'mobile' | 'slides' */
  canvasView: 'board',

  /* 보관한 시안 [{ palette, myPicks, roles, contrastOffset }] — 이 탭 안에서만 */
  paletteHistory: [],

  /* 서랍에서 불러온 브랜드의 저장 키 (고쳐서 저장하면 덮어쓴다) */
  loadedCardKey: null,

  /* 저장하지 않은 변경이 있는지 */
  isDirty: false,
};

const listeners = [];

/**
 * 상태를 바꾸고 구독자에게 알린다
 * @param {Partial<typeof state>} patch
 */
function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state, patch));
}

/**
 * 상태가 바뀔 때마다 불릴 함수 등록
 * @param {(state: typeof state, patch: object) => void} fn
 */
function subscribe(fn) {
  listeners.push(fn);
}

export { state, setState, subscribe };
