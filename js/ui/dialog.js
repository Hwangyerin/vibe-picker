/* ==========================================================
   dialog.js — 확인 창 (브라우저 기본 confirm 대체)
   네이티브 <dialog>를 써서 포커스 가두기·Esc 닫기를 브라우저에 맡긴다
   ========================================================== */

/**
 * 확인 창을 열고, 사용자가 고른 결과를 돌려준다
 * @param {object} opts
 * @param {string} opts.title - 창 제목 (질문)
 * @param {string} [opts.body] - 설명
 * @param {string} [opts.confirmText] - 확인 버튼 문구 (결과를 말하게: "서랍에서 지우기")
 * @param {string} [opts.cancelText] - 취소 버튼 문구
 * @param {'default'|'danger'} [opts.tone] - danger면 빨간 버튼, 처음 포커스는 취소에
 * @returns {Promise<boolean>} 확인이면 true
 */
export function confirmDialog({
  title,
  body = '',
  confirmText = '계속',
  cancelText = '취소',
  tone = 'default',
}) {
  return new Promise((resolve) => {
    const returnFocus = document.activeElement;

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    dialog.innerHTML = `
      <h2 class="dialog__title" id="dialog-title"></h2>
      ${body ? '<p class="dialog__body"></p>' : ''}
      <div class="dialog__actions">
        <button type="button" class="btn btn--secondary" data-action="cancel"></button>
        <button type="button" class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" data-action="confirm"></button>
      </div>`;

    /* 문구는 textContent로 넣어 HTML이 섞이지 않게 */
    dialog.querySelector('.dialog__title').textContent = title;
    if (body) dialog.querySelector('.dialog__body').textContent = body;
    dialog.querySelector('[data-action="cancel"]').textContent = cancelText;
    dialog.querySelector('[data-action="confirm"]').textContent = confirmText;

    document.body.appendChild(dialog);

    let settled = false;

    /* 닫힘 모션을 보여준 뒤 실제로 닫고 결과를 돌려준다 */
    const finish = (result) => {
      if (settled) return;
      settled = true;
      dialog.setAttribute('data-closing', '');
      afterAnimation(dialog, () => {
        dialog.close();
        dialog.remove();
        if (returnFocus && returnFocus.focus) returnFocus.focus();
        resolve(result);
      });
    };

    dialog.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) return finish(action === 'confirm');
      /* 창 바깥(배경)을 누르면 취소 */
      if (e.target === dialog && isOutside(dialog, e)) finish(false);
    });

    /* Esc — 브라우저가 바로 닫지 않게 막고, 모션과 함께 닫는다 */
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(false);
    });

    dialog.showModal();

    /* 지우기처럼 되돌릴 수 없는 일은 취소에 먼저 포커스 */
    const first = tone === 'danger' ? '[data-action="cancel"]' : '[data-action="confirm"]';
    dialog.querySelector(first).focus();
  });
}

/** 클릭 위치가 창 사각형 바깥인지 (<dialog>는 배경 클릭도 자기 자신이 받는다) */
function isOutside(el, e) {
  const r = el.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/**
 * 요소의 애니메이션이 끝나면 콜백 실행
 * 움직임 줄이기 등으로 애니메이션이 없으면 바로 실행
 */
export function afterAnimation(el, done) {
  const anims = el.getAnimations ? el.getAnimations() : [];
  if (anims.length === 0) return done();
  Promise.all(anims.map((a) => a.finished)).then(done, done);
}
