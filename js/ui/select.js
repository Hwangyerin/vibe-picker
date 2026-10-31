/* ==========================================================
   select.js — 선택 목록 (기본 <select> 대체)
   항목마다 미리보기(서체로 쓴 워드마크 등)를 넣을 수 있다
   키보드: ↑↓ 이동, Enter/Space 선택, Esc 닫기, Home/End, Tab은 닫고 다음으로
   ========================================================== */

import { icon } from './icon.js';

let uid = 0;

/**
 * @typedef {{ value: string, label: string, group?: string, disabled?: boolean, [key: string]: any }} SelectOption
 *
 * @param {HTMLElement} root - 비어 있는 .select 요소
 * @param {object} opts
 * @param {SelectOption[]} opts.options
 * @param {string} [opts.value] - 처음 선택값
 * @param {string} [opts.label] - 스크린 리더용 이름
 * @param {(opt: SelectOption) => string} [opts.renderOption] - 메뉴 항목 HTML (기본: label)
 * @param {(opt: SelectOption) => string} [opts.renderValue] - 닫힌 버튼에 보일 HTML (기본: label)
 * @param {(value: string, opt: SelectOption) => void} [opts.onChange]
 */
export function createSelect(root, {
  options,
  value,
  label = '',
  renderOption = (o) => escapeHtml(o.label),
  renderValue = (o) => escapeHtml(o.label),
  onChange,
}) {
  const id = `select-${++uid}`;
  let opts = options;
  let current = value ?? opts[0]?.value;
  let active = -1;   /* 가리키는 항목 인덱스 */
  let open = false;

  root.classList.add('select');
  root.innerHTML = `
    <button type="button" class="select__trigger" aria-haspopup="listbox"
            aria-expanded="false" aria-controls="${id}-list">
      <span class="select__value"></span>${icon('chevron-down')}
    </button>
    <ul class="select__menu" role="listbox" id="${id}-list" tabindex="-1"></ul>`;

  const trigger = root.querySelector('.select__trigger');
  const menu = root.querySelector('.select__menu');
  if (label) {
    trigger.setAttribute('aria-label', label);
    menu.setAttribute('aria-label', label);
  }

  /* ---------- 그리기 ---------- */

  function renderMenu() {
    let html = '';
    let lastGroup = null;
    opts.forEach((o, i) => {
      if (o.group && o.group !== lastGroup) {
        html += `<li class="select__group-label" role="presentation">${escapeHtml(o.group)}</li>`;
        lastGroup = o.group;
      }
      html += `
        <li class="select__option" role="option" id="${id}-opt-${i}" data-index="${i}"
            aria-selected="${o.value === current}" ${o.disabled ? 'aria-disabled="true"' : ''}>
          <span class="select__option-body">${renderOption(o)}</span>
          <span class="select__check">${icon('check')}</span>
        </li>`;
    });
    menu.innerHTML = html;
  }

  function renderTrigger() {
    const o = opts.find((x) => x.value === current);
    root.querySelector('.select__value').innerHTML = o ? renderValue(o) : '';
  }

  function setActive(i, scroll = true) {
    menu.querySelector('[data-active]')?.removeAttribute('data-active');
    active = i;
    const el = menu.querySelector(`[data-index="${i}"]`);
    if (!el) return menu.removeAttribute('aria-activedescendant');
    el.setAttribute('data-active', '');
    menu.setAttribute('aria-activedescendant', el.id);
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- 열고 닫기 ---------- */

  function openMenu() {
    if (open || trigger.disabled) return;
    open = true;
    /* 아래 공간이 부족하면 위로 */
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    root.dataset.placement = below < 260 && r.top > below ? 'top' : 'bottom';
    root.setAttribute('data-open', '');
    trigger.setAttribute('aria-expanded', 'true');
    setActive(Math.max(0, opts.findIndex((o) => o.value === current)));
    menu.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
  }

  function closeMenu(focusTrigger = true) {
    if (!open) return;
    open = false;
    root.removeAttribute('data-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (focusTrigger) trigger.focus({ preventScroll: true });
  }

  function onOutside(e) {
    if (!root.contains(e.target)) closeMenu(false);
  }

  function choose(i) {
    const o = opts[i];
    if (!o || o.disabled) return;
    const changed = o.value !== current;
    current = o.value;
    renderMenu();
    renderTrigger();
    closeMenu();
    if (changed) onChange?.(current, o);
  }

  /* 사용 가능한 다음 항목 (비활성 건너뛰기) */
  function step(from, dir) {
    let i = from;
    for (let n = 0; n < opts.length; n++) {
      i = (i + dir + opts.length) % opts.length;
      if (!opts[i].disabled) return i;
    }
    return from;
  }

  /* ---------- 이벤트 ---------- */

  trigger.addEventListener('click', () => (open ? closeMenu() : openMenu()));

  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(step(active, 1)); break;
      case 'ArrowUp':   e.preventDefault(); setActive(step(active, -1)); break;
      case 'Home':      e.preventDefault(); setActive(step(-1, 1)); break;
      case 'End':       e.preventDefault(); setActive(step(opts.length, -1)); break;
      case 'Enter':
      case ' ':         e.preventDefault(); choose(active); break;
      case 'Escape':    e.preventDefault(); e.stopPropagation(); closeMenu(); break;
      case 'Tab':       closeMenu(false); break;
    }
  });

  menu.addEventListener('pointermove', (e) => {
    const li = e.target.closest('.select__option');
    if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index), false);
  });

  menu.addEventListener('click', (e) => {
    const li = e.target.closest('.select__option');
    if (li) choose(Number(li.dataset.index));
  });

  renderMenu();
  renderTrigger();

  return {
    get: () => current,
    set(v) { current = v; renderMenu(); renderTrigger(); },
    setOptions(next, v = current) { opts = next; current = v; renderMenu(); renderTrigger(); },
    setDisabled(d) { trigger.disabled = d; if (d) closeMenu(false); },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
