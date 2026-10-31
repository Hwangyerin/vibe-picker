/* ==========================================================
   segmented.js — 세그먼트 컨트롤
   선택 표시(.segmented__indicator)는 CSS 변수 --i로 미끄러진다
   키보드: ←→(↑↓)로 이동하며 바로 선택, Home/End
   ========================================================== */

/**
 * @param {HTMLElement} root - .segmented 요소, 안에 [role=radio][data-value] 버튼들
 * @param {object} [opts]
 * @param {(value: string) => void} [opts.onChange]
 * @returns {{ get: () => string, set: (value: string, silent?: boolean) => void, setDisabled: (d: boolean) => void }}
 */
export function initSegmented(root, { onChange } = {}) {
  const items = [...root.querySelectorAll('[role="radio"]')];
  root.setAttribute('role', 'radiogroup');
  root.style.setProperty('--n', items.length);

  /* 선택 표시가 없으면 만들어 넣는다 */
  if (!root.querySelector('.segmented__indicator')) {
    const ind = document.createElement('span');
    ind.className = 'segmented__indicator';
    ind.setAttribute('aria-hidden', 'true');
    root.prepend(ind);
  }

  let index = Math.max(0, items.findIndex((b) => b.getAttribute('aria-checked') === 'true'));

  function render() {
    items.forEach((b, i) => {
      const on = i === index;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1; /* 그룹 안에서는 선택된 하나만 Tab으로 들어온다 */
    });
    root.style.setProperty('--i', index);
  }

  function select(i, silent = false) {
    if (i === index || i < 0 || i >= items.length) return;
    index = i;
    render();
    if (!silent) {
      onChange?.(items[index].dataset.value);
      root.dispatchEvent(new CustomEvent('change', { detail: items[index].dataset.value }));
    }
  }

  items.forEach((b, i) => {
    b.type = 'button';
    b.addEventListener('click', () => select(i));
  });

  root.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (e.key in keys) next = (index + keys[e.key] + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    items[next].focus();
  });

  render();

  return {
    get: () => items[index].dataset.value,
    set: (value, silent = true) => select(items.findIndex((b) => b.dataset.value === value), silent),
    setDisabled: (d) => {
      root.setAttribute('aria-disabled', String(d));
      items.forEach((b) => { b.disabled = d; });
    },
  };
}
