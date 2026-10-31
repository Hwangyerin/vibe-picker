/* ==========================================================
   export.js — 브랜드 시스템 내보내기 글 만들기
   AI 프롬프트(모바일 웹 / 슬라이드) · CSS 변수 · Tailwind 설정 · JSON 토큰
   네 형식의 값은 모두 화면(보드·목업)에 보이는 값과 같다 (같은 brandTokens 결과를 쓴다)
   ========================================================== */

import { ICON_SETS, ICON_WEIGHTS } from './icons.js';
import { contrastRatio } from './color.js';

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family=';

/**
 * @typedef {object} ExportInput
 * @property {object} brand - 설정
 * @property {object} light - brandTokens(..., 'light')
 * @property {object} dark - brandTokens(..., 'dark')
 */

/** 서체를 불러오는 CSS 주소 */
function fontUrl(font) {
  if (font.id === 'pretendard') return 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
  return font.css ?? `${GOOGLE}${font.google}`;
}

/** CSS font-family 값 */
function family(font) {
  return `${font.family}, ${font.kind === '명조' ? 'serif' : 'sans-serif'}`;
}

function iconLine(brand) {
  const set = ICON_SETS[brand.iconSet];
  const w = ICON_WEIGHTS[brand.iconWeight];
  return set.stroke
    ? `${set.name} 세트만 쓰고 선 굵기는 ${w.stroke} (${w.label})`
    : `${set.name} 세트만 쓰고 굵기는 ${w.phosphor} (${w.label})`;
}

const radiusText = (px) => (px >= 999 ? '완전히 둥글게 (pill, 9999px)' : `${px}px`);

/* ==========================================================
   AI 프롬프트
   ========================================================== */

/**
 * @param {ExportInput} input
 * @param {'mobile'|'slides'} target
 */
export function buildPrompt({ brand, light: L, dark: D }, target) {
  const name = brand.wordmark.trim() || '서비스';
  const ratio = contrastRatio(L.text, L.bg).toFixed(1);

  const rows = [
    ['바탕', 'bg', '페이지 배경'],
    ['면', 'surface', '카드, 입력창, 탭바'],
    ['글자', 'text', '본문, 제목'],
    ['보조 글자', 'muted', '설명, 날짜, 자리 표시 글자'],
    ['경계선', 'border', '카드·입력창 테두리 (1px)'],
    ['Primary', 'primary', '주요 버튼 하나, 선택된 탭, 오늘 날짜 — 화면마다 한 가지 행동에만'],
    ['Primary 위 글자', 'primaryFg', 'Primary 면 위의 글자·아이콘'],
    ['Secondary', 'secondary', '옅은 강조 면: 진행률 카드, 아이콘 바탕, 보조 버튼'],
    ['Secondary 위 글자', 'onSecondary', 'Secondary 면 위의 글자'],
    ['Point', 'point', '작은 표시: 점, 태그 바탕(옅게)'],
    ['Sub', 'sub', '보조 태그, 아바타'],
  ];

  const colorTable = [
    '| 역할 | 라이트 | 다크 | 쓰는 곳 |',
    '| --- | --- | --- | --- |',
    ...rows.map(([label, key, use]) => `| ${label} | ${L[key]} | ${D[key]} | ${use} |`),
  ].join('\n');

  const target_ = target === 'mobile'
    ? {
      title: '모바일 웹 화면',
      size: '가로 390px 기준 모바일 웹 화면을',
      rules: [
        '터치 대상은 최소 44px',
        '제목 28~32px, 본문 15~16px, 보조 글자 12~13px',
        '그림자는 떠 있는 요소(플로팅 버튼, 시트)에만 쓰고, 나머지는 1px 경계선으로 나눕니다',
      ],
    }
    : {
      title: '발표 슬라이드',
      size: '16:9 (1920×1080 또는 960×540) 발표 슬라이드를',
      rules: [
        '한 장에 하나의 메시지. 제목은 결론을 문장으로 씁니다',
        '제목 48~64px(1920 기준), 본문 24~28px, 각주 16px',
        '차트는 강조할 값 하나만 Primary, 나머지는 Primary를 옅게 (30%) 칠합니다',
        '표지는 심볼과 워드마크, 오른쪽 또는 아래에 Secondary 면',
      ],
    };

  return `# ${name} 브랜드로 ${target_.title} 만들기

아래 브랜드 규칙을 지켜 ${target_.size} 만들어 주세요.
만들 화면: (여기에 적어 주세요. 예: 로그인 화면, 설정 화면, 3장짜리 중간 발표)

## 1. 색
라이트 모드가 기본입니다. 다크 모드는 prefers-color-scheme: dark일 때 다크 열의 값으로 바꿉니다.

${colorTable}

회색 5단계 (라이트): ${L.grays.join(', ')}

## 2. 서체
- 제목: ${L.fontDisplay.name}, 굵기 ${L.fontDisplay.heading} — ${fontUrl(L.fontDisplay)}
- 본문: ${L.fontBody.name}, 굵기 400(본문) / 600(강조) — ${fontUrl(L.fontBody)}
- 숫자·시간은 font-variant-numeric: tabular-nums

## 3. 아이콘
- ${iconLine(brand)}
- 이모지를 아이콘 대신 쓰지 않습니다

## 4. 모양
- 카드·패널 둥글기: ${radiusText(L.radiusCard)}
- 버튼·입력창·태그 둥글기: ${radiusText(L.radiusControl)}
${target_.rules.map((r) => `- ${r}`).join('\n')}

## 5. 지켜야 할 것
1. 위 표에 없는 색을 새로 만들지 않습니다 (같은 색의 투명도 조절은 괜찮습니다)
2. Primary는 화면마다 주요 행동 하나에만 씁니다. 모든 버튼·링크·아이콘을 Primary로 칠하지 않습니다
3. 본문 글자와 바탕의 대비는 4.5:1 이상입니다 (지금 라이트 ${ratio}:1)
4. 그라데이션 배경, 유리(blur) 효과, 보라·파랑 기본 색을 쓰지 않습니다
5. "손쉽게", "한눈에" 같은 상투적인 문구 대신 구체적인 문장을 씁니다
`;
}

/* ==========================================================
   CSS 변수
   ========================================================== */

const VAR_KEYS = [
  ['bg', 'bg'], ['surface', 'surface'], ['text', 'text'], ['muted', 'muted'], ['border', 'border'],
  ['primary', 'primary'], ['on-primary', 'primaryFg'], ['secondary', 'secondary'], ['on-secondary', 'onSecondary'],
  ['point', 'point'], ['sub', 'sub'],
];

function colorVars(t, indent) {
  return [
    ...VAR_KEYS.map(([n, k]) => `${indent}--color-${n}: ${t[k]};`),
    ...t.grays.map((g, i) => `${indent}--gray-${i + 1}: ${g};`),
  ].join('\n');
}

/** @param {ExportInput} input */
export function buildCss({ brand, light: L, dark: D }) {
  const fonts = [...new Set([fontUrl(L.fontDisplay), fontUrl(L.fontBody)])];
  return `/* ${brand.wordmark || '브랜드'} 토큰 — VibePicker에서 만듦 */
${fonts.map((u) => `@import url("${u}");`).join('\n')}

:root {
${colorVars(L, '  ')}

  --font-display: ${family(L.fontDisplay)};
  --font-display-weight: ${L.fontDisplay.heading};
  --font-body: ${family(L.fontBody)};

  --radius-card: ${L.radiusCard}px;
  --radius-control: ${L.radiusControl >= 999 ? 9999 : L.radiusControl}px;
  --icon-stroke: ${L.iconStroke}; /* ${ICON_SETS[brand.iconSet].name} */

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
${colorVars(D, '    ')}
    color-scheme: dark;
  }
}
`;
}

/* ==========================================================
   Tailwind 설정 (theme.extend)
   ========================================================== */

/** @param {ExportInput} input */
export function buildTailwind({ brand, light: L, dark: D }) {
  const colors = (t) => Object.fromEntries(VAR_KEYS.map(([n, k]) => [n, t[k]]));
  const obj = {
    colors: {
      brand: { ...colors(L), gray: Object.fromEntries(L.grays.map((g, i) => [(i + 1) * 100, g])) },
      'brand-dark': colors(D),
    },
    fontFamily: {
      display: [L.fontDisplay.family.replace(/'/g, ''), L.fontDisplay.kind === '명조' ? 'serif' : 'sans-serif'],
      body: [L.fontBody.family.replace(/'/g, ''), L.fontBody.kind === '명조' ? 'serif' : 'sans-serif'],
    },
    borderRadius: {
      card: `${L.radiusCard}px`,
      control: L.radiusControl >= 999 ? '9999px' : `${L.radiusControl}px`,
    },
  };
  return `// ${brand.wordmark || '브랜드'} — tailwind.config.js 의 theme.extend 에 넣으세요 (VibePicker에서 만듦)
// 다크 모드: class="dark:bg-brand-dark-bg dark:text-brand-dark-text" 처럼 brand-dark 색을 씁니다
// 서체 불러오기: ${[...new Set([fontUrl(L.fontDisplay), fontUrl(L.fontBody)])].join('  ')}
module.exports = {
  theme: {
    extend: ${JSON.stringify(obj, null, 2).replace(/\n/g, '\n    ')},
  },
};
`;
}

/* ==========================================================
   JSON 토큰 (Design Tokens 형식)
   ========================================================== */

/** @param {ExportInput} input */
export function buildJson({ brand, light: L, dark: D }) {
  const colorGroup = (t) => Object.fromEntries([
    ...VAR_KEYS.map(([n, k]) => [n, { $type: 'color', $value: t[k] }]),
    ...t.grays.map((g, i) => [`gray-${i + 1}`, { $type: 'color', $value: g }]),
  ]);
  const tokens = {
    $description: `${brand.wordmark || '브랜드'} 디자인 토큰 — VibePicker`,
    color: { light: colorGroup(L), dark: colorGroup(D) },
    font: {
      display: { $type: 'fontFamily', $value: L.fontDisplay.family.replace(/'/g, ''), weight: L.fontDisplay.heading, url: fontUrl(L.fontDisplay) },
      body: { $type: 'fontFamily', $value: L.fontBody.family.replace(/'/g, ''), url: fontUrl(L.fontBody) },
    },
    radius: {
      card: { $type: 'dimension', $value: `${L.radiusCard}px` },
      control: { $type: 'dimension', $value: L.radiusControl >= 999 ? '9999px' : `${L.radiusControl}px` },
    },
    icon: {
      set: ICON_SETS[brand.iconSet].name,
      weight: brand.iconWeight,
      stroke: L.iconStroke,
    },
    wordmark: brand.wordmark,
  };
  return `${JSON.stringify(tokens, null, 2)}\n`;
}

/** 형식 이름 → 만들기 */
export const FORMATS = {
  prompt: { label: 'AI 프롬프트', build: (input, target) => buildPrompt(input, target) },
  css: { label: 'CSS 변수', build: buildCss },
  tailwind: { label: 'Tailwind', build: buildTailwind },
  json: { label: 'JSON', build: buildJson },
};
