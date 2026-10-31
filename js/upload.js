/* ==========================================================
   upload.js — 사진 들여오기
   파일 고르기 / 창 어디에나 끌어다 놓기 / 샘플 사진 세 가지 길
   사진은 브라우저 안에서만 다루고 어디로도 보내지 않는다
   ========================================================== */

import { extractColors, pickDistinct } from './extract.js';

/* 샘플: 작업에 쓰는 원본과 첫 화면 카드 */
const SAMPLES = {
  1: 'samples/sample1.jpg',
  2: 'samples/sample2.jpg',
  3: 'samples/sample3.jpg',
};

/* 사진을 사진 영역·색 추출에 쓸 때 긴 변 최대 크기 (원본이 커도 이 크기로 줄인다) */
const WORK_MAX = 1600;

let onImage = null;

/**
 * 사진이 준비되면 부를 함수 등록 (main.js)
 * @param {(img: HTMLImageElement) => void} fn
 */
export function setOnImage(fn) {
  onImage = fn;
}

/** 업로드 관련 이벤트 연결 */
export function initUpload() {
  const fileInput = document.getElementById('file-input');

  document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadFile(file);
    fileInput.value = ''; /* 같은 파일을 다시 골라도 change가 일어나게 */
  });

  document.querySelectorAll('.sample').forEach((btn) => {
    btn.addEventListener('click', () => loadSrc(SAMPLES[btn.dataset.sample]));
    /* 마우스를 처음 올리거나 포커스가 오면 그 사진의 팔레트를 미리 뽑아 띠에 채운다 */
    const prime = () => primeSampleStrip(btn);
    btn.addEventListener('pointerenter', prime, { once: true });
    btn.addEventListener('focus', prime, { once: true });
  });

  initWindowDrop();
}

/** 파일 고르기 창 열기 (헤더 등 다른 곳에서도 쓸 수 있게) */
export function openFilePicker() {
  document.getElementById('file-input').click();
}

/* ---------- 창 전체 끌어다 놓기 ---------- */

function initWindowDrop() {
  const overlay = document.getElementById('drop-overlay');
  let depth = 0; /* 자식 요소를 지날 때마다 dragenter/leave가 반복되므로 깊이로 센다 */

  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });

  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.hidden = true;
  });

  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) loadFile(file);
  });
}

/* ---------- 읽기 ---------- */

function loadFile(file) {
  if (!file.type.startsWith('image/')) return;
  /* 파일을 서버로 보내지 않고 브라우저 메모리 주소로만 연다 */
  const url = URL.createObjectURL(file);
  loadSrc(url, () => URL.revokeObjectURL(url));
}

function loadSrc(src, cleanup) {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const work = downscale(img, WORK_MAX);
    cleanup?.();
    onImage?.(work);
  };
  img.onerror = () => {
    cleanup?.();
    console.error('사진을 불러오지 못했어요:', src);
  };
  img.src = src;
}

/**
 * 큰 사진은 긴 변을 max로 줄인 이미지로 바꾼다 (스포이드·추출을 가볍게)
 * @returns {HTMLCanvasElement|HTMLImageElement}
 */
function downscale(img, max) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return img;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * 새로고침 뒤 되살리기용 작은 사진 (base64)
 * @param {HTMLCanvasElement|HTMLImageElement} img
 */
export function makePreview(img, max = 800) {
  const w0 = img.naturalWidth ?? img.width;
  const h0 = img.naturalHeight ?? img.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * scale);
  c.height = Math.round(h0 * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}

/**
 * 저장해 둔 base64 사진을 다시 이미지로
 * @param {string} src
 * @returns {Promise<HTMLImageElement|null>}
 */
export function restoreImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------- 첫 화면 샘플 띠 ---------- */

function primeSampleStrip(btn) {
  const strip = btn.querySelector('.sample__strip');
  const img = btn.querySelector('img');
  const fill = () => {
    const palette = pickDistinct(extractColors(img), new Set(), 5, false);
    strip.innerHTML = palette.map((c) => `<i style="--c: ${c}"></i>`).join('');
    strip.setAttribute('data-ready', '');
  };
  if (img.complete) fill();
  else img.addEventListener('load', fill, { once: true });
}
