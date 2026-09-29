/* ==========================================================
   state.js — 현재 작업 상태와 변경 감지
   앱 전체에서 공유하는 유일한 데이터 원천(single source of truth)
   ========================================================== */

/**
 * 앱 상태 객체
 * - 모든 기능 모듈이 이 객체를 읽고 씀
 * - 직접 바꾸지 말고 반드시 setState()를 통해 변경
 */
const state = {
  /* 현재 올라온 이미지 (HTMLImageElement) */
  image: null,

  /* 사진 썸네일 (base64 문자열, 서랍 저장용) */
  thumbnail: null,

  /* 후보 색 10~12개 (k-means 결과, HEX 문자열 배열) */
  candidateColors: [],

  /* 현재 표시 중인 대표색 5개 (HEX 문자열 배열) */
  palette: [],

  /* my pick 칩 인덱스 집합 (다시 뽑기 때 유지) */
  myPicks: new Set(),

  /* 색 역할 배정 결과
     { bg, text, main, point, sub } — 각각 HEX 문자열 */
  roles: null,

  /* 대비 슬라이더 값 (-50 ~ +50, 기본 0) */
  contrastOffset: 0,

  /* 현재 모드: 'light' | 'dark' */
  mode: 'light',

  /* 서랍에서 불러온 카드의 localStorage 키 (덮어쓰기용) */
  loadedCardKey: null,

  /* 저장되지 않은 변경이 있는지 여부 (저장 버튼 활성화 조건) */
  isDirty: false,
};

/**
 * 상태를 업데이트하고, 등록된 리스너를 호출
 * @param {Partial<typeof state>} patch - 바꿀 값만 담은 객체
 */
function setState(patch) {
  Object.assign(state, patch);

  /* 상태가 바뀔 때마다 리스너에 알림 */
  listeners.forEach((fn) => fn(state));
}

/**
 * 변경 감지 리스너 목록
 * 상태가 바뀌면 각 리스너가 순서대로 실행됨
 */
const listeners = [];

/**
 * 상태 변경 리스너 등록
 * @param {(state: typeof state) => void} fn
 */
function subscribe(fn) {
  listeners.push(fn);
}

export { state, setState, subscribe };
