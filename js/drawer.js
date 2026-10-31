/* ==========================================================
   drawer.js — 서랍(저장한 브랜드 목록)과 첫 화면의 저장한 브랜드
   서랍은 오른쪽에서 들어오는 창(<dialog>). 카드를 누르면 불러오고, 지울 때는 확인 창
   ========================================================== */

import { icon } from './ui/icon.js';
import { confirmDialog, afterAnimation } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { listCards, deleteCard, MAX_CARDS } from './storage.js';
import { applyContrastToPalette } from './roles.js';
import { onColor } from './color.js';
import { fontById, fontStack, paletteMood, rankFonts } from './fonts.js';
import { ICON_SETS } from './icons.js';

let onLoad = () => {};

/**
 * @param {(key: string, card: object) => void} handler - 카드를 불러올 때
 */
export function initDrawer(handler) {
  onLoad = handler;
  document.getElementById('btn-drawer').addEventListener('click', openDrawer);

  /* 첫 화면 목록 */
  document.getElementById('home-saved').addEventListener('click', (e) => {
    const card = e.target.closest('[data-load]');
    if (card) load(card.dataset.load);
  });

  refreshDrawerCount();
  renderHomeSaved();
}

/* ==========================================================
   카드 한 장
   ========================================================== */

/** 카드에 보일 값 (v1 카드는 브랜드 설정이 없다) */
function view(card) {
  const colors = applyContrastToPalette(card.palette, card.roles, card.contrastOffset ?? 0);
  const brand = card.brand ?? null;
  const primary = brand?.accentIndex != null ? colors[brand.accentIndex] : card.roles?.main ?? colors[2];
  const name = brand?.wordmark?.trim() || '이름 없는 팔레트';
  /* 서체를 자동(추천)으로 둔 카드는 그 팔레트의 추천 1순위 */
  const font = brand ? (brand.fontDisplay ? fontById(brand.fontDisplay) : rankFonts(paletteMood(colors))[0].font) : null;
  const date = new Date(card.savedAt ?? Date.now());
  const meta = [
    `${date.getMonth() + 1}월 ${date.getDate()}일`,
    font?.name,
    brand ? ICON_SETS[brand.iconSet]?.name : 'v1 팔레트',
  ].filter(Boolean).join(' · ');
  return { colors, primary, name, font, meta, letter: brand ? [...name][0].toUpperCase() : 'v1', symbol: brand?.symbol };
}

function cardHtml(key, card, { removable }) {
  const v = view(card);
  return `
    <li class="brand-card">
      <button type="button" class="brand-card__load card card--interactive" data-load="${key}" aria-label="${esc(v.name)} 불러오기">
        <span class="brand-card__strip">${v.colors.map((c) => `<i style="--c: ${c}"></i>`).join('')}</span>
        <span class="brand-card__body">
          <span class="brand-card__mark" style="--c: ${v.primary}; --fg: ${onColor(v.primary)}">${v.symbol ? `<img src="${v.symbol}" alt="" />` : esc(v.letter)}</span>
          <span class="brand-card__text">
            <b ${v.font ? `style="font-family: ${fontStack(v.font)}"` : ''}>${esc(v.name)}</b>
            <small>${esc(v.meta)}</small>
          </span>
        </span>
      </button>
      ${removable ? `<button type="button" class="brand-card__remove btn btn--ghost btn--icon btn--sm" data-remove="${key}" aria-label="${esc(v.name)} 지우기" data-tooltip="서랍에서 지우기">${icon('trash')}</button>` : ''}
    </li>`;
}

/* ==========================================================
   서랍 창
   ========================================================== */

function openDrawer() {
  if (document.querySelector('.drawer')) return;
  const returnFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'drawer';
  dialog.setAttribute('aria-labelledby', 'drawer-title');
  document.body.appendChild(dialog);

  const render = () => {
    const cards = listCards();
    dialog.innerHTML = `
      <header class="drawer__head">
        <div>
          <h2 class="drawer__title" id="drawer-title">서랍</h2>
          <p class="drawer__sub num">${cards.length} / ${MAX_CARDS}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--icon btn--sm" data-close aria-label="서랍 닫기">${icon('x')}</button>
      </header>
      ${cards.length
        ? `<ul class="drawer__list">${cards.map(({ key, card }) => cardHtml(key, card, { removable: true })).join('')}</ul>`
        : `<div class="empty drawer__empty">${icon('drawer')}<p class="empty__title">아직 저장한 브랜드가 없어요</p><p class="empty__text">작업 화면 위쪽의 저장을 누르면 여기에 모입니다. 이 브라우저에만 남아요.</p></div>`}`;
  };

  const close = () => {
    if (dialog.hasAttribute('data-closing')) return;
    dialog.setAttribute('data-closing', '');
    afterAnimation(dialog, () => {
      dialog.close();
      dialog.remove();
      returnFocus?.focus?.();
    });
  };

  dialog.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return close();
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const name = remove.getAttribute('aria-label').replace(/ 지우기$/, '');
      const ok = await confirmDialog({
        title: `"${name}" 브랜드를 서랍에서 지울까요?`,
        body: '지운 브랜드는 되돌릴 수 없어요.',
        confirmText: '서랍에서 지우기',
        tone: 'danger',
      });
      if (ok) {
        deleteCard(remove.dataset.remove);
        render();
        refreshDrawerCount();
        renderHomeSaved();
        toast('서랍에서 지웠어요', { icon: 'trash' });
      }
      return;
    }
    const loadBtn = e.target.closest('[data-load]');
    if (loadBtn) {
      close();
      load(loadBtn.dataset.load);
      return;
    }
    /* 창 바깥(배경) */
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left) close();
    }
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

  render();
  dialog.showModal();
  (dialog.querySelector('[data-load]') ?? dialog.querySelector('[data-close]')).focus();
}

function load(key) {
  const entry = listCards().find((c) => c.key === key);
  if (entry) onLoad(key, entry.card);
}

/* ==========================================================
   헤더 개수 · 첫 화면 목록
   ========================================================== */

export function refreshDrawerCount() {
  const btn = document.getElementById('btn-drawer');
  const n = listCards().length;
  btn.disabled = false;
  let badge = btn.querySelector('.drawer-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'drawer-count num';
    btn.appendChild(badge);
  }
  badge.textContent = n ? String(n) : '';
  badge.hidden = n === 0;
}

export function renderHomeSaved() {
  const wrap = document.getElementById('home-saved');
  const cards = listCards().slice(0, 6);
  wrap.hidden = cards.length === 0;
  wrap.querySelector('ul').innerHTML = cards.map(({ key, card }) => cardHtml(key, card, { removable: false })).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
