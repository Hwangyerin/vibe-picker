/* ==========================================================
   upload.js — 사진 올리기, 샘플 사진
   파일 선택 / 드래그앤드롭 / 샘플 클릭 세 가지 경로 처리
   ========================================================== */

import { state, setState } from './state.js';

/* 샘플 사진 경로 (samples/ 폴더에 있어야 함) */
const SAMPLE_PATHS = [
  'samples/sample1.jpg',
  'samples/sample2.jpg',
  'samples/sample3.jpg',
];

/* 이미지가 올라왔을 때 호출할 콜백 (main.js에서 등록) */
let onImageLoaded = null;

/**
 * 이미지 로드 콜백 등록
 * @param {(img: HTMLImageElement) => void} fn
 */
export function setOnImageLoaded(fn) {
  onImageLoaded = fn;
}

/**
 * 업로드 UI 초기화 — 이벤트 리스너 연결
 */
export function initUpload() {
  const placeholder  = document.getElementById('upload-placeholder');
  const fileInput    = document.getElementById('file-input');
  const btnFile      = document.getElementById('btn-file');
  const sampleThumbs = document.querySelectorAll('.sample-thumb');

  /* 파일 선택 버튼 → file input 열기 */
  btnFile.addEventListener('click', () => fileInput.click());

  /* 파일 선택됐을 때 */
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    /* input을 리셋해야 같은 파일을 다시 올릴 때도 change 이벤트가 발생 */
    fileInput.value = '';
  });

  /* 드래그앤드롭: placeholder 영역 전체에서 받음 */
  placeholder.addEventListener('dragover', (e) => {
    e.preventDefault(); /* 기본 동작 막아야 drop 이벤트 발생 */
    placeholder.classList.add('drag-over');
  });
  placeholder.addEventListener('dragleave', () => {
    placeholder.classList.remove('drag-over');
  });
  placeholder.addEventListener('drop', (e) => {
    e.preventDefault();
    placeholder.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
  });

  /* 샘플 사진 클릭 */
  sampleThumbs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      loadSample(SAMPLE_PATHS[idx]);
    });
  });
}

/* ---------- 내부 함수 ---------- */

/**
 * File 객체를 읽어 이미지로 로드
 * @param {File} file
 */
function loadFile(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => loadSrc(e.target.result);
  reader.readAsDataURL(file);
}

/**
 * URL(data URL 또는 경로)을 이미지로 로드
 * @param {string} src
 */
function loadSrc(src) {
  const img = new Image();
  img.onload = () => {
    /* 상태에 이미지 저장 */
    setState({ image: img, isDirty: true });

    /* 사진 표시 영역 전환 */
    showImageDisplay(img);

    /* 썸네일(80px) + 프리뷰(800px) 생성 후 상태에 저장 */
    const thumbnail    = makeThumbnail(img);
    const previewImage = makePreviewImage(img);
    setState({ thumbnail, previewImage });

    /* 색 추출 등 후속 작업을 main.js가 처리 */
    onImageLoaded?.(img);
  };
  img.onerror = () => console.error('이미지를 불러오지 못했습니다:', src);
  img.src = src;
}

/**
 * 샘플 사진 경로로 로드
 * @param {string} path
 */
function loadSample(path) {
  loadSrc(path);
}

/**
 * 캔버스에 사진을 그림
 * (화면 전환은 main.js handleImageLoaded에서 처리)
 * @param {HTMLImageElement} img
 */
function showImageDisplay(img) {
  const canvas = document.getElementById('image-canvas');

  /* 캔버스 크기를 이미지에 맞게 설정 */
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
}

/**
 * 이미지를 작은 썸네일(base64)로 변환 (서랍 카드 미리보기용 — 80px 소형)
 * @param {HTMLImageElement} img
 * @param {number} maxW - 최대 너비 (기본 80px)
 * @returns {string} base64 data URL
 */
function makeThumbnail(img, maxW = 80) {
  const scale  = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth  * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * 이미지를 큰 프리뷰(base64)로 변환 (서랍에서 불러올 때 캔버스 표시용 — 800px 대형)
 * @param {HTMLImageElement} img
 * @param {number} maxW - 최대 너비 (기본 800px)
 * @returns {string} base64 data URL
 */
function makePreviewImage(img, maxW = 800) {
  const scale  = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth  * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}
