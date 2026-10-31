/* ==========================================================
   icons.js — 브랜드 아이콘 세트 (Lucide · Tabler · Phosphor)
   브랜드 보드와 목업에 쓰는 아이콘만 CDN에서 SVG로 받아 캐시한다.
   VibePicker UI 아이콘(assets/icons.svg)과는 따로다.
   ========================================================== */

/* 아이콘 이름 (보드 12개 + 목업에서 더 쓰는 것) */
export const BOARD_ICONS = ['home', 'search', 'menu', 'user', 'heart', 'bell', 'mail', 'chat', 'calendar', 'folder', 'image', 'settings'];
export const EXTRA_ICONS = ['plus', 'check', 'clock', 'chevron-right', 'chevron-left', 'more', 'map-pin', 'users', 'chart', 'arrow-right'];
const ALL = [...BOARD_ICONS, ...EXTRA_ICONS];

/** 세트마다 같은 뜻의 아이콘 파일 이름이 다르다 */
export const ICON_SETS = {
  lucide: {
    name: 'Lucide', license: 'ISC', stroke: true,
    url: (n) => `https://unpkg.com/lucide-static@0.454.0/icons/${n}.svg`,
    names: {
      home: 'house', search: 'search', menu: 'menu', user: 'user', heart: 'heart', bell: 'bell', mail: 'mail',
      chat: 'message-circle', calendar: 'calendar', folder: 'folder', image: 'image', settings: 'settings',
      plus: 'plus', check: 'check', clock: 'clock', 'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left',
      more: 'ellipsis', 'map-pin': 'map-pin', users: 'users', chart: 'chart-column', 'arrow-right': 'arrow-right',
    },
  },
  tabler: {
    name: 'Tabler', license: 'MIT', stroke: true,
    url: (n) => `https://unpkg.com/@tabler/icons@3.19.0/icons/outline/${n}.svg`,
    names: {
      home: 'home', search: 'search', menu: 'menu-2', user: 'user', heart: 'heart', bell: 'bell', mail: 'mail',
      chat: 'message-circle', calendar: 'calendar', folder: 'folder', image: 'photo', settings: 'settings',
      plus: 'plus', check: 'check', clock: 'clock', 'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left',
      more: 'dots', 'map-pin': 'map-pin', users: 'users', chart: 'chart-bar', 'arrow-right': 'arrow-right',
    },
  },
  phosphor: {
    name: 'Phosphor', license: 'MIT', stroke: false,
    /* Phosphor는 선 굵기 대신 굵기별 파일이 따로 있다 */
    url: (n, w) => (w === 'regular'
      ? `https://unpkg.com/@phosphor-icons/core@2.1.1/assets/regular/${n}.svg`
      : `https://unpkg.com/@phosphor-icons/core@2.1.1/assets/${w}/${n}-${w}.svg`),
    names: {
      home: 'house', search: 'magnifying-glass', menu: 'list', user: 'user', heart: 'heart', bell: 'bell', mail: 'envelope-simple',
      chat: 'chat-circle', calendar: 'calendar-blank', folder: 'folder', image: 'image', settings: 'gear',
      plus: 'plus', check: 'check', clock: 'clock', 'chevron-right': 'caret-right', 'chevron-left': 'caret-left',
      more: 'dots-three', 'map-pin': 'map-pin', users: 'users', chart: 'chart-bar', 'arrow-right': 'arrow-right',
    },
  },
};

/** 굵기 → 선 굵기(Lucide·Tabler) / 파일 굵기(Phosphor) */
export const ICON_WEIGHTS = {
  thin:    { label: '얇게', stroke: 1.25, phosphor: 'light' },
  regular: { label: '보통', stroke: 1.75, phosphor: 'regular' },
  bold:    { label: '굵게', stroke: 2.4,  phosphor: 'bold' },
};

const cache = new Map(); /* "세트/굵기" → Map(아이콘 이름 → SVG 문자열) */

/**
 * 한 세트의 아이콘을 모두 받는다
 * @param {keyof ICON_SETS} setId
 * @param {keyof ICON_WEIGHTS} weight
 * @returns {Promise<Map<string, string>>} 아이콘 이름 → SVG 문자열 (class="b-icon")
 */
export async function loadIconSet(setId, weight) {
  const set = ICON_SETS[setId];
  /* 선으로 그린 세트는 굵기를 CSS로 바꾸므로 파일은 하나 */
  const fileWeight = set.stroke ? 'regular' : ICON_WEIGHTS[weight].phosphor;
  const key = `${setId}/${fileWeight}`;
  if (cache.has(key)) return cache.get(key);

  const entries = await Promise.all(ALL.map(async (name) => {
    try {
      const res = await fetch(set.url(set.names[name], fileWeight));
      if (!res.ok) throw new Error(res.status);
      return [name, clean(await res.text())];
    } catch {
      return [name, FALLBACK];
    }
  }));
  const map = new Map(entries);
  cache.set(key, map);
  return map;
}

/** 라이선스 주석·고정 크기·원래 class를 지우고 b-icon class를 붙인다 */
function clean(svg) {
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').trim();
  /* 맨 바깥 <svg …> 태그에서만 지운다 (안쪽 <rect width> 등은 그대로) */
  return body.replace(/<svg\b[^>]*>/, (tag) => tag
    .replace(/\s(width|height|class)="[^"]*"/g, '')
    .replace('<svg', '<svg class="b-icon" aria-hidden="true" focusable="false"'));
}

/* 인터넷이 끊겨 받지 못했을 때 자리만 지키는 빈 동그라미 */
const FALLBACK = '<svg class="b-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';
