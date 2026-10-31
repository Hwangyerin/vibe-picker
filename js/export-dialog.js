/* ==========================================================
   export-dialog.js — 내보내기 창
   형식(AI 프롬프트 · CSS 변수 · Tailwind · JSON)을 고르고, 미리 보고, 복사한다
   ========================================================== */

import { icon } from './ui/icon.js';
import { initSegmented } from './ui/segmented.js';
import { afterAnimation } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { FORMATS } from './export.js';

const HINTS = {
  prompt: 'AI(Claude, ChatGPT 등)에 그대로 붙여 넣고 "만들 화면"만 채워 주세요.',
  css: '프로젝트에서 가장 먼저 읽히는 CSS 파일 맨 위에 붙여 넣으세요. var(--color-primary)처럼 씁니다.',
  tailwind: 'tailwind.config.js의 theme.extend에 넣으세요. bg-brand-primary, rounded-card처럼 씁니다.',
  json: '디자인 토큰 도구(Style Dictionary, Figma Tokens 등)에서 읽을 수 있는 형식입니다.',
};

let open = false;

/**
 * 내보내기 창 열기
 * @param {() => import('./export.js').ExportInput} getInput - 지금 브랜드 값
 * @param {'mobile'|'slides'} target - 프롬프트 대상 (지금 보고 있는 화면에 맞춘다)
 */
export function openExportDialog(getInput, target = 'mobile') {
  if (open) return;
  open = true;
  const returnFocus = document.activeElement;
  let format = 'prompt';
  let promptTarget = target;

  const dialog = document.createElement('dialog');
  dialog.className = 'dialog dialog--wide export';
  dialog.setAttribute('aria-labelledby', 'export-title');
  dialog.innerHTML = `
    <header class="export__head">
      <h2 class="dialog__title" id="export-title">내보내기</h2>
      <button type="button" class="btn btn--ghost btn--icon btn--sm" data-close aria-label="닫기">${icon('x')}</button>
    </header>
    <div class="export__bar">
      <div class="segmented" id="export-format" aria-label="내보낼 형식">
        ${Object.entries(FORMATS).map(([k, f], i) => `<button role="radio" data-value="${k}" aria-checked="${i === 0}">${f.label}</button>`).join('')}
      </div>
      <div class="segmented" id="export-target" aria-label="프롬프트 대상">
        <button role="radio" data-value="mobile" aria-checked="${target === 'mobile'}">${icon('phone')}모바일 웹</button>
        <button role="radio" data-value="slides" aria-checked="${target === 'slides'}">${icon('slides')}슬라이드</button>
      </div>
    </div>
    <p class="export__hint"></p>
    <pre class="export__code" tabindex="0" aria-label="내보낼 내용"><code></code></pre>
    <footer class="dialog__actions export__foot">
      <span class="export__meta num"></span>
      <button type="button" class="btn btn--primary" data-copy-all>${icon('copy')}<span>복사</span></button>
    </footer>`;
  document.body.appendChild(dialog);

  const code = dialog.querySelector('code');
  const targetSeg = dialog.querySelector('#export-target');
  const copyBtn = dialog.querySelector('[data-copy-all]');

  const render = () => {
    const text = FORMATS[format].build(getInput(), promptTarget);
    code.textContent = text;
    dialog.querySelector('.export__hint').textContent = HINTS[format];
    dialog.querySelector('.export__meta').textContent = `${text.split('\n').length}줄 · ${text.length.toLocaleString()}자`;
    targetSeg.hidden = format !== 'prompt';
    copyBtn.querySelector('span').textContent = `${FORMATS[format].label} 복사`;
  };

  initSegmented(dialog.querySelector('#export-format'), { onChange: (v) => { format = v; render(); } });
  initSegmented(targetSeg, { onChange: (v) => { promptTarget = v; render(); } });

  copyBtn.addEventListener('click', async () => {
    const text = code.textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.dataset.state = 'done';
    copyBtn.querySelector('use').setAttribute('href', copyBtn.querySelector('use').getAttribute('href').replace('#copy', '#check'));
    toast(`${FORMATS[format].label}를 복사했어요`, { tone: 'success' });
    setTimeout(() => {
      delete copyBtn.dataset.state;
      copyBtn.querySelector('use')?.setAttribute('href', copyBtn.querySelector('use').getAttribute('href').replace('#check', '#copy'));
    }, 1600);
  });

  const close = () => {
    if (dialog.hasAttribute('data-closing')) return;
    dialog.setAttribute('data-closing', '');
    afterAnimation(dialog, () => {
      dialog.close();
      dialog.remove();
      open = false;
      returnFocus?.focus?.();
    });
  };

  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });

  render();
  dialog.showModal();
  copyBtn.focus();
}
