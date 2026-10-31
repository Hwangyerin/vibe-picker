/* ==========================================================
   palette.js — 후보 색에서 "예쁜" 5색 만들기 (v2)

   v1은 후보 중 서로 먼 5개를 아무렇게나 골랐다. 그래서
   - 탁한 중간색(회갈색, 회녹색)이 섞이고
   - 밝은 색이 두세 개 겹치거나
   - 채도가 끝까지 찬 색이 그대로 나왔다.

   v2는 역할을 먼저 정하고 그 역할에 맞는 색을 고른다.
     밝은 색 1 (배경 바탕) · 어두운 색 1 (글자) · 강조색 1 · 명도 사이를 채우는 색 2
   그다음 사진 색에서 크게 벗어나지 않는 범위(ΔE)에서만 다듬는다.
   ========================================================== */

import { oklabToOklch, oklchToOklab, oklabToHex, hexToOklab, deltaE } from './oklab.js';
import { mulberry32 } from './extract.js';

/** 팔레트 스타일 */
export const STYLES = {
  natural: { label: '자연스럽게', maxShift: 0.05 },
  vivid:   { label: '선명하게',   maxShift: 0.09 },
  muted:   { label: '차분하게',   maxShift: 0.10 },
  raw:     { label: '원본 그대로', maxShift: 0 },
};

/* 서로 이만큼은 달라야 다른 색으로 본다 (단계적으로 낮춰 가며 시도) */
const MIN_DE_STEPS = [0.08, 0.065, 0.05, 0.04];
/* 이보다 가까우면 후보를 쓰지 않고 밝기를 바꾼 색을 만든다 (단조로운 사진) */
const SYNTH_MIN_DE = 0.06;

/**
 * 후보 색에서 팔레트 5색 만들기
 * @param {import('./extract.js').Candidate[]} candidates
 * @param {object} [opts]
 * @param {keyof STYLES} [opts.style]
 * @param {number} [opts.attempt] - 0이면 정해진 8가지 중 가장 조화로운 조합(항상 같음), 1 이상이면 16가지 중 상위 4개에서 하나
 * @param {Map<number, string>} [opts.fixed] - 자리를 지킬 색 (my pick): 칩 위치 → HEX
 * @param {string[]} [opts.avoid] - 피할 조합 서명 (직전에 보여 준 조합)
 * @returns {{ colors: string[], signature: string }}
 */
export function composePalette(candidates, {
  style = 'natural',
  attempt = 0,
  fixed = new Map(),
  avoid = [],
} = {}) {
  const fixedLabs = [...fixed.values()].map(hexToOklab);
  /* my pick과 거의 같은 후보는 빼 둔다 */
  const pool = candidates.filter((c) => fixedLabs.every((f) => deltaE(f, c.lab) > 0.04));
  const need = 5 - fixed.size;
  const muddyPhoto = isMuddyPhoto(candidates);

  /* 조합 후보 만들기 */
  /* 첫 결과(attempt 0)도 정해진 시드로 8가지를 만들어 가장 조화로운 것을 고른다 → 항상 같은 결과 */
  const rng = mulberry32(0x9E3779B9 ^ (attempt * 2654435761));
  const options = [
    selectColors(pool, need, fixedLabs, style, muddyPhoto, null),
    ...Array.from({ length: attempt === 0 ? 7 : 15 }, () => selectColors(pool, need, fixedLabs, style, muddyPhoto, rng)),
  ];

  /* 조화 점수로 줄 세우고, 다시 뽑기면 상위 4개 중 직전과 다른 것 */
  const scored = options
    .map((picks) => {
      const labs = [...fixedLabs, ...picks.map((p) => p.lab)];
      return { picks, score: harmony(labs, style), distinct: minDistance(labs) >= 0.08 };
    })
    .sort((a, b) => b.score - a.score);

  let chosen = scored[0];
  if (attempt > 0) {
    const rng = mulberry32(attempt * 40503);
    /* 직전과 다르고, 거의 같은 두 색이 없는 조합을 먼저 */
    const fresh = scored.filter((o) => !avoid.includes(signatureOf(o.picks, fixed)));
    const good = fresh.filter((o) => o.distinct);
    const top = (good.length ? good : fresh.length ? fresh : scored).slice(0, 4);
    chosen = top[Math.floor(rng() * top.length)];
  }

  /* 다듬기 (my pick은 사용자가 고른 그대로) */
  const accentHue = (chosen.picks.find((p) => p.role === 'accent') ?? chosen.picks[0])?.lch[2] ?? 0;
  const refined = chosen.picks.map((p) => ({
    ...p,
    origHex: p.hex,
    hex: refine(p, style, accentHue),
  }));
  keepApart(refined, fixedLabs);

  return {
    colors: arrange(refined, fixed),
    signature: signatureOf(chosen.picks, fixed),
  };
}

/* ==========================================================
   역할별로 고르기
   ========================================================== */

function selectColors(pool, need, fixedLabs, style, muddyPhoto, rng) {
  const noise = () => (rng ? 0.7 + rng() * 0.6 : 1);
  const picks = [];
  const takenLabs = () => [...fixedLabs, ...picks.map((p) => p.lab)];

  const mud = (c) => {
    if (!isMuddy(c) || muddyPhoto || style === 'raw') return 1;
    return style === 'muted' ? 0.85 : 0.45;
  };

  /* 조건에 맞는 후보 중 점수가 가장 높은 것. 서로 다른 정도는 단계적으로 낮춰 본다 */
  const pickBest = (filter, score, steps = MIN_DE_STEPS) => {
    for (const minDE of steps) {
      let best = null, bestScore = -Infinity;
      for (const c of pool) {
        if (picks.includes(c) || !filter(c)) continue;
        if (takenLabs().some((t) => deltaE(t, c.lab) < minDE)) continue;
        const s = score(c) * noise();
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (best) return best;
    }
    return null;
  };

  const add = (c, role) => {
    if (c && picks.length < need) picks.push({ ...c, role });
  };

  const hasLight = fixedLabs.some((l) => l[0] >= 0.8);
  const hasDark = fixedLabs.some((l) => l[0] <= 0.38);

  /* 사진에 밝은 색·어두운 색이 없을 때 쓸 색: 가장 넓은 색의 색조로 만든다
     (하늘만 찍은 사진에도 글자로 쓸 어두운 색이 있어야 화면을 만들 수 있다) */
  const dominant = pool[0] ?? { lch: oklabToOklch(fixedLabs[0] ?? [0.6, 0, 0]) };
  const synth = (L, chromaScale, role) => {
    const lch = [L, Math.min(dominant.lch[1] * chromaScale, 0.05), dominant.lch[2]];
    const lab = oklchToOklab(lch);
    return { lab, lch, hex: oklabToHex(lab), area: 0, role };
  };

  /* 1. 밝은 색 (배경의 바탕) */
  if (!hasLight) {
    add(pickBest((c) => c.lch[0] >= 0.78, (c) => Math.sqrt(c.area) * c.lch[0])
      ?? synth(0.95, 0.4), 'light');
  }

  /* 2. 어두운 색 (글자) */
  if (!hasDark) {
    add(pickBest((c) => c.lch[0] <= 0.38, (c) => Math.sqrt(c.area) * (1.2 - c.lch[0]))
      ?? synth(0.26, 0.6), 'dark');
  }

  /* 3. 강조색: 너무 밝거나 어둡지 않은 색 중 선명한 색 (작은 면적도 살아남게 area^0.3) */
  add(pickBest(
    (c) => c.lch[0] > 0.3 && c.lch[0] < 0.88,
    (c) => accentWeight(c.lch[1], style) * c.area ** 0.3 * mud(c),
  ), 'accent');

  /* 4·5. 명도 사이를 채우는 색 */
  while (picks.length < need) {
    const Ls = takenLabs().map((l) => l[0]);
    /* 채우는 색은 거의 같은 색을 쓰느니 밝기를 바꾼 색을 만든다 (아래) */
    const c = pickBest(() => true, (c) => {
      const gap = Math.min(...Ls.map((L) => Math.abs(L - c.lch[0])), 0.5);
      return c.area ** 0.4 * mud(c) * (0.35 + gap * 3) * fillChroma(c.lch[1], style);
    }, [0.08]);
    if (!c) break;
    add(c, 'fill');
  }

  /* 후보가 모자란 단조로운 사진: 가장 넓은 색의 밝기를 바꿔 채운다 */
  const base = pool[0] ?? { lab: fixedLabs[0] ?? [0.6, 0, 0], area: 1 };
  const shifts = [0.22, -0.22, 0.38, -0.38, 0.12, -0.12, 0.3, -0.3];
  for (const minDE of [0.08, SYNTH_MIN_DE, 0.04]) {
    for (const s of shifts) {
      if (picks.length >= need) break;
      const [L, C, h] = oklabToOklch(base.lab);
      const lch = [Math.min(0.97, Math.max(0.12, L + s)), C, h];
      const lab = oklchToOklab(lch);
      if (takenLabs().some((t) => deltaE(t, lab) < minDE)) continue;
      picks.push({ lab, lch, hex: oklabToHex(lab), area: 0, role: 'fill' });
    }
  }

  return picks;
}

/** 강조색 점수: 스타일마다 원하는 채도가 다르다 */
function accentWeight(C, style) {
  if (style === 'vivid') return 2 * C ** 1.5 + 0.001;
  if (style === 'muted') return 1 / (1 + Math.abs(C - 0.07) * 20);
  return C + 0.001;
}

/** 채우는 색의 채도 선호 */
function fillChroma(C, style) {
  if (style === 'vivid') return 0.5 + C * 4;
  if (style === 'muted') return Math.max(0.2, 1.2 - C * 4);
  return 0.7 + C * 2;
}

/* ==========================================================
   탁한 색 판단
   ========================================================== */

/** 채도가 낮은 중간 밝기 = 회갈색·회녹색처럼 탁해 보이는 색 */
function isMuddy(c) {
  const [L, C] = c.lch;
  return C > 0.012 && C < 0.065 && L > 0.3 && L < 0.78;
}

/** 사진 대부분이 탁한 색이면 그게 그 사진의 분위기이므로 벌점을 주지 않는다 */
function isMuddyPhoto(candidates) {
  const area = candidates.filter(isMuddy).reduce((a, c) => a + c.area, 0);
  return area > 0.65;
}

/* ==========================================================
   조화 점수 — 다시 뽑기 때 여러 조합 중 고를 기준
   ========================================================== */

function minDistance(labs) {
  let min = Infinity;
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) min = Math.min(min, deltaE(labs[i], labs[j]));
  }
  return min;
}

function harmony(labs, style) {
  const Ls = labs.map((l) => l[0]);
  const mean = Ls.reduce((a, b) => a + b, 0) / Ls.length;
  const spread = Math.sqrt(Ls.reduce((a, L) => a + (L - mean) ** 2, 0) / Ls.length);

  const minDE = minDistance(labs);

  const lchs = labs.map(oklabToOklch);
  const avgC = lchs.reduce((a, l) => a + l[1], 0) / lchs.length;
  const muddy = lchs.filter((l) => isMuddy({ lch: l })).length;
  const chromaWeight = { vivid: 3, muted: -1, raw: 0.5, natural: 1.5 }[style];

  return Math.min(spread, 0.32) * 1.5
    + Math.min(minDE, 0.2) * 3
    - (minDE < 0.08 ? 0.25 : 0)   /* 거의 같은 두 색이 있으면 크게 깎는다 */
    + avgC * chromaWeight
    - (style === 'muted' ? 0 : muddy * 0.12);
}

/* ==========================================================
   다듬기 — 원래 색에서 ΔE maxShift 이내로만
   ========================================================== */

function refine(pick, style, accentHue) {
  const { maxShift } = STYLES[style];
  if (maxShift === 0) return pick.hex;

  let [L, C, h] = pick.lch;

  if (pick.role === 'light') {
    /* 종이처럼 맑게: 더 밝게, 채도는 조금 덜 */
    L = Math.min(0.975, Math.max(L, Math.min(L + 0.05, 0.955)));
    C *= style === 'muted' ? 0.5 : 0.75;
  } else if (pick.role === 'dark') {
    /* 순검정 대신 색조를 머금은 짙은 색 */
    if (L < 0.17) L = 0.17;
    if (C < 0.014) { C = 0.014; h = accentHue; }
  } else if (style === 'vivid') {
    C *= 1.3;
  } else if (style === 'muted') {
    C *= 0.6;
    L += (0.62 - L) * 0.15;
  } else {
    /* 자연스럽게: 탁한 색은 조금 맑게, 끝까지 찬 색은 조금 누그러뜨리기 */
    if (isMuddy(pick)) C *= 1.35;
    if (C > 0.2) C = 0.2;
  }

  const target = oklchToOklab([L, C, h]);
  return oklabToHex(limitShift(pick.lab, target, maxShift));
}

/**
 * 다듬은 뒤 두 색이 너무 가까워졌으면(밝은 색을 더 밝게 하다 옆의 밝은 색에 붙는 경우 등)
 * 그 쌍 중 실제로 다듬어진 색을 원래대로 되돌린다. 둘 다 다듬어졌으면 덜 중요한 쪽(채우는 색 → 강조 → 어두운 → 밝은)
 */
function keepApart(picks, fixedLabs) {
  const order = { fill: 0, accent: 1, dark: 2, light: 3 };
  const items = [
    ...fixedLabs.map((lab) => ({ fixed: true, lab, hex: null })),
    ...picks,
  ];
  const labOf = (it) => (it.fixed ? it.lab : hexToOklab(it.hex));

  for (let pass = 0; pass < picks.length; pass++) {
    let fixedOne = false;
    for (let i = 0; i < items.length && !fixedOne; i++) {
      for (let j = i + 1; j < items.length && !fixedOne; j++) {
        const now = deltaE(labOf(items[i]), labOf(items[j]));
        const before = deltaE(items[i].lab, items[j].lab);
        if (now >= Math.min(0.08, before)) continue;
        const refined = [items[i], items[j]].filter((it) => !it.fixed && it.hex !== it.origHex);
        if (!refined.length) continue;
        refined.sort((a, b) => order[a.role] - order[b.role]);
        refined[0].hex = refined[0].origHex;
        fixedOne = true;
      }
    }
    if (!fixedOne) break;
  }
}

/** orig에서 target 쪽으로 가되 ΔE가 max를 넘지 않는 곳까지만 */
function limitShift(orig, target, max) {
  const d = deltaE(orig, target);
  if (d <= max) return target;
  const t = max / d;
  return orig.map((v, i) => v + (target[i] - v) * t);
}

/* ==========================================================
   칩 순서
   ========================================================== */

/** my pick은 제자리, 나머지는 밝은 색부터 */
function arrange(picks, fixed) {
  const rest = [...picks].sort((a, b) => b.lch[0] - a.lch[0]).map((p) => p.hex);
  return Array.from({ length: 5 }, (_, i) => (fixed.has(i) ? fixed.get(i) : rest.shift()));
}

function signatureOf(picks, fixed) {
  return [...fixed.values(), ...picks.map((p) => p.hex)].sort().join(',');
}
