# VibePicker 디자인 시스템

VibePicker v2 화면을 만들 때 지키는 규칙이다. 토큰 값은 [`css/tokens.css`](../css/tokens.css)에 있고, 모든 컴포넌트와 상태는 [`docs/components.html`](./components.html) 견본 페이지에서 직접 눌러 볼 수 있다.

`ai-tell-check` 스킬은 이 문서를 기준으로 화면을 점검한다.

---

## 1. 원칙

1. **도구는 물러나고, 사용자의 사진과 브랜드가 주인공이다.** VibePicker의 UI는 중립색과 경계선으로 조용하게 만들고, 색은 사용자가 만든 브랜드에 양보한다.
2. **사진에 물든다.** 사진을 바꾸면 중립색이 그 사진의 색조를 아주 살짝 머금고, 강조색이 바뀐다. 도구 전체가 지금 작업 중인 분위기를 따라간다.
3. **강조색은 한 화면에 한 가지 행동에만.** 모든 버튼이 강조색이면 어느 것도 강조되지 않는다.
4. **움직임은 상태가 바뀌었다는 신호다.** 장식으로 움직이지 않는다. 빠르고(140~320ms) 조용하게.
5. **값은 토큰으로만.** CSS에 HEX, px 간격, ms를 직접 쓰지 않는다. 새 값이 필요하면 토큰을 먼저 추가하고 이 문서를 고친다.

---

## 2. 색

### 2-1. 사진에 물드는 중립색

중립색 12단계는 밝기가 고정이고, 채도만 `--tint-c`에 비례한다. `js/ui/theme.js`가 사진 팔레트에서 두 값을 정한다.

| 변수 | 뜻 | 범위 |
| --- | --- | --- |
| `--tint-h` | 중립색이 머금을 색조 각도 (OKLCH) | 0~360, 강조색의 색조 |
| `--tint-c` | 머금는 정도 | 0~0.02. 기본 0.008 |
| `--accent` | 강조색 | 브랜드 Primary. 흰 글자와 대비 4.5:1 이상이 되도록 밝기를 보정 |

`--neutral-0`(흰색) ~ `--neutral-950`(가장 어두움)은 **컴포넌트에서 직접 쓰지 않는다.** 아래 의미 색만 쓴다.

### 2-2. 의미 색

| 토큰 | 라이트 | 쓰는 곳 |
| --- | --- | --- |
| `--bg` | neutral-50 | 페이지 바탕 |
| `--surface` | neutral-0 | 패널, 카드, 창 |
| `--surface-sunken` | neutral-100 | 세그먼트 바탕, 입력 우물 |
| `--surface-hover` / `--surface-active` | neutral-100 / 150 | 고스트·보조 버튼, 메뉴 항목 |
| `--surface-inverse` | neutral-900 | 토스트 |
| `--border` / `--border-strong` | neutral-200 / 300 | 구분선 / 호버된 경계, 입력창 |
| `--text` | neutral-900 | 본문, 제목 |
| `--text-muted` | neutral-600 | 설명, 보조 라벨 (대비 6:1 이상) |
| `--text-subtle` | neutral-500 | 자리 표시 글자. **정보 전달에 쓰지 않음** |
| `--accent` / `-hover` / `-active` | 사진에 따라 | 주요 버튼, 선택된 상태, 포커스 링 |
| `--accent-soft` / `--accent-text` | 강조색 10% | `추천` 태그 바탕 / 그 위 글자 |
| `--success` / `--warning` / `--danger` | 고정 | 복사됨 / 가독성 주의 / 삭제 |

다크 모드는 같은 이름에 다른 값을 넣는다. 시스템 설정을 따르고, `<html data-theme="dark|light">`로 직접 고르면 그쪽이 이긴다.

### 2-3. 하지 말 것

- 강조색을 보조 버튼, 아이콘, 링크에 함께 쓰기
- 그라데이션 배경, 유리 효과(blur 배경) — 토스트·창의 바탕 흐림도 쓰지 않는다
- `#3B82F6` 계열 기본 파랑을 강조색 기본값으로 쓰기

---

## 3. 서체

- UI: Pretendard (가변 서체). HEX·숫자는 `.num`(고정폭 숫자), 코드는 `.mono`
- 사용자가 고른 브랜드 서체는 캔버스(보드·목업) 안에서만 쓴다. VibePicker UI는 항상 Pretendard

| 토큰 | 크기 | 쓰는 곳 |
| --- | --- | --- |
| `--text-2xs` | 11px | 배지, 칩 위 아주 작은 라벨 |
| `--text-xs` | 12px | 캡션, RGB, 보조 숫자 |
| `--text-sm` | 13px | 보조 라벨, 세그먼트, 메뉴 항목 |
| `--text-base` | 14px | UI 기본 (버튼, 입력) |
| `--text-md` | 16px | 강조 라벨, 본문 |
| `--text-lg` | 20px | 섹션 제목, 창 제목 |
| `--text-xl` | 28px | 화면 제목 |
| `--text-2xl` | 40px | 첫 화면 제목 (휴대폰) |
| `--text-3xl` | 56px | 첫 화면 제목 (PC) |

- 굵기는 **400 / 500 / 600** 세 가지만. 700 이상은 쓰지 않는다.
- 28px 이상은 `--tracking-tight`, `--leading-tight`
- 제목과 그 아래 본문은 1.5배 이상 차이가 나게 (위계)

---

## 4. 간격·크기·모양

- **간격:** 4px 그리드. `--space-1`(4) `-2`(8) `-3`(12) `-4`(16) `-5`(20) `-6`(24) `-8`(32) `-10`(40) `-12`(48) `-16`(64) `-20`(80)
  - 관련된 것끼리는 8~12, 묶음 사이는 24~32, 영역 사이는 48 이상
- **컨트롤 높이:** `--control-sm` 30 / `--control-md` 36 / `--control-lg` 44 (휴대폰 터치 대상은 44 이상)
- **둥글기:** `--radius-sm` 6 (칩·태그·세그먼트 안쪽) / `--radius-md` 10 (버튼·입력·메뉴 항목) / `--radius-lg` 16 (패널·카드·창) / `--radius-full`
  - 안쪽 요소의 둥글기 = 바깥 둥글기 − 안쪽 여백 (예: 세그먼트 바깥 10, 여백 3 → 안쪽 6~7)
- **그림자는 두 단계뿐:** `--shadow-float`(호버로 떠오른 카드, 메뉴) / `--shadow-overlay`(창, 시트, 토스트). 평소의 구분은 1px `--border`
- **아이콘:** `assets/icons.svg` 스프라이트, 24 격자, 선 굵기 1.75, 크기 14 / 16 / 20

---

## 5. 컴포넌트 상태 규칙

모든 누를 수 있는 요소는 다섯 상태를 가진다.

| 상태 | 규칙 |
| --- | --- |
| 기본 | |
| hover | 바탕이 한 단계 진해지거나(`--surface-hover`, `--accent-hover`), 카드는 `--lift`만큼 떠오름. **마우스가 있는 기기에서만** (`@media (hover: hover)`) |
| active (누름) | `scale(var(--press-scale))` = 0.97, `--dur-instant` |
| focus-visible | 2px `--focus-ring` 링, 2px 띄움. 키보드로 이동할 때만 |
| disabled | 불투명도 0.45, 커서 not-allowed, 호버·누름 반응 없음. 가능하면 이유를 옆에 적는다 |

| 컴포넌트 | 파일 | 메모 |
| --- | --- | --- |
| 버튼 `.btn` | components.css | `--primary` 화면당 하나 / `--secondary` / `--ghost` / `--danger` / `--icon`, 크기 `--sm` `--lg` |
| 세그먼트 `.segmented` | components.css, js/ui/segmented.js | 선택 표시가 미끄러져 이동. ←→ 키로 이동 |
| 슬라이더 `.slider` | components.css | 채워진 부분이 강조색. 값은 고정폭 숫자로 |
| 선택 목록 `.select` | components.css, js/ui/select.js | 기본 `<select>` 대신. 항목마다 미리보기를 넣을 수 있음. ↑↓ Enter Esc |
| 입력창 `.field` | components.css | 글자 수 표시, 포커스 시 경계가 강조색 |
| 확인 창 `.dialog` | components.css, js/ui/dialog.js | 브라우저 `confirm` 대신. Esc·바깥 클릭으로 닫힘, 포커스 가둠 |
| 토스트 `.toast` | components.css, js/ui/toast.js | 화면 아래 가운데, 1.8초. 스크린 리더에 읽힘 |
| 바텀 시트 `.sheet` | components.css, js/ui/sheet.js | 640px 이하에서 패널 대신. 끌어 내려 닫기 |
| 툴팁 `[data-tooltip]` | components.css | 아이콘 버튼 설명. 0.4초 머문 뒤 표시 |
| 태그 `.tag` | components.css | `my pick`, `추천`, 역할 이름 |
| 카드 `.card` | components.css | `--interactive`면 호버로 떠오름 |

---

## 6. 모션

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `--dur-instant` | 80ms | 누름 |
| `--dur-fast` | 140ms | 호버, 색 바뀜, 툴팁, 사라짐 |
| `--dur-base` | 220ms | 탭·화면 전환, 메뉴 열림, 세그먼트 이동 |
| `--dur-slow` | 320ms | 창·시트 열림, 팔레트 교체, 사진에 물드는 색 변화 |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | 들어오는 것, 호버 |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | 자리를 바꾸는 것 (세그먼트 표시, 슬라이드 넘김) |
| `--ease-sheet` | `cubic-bezier(.32,.72,0,1)` | 창, 바텀 시트 |

**정해 둔 움직임**

| 상황 | 움직임 |
| --- | --- |
| 버튼 호버 / 누름 | 바탕색 140ms / 0.97로 80ms |
| 카드·칩 호버 | 2px 떠오름 + `--shadow-float` |
| 세그먼트 선택 | 선택 표시가 220ms 동안 미끄러짐 |
| 메뉴 열림 | 위에서 0.96 → 1, 투명 → 불투명, 220ms |
| 창 열림 / 닫힘 | 0.96 → 1 (320ms, sheet 곡선) / 0.98로 140ms |
| 시트 열림 | 아래에서 올라옴 320ms |
| 토스트 | 8px 아래에서 올라옴, 사라질 때 투명하게 |
| 팔레트 교체 | 칩 색이 왼쪽부터 30ms 간격으로 차례로 (`--stagger`) |
| 화면 전환 | 나가는 쪽 140ms 투명 → 들어오는 쪽 8px 올라오며 220ms |

**규칙**

- `transition: all` 금지. 바뀌는 속성만 적는다.
- `transform`과 `opacity`만 움직인다. width, height, top, left는 움직이지 않는다.
- 등장 모션(`anim-rise`, `anim-stagger`)은 화면당 한 곳만. 모든 것이 떠오르면 AI 티가 난다.
- `prefers-reduced-motion: reduce`이면 `motion.css`가 모든 움직임을 끈다. 기능은 그대로 동작해야 한다.

---

## 7. 문구

- 버튼은 결과를 말한다: "확인" ✗ → "프롬프트 복사", "서랍에서 지우기"
- 같은 대상은 같은 이름: **서랍**(저장한 브랜드 모음), **시안**(다시 뽑기 전 보관한 조합), **브랜드 보드**, **적용 화면**
- 상투 문구 금지: "손쉽게", "한눈에", "간편하게", "혁신적인", "지금 바로 시작하세요"
- 문장 끝 느낌표·이모지 없이

---

## 8. 파일

| 파일 | 내용 |
| --- | --- |
| `css/tokens.css` | 토큰 (색·서체·간격·크기·모양·모션, 다크) |
| `css/base.css` | 초기화, 포커스, 유틸리티(`.num`, `.mono`, `.icon`, `.sr-only`) |
| `css/motion.css` | 키프레임, 등장·전환 유틸리티, 움직임 줄이기 |
| `css/components.css` | 컴포넌트 |
| `assets/icons.svg` | UI 아이콘 스프라이트 |
| `js/ui/*.js` | 컴포넌트 동작 (확인 창, 토스트, 시트, 선택 목록, 세그먼트) |
| `docs/components.html` | 견본 페이지 |
