/* ==========================================================
   prompt.js — AI 프롬프트 생성, 미리보기 모달, 복사
   현재 탭(슬라이드 / 웹 / 앱)에 맞는 프롬프트를 생성
   ========================================================== */

import { state } from './state.js';

/* 현재 활성 탭 — initMockupTabs에서 업데이트 (main.js에서 호출) */
let activeTab = 'slide';

export function setActiveTab(tab) {
  activeTab = tab;
}

/* =========================================================
   프롬프트 빌더
   ========================================================= */

/** 라이트/다크 팔레트 테이블 공통 블록 */
function paletteBlock(roles, mode) {
  const lightBg   = roles.bg;
  const lightText = roles.text;
  const darkBg    = roles.bgDark;
  const darkText  = roles.textDark;
  const primary   = mode === 'dark' ? 'dark' : 'light';

  return `## Color Palette

### Light Mode${primary === 'light' ? '  ← current default' : ''}
| Role  | Hex | Usage |
|-------|-----|-------|
| bg    | \`${lightBg}\` | Page / card background |
| text  | \`${lightText}\` | All body text, headings, labels |
| main  | \`${roles.main}\` | Brand color — nav, primary buttons, links |
| point | \`${roles.point}\` | CTA buttons, badges, highlights |
| sub   | \`${roles.sub}\` | Dividers, placeholders, muted text |

### Dark Mode${primary === 'dark' ? '  ← current default' : ''}
| Role  | Hex | Usage |
|-------|-----|-------|
| bg    | \`${darkBg}\` | Page / card background |
| text  | \`${darkText}\` | All body text, headings, labels |
| main  | \`${roles.main}\` | Same role as light mode |
| point | \`${roles.point}\` | Same role as light mode |
| sub   | \`${roles.sub}\` | Same role as light mode |`;
}

/** 공통 색 사용 규칙 */
const COLOR_RULES = `## Color Rules (follow strictly)
1. Use **bg** only for backgrounds — never on text or interactive elements.
2. Use **text** for all readable content. Maintain WCAG AA contrast (≥ 4.5:1) against bg.
3. Use **main** for the primary brand element per section (nav bar, primary button, active tab).
4. Use **point** sparingly — 1–2 elements max per section — to direct the user's eye.
5. Use **sub** for low-emphasis elements that should recede visually.
6. Never use pure \`#FFFFFF\` or \`#000000\`. Use the bg/text values above.
7. Never add new colors. For hover/active states, use opacity variants (e.g. main at 80% opacity).`;

/** 공통 기본 스타일 */
const BASE_STYLE = `## Typography & Layout
- Font: **Pretendard**
  CDN: \`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css\`
- Type scale: ~28–32px heading / 16px body / 13px caption
- Line height: 1.5–1.7 for body text
- Spacing: min 16px padding inside cards, 24–40px between sections
- Border radius: 8–12px for cards/buttons, 9999px for pills/badges
- Shadows: subtle only (e.g. \`0 2px 12px rgba(0,0,0,0.08)\`)
- Style: clean, minimal — let the palette be the personality. No heavy gradients or textures.`;

/** 슬라이드용 프롬프트 */
function buildSlidePrompt() {
  const { roles, mode } = state;
  if (!roles) return '';

  return `You are a presentation designer. Create slides using **exactly** the color palette below — do not substitute or add any colors not listed.

${paletteBlock(roles, mode)}

---

${COLOR_RULES}

---

## Slide-Specific Guidelines
- **Cover slide**: use bg as the full-bleed background; main as an accent stripe or shape; text/heading in the text color.
- **Content slides**: white-ish bg for readability; use main for section headers and rule lines; point for highlighted callouts or data labels.
- **Charts / graphs**: use main for the primary data series, point for the highlight bar/line, sub for secondary or reference series. Axis labels in sub color.
- **Typography**: title ~32–40px bold, body ~18–22px, caption ~14px. Use Pretendard.
- Slide aspect ratio: 16:9.
- Keep layouts clean with generous whitespace — avoid clutter.

---

${BASE_STYLE}

---

**Now create:** (describe the slide deck topic and structure below)
`;
}

/** 웹/앱용 프롬프트 */
function buildWebAppPrompt(type) {
  const { roles, mode } = state;
  if (!roles) return '';

  const typeLabel = type === 'app' ? 'mobile app' : 'web interface';
  const extras = type === 'app'
    ? `## Mobile App Guidelines
- Design for a ~390px wide viewport (iPhone-sized).
- Include a top navigation bar (background: main) and a bottom tab bar.
- Use touch-friendly tap targets (min 44×44px).
- Cards should have soft border-radius (12–16px) and light shadow.
- Bottom tab bar: active icon/label in main color, inactive in sub.`
    : `## Web Interface Guidelines
- Design for a desktop viewport (~1280px), responsive down to 768px.
- Include a sticky top navigation bar with logo (main color) and nav links.
- Use a clear visual hierarchy: hero → features/content → CTA.
- CTA buttons: background point, text bg (or white). Primary buttons: background main.
- Cards and sections should breathe — use generous padding (32–48px).`;

  return `You are a UI/UX designer and front-end developer. Build the ${typeLabel} described at the end of this prompt using **exactly** the color palette below.

${paletteBlock(roles, mode)}

---

${COLOR_RULES}

---

${extras}

---

## Component Color Mapping
| Component | Color |
|-----------|-------|
| Page background | bg |
| All body text | text |
| Primary button | main (text: bg) |
| CTA / accent button | point (text: bg) |
| Nav bar background | main or bg |
| Card background | bg with slight shadow |
| Input border (default) | sub |
| Input border (focus) | main |
| Disabled / placeholder | sub |
| Section dividers | sub at low opacity |

---

${BASE_STYLE}

---

**Now build:** (describe what you want below)
`;
}

export function buildPrompt() {
  if (activeTab === 'slide') return buildSlidePrompt();
  if (activeTab === 'app')   return buildWebAppPrompt('app');
  return buildWebAppPrompt('web');
}

/* =========================================================
   클립보드 복사 유틸
   ========================================================= */

function copyText(text, onSuccess) {
  navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onSuccess();
  });
}

/* =========================================================
   초기화
   ========================================================= */

const TAB_TITLES = {
  slide: 'AI Prompt — Presentation Slides',
  web:   'AI Prompt — Web Interface',
  app:   'AI Prompt — Mobile App',
};

export function initPrompt() {
  const btnOpen  = document.getElementById('btn-prompt-icon');
  const backdrop = document.getElementById('prompt-modal-backdrop');
  const modal    = document.getElementById('prompt-modal');
  const title    = document.getElementById('prompt-modal-title');
  const body     = document.getElementById('prompt-modal-body');
  const btnClose = document.getElementById('prompt-modal-close');
  const btnCopy  = document.getElementById('btn-copy-prompt-confirm');
  const badge    = document.getElementById('prompt-copied');

  btnOpen.addEventListener('click', () => {
    const text = buildPrompt();
    if (!text) return;
    title.textContent = TAB_TITLES[activeTab] ?? 'AI Prompt';
    body.textContent  = text;
    badge.hidden      = true;
    backdrop.hidden   = false;
    modal.hidden      = false;
  });

  function closeModal() {
    backdrop.hidden = true;
    modal.hidden    = true;
  }
  btnClose.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  btnCopy.addEventListener('click', () => {
    copyText(body.textContent, () => {
      badge.hidden = false;
      setTimeout(() => { badge.hidden = true; }, 1500);
    });
  });
}

export function showPromptSection() {
  /* 아이콘 버튼 표시 (팔레트가 준비되면 호출됨) */
  const btn = document.getElementById('btn-prompt-icon');
  if (btn) btn.hidden = false;
}
