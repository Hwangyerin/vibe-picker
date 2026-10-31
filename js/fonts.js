/* ==========================================================
   fonts.js — 브랜드 서체 목록, 사진 분위기에 맞는 추천, 불러오기
   모두 상업적으로 무료인 한글 서체 (OFL). 고른 서체만 그때 불러온다.
   ========================================================== */

import { hexToOklch } from './oklab.js';

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family=';

/**
 * 서체 목록
 * - mood: 이 서체가 잘 어울리는 분위기 (0~1)
 *   calm 차분함 · vivid 선명함 · warm 따뜻함 · firm 단단함
 * - displayOnly: 제목에만 어울리는 굵은 서체 (본문 목록에서 뺀다)
 * - heading: 제목에 쓸 굵기
 */
export const FONTS = [
  { id: 'pretendard', name: 'Pretendard', kind: '고딕', family: "'Pretendard Variable', Pretendard", css: null, heading: 700,
    mood: { calm: 0.6, vivid: 0.5, warm: 0.3, firm: 0.6 } },
  { id: 'suit', name: 'SUIT', kind: '고딕', family: "'SUIT Variable', SUIT", heading: 700,
    css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css',
    mood: { calm: 0.5, vivid: 0.7, warm: 0.4, firm: 0.4 } },
  { id: 'noto-sans', name: 'Noto Sans KR', kind: '고딕', family: "'Noto Sans KR'", google: 'Noto+Sans+KR:wght@400;500;700', heading: 700,
    mood: { calm: 0.7, vivid: 0.3, warm: 0.3, firm: 0.5 } },
  { id: 'ibm-plex', name: 'IBM Plex Sans KR', kind: '고딕', family: "'IBM Plex Sans KR'", google: 'IBM+Plex+Sans+KR:wght@400;500;700', heading: 700,
    mood: { calm: 0.4, vivid: 0.3, warm: 0.1, firm: 0.9 } },
  { id: 'gothic-a1', name: 'Gothic A1', kind: '고딕', family: "'Gothic A1'", google: 'Gothic+A1:wght@400;500;700', heading: 700,
    mood: { calm: 0.4, vivid: 0.5, warm: 0.2, firm: 0.7 } },
  { id: 'gowun-dodum', name: '고운돋움', kind: '고딕', family: "'Gowun Dodum'", google: 'Gowun+Dodum', heading: 400,
    mood: { calm: 0.6, vivid: 0.2, warm: 0.9, firm: 0.1 } },
  { id: 'noto-serif', name: 'Noto Serif KR', kind: '명조', family: "'Noto Serif KR'", google: 'Noto+Serif+KR:wght@400;600;700', heading: 700,
    mood: { calm: 0.8, vivid: 0.2, warm: 0.4, firm: 0.5 } },
  { id: 'gowun-batang', name: '고운바탕', kind: '명조', family: "'Gowun Batang'", google: 'Gowun+Batang:wght@400;700', heading: 700,
    mood: { calm: 0.7, vivid: 0.1, warm: 0.9, firm: 0.2 } },
  { id: 'nanum-myeongjo', name: '나눔명조', kind: '명조', family: "'Nanum Myeongjo'", google: 'Nanum+Myeongjo:wght@400;700;800', heading: 800,
    mood: { calm: 0.9, vivid: 0.1, warm: 0.5, firm: 0.3 } },
  { id: 'hahmlet', name: '함렛', kind: '명조', family: "'Hahmlet'", google: 'Hahmlet:wght@400;600;700', heading: 700,
    mood: { calm: 0.3, vivid: 0.6, warm: 0.3, firm: 0.8 } },
  { id: 'black-han-sans', name: '검은고딕', kind: '제목용', family: "'Black Han Sans'", google: 'Black+Han+Sans', heading: 400, displayOnly: true,
    mood: { calm: 0, vivid: 0.9, warm: 0.2, firm: 0.9 } },
  { id: 'do-hyeon', name: '도현', kind: '제목용', family: "'Do Hyeon'", google: 'Do+Hyeon', heading: 400, displayOnly: true,
    mood: { calm: 0.1, vivid: 0.8, warm: 0.6, firm: 0.5 } },
];

export const fontById = (id) => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** CSS에서 쓸 font-family 값 (불러오는 동안 보일 대체 서체 포함) */
export function fontStack(font) {
  const fallback = font.kind === '명조' ? "'Apple SD Gothic Neo', serif" : "'Apple SD Gothic Neo', sans-serif";
  return `${font.family}, ${fallback}`;
}

/* ==========================================================
   사진 분위기 → 서체 추천
   ========================================================== */

/**
 * 팔레트에서 분위기 읽기
 * @param {string[]} palette - HEX 5개
 * @returns {{ calm: number, vivid: number, warm: number, firm: number }} 0~1
 */
export function paletteMood(palette) {
  const lch = palette.map(hexToOklch);
  const avgC = lch.reduce((a, [, C]) => a + C, 0) / lch.length;
  const Ls = lch.map(([L]) => L);
  const spread = Math.max(...Ls) - Math.min(...Ls);

  /* 채도가 있는 색 중 따뜻한 색조(빨강~노랑, 20°~100°)의 비율 */
  let warmW = 0;
  let totalW = 0;
  lch.forEach(([, C, h]) => {
    if (C < 0.02) return;
    totalW += C;
    if (h >= 20 && h <= 100) warmW += C;
  });

  const vivid = Math.min(1, avgC / 0.12);
  return {
    calm: 1 - vivid,
    vivid,
    warm: totalW ? warmW / totalW : 0.3,
    firm: Math.min(1, Math.max(0, (spread - 0.45) / 0.4)),
  };
}

/**
 * 분위기에 맞는 순서로 서체 정렬
 * @param {ReturnType<typeof paletteMood>} mood
 * @param {object} [opts]
 * @param {boolean} [opts.body] - 본문용 (제목 전용 서체 빼기)
 * @returns {Array<{ font: object, score: number }>}
 */
export function rankFonts(mood, { body = false } = {}) {
  return FONTS
    .filter((f) => !(body && f.displayOnly))
    .map((font) => ({
      font,
      /* 코사인 유사도: 분위기의 "방향"이 얼마나 닮았는지.
         단순 곱의 합이면 모든 값이 큰 서체(검은고딕 등)가 늘 1등이 된다 */
      score: cosine(mood, font.mood),
    }))
    .sort((a, b) => b.score - a.score);
}

function cosine(a, b) {
  const keys = Object.keys(a);
  const dot = keys.reduce((s, k) => s + a[k] * b[k], 0);
  const na = Math.hypot(...keys.map((k) => a[k]));
  const nb = Math.hypot(...keys.map((k) => b[k]));
  return na && nb ? dot / (na * nb) : 0;
}

/* ==========================================================
   불러오기
   ========================================================== */

const loaded = new Set(['pretendard']); /* Pretendard는 index.html에서 이미 */
const previewLoaded = new Map();         /* 서체 id → 미리보기용으로 받은 글자 */

function addStylesheet(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  return link;
}

/**
 * 서체 전체 불러오기. 다 받아질 때까지 기다린다 (그동안은 이전 서체가 보여 깜빡임이 없다)
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function loadFont(id) {
  const font = fontById(id);
  if (!loaded.has(id)) {
    loaded.add(id);
    addStylesheet(font.css ?? `${GOOGLE}${font.google}`);
  }
  try {
    await Promise.race([
      document.fonts.load(`${font.heading} 32px ${font.family}`, '가A'),
      new Promise((r) => setTimeout(r, 4000)), /* 느린 연결에서 무한정 기다리지 않게 */
    ]);
  } catch {
    /* 못 받아도 대체 서체로 보인다 */
  }
}

/**
 * 선택 목록 미리보기용: 그 글자만 담은 아주 작은 서체 파일을 받는다 (Google Fonts text=)
 * @param {string} text - 미리보기에 쓸 글자 (워드마크 등)
 */
export function loadPreviews(text) {
  const chars = [...new Set(`${text}가나`)].join('');
  FONTS.forEach((font) => {
    if (loaded.has(font.id) || !font.google) return;
    if (previewLoaded.get(font.id)?.includes(chars)) return;
    previewLoaded.set(font.id, (previewLoaded.get(font.id) ?? '') + chars);
    addStylesheet(`${GOOGLE}${font.google}&text=${encodeURIComponent(chars)}`);
  });
  /* SUIT는 text= 를 지원하지 않으므로 미리보기 때 통째로 받는다 (가변 서체 하나) */
  if (!loaded.has('suit')) {
    loaded.add('suit');
    addStylesheet(fontById('suit').css);
  }
}
