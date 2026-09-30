/* ==========================================================
   roles.js — 색 역할 자동 배정, 랜덤 섞기
   5색 중 글자가 잘 읽히는 조합으로 배경·글자·메인·포인트·보조 배정
   ========================================================== */

import { contrastRatio, luminance, makeLightBg, makeDarkBg } from './color.js';

/**
 * 5색 팔레트에서 역할을 자동으로 배정
 * 배정 기준:
 * 1. 가장 밝은 색 → 라이트 배경 기반색 (실제 배경은 makeLightBg로 파생)
 * 2. 가장 어두운 색 → 글자 (배경과의 대비 확인)
 * 3. 나머지 3색 → 메인, 포인트, 보조 (명도 내림차순)
 * @param {string[]} palette - HEX 문자열 5개 배열
 * @returns {{ bg: string, text: string, main: string, point: string, sub: string,
 *             bgDark: string, textDark: string }}
 */
export function assignRoles(palette) {
  /* 명도 기준으로 정렬 (밝은 순) */
  const sorted = [...palette].sort((a, b) => luminance(b) - luminance(a));

  /* 가장 밝은 색의 색조로 라이트·다크 배경 만들기 */
  const mainCandidate = sorted[0];
  const bg     = makeLightBg(mainCandidate);
  const bgDark = makeDarkBg(mainCandidate);

  /* 글자색: 가장 어두운 색 (배경과 대비가 높아야 함)
     라이트 배경 기준으로 대비 계산 */
  let textIdx = sorted.length - 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (contrastRatio(sorted[i], bg) >= 4.5) {
      textIdx = i;
      break;
    }
  }
  const text = sorted[textIdx];

  /* 다크 모드 글자: 가장 밝은 색 (다크 배경과 대비) */
  let textDark = sorted[0];
  /* 팔레트 색 중 다크 배경과 대비가 충분한 가장 밝은 색 */
  for (const c of sorted) {
    if (contrastRatio(c, bgDark) >= 4.5) {
      textDark = c;
      break;
    }
  }
  /* 팔레트 색 중 적합한 게 없으면 거의 흰색으로 폴백 */
  if (contrastRatio(textDark, bgDark) < 4.5) {
    textDark = '#F5F5F5';
  }

  /* 나머지 색 중 메인·포인트·보조 배정 (명도 내림차순) */
  const rest = sorted.filter((c, i) => i !== textIdx);
  const main  = rest[0] ?? palette[0];
  const point = rest[1] ?? palette[1];
  const sub   = rest[2] ?? palette[2];

  return { bg, text, main, point, sub, bgDark, textDark };
}

/**
 * 팔레트 5색 안에서 역할을 무작위로 다시 배정
 * - 글자가 잘 안 읽히는 조합도 허용 (경고와 함께 보여줌)
 * @param {string[]} palette - HEX 문자열 5개 배열
 * @returns {{ bg: string, text: string, main: string, point: string, sub: string,
 *             bgDark: string, textDark: string }}
 */
export function shuffleRoles(palette) {
  /* Fisher-Yates 셔플 — sort() 기반보다 통계적으로 균등 */
  const shuffled = [...palette];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  /* 배경: 섞인 첫 번째 색의 색조로 배경 파생 */
  const bg     = makeLightBg(shuffled[0]);
  const bgDark = makeDarkBg(shuffled[0]);

  /* 나머지 역할은 섞인 순서대로 배정 */
  const text     = shuffled[1] ?? shuffled[0];
  const textDark = shuffled[0]; /* 다크 글자는 가장 밝은 쪽이 나을 수 있으나 랜덤 섞기이므로 그대로 */
  const main     = shuffled[2] ?? shuffled[0];
  const point    = shuffled[3] ?? shuffled[0];
  const sub      = shuffled[4] ?? shuffled[0];

  return { bg, text, main, point, sub, bgDark, textDark };
}

/**
 * 글자-배경 조합의 가독성 경고 메시지를 만듦
 * @param {string} text - 글자 HEX
 * @param {string} bg - 배경 HEX
 * @returns {{ warn: boolean, ratio: number, message: string }}
 */
export function readabilityWarning(text, bg) {
  const ratio = contrastRatio(text, bg);
  const warn  = ratio < 4.5;
  const fixed = ratio.toFixed(1);
  const message = warn
    ? `글자와 배경 대비 ${fixed}:1 — WCAG AA 기준(4.5:1) 미만`
    : '';
  return { warn, ratio, message };
}
