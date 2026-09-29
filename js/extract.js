/* ==========================================================
   extract.js — 사진에서 대표색 추출
   Canvas API로 픽셀을 읽어 k-means 클러스터링으로 색 뽑기
   사진은 브라우저 밖으로 전송하지 않음
   ========================================================== */

import { rgbToHex } from './color.js';

/* 색 추출에 쓸 캔버스 크기 (작을수록 빠르지만 정확도 감소) */
const SAMPLE_SIZE = 120;

/* 후보 색 수 (나중에 다시 뽑기 때 섞을 풀) */
const CANDIDATE_COUNT = 12;

/* k-means 반복 횟수 */
const KMEANS_ITER = 20;

/**
 * 이미지에서 후보 색 CANDIDATE_COUNT개를 추출
 * @param {HTMLImageElement} img
 * @returns {string[]} HEX 문자열 배열
 */
export function extractColors(img) {
  /* 1. 이미지를 작은 캔버스에 그려 픽셀 샘플링 */
  const canvas = document.createElement('canvas');
  canvas.width  = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  /* 2. 픽셀 데이터 읽기 (RGBA 순서) */
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  /* 3. RGBA 배열 → [r, g, b] 배열로 변환 (투명 픽셀 제외) */
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue; /* 투명 픽셀 무시 */
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  /* 4. k-means로 CANDIDATE_COUNT개 클러스터 중심 구하기 */
  const centers = kmeans(pixels, CANDIDATE_COUNT, KMEANS_ITER);

  /* 5. RGB → HEX 변환 후 반환 */
  return centers.map((c) => rgbToHex(c));
}

/**
 * 후보 색 중 서로 너무 비슷하지 않은 5개 고르기
 * - 이미 my pick으로 고정된 색은 무조건 포함
 * - shuffle 옵션이 true(기본값)이면 풀을 먼저 섞어
 *   다시 뽑기를 눌렀을 때 매번 다른 조합이 나옴
 * @param {string[]} candidates - 후보 HEX 배열
 * @param {Set<string>} myPickColors - my pick으로 고정된 HEX 집합
 * @param {number} count - 고를 개수 (기본 5)
 * @param {boolean} shuffle - 풀 셔플 여부 (기본 true)
 * @returns {string[]} 선택된 HEX 배열
 */
export function pickDistinct(candidates, myPickColors = new Set(), count = 5, shuffle = true) {
  /* my pick 색은 결과에 먼저 포함 */
  const fixed = [...myPickColors];

  /* 풀에서 my pick 제외 후, 셔플해서 다시 뽑기마다 다른 조합이 나오게 함 */
  const pool = candidates
    .filter((c) => !myPickColors.has(c))
    .sort(() => shuffle ? Math.random() - 0.5 : 0); /* 셔플 */

  const chosen = [...fixed];

  /* 이미 고른 색들과 가장 다른 색을 순서대로 채움 */
  while (chosen.length < count && pool.length > 0) {
    let bestIdx  = 0;
    let bestDist = -1;

    for (let i = 0; i < pool.length; i++) {
      /* 고른 색이 없으면 무조건 첫 번째 */
      const minDist = chosen.length === 0
        ? Infinity
        : Math.min(...chosen.map((c) => colorDistance(pool[i], c)));

      if (minDist > bestDist) {
        bestDist = minDist;
        bestIdx  = i;
      }
    }

    chosen.push(pool.splice(bestIdx, 1)[0]);
  }

  return chosen.slice(0, count);
}

/* ---------- 내부 헬퍼 ---------- */

/**
 * k-means 클러스터링
 * @param {number[][]} pixels - [r, g, b] 배열의 배열
 * @param {number} k - 클러스터 수
 * @param {number} maxIter - 최대 반복 횟수
 * @returns {number[][]} 클러스터 중심 [r, g, b] 배열
 */
function kmeans(pixels, k, maxIter) {
  /* 픽셀이 없거나 k보다 적으면 있는 픽셀만 반환 */
  if (pixels.length === 0) return [];
  if (pixels.length < k) return pixels.map((p) => [...p]);

  /* 초기 중심: 픽셀 중 균등 간격으로 k개 선택 */
  let centers = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centers.push([...pixels[i * step]]);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    /* 각 픽셀을 가장 가까운 클러스터에 배정 */
    const clusters = Array.from({ length: k }, () => []);
    for (const px of pixels) {
      let nearest = 0;
      let minDist = Infinity;
      for (let j = 0; j < k; j++) {
        const d = euclidean(px, centers[j]);
        if (d < minDist) { minDist = d; nearest = j; }
      }
      clusters[nearest].push(px);
    }

    /* 클러스터 중심 재계산 */
    let changed = false;
    for (let j = 0; j < k; j++) {
      if (clusters[j].length === 0) continue; /* 빈 클러스터 스킵 */
      const avg = average(clusters[j]);
      if (euclidean(avg, centers[j]) > 1) changed = true;
      centers[j] = avg;
    }

    /* 중심이 더 이상 움직이지 않으면 일찍 종료 */
    if (!changed) break;
  }

  return centers;
}

/**
 * 두 픽셀 사이의 유클리드 거리 (RGB 공간)
 */
function euclidean([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt(
    (r1 - r2) ** 2 +
    (g1 - g2) ** 2 +
    (b1 - b2) ** 2
  );
}

/**
 * 픽셀 배열의 평균 RGB 계산
 */
function average(pixels) {
  const n = pixels.length;
  const sum = pixels.reduce(
    ([sr, sg, sb], [r, g, b]) => [sr + r, sg + g, sb + b],
    [0, 0, 0]
  );
  return sum.map((v) => Math.round(v / n));
}

/**
 * 두 HEX 색 사이의 RGB 공간 거리
 */
function colorDistance(hex1, hex2) {
  const parse = (h) => {
    const c = h.replace('#', '');
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  };
  return euclidean(parse(hex1), parse(hex2));
}
