/* ==========================================================
   storage.js — 저장 버튼, 서랍, localStorage
   팔레트 카드 최대 20개 저장, 새로고침 후에도 유지
   ========================================================== */

import { state, setState } from './state.js';

/* localStorage 키 접두사 */
const KEY_PREFIX = 'vp_card_';
/* 카드 키 목록을 저장하는 키 */
const INDEX_KEY  = 'vp_index';
/* 최대 저장 개수 */
const MAX_CARDS  = 20;

/* =========================================================
   저장 버튼
   ========================================================= */

/**
 * 저장 버튼 초기화
 */
export function initSaveButton() {
  const btn = document.getElementById('btn-save');
  btn.addEventListener('click', saveCurrentCard);
}

/**
 * 현재 작업 상태를 카드로 저장
 */
function saveCurrentCard() {
  const { palette, myPicks, roles, contrastOffset, mode, thumbnail, loadedCardKey } = state;

  if (!palette.length || !roles) return;

  /* 카드 인덱스 불러오기 */
  const index = loadIndex();

  /* 최대 개수 초과 확인 */
  if (!loadedCardKey && index.length >= MAX_CARDS) {
    alert('서랍이 가득 찼어요. 오래된 카드를 지워 주세요.');
    return;
  }

  /* 저장할 카드 데이터 */
  const card = {
    palette,
    myPicks: [...myPicks],
    roles,
    contrastOffset,
    mode,
    thumbnail,
    savedAt: Date.now(),
  };

  /* 덮어쓰기 or 새 카드 */
  const key = loadedCardKey ?? `${KEY_PREFIX}${Date.now()}`;
  localStorage.setItem(key, JSON.stringify(card));

  /* 인덱스 업데이트 */
  if (!index.includes(key)) {
    index.push(key);
    saveIndex(index);
  }

  /* 상태 업데이트 */
  setState({ loadedCardKey: key, isDirty: false });

  /* 저장 버튼 비활성화 */
  document.getElementById('btn-save').disabled = true;

  /* 서랍 열려있으면 목록 새로고침 */
  if (!document.getElementById('drawer-panel').hidden) {
    renderDrawerList();
  }
}

/* =========================================================
   서랍 패널
   ========================================================= */

/**
 * 서랍 버튼·패널 초기화
 */
export function initDrawer() {
  const btnDrawer  = document.getElementById('btn-drawer');
  const btnClose   = document.getElementById('btn-drawer-close');
  const backdrop   = document.getElementById('drawer-backdrop');

  btnDrawer.addEventListener('click', openDrawer);
  btnClose.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
}

function openDrawer() {
  document.getElementById('drawer-backdrop').hidden = false;
  document.getElementById('drawer-panel').hidden    = false;
  renderDrawerList();
}

function closeDrawer() {
  document.getElementById('drawer-backdrop').hidden = true;
  document.getElementById('drawer-panel').hidden    = true;
}

/**
 * 서랍 목록 렌더링
 */
function renderDrawerList() {
  const list  = document.getElementById('drawer-list');
  const index = loadIndex();

  if (index.length === 0) {
    list.innerHTML = '<p class="drawer-empty">저장된 팔레트가 없어요.</p>';
    return;
  }

  list.innerHTML = '';

  /* 최근 저장 순서로 역순 표시 */
  [...index].reverse().forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const card = JSON.parse(raw);
    list.appendChild(buildCardEl(key, card));
  });

  /* 서랍 가득 찬 경고 */
  if (index.length >= MAX_CARDS) {
    const notice = document.createElement('p');
    notice.className = 'drawer-full-notice';
    notice.textContent = '서랍이 가득 찼어요. 오래된 카드를 지워 주세요.';
    list.prepend(notice);
  }
}

/**
 * 팔레트 카드 DOM 요소 생성
 */
function buildCardEl(key, card) {
  const el = document.createElement('div');
  el.className = 'palette-card';

  /* 썸네일 */
  const thumb = document.createElement('div');
  thumb.className = 'card-thumb';
  if (card.thumbnail) {
    const img = document.createElement('img');
    img.src = card.thumbnail;
    img.alt = '저장된 팔레트 사진';
    thumb.appendChild(img);
  }

  /* 5색 미니 스와치 */
  const colors = document.createElement('div');
  colors.className = 'card-colors';
  card.palette.forEach((hex) => {
    const sw = document.createElement('div');
    sw.className = 'card-swatch';
    sw.style.backgroundColor = hex;
    colors.appendChild(sw);
  });

  /* 삭제 버튼 */
  const btnDel = document.createElement('button');
  btnDel.className = 'btn-card-delete';
  btnDel.textContent = '✕';
  btnDel.title = '카드 삭제';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation(); /* 카드 클릭(불러오기)과 충돌 방지 */
    deleteCard(key);
    renderDrawerList();
  });

  /* 카드 클릭 → 팔레트 불러오기 */
  el.addEventListener('click', () => {
    loadCard(key, card);
    closeDrawer();
  });

  el.appendChild(thumb);
  el.appendChild(colors);
  el.appendChild(btnDel);

  return el;
}

/* =========================================================
   카드 불러오기 (main.js로 콜백 위임)
   ========================================================= */

let onCardLoaded = null;

/**
 * 카드 불러오기 콜백 등록 (main.js에서 등록)
 * @param {(card: object, key: string) => void} fn
 */
export function setOnCardLoaded(fn) {
  onCardLoaded = fn;
}

/**
 * 저장된 카드를 작업 화면으로 불러옴
 */
function loadCard(key, card) {
  onCardLoaded?.(card, key);
}

/* =========================================================
   카드 삭제
   ========================================================= */

function deleteCard(key) {
  localStorage.removeItem(key);
  const index = loadIndex().filter((k) => k !== key);
  saveIndex(index);

  /* 현재 불러온 카드를 삭제하면 loadedCardKey 초기화 */
  if (state.loadedCardKey === key) {
    setState({ loadedCardKey: null });
  }
}

/* =========================================================
   localStorage 헬퍼
   ========================================================= */

function loadIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/* =========================================================
   저장 버튼 활성화 감지 (상태 변화 구독)
   ========================================================= */

/**
 * state.isDirty가 true이면 저장 버튼 활성화
 * subscribe()를 통해 state 변경 시마다 호출됨
 */
export function onStateChange(newState) {
  const btn = document.getElementById('btn-save');
  if (!btn) return;
  btn.disabled = !newState.isDirty;
}
