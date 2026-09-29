/* ==========================================================
   prompt.js — AI 프롬프트 만들기와 복사
   현재 색 역할 배정 결과를 AI 에이전트에 넘길 프롬프트로 변환
   ========================================================== */

import { state } from './state.js';

/**
 * 현재 상태를 바탕으로 AI 프롬프트 문자열 생성
 * @returns {string}
 */
export function buildPrompt() {
  const { roles, mode } = state;

  if (!roles) return '';

  /* 마지막으로 보던 모드를 먼저 적어 기본값으로 읽히게 함 */
  const primary   = mode === 'dark' ? '다크' : '라이트';
  const secondary = mode === 'dark' ? '라이트' : '다크';

  return `아래 색 팔레트를 그대로 사용해 화면을 만들어 주세요.

## 색 팔레트 (${primary} 모드 우선)

### ${primary} 모드
- 배경: ${mode === 'dark' ? roles.bgDark : roles.bg}
- 글자: ${mode === 'dark' ? roles.textDark : roles.text}
- 메인: ${roles.main}
- 포인트: ${roles.point}
- 보조: ${roles.sub}

### ${secondary} 모드
- 배경: ${mode === 'dark' ? roles.bg : roles.bgDark}
- 글자: ${mode === 'dark' ? roles.text : roles.textDark}
- 메인: ${roles.main}
- 포인트: ${roles.point}
- 보조: ${roles.sub}

## 색 사용 규칙
- 배경(bg): 페이지나 카드의 기본 배경색으로만 사용합니다.
- 글자(text): 본문·제목 등 모든 텍스트에 사용합니다.
- 메인(main): 브랜드 색으로, 헤더·버튼·링크·강조 요소에 사용합니다.
- 포인트(point): 클릭을 유도하는 CTA 버튼, 배지, 태그에 사용합니다.
- 보조(sub): 구분선·플레이스홀더·비활성 텍스트 등 조용한 요소에 사용합니다.
- 라이트 모드 배경은 위 bg 값을 그대로 사용하세요(순수 흰색 금지).
- 다크 모드 배경은 위 bg-dark 값을 사용하세요(순수 검정 금지).

## 기본 스타일
- 폰트: Pretendard (CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css)
- 스타일: 심플하고 깔끔하게. 그림자·테두리는 최소화, 여백을 넉넉히.

(위 색과 규칙을 바탕으로, 아래에 만들고 싶은 것을 적어주세요.)
`;
}

/**
 * 프롬프트 복사 버튼 초기화
 */
export function initPrompt() {
  const btn     = document.getElementById('btn-copy-prompt');
  const badge   = document.getElementById('prompt-copied');

  btn.addEventListener('click', () => {
    const text = buildPrompt();
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      /* "복사됨" 뱃지를 잠깐 보여줌 */
      badge.hidden = false;
      setTimeout(() => { badge.hidden = true; }, 1500);
    }).catch(() => {
      /* fallback */
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  });
}

/**
 * 프롬프트 섹션 표시
 */
export function showPromptSection() {
  document.getElementById('prompt-section').hidden = false;
}
