/* ==========================================================
   board.js — 브랜드 보드
   크기가 다른 칸을 맞물린 한 장: 심볼 · 워드마크 · 아이콘 · 색 · 타이포 · 흑백 음영 · 컴포넌트
   구조는 처음 한 번만 만들고, 이후에는 글자와 값만 바꾼다
   (색은 CSS 변수로 바뀌므로 전환 모션이 그대로 보인다)
   ========================================================== */

import { onColor } from './color.js';
import { BOARD_ICONS, ICON_SETS, ICON_WEIGHTS } from './icons.js';
import { RADIUS_CARD, RADIUS_CONTROL } from './brand.js';

const RADIUS_LABEL = { none: '없음', sm: '작게', md: '보통', lg: '크게', full: '완전' };

/* 타이포 단계: 실제 서비스(팀 일정 관리)에서 쓸 만한 문장 */
const TYPE_SCALE = [
  { key: 'display', label: 'Display', size: 40, font: 'display', text: '오늘 할 일을 한곳에' },
  { key: 'h1', label: 'H1', size: 28, font: 'display', text: '팀 일정이 겹치지 않게' },
  { key: 'h2', label: 'H2', size: 21, font: 'display', text: '이번 주 마감 세 건' },
  { key: 'h3', label: 'H3', size: 17, font: 'body', weight: 600, text: '금요일 회의록 정리' },
  { key: 'body', label: '본문', size: 14, font: 'body', text: '회의가 끝나면 정한 일을 바로 담당자에게 나눠 주세요. 마감 하루 전에 알림이 갑니다.' },
  { key: 'caption', label: '캡션', size: 12, font: 'body', text: '10월 31일 금요일 · 오후 3시' },
];

/**
 * 보드 그리기
 * @param {HTMLElement} root - 보드를 넣을 자리
 * @param {object} p
 * @param {ReturnType<import('./brand.js').brandTokens>} p.tokens
 * @param {object} p.brand - 설정
 * @param {string[]} p.palette - 팔레트 5색 (대비 적용)
 * @param {Map<string,string>|null} p.icons - 아이콘 SVG (불러오는 중이면 null)
 */
export function renderBoard(root, { tokens: t, brand, palette, icons }) {
  if (!root.querySelector('.board')) root.innerHTML = skeleton();
  const $ = (sel) => root.querySelector(sel);

  /* 심볼: 올린 이미지 또는 워드마크 첫 글자 모노그램 */
  const symbol = $('[data-slot="symbol"]');
  if (brand.symbol) {
    symbol.innerHTML = `<img src="${brand.symbol}" alt="" />`;
    symbol.dataset.kind = 'image';
  } else {
    const letter = [...(brand.wordmark.trim() || 'V')][0].toUpperCase();
    symbol.innerHTML = `<span class="symbol__letter">${escapeHtml(letter)}</span><i class="symbol__dot"></i>`;
    symbol.dataset.kind = 'monogram';
  }

  $('[data-slot="wordmark"]').textContent = brand.wordmark || '이름 없음';
  $('[data-slot="wordmark-meta"]').textContent =
    `${t.fontDisplay.name} · ${t.fontDisplay.heading}`;

  /* 아이콘 */
  $('[data-slot="icon-meta"]').textContent =
    `${ICON_SETS[brand.iconSet].name} · ${ICON_WEIGHTS[brand.iconWeight].label}`;
  const grid = $('[data-slot="icons"]');
  /* 아이콘 SVG는 세트가 바뀔 때만 다시 넣는다 (슬라이더를 끄는 동안 매번 만들지 않게) */
  const iconsChanged = grid.__icons !== icons || !grid.children.length;
  if (iconsChanged) {
    grid.__icons = icons;
    grid.toggleAttribute('data-loading', !icons);
    grid.innerHTML = BOARD_ICONS.map((name) =>
      `<span class="icon-cell" title="${name}">${icons ? icons.get(name) : ''}</span>`).join('');
  }

  /* 색 */
  setSwatch($('[data-slot="primary"]'), t.primary, t.primaryFg);
  setSwatch($('[data-slot="secondary"]'), t.secondary, t.onSecondary);
  setSwatch($('[data-slot="tertiary"]'), t.tertiary, onColor(t.tertiary));
  $('[data-slot="palette"]').innerHTML = palette.map((c) =>
    `<button type="button" class="b-copy palette-dot" style="--c: ${c}" data-copy="${c}" aria-label="${c} 복사"></button>`).join('');

  /* 타이포 */
  $('[data-slot="type-meta"]').textContent = `${t.fontDisplay.name} / ${t.fontBody.name}`;

  /* 흑백 음영 */
  $('[data-slot="tone-meta"]').textContent = `톤 ${brand.tone}%`;
  $('[data-slot="grays"]').innerHTML = t.grays.map((g, i) => `
    <button type="button" class="gray-row b-copy" style="--c: ${g}; color: ${onColor(g)}" data-copy="${g}" aria-label="${g} 복사">
      <span>0${i + 1}</span><span class="num">${g}</span>
    </button>`).join('');

  /* 컴포넌트 */
  $('[data-slot="radius-meta"]').textContent =
    `카드 ${RADIUS_LABEL[brand.radiusCard]} ${RADIUS_CARD[brand.radiusCard]}px · 버튼 ${RADIUS_LABEL[brand.radiusControl]}${brand.radiusControl === 'full' ? '' : ` ${RADIUS_CONTROL[brand.radiusControl]}px`}`;
  if (!iconsChanged && $('[data-slot="components"]').children.length) return;
  const plus = icons?.get('plus') ?? '';
  const cal = icons?.get('calendar') ?? '';
  const clock = icons?.get('clock') ?? '';
  $('[data-slot="components"]').innerHTML = `
    <div class="comp-row">
      <span class="b-btn b-btn--primary">${plus}일정 추가</span>
      <span class="b-btn b-btn--secondary">취소</span>
      <span class="b-tag">디자인</span>
      <span class="b-tag b-tag--soft">D-3</span>
    </div>
    <div class="comp-row comp-row--split">
      <span class="b-input"><span>회의 이름</span>${cal}</span>
      <span class="b-mini-card">
        <span class="b-mini-card__bar"></span>
        <span class="b-mini-card__body">
          <strong>주간 회의</strong>
          <span>${clock}오후 3:00 · 3층 회의실</span>
        </span>
      </span>
    </div>`;
}

function setSwatch(el, bg, fg) {
  el.style.setProperty('--c', bg);
  el.style.color = fg;
  el.querySelector('.num').textContent = bg;
  el.dataset.copy = bg;
  el.setAttribute('aria-label', `${el.dataset.name} ${bg} 복사`);
}

/** 보드 뼈대 (처음 한 번) */
function skeleton() {
  const types = TYPE_SCALE.map((s) => `
    <div class="type-row">
      <span class="type-row__label">${s.label}</span>
      <span class="type-row__sample" data-font="${s.font}" style="--size: ${s.size}px; ${s.weight ? `--weight: ${s.weight};` : ''}">${s.text}</span>
    </div>`).join('');

  return `
    <div class="board" aria-label="브랜드 보드">
      <section class="bcard bcard--symbol">
        <span class="bcard__label">심볼</span>
        <div class="symbol" data-slot="symbol"></div>
      </section>

      <section class="bcard bcard--wordmark">
        <span class="bcard__label">워드마크 <em data-slot="wordmark-meta"></em></span>
        <p class="wordmark" data-slot="wordmark"></p>
      </section>

      <section class="bcard bcard--icons">
        <span class="bcard__label">아이콘 <em data-slot="icon-meta"></em></span>
        <div class="icon-grid" data-slot="icons"></div>
      </section>

      <section class="bcard bcard--colors">
        <span class="bcard__label">색</span>
        <div class="color-blocks">
          <button type="button" class="color-block color-block--primary b-copy" data-slot="primary" data-name="Primary">
            <span>Primary</span><span class="num"></span>
          </button>
          <button type="button" class="color-block b-copy" data-slot="secondary" data-name="Secondary">
            <span>Secondary</span><span class="num"></span>
          </button>
          <button type="button" class="color-block b-copy" data-slot="tertiary" data-name="Tertiary">
            <span>Tertiary</span><span class="num"></span>
          </button>
        </div>
        <div class="palette-dots" data-slot="palette"></div>
      </section>

      <section class="bcard bcard--type">
        <span class="bcard__label">타이포그래피 <em data-slot="type-meta"></em></span>
        <div class="type-list">${types}</div>
      </section>

      <section class="bcard bcard--grays">
        <span class="bcard__label">흑백 음영 <em data-slot="tone-meta"></em></span>
        <div class="gray-list" data-slot="grays"></div>
      </section>

      <section class="bcard bcard--components">
        <span class="bcard__label">컴포넌트 <em data-slot="radius-meta"></em></span>
        <div class="components" data-slot="components"></div>
      </section>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
