/* ==========================================================
   panel.js — 오른쪽 브랜드 설정 패널
   워드마크 · 심볼 · 강조색 · 톤 · 서체 · 아이콘 · 둥글기
   값이 바뀌면 onChange(patch)로 main.js에 알린다
   ========================================================== */

import { icon } from './ui/icon.js';
import { initSegmented } from './ui/segmented.js';
import { createSelect } from './ui/select.js';
import { toast } from './ui/toast.js';
import { fontById, fontStack } from './fonts.js';
import { ICON_SETS, ICON_WEIGHTS } from './icons.js';

const WORDMARK_MAX = 16;
const SYMBOL_SIZE = 256; /* 올린 심볼은 이 크기로 줄여 저장한다 */

let onChange = () => {};
let ui = null;            /* 만들어 둔 컨트롤들 */
let lastWordmark = '';

/**
 * 패널 만들기
 * @param {(patch: object) => void} handler
 */
export function initPanel(handler) {
  onChange = handler;
  const body = document.getElementById('panel-body');
  body.innerHTML = markup();

  /* 워드마크 */
  const wm = body.querySelector('#brand-wordmark');
  wm.addEventListener('input', () => {
    body.querySelector('#brand-wordmark-count').textContent = `${[...wm.value].length}/${WORDMARK_MAX}`;
    onChange({ wordmark: wm.value });
  });

  /* 심볼 */
  const symbolInput = body.querySelector('#symbol-input');
  body.querySelector('#btn-symbol-upload').addEventListener('click', () => symbolInput.click());
  symbolInput.addEventListener('change', async () => {
    const file = symbolInput.files?.[0];
    symbolInput.value = '';
    if (!file?.type.startsWith('image/')) return;
    onChange({ symbol: await shrinkImage(file) });
    toast('심볼을 바꿨어요', { icon: 'image' });
  });
  body.querySelector('#btn-symbol-reset').addEventListener('click', () => onChange({ symbol: null }));

  /* 강조색: 팔레트 칸 고르기 */
  body.querySelector('#accent-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accent]');
    if (!b) return;
    const v = b.dataset.accent === 'auto' ? null : Number(b.dataset.accent);
    onChange({ accentIndex: v, accentLight: 0, accentChroma: 0 });
  });

  /* 슬라이더: 끄는 동안은 한 프레임에 한 번 */
  bindSlider('#accent-light', (v) => onChange({ accentLight: v }), true);
  bindSlider('#accent-chroma', (v) => onChange({ accentChroma: v }), true);
  bindSlider('#brand-tone', (v) => onChange({ tone: v }), false, '%');

  /* 서체 */
  const fontOption = (o) => `
    <span class="font-option">
      <span class="font-option__sample" style="font-family: ${fontStack(fontById(o.value))}; font-weight: ${fontById(o.value).heading}">${escapeHtml(lastWordmark || 'Planit')}</span>
      <span class="font-option__name">${o.label}</span>
      ${o.rec ? `<span class="tag tag--accent">${icon('sparkle')}추천</span>` : ''}
    </span>`;
  const fontValue = (o) => `${o.label}${o.rec ? ' · 추천' : ''}`;

  const displaySelect = createSelect(body.querySelector('#font-display'), {
    options: [], label: '디스플레이 서체', renderOption: fontOption, renderValue: fontValue,
    onChange: (v) => onChange({ fontDisplay: v }),
  });
  const bodySelect = createSelect(body.querySelector('#font-body'), {
    options: [], label: '본문 서체', renderOption: fontOption, renderValue: fontValue,
    onChange: (v) => onChange({ fontBody: v }),
  });

  /* 아이콘·둥글기 */
  const iconSet = initSegmented(body.querySelector('#icon-set'), { onChange: (v) => onChange({ iconSet: v }) });
  const iconWeight = initSegmented(body.querySelector('#icon-weight'), { onChange: (v) => onChange({ iconWeight: v }) });
  const radiusCard = initSegmented(body.querySelector('#radius-card'), { onChange: (v) => onChange({ radiusCard: v }) });
  const radiusControl = initSegmented(body.querySelector('#radius-control'), { onChange: (v) => onChange({ radiusControl: v }) });

  ui = { body, wm, displaySelect, bodySelect, iconSet, iconWeight, radiusCard, radiusControl, fontKey: '' };
}

/**
 * 패널을 지금 값에 맞춘다 (다시 만들지 않고 값만)
 * @param {object} brand - 설정
 * @param {object} ctx
 * @param {string[]} ctx.palette - 팔레트 5색 (대비 적용)
 * @param {number} ctx.autoAccent - 자동일 때 쓰이는 팔레트 칸
 * @param {string} ctx.primary - 실제로 쓰이는 강조색
 * @param {Array<{font, score}>} ctx.displayRank - 디스플레이 서체 추천 순서
 * @param {Array<{font, score}>} ctx.bodyRank - 본문 서체 추천 순서
 * @param {string} ctx.autoFont - 디스플레이 서체 자동 값
 */
export function renderPanel(brand, ctx) {
  if (!ui) return;
  const { body } = ui;

  /* 워드마크 (입력 중에는 건드리지 않는다) */
  if (document.activeElement !== ui.wm) ui.wm.value = brand.wordmark;
  body.querySelector('#brand-wordmark-count').textContent = `${[...ui.wm.value].length}/${WORDMARK_MAX}`;

  /* 심볼 */
  body.querySelector('#btn-symbol-reset').hidden = !brand.symbol;
  body.querySelector('#symbol-state').textContent = brand.symbol ? '올린 이미지' : '워드마크 첫 글자';

  /* 강조색 칸 */
  const chosen = brand.accentIndex ?? ctx.autoAccent;
  body.querySelector('#accent-swatches').innerHTML = ctx.palette.map((c, i) => `
    <button type="button" class="accent-swatch" role="radio" data-accent="${i}" style="--c: ${c}"
            aria-checked="${i === chosen}" aria-label="${i + 1}번째 색 ${c}${i === ctx.autoAccent ? ' (자동)' : ''}">
      ${i === ctx.autoAccent ? '<span class="accent-swatch__auto">자동</span>' : ''}
    </button>`).join('');
  body.querySelector('#accent-value').textContent = ctx.primary;
  setSlider('#accent-light', brand.accentLight, true);
  setSlider('#accent-chroma', brand.accentChroma, true);
  setSlider('#brand-tone', brand.tone, false, '%');

  /* 서체: 추천 순서나 워드마크가 바뀔 때만 목록을 다시 */
  const key = `${ctx.displayRank.map((r) => r.font.id).join()}|${brand.wordmark}`;
  const displayValue = brand.fontDisplay ?? ctx.autoFont;
  if (key !== ui.fontKey) {
    ui.fontKey = key;
    lastWordmark = brand.wordmark;
    const rec = new Set(ctx.displayRank.slice(0, 3).map((r) => r.font.id));
    const recBody = new Set(ctx.bodyRank.slice(0, 3).map((r) => r.font.id));
    ui.displaySelect.setOptions(ctx.displayRank.map(({ font }) => ({
      value: font.id, label: font.name, rec: rec.has(font.id),
      group: rec.has(font.id) ? '사진 분위기에 맞는 서체' : `전체 · ${font.kind}`,
    })), displayValue);
    ui.bodySelect.setOptions(ctx.bodyRank.map(({ font }) => ({
      value: font.id, label: font.name, rec: recBody.has(font.id),
      group: recBody.has(font.id) ? '사진 분위기에 맞는 서체' : `전체 · ${font.kind}`,
    })), brand.fontBody);
  } else {
    if (ui.displaySelect.get() !== displayValue) ui.displaySelect.set(displayValue);
    if (ui.bodySelect.get() !== brand.fontBody) ui.bodySelect.set(brand.fontBody);
  }

  ui.iconSet.set(brand.iconSet);
  ui.iconWeight.set(brand.iconWeight);
  ui.radiusCard.set(brand.radiusCard);
  ui.radiusControl.set(brand.radiusControl);
}

/* ==========================================================
   만들기
   ========================================================== */

function markup() {
  const seg = (id, label, items) => `
    <div class="segmented segmented--block" id="${id}" aria-label="${label}">
      ${items.map(([v, t], i) => `<button role="radio" data-value="${v}" aria-checked="${i === 0}">${t}</button>`).join('')}
    </div>`;

  const slider = (id, label, min, max, bipolar) => `
    <label class="slider ${bipolar ? 'slider--bipolar' : ''}" for="${id}">
      <span class="slider__label">${label}</span>
      <output class="slider__value" for="${id}"></output>
      <input type="range" id="${id}" min="${min}" max="${max}" step="1" value="0" />
    </label>`;

  return `
    <section class="pgroup">
      <label class="field">
        <span class="field__label">워드마크</span>
        <input class="field__input" id="brand-wordmark" maxlength="${WORDMARK_MAX}" autocomplete="off" spellcheck="false" placeholder="서비스 이름" />
        <span class="field__count num" id="brand-wordmark-count"></span>
      </label>
    </section>

    <section class="pgroup">
      <h3 class="pgroup__title">심볼 <span class="pgroup__hint" id="symbol-state"></span></h3>
      <div class="pgroup__row">
        <button type="button" class="btn btn--secondary btn--sm" id="btn-symbol-upload">${icon('upload')}이미지 올리기</button>
        <button type="button" class="btn btn--ghost btn--sm" id="btn-symbol-reset" hidden>${icon('x')}첫 글자로</button>
      </div>
      <input type="file" id="symbol-input" accept="image/*" hidden />
    </section>

    <section class="pgroup">
      <h3 class="pgroup__title">강조색 <span class="pgroup__hint num" id="accent-value"></span></h3>
      <div class="accent-swatches" id="accent-swatches" role="radiogroup" aria-label="강조색으로 쓸 팔레트 색"></div>
      ${slider('accent-light', '밝기', -20, 20, true)}
      ${slider('accent-chroma', '채도', -20, 20, true)}
    </section>

    <section class="pgroup">
      ${slider('brand-tone', '톤 · 회색이 강조색을 머금는 정도', 0, 100, false)}
    </section>

    <section class="pgroup">
      <h3 class="pgroup__title">서체</h3>
      <div class="field">
        <span class="field__label">제목 (디스플레이)</span>
        <div id="font-display"></div>
      </div>
      <div class="field">
        <span class="field__label">본문</span>
        <div id="font-body"></div>
      </div>
    </section>

    <section class="pgroup">
      <h3 class="pgroup__title">아이콘</h3>
      ${seg('icon-set', '아이콘 세트', Object.entries(ICON_SETS).map(([k, s]) => [k, s.name]))}
      ${seg('icon-weight', '아이콘 굵기', Object.entries(ICON_WEIGHTS).map(([k, w]) => [k, w.label]))}
    </section>

    <section class="pgroup">
      <h3 class="pgroup__title">둥글기</h3>
      <span class="field__label">카드</span>
      ${seg('radius-card', '카드 둥글기', [['none', '없음'], ['sm', '작게'], ['md', '보통'], ['lg', '크게']])}
      <span class="field__label">버튼 · 입력창</span>
      ${seg('radius-control', '버튼 둥글기', [['none', '없음'], ['sm', '작게'], ['md', '보통'], ['lg', '크게'], ['full', '완전']])}
    </section>`;
}

/* ---------- 슬라이더 ---------- */

function bindSlider(sel, fn, bipolar, suffix = '') {
  const input = document.querySelector(sel);
  let frame = 0;
  input.addEventListener('input', () => {
    const v = Number(input.value);
    paintSlider(input, v, bipolar, suffix);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => fn(v));
  });
}

function setSlider(sel, value, bipolar, suffix = '') {
  const input = document.querySelector(sel);
  if (document.activeElement !== input) input.value = value;
  paintSlider(input, Number(input.value), bipolar, suffix);
}

function paintSlider(input, v, bipolar, suffix) {
  const pct = ((v - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  if (bipolar) {
    input.style.setProperty('--from', `${Math.min(50, pct)}%`);
    input.style.setProperty('--to', `${Math.max(50, pct)}%`);
  } else {
    input.style.setProperty('--fill', `${pct}%`);
  }
  input.closest('.slider').querySelector('output').textContent =
    bipolar && v > 0 ? `+${v}` : `${v}${suffix}`;
}

/* ---------- 심볼 이미지 줄이기 ---------- */

function shrinkImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, SYMBOL_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.src = url;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

