/* ==========================================================
   storage.js — 서랍(localStorage)과 새로고침 복원(sessionStorage) (v2)
   화면은 drawer.js가 그리고, 여기서는 읽고 쓰기만 한다.

   카드 형식
   - v1 (실습): { palette, myPicks, roles, contrastOffset, mode, savedAt }
   - v2: v1 + { version: 2, brand, paletteStyle }
   v1에서 저장한 카드도 그대로 읽는다 (브랜드 설정은 기본값으로)
   ========================================================== */

const KEY_PREFIX = 'vp_card_';  /* v1과 같은 키 → 실습 때 저장한 카드도 서랍에 보인다 */
const INDEX_KEY = 'vp_index';
const SESSION_KEY = 'vp_session';
export const MAX_CARDS = 20;

/* ---------- localStorage를 쓸 수 없는 브라우저(사생활 보호 창 등)에서도 앱은 동작해야 한다 ---------- */

function read(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; /* 용량 초과 또는 저장 막힘 */
  }
}

/* ==========================================================
   서랍
   ========================================================== */

/**
 * 저장한 카드 목록 (최근 저장 순)
 * @returns {Array<{ key: string, card: object }>}
 */
export function listCards() {
  const index = read(localStorage, INDEX_KEY, []);
  return index
    .map((key) => ({ key, card: read(localStorage, key, null) }))
    .filter(({ card }) => card?.palette?.length)
    .sort((a, b) => (b.card.savedAt ?? 0) - (a.card.savedAt ?? 0));
}

/**
 * 카드 저장 (key가 있으면 덮어쓰기)
 * @param {object} card
 * @param {string|null} key
 * @returns {{ ok: true, key: string } | { ok: false, reason: 'full' | 'quota' }}
 */
export function saveCard(card, key = null) {
  const index = read(localStorage, INDEX_KEY, []);
  const exists = key && index.includes(key);
  if (!exists && index.length >= MAX_CARDS) return { ok: false, reason: 'full' };

  const k = exists ? key : `${KEY_PREFIX}${Date.now()}`;
  if (!write(localStorage, k, { version: 2, ...card, savedAt: Date.now() })) {
    return { ok: false, reason: 'quota' };
  }
  if (!exists) write(localStorage, INDEX_KEY, [...index, k]);
  return { ok: true, key: k };
}

/** 카드 지우기 */
export function deleteCard(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
  write(localStorage, INDEX_KEY, read(localStorage, INDEX_KEY, []).filter((k) => k !== key));
}

/** 카드 하나 읽기 */
export function getCard(key) {
  return read(localStorage, key, null);
}

/* ==========================================================
   새로고침 복원 — 탭을 닫으면 사라진다 (서랍과는 별개)
   ========================================================== */

let timer = 0;

/**
 * 작업 상태 임시 보관. 자주 불리므로 0.3초 모아서 쓴다
 * @param {object} data
 * @param {boolean} [now] - 페이지를 떠나기 직전에는 바로
 */
export function saveSession(data, now = false) {
  clearTimeout(timer);
  const run = () => {
    if (!data) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* 무시 */ }
      return;
    }
    /* 사진까지 담으면 용량이 넘칠 수 있다 → 넘치면 사진만 빼고 다시 */
    if (!write(sessionStorage, SESSION_KEY, data)) {
      write(sessionStorage, SESSION_KEY, { ...data, previewImage: null });
    }
  };
  if (now) run();
  else timer = setTimeout(run, 300);
}

export function loadSession() {
  return read(sessionStorage, SESSION_KEY, null);
}
