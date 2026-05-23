# Claude Code — Hex Comparator UI Implementation Prompt

> 이 파일 하나만 읽어도 작업할 수 있도록 만들었다. CSS 전문, 마크업 변경 사항, 시각 레퍼런스 경로를 모두 포함한다.

---

## 0. 너의 작업 (한 줄)

`src/styles.css`를 §4의 CSS 전문으로 **통째로 교체**하고, `src/app.js`에 §5의 마크업 추가 두 가지를 반영한 뒤 빌드한다. **로직(`src/core.js`)·className 계약·테스트는 절대 손대지 않는다.**

---

## 1. 컨텍스트

엔터프라이즈 마이그레이션 검증 도구(`spec-hex-comparator.md` §8). 메인프레임(As-Is) → 오픈시스템(To-Be) CSV를 byte-for-byte 비교해 **Pass / Fail**을 판정한다. 외부 요청 0인 폐쇄망용 단일 오프라인 `index.html`.

기존 구조:
- `src/core.js` — 로직 (테스트 47/47 통과, 손대지 않음)
- `src/app.js` — UI 마크업, className hook 보유 (§5 두 군데만 수정)
- `src/styles.css` — 본 핸드오프에서 **전부 교체**
- `build.mjs` — 단일 `index.html`로 인라인 빌드

---

## 2. 절대 제약 (어기면 산출물 폐기)

1. **`.mono` 등폭 폰트 유지** — 모든 헥스/원시값에 적용 (스펙 §2.1)
2. **Pass/Fail 이중 인코딩** — 색만 의존 금지. 색 + ✓/× SVG + 텍스트 3중 인코딩 (스펙 §2.5)
3. **외부 요청 0** — `styles.css`에 외부 URL 없음, 폰트는 시스템 스택, 아이콘은 인라인 SVG만 (스펙 §2.3)
4. **로직/판정 의미/기능 변경 금지** — 시각 표현만 바꾼다 (스펙 §2.4)

---

## 3. ClassName 계약 (변경 없음 — 그대로 유지)

```
레이아웃    .app .app__title .app__subtitle .card .card__title .muted .small .mono
업로드      .uploads .drop .drop--over .drop--loaded .drop__role .drop__name .drop__hint .colchips .chip
설정        .field .field__label .toggles .toggle .toggle--on .toggle--off .toggle--pk .checkrow
액션/메시지 .btn .btn--secondary .btnrow .error .warn .render-note
판정(B)     .verdict .verdict--pass .verdict--fail .verdict__badge .verdict__reason .verdict__meta
집계(C)     .metrics .metric .metric__num .metric__label
상세(D)     .filters .detail-row .detail-row__head .detail-row__head--plain
            .badge .badge--match .badge--mismatch .badge--only
            .detail-row__key .detail-row__preview .detail-row__body
diff(D)     .diffpair .diffpair__col .diffpair__sides .side .side__label .side__val
            .u  .u.diff  .u.diff.residual  .empty
```

상태 modifier 의미:
- `--over`(드래그 중) `--loaded`(파일 인식됨)
- `.toggle--on`(검사 중) `.toggle--off`(제외됨) `.toggle--pk`(PK, 비활성)
- `.badge--match/--mismatch/--only`(일치/불일치/한쪽만)
- `.u.diff`(다른 유닛) `.u.diff.residual`(길이 차 잔여 유닛) `.empty`(빈 값 ∅)

---

## 4. `src/styles.css` 전문 (그대로 복사)

기존 파일을 통째로 아래 내용으로 덮어쓴다.

```css
/* Hex Comparator — Linear-style minimal redesign.
 * Sentence case throughout. Decorative icons removed. Only PASS/FAIL
 * accessibility icons retained (color-blind dual-encoding mandate). */

:root {
  --bg:          oklch(99% 0 0);
  --bg-sunken:   oklch(97.5% 0 0);
  --surface:     #fff;
  --surface-2:   oklch(98.5% 0 0);

  --ink:         oklch(22% 0.005 270);
  --ink-2:       oklch(40% 0.006 270);
  --ink-3:       oklch(55% 0.005 270);
  --ink-4:       oklch(72% 0.005 270);
  --line:        oklch(93% 0.003 270);
  --line-2:      oklch(88% 0.004 270);
  --line-3:      oklch(82% 0.005 270);

  --accent:      oklch(52% 0.18 268);
  --accent-2:    oklch(45% 0.19 268);
  --accent-soft: oklch(96% 0.025 268);
  --focus-ring:  oklch(85% 0.10 268);

  --pass:        oklch(52% 0.13 152);
  --pass-2:      oklch(42% 0.13 152);
  --pass-soft:   oklch(96.5% 0.030 152);
  --pass-border: oklch(85% 0.060 152);

  --fail:        oklch(54% 0.20 25);
  --fail-2:      oklch(44% 0.21 25);
  --fail-soft:   oklch(97% 0.025 25);
  --fail-border: oklch(85% 0.080 25);

  --warn:        oklch(60% 0.13 75);
  --warn-2:      oklch(46% 0.14 75);
  --warn-soft:   oklch(97% 0.030 90);
  --warn-border: oklch(86% 0.075 80);

  --diff-bg:        oklch(92% 0.090 85);
  --diff-fg:        oklch(28% 0.080 60);
  --diff-residual-bg: oklch(89% 0.060 290);
  --diff-residual-fg: oklch(30% 0.080 290);

  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue",
          "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas,
          "D2Coding", "Courier New", monospace;

  --r-xs: 4px;
  --r-sm: 6px;
  --r:    8px;
  --r-lg: 10px;

  --shadow-xs: 0 1px 0 rgba(17, 24, 39, 0.03);
  --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04), 0 0 0 1px rgba(17, 24, 39, 0.04);
  --shadow:    0 4px 12px -4px rgba(17, 24, 39, 0.08), 0 0 0 1px rgba(17, 24, 39, 0.05);
  --shadow-lg: 0 12px 32px -10px rgba(17, 24, 39, 0.14), 0 0 0 1px rgba(17, 24, 39, 0.06);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--sans);
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "ss01", "cv11", "tnum";
  letter-spacing: -0.005em;
}
button, input, select, textarea { font-family: inherit; font-size: inherit; }

.mono {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "zero";
  letter-spacing: 0;
}
.muted { color: var(--ink-3); }
.small { font-size: 12px; line-height: 1.5; }

/* ── App shell ─────────────────────────────────────────────────── */
.app {
  max-width: 980px;
  margin: 0 auto;
  padding: 48px 28px 120px;
}
.app__title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.015em;
  margin: 0 0 6px;
  color: var(--ink);
}
.app__subtitle {
  color: var(--ink-3);
  margin: 0 0 36px;
  font-size: 13px;
  max-width: 640px;
  line-height: 1.55;
}
.app__subtitle .mono { color: var(--ink-2); font-weight: 500; }

/* ── Card ──────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 22px 24px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-xs);
}
.card__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--ink);
  margin: 0 0 4px;
}
.card > .small.muted,
.card > .card__subtitle {
  color: var(--ink-3);
  margin: 0 0 20px;
  font-size: 12.5px;
}

/* ── Buttons ───────────────────────────────────────────────────── */
.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ink);
  border-radius: var(--r-sm);
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, opacity 0.12s;
}
.btn:hover { background: oklch(15% 0.005 270); border-color: oklch(15% 0.005 270); }
.btn:active { opacity: 0.85; }
.btn:disabled {
  background: var(--bg-sunken);
  border-color: var(--line-2);
  color: var(--ink-4);
  cursor: not-allowed;
}
.btn--secondary {
  background: var(--surface);
  border-color: var(--line-2);
  color: var(--ink);
}
.btn--secondary:hover { background: var(--bg-sunken); border-color: var(--line-3); }
.btnrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── Messages ──────────────────────────────────────────────────── */
.error, .warn, .render-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-sm);
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid;
}
.error {
  color: var(--fail-2);
  background: var(--fail-soft);
  border-color: var(--fail-border);
}
.error::before {
  content: "";
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--fail);
  flex: none;
  margin-top: 3px;
  background-image: linear-gradient(#fff, #fff), linear-gradient(#fff, #fff);
  background-size: 2px 6px, 2px 2px;
  background-position: center 3px, center 9px;
  background-repeat: no-repeat;
}
.warn {
  color: var(--warn-2);
  background: var(--warn-soft);
  border-color: var(--warn-border);
}
.warn::before {
  content: "";
  width: 14px; height: 14px;
  flex: none;
  margin-top: 3px;
  border-radius: 50%;
  background: var(--warn);
  background-image: linear-gradient(#fff, #fff), linear-gradient(#fff, #fff);
  background-size: 2px 6px, 2px 2px;
  background-position: center 3px, center 9px;
  background-repeat: no-repeat;
}
.render-note {
  color: var(--ink-2);
  background: var(--bg-sunken);
  border-color: var(--line);
  font-size: 12.5px;
}
.render-note::before {
  content: "";
  width: 4px;
  flex: none;
  margin: 4px 0;
  background: var(--ink-4);
  border-radius: 2px;
  align-self: stretch;
}

/* ── A · Uploads ───────────────────────────────────────────────── */
.uploads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 4px;
}
.uploads > .drop:nth-of-type(1) { grid-column: 1; grid-row: 1; }
.uploads > .drop:nth-of-type(2) { grid-column: 2; grid-row: 1; }
.drop {
  position: relative;
  border: 1px dashed var(--line-2);
  border-radius: var(--r);
  background: var(--surface-2);
  padding: 16px 16px;
  min-height: 130px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drop:hover { border-color: var(--line-3); background: var(--bg-sunken); }
.drop--over {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 14%, transparent);
}
.drop--loaded {
  border-style: solid;
  border-color: var(--line);
  background: var(--surface);
  cursor: default;
  box-shadow: var(--shadow-xs);
}
.drop__role {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-3);
  letter-spacing: -0.005em;
}
.drop--loaded .drop__role { color: var(--ink-2); }
.drop__name {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  word-break: break-all;
  line-height: 1.45;
}
.drop--loaded .drop__name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.drop--loaded .drop__name::before {
  content: "";
  width: 14px; height: 14px;
  border-radius: 3px;
  background: var(--pass);
  flex: none;
  background-image: linear-gradient(45deg, transparent 38%, #fff 38% 50%, transparent 50%),
                    linear-gradient(-45deg, transparent 50%, #fff 50% 62%, transparent 62%);
  background-size: 4px 5px, 7px 6px;
  background-position: 3px 7px, 4px 4px;
  background-repeat: no-repeat;
}
.drop__hint {
  color: var(--ink-3);
  font-size: 12px;
  margin-top: auto;
}
.drop__hint .mono { color: var(--ink-2); }

.colchips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.chip {
  display: inline-flex;
  align-items: center;
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 7px 1px;
  background: var(--bg-sunken);
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink-2);
  white-space: nowrap;
}

/* ── A · Field / toggles ──────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 18px;
}
.field__label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-2);
  letter-spacing: -0.005em;
}
.field__label .muted { font-weight: 400; }
.field select,
.field input[type="text"] {
  appearance: none;
  -webkit-appearance: none;
  height: 34px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.12s, box-shadow 0.12s;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%23999' d='M0 0h10L5 6z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.field select:hover { border-color: var(--line-3); }
.field select:focus,
.field input[type="text"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.toggles { display: flex; flex-wrap: wrap; gap: 6px; }
.toggle {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 12px;
  padding: 4px 10px 3px;
  border-radius: var(--r-sm);
  border: 1px solid;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.toggle--on {
  background: var(--surface);
  border-color: var(--line-2);
  color: var(--ink);
}
.toggle--on::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--pass);
  flex: none;
}
.toggle--on:hover { border-color: var(--line-3); background: var(--bg-sunken); }
.toggle--off {
  background: var(--bg-sunken);
  border-color: var(--line);
  color: var(--ink-3);
}
.toggle--off::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--ink-4);
  flex: none;
  opacity: 0.6;
}
.toggle--off:hover { color: var(--ink-2); }
.toggle--pk {
  background: var(--accent-soft);
  border-color: color-mix(in oklch, var(--accent) 30%, var(--line));
  color: var(--accent-2);
  cursor: not-allowed;
}
.toggle--pk::before {
  content: "";
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex: none;
}
.toggle--pk::after {
  content: "PK";
  font-size: 10px;
  font-weight: 600;
  margin-left: 4px;
  padding: 1px 5px 0;
  background: var(--accent);
  color: #fff;
  border-radius: 3px;
  letter-spacing: 0.02em;
}

.checkrow {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 0;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--ink-2);
}
.checkrow input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 15px; height: 15px;
  border: 1px solid var(--line-3);
  border-radius: 3px;
  background: var(--surface);
  cursor: pointer;
  position: relative;
  flex: none;
  margin: 0;
  transition: border-color 0.1s, background 0.1s;
}
.checkrow input[type="checkbox"]:hover { border-color: var(--ink-3); }
.checkrow input[type="checkbox"]:checked {
  background: var(--ink);
  border-color: var(--ink);
}
.checkrow input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px; top: 1px;
  width: 4px; height: 8px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.checkrow:hover { color: var(--ink); }


/* ── B · Verdict ───────────────────────────────────────────────── */
.verdict {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 24px 28px;
  border-radius: var(--r-lg);
  border: 1px solid;
  margin-bottom: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}
.verdict--pass { border-color: var(--pass-border); background: var(--pass-soft); }
.verdict--fail { border-color: var(--fail-border); background: var(--fail-soft); }

.verdict__badge {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 132px;
  padding: 14px 22px;
  border-radius: var(--r);
  color: #fff;
  font-weight: 600;
  font-size: 24px;
  letter-spacing: 0.04em;
  line-height: 1;
}
.verdict--pass .verdict__badge { background: var(--pass); }
.verdict--fail .verdict__badge { background: var(--fail); }
.verdict__badge svg {
  width: 14px;
  height: 14px;
  display: block;
  opacity: 0.92;
}

.verdict__reason {
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--ink);
  line-height: 1.45;
}
.verdict__reason b {
  font-weight: 600;
  font-family: var(--mono);
  font-size: 15px;
  color: inherit;
  padding: 0 1px;
}
.verdict--fail .verdict__reason b { color: var(--fail-2); }
.verdict__reason .small {
  margin-top: 6px;
  font-weight: 400;
  color: var(--warn-2);
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.verdict__reason .small::before {
  content: "";
  width: 3px;
  height: 14px;
  background: var(--warn);
  border-radius: 1.5px;
  flex: none;
}

.verdict__meta {
  font-size: 12px;
  color: var(--ink-2);
  text-align: right;
  line-height: 1.5;
  min-width: 180px;
  margin: 0;
}
.verdict__meta .mono { color: var(--ink); font-weight: 500; }
.verdict__meta dt {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 6px;
  font-weight: 400;
}
.verdict__meta dt:first-child { margin-top: 0; }
.verdict__meta dd { margin: 0 0 2px; }

/* ── C · Metrics ───────────────────────────────────────────────── */
.metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  overflow: hidden;
  margin-bottom: 12px;
  box-shadow: var(--shadow-xs);
}
.metric {
  padding: 18px 20px 16px;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metric:last-child { border-right: 0; }
.metric__num {
  font-family: var(--mono);
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.metric__label {
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-3);
  letter-spacing: -0.005em;
}
.metric[data-kind="match"] .metric__num    { color: var(--pass-2); }
.metric[data-kind="mismatch"] .metric__num { color: var(--fail-2); }
.metric[data-kind="mismatch"][data-value="0"] .metric__num { color: var(--ink-4); }
.metric[data-kind="only-a"][data-value="0"] .metric__num,
.metric[data-kind="only-b"][data-value="0"] .metric__num { color: var(--ink-4); }

/* ── D · Filters & detail ──────────────────────────────────────── */
.filters {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 14px;
  padding: 3px;
  background: var(--bg-sunken);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  width: fit-content;
}
.filters button {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-3);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.1s, color 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.filters button:hover { color: var(--ink); }
.filters button[aria-pressed="true"] {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.06), 0 0 0 1px rgba(17, 24, 39, 0.04);
}
.filters button .count {
  font-family: var(--mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 0 5px;
  background: transparent;
  border-radius: 3px;
  color: var(--ink-3);
}
.filters button[aria-pressed="true"] .count {
  background: var(--bg-sunken);
  color: var(--ink-2);
}

.detail-row {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  margin-bottom: 4px;
  overflow: hidden;
  transition: border-color 0.1s, box-shadow 0.1s;
}
.detail-row:hover { border-color: var(--line-2); }
.detail-row[data-state="mismatch"] { border-left: 2px solid var(--fail); }
.detail-row[data-state="only-a"],
.detail-row[data-state="only-b"]   { border-left: 2px solid var(--warn); }
.detail-row[data-state="match"]    { border-left: 2px solid var(--pass); }
.detail-row[data-open="true"] {
  border-color: var(--line-2);
  box-shadow: var(--shadow-sm);
}

.detail-row__head {
  display: grid;
  grid-template-columns: 130px 80px 1fr 16px;
  align-items: center;
  gap: 14px;
  padding: 9px 14px 9px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 12.5px;
}
.detail-row__head:hover { background: var(--bg-sunken); }
.detail-row__head--plain { cursor: default; }
.detail-row__head--plain:hover { background: transparent; }
.detail-row__head::after {
  content: "";
  width: 6px; height: 6px;
  border-right: 1.5px solid var(--ink-4);
  border-bottom: 1.5px solid var(--ink-4);
  transform: rotate(-45deg);
  justify-self: end;
  transition: transform 0.15s;
}
.detail-row[data-open="true"] .detail-row__head::after {
  transform: rotate(45deg);
  border-color: var(--ink-2);
}
.detail-row__head--plain::after { display: none; }
.detail-row__head--plain { grid-template-columns: 130px 80px 1fr; }

.detail-row__key {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--ink);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-row__preview {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-row__body {
  padding: 4px 12px 12px;
  border-top: 1px solid var(--line);
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Badges ────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  padding: 2px 8px 1px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-family: var(--sans);
  white-space: nowrap;
  letter-spacing: -0.005em;
}
.badge::before {
  content: "";
  width: 5px; height: 5px;
  border-radius: 50%;
  flex: none;
}
.badge--match {
  color: var(--pass-2);
  background: var(--pass-soft);
  border-color: var(--pass-border);
}
.badge--match::before { background: var(--pass); }
.badge--mismatch {
  color: var(--fail-2);
  background: var(--fail-soft);
  border-color: var(--fail-border);
}
.badge--mismatch::before { background: var(--fail); }
.badge--only {
  color: var(--warn-2);
  background: var(--warn-soft);
  border-color: var(--warn-border);
}
.badge--only::before { background: var(--warn); }

/* ── D · Diff pairs ────────────────────────────────────────────── */
.diffpair {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  overflow: hidden;
}
.diffpair__col {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  color: var(--ink-3);
}
.diffpair__col .mono {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
}
.diffpair__col .badge { margin-left: auto; }

.diffpair__sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--line);
  gap: 1px;
}
.side {
  background: var(--surface);
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.side__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-3);
  letter-spacing: -0.005em;
}
.side:nth-child(1) .side__label { color: var(--ink-2); }
.side:nth-child(2) .side__label { color: var(--ink-2); }

.side__val {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink);
  word-break: break-all;
  white-space: pre-wrap;
}

/* ── Diff units ────────────────────────────────────────────────── */
.u { display: inline; padding: 0; border-radius: 0; }
.u.diff {
  background: var(--diff-bg);
  color: var(--diff-fg);
  font-weight: 600;
  border-radius: 2px;
  padding: 0 1px;
  margin: 0 -1px;
}
.u.diff.residual {
  background: var(--diff-residual-bg);
  color: var(--diff-residual-fg);
  font-weight: 600;
  text-decoration: underline dotted currentColor;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}
.empty {
  font-family: var(--mono);
  display: inline-block;
  color: var(--ink-3);
  background: var(--bg-sunken);
  border: 1px dashed var(--line-2);
  padding: 0 8px;
  border-radius: 3px;
  font-style: normal;
  letter-spacing: 0.02em;
  font-size: 11.5px;
}
.empty::before { content: "∅ "; color: var(--ink-2); font-weight: 600; }

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .uploads { grid-template-columns: 1fr; }
  .uploads > .drop:nth-of-type(2) { grid-column: 1; grid-row: 2; }
  .verdict { grid-template-columns: 1fr; text-align: center; gap: 16px; }
  .verdict__meta { text-align: center; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .metric { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .metric:nth-child(2n) { border-right: 0; }
  .detail-row__head { grid-template-columns: 1fr auto 16px; }
  .detail-row__preview { display: none; }
  .diffpair__sides { grid-template-columns: 1fr; gap: 0; }
  .side:first-child { border-bottom: 1px solid var(--line); }
}

```

---

## 5. `src/app.js` 마크업 추가 (두 군데만)

### 5.1 `.verdict__badge` 내부 SVG 아이콘 (**필수** — 색약 이중 인코딩)

verdict 뱃지 렌더 부분을 다음과 같이 수정한다. Pass / Fail 모두 SVG가 텍스트 앞에 와야 한다.

```html
<!-- Pass -->
<div class="verdict__badge">
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <path d="M3 8.5 L6.5 12 L13 4"/>
  </svg>
  Pass
</div>

<!-- Fail -->
<div class="verdict__badge">
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <path d="M4 4 L12 12 M12 4 L4 12"/>
  </svg>
  Fail
</div>
```

CSS에서 `.verdict__badge svg` 가 14×14 / `currentColor`(흰색)로 그린다.

판정 텍스트는 **"Pass" / "Fail"** (sentence case)로 표기한다. `PASS`/`FAIL` (대문자)이었다면 바꾼다.

### 5.2 `.metric`에 `data-value` 추가 (**선택** — 0값 회색 처리)

메트릭이 0일 때 회색으로 강조 해제하려면 `data-value`를 출력한다.

```html
<div class="metric" data-kind="total" data-value="${total}">
  <div class="metric__num">${total.toLocaleString('ko-KR')}</div>
  <div class="metric__label">전체 row</div>
</div>
<div class="metric" data-kind="match" data-value="${match}">…</div>
<div class="metric" data-kind="mismatch" data-value="${mismatch}">…</div>
<div class="metric" data-kind="only-a" data-value="${onlyA}">…</div>
<div class="metric" data-kind="only-b" data-value="${onlyB}">…</div>
```

라벨 텍스트는 다음과 같이 변경:
- "전체" → **"전체 row"**
- "AS-IS만" / "TO-BE만" → **"As-Is만 존재"** / **"To-Be만 존재"**

### 5.3 (참고) 기타 sentence case 정리

마크업에 직접 박혀 있는 대문자 라벨은 모두 sentence case로 바꾼다:
- 서브타이틀의 `PASS / FAIL` → `Pass / Fail`
- 드롭존 `.drop__role` — `AS-IS` / `TO-BE` → `As-Is` / `To-Be` (CSS가 더 이상 uppercase로 변환 안 함)
- `.field__label` — 한국어 라벨이라면 그대로 유지

---

## 6. 시각 레퍼런스 (반드시 확인)

같은 폴더의 `screenshots/` 안에 12장의 PNG가 있다. **각 상태가 어떻게 보여야 하는지 시각으로 확인**한 뒤 구현에 들어가라.

| # | 파일 | 이 화면이 보여주는 것 |
|---|------|------|
| 01 | `screenshots/01-overview-fail.png` | 페이지 상단 — 타이틀(18px / 600), 서브타이틀, 화면 A 시작 |
| 02 | `screenshots/02-screen-A-settings.png` | 화면 A 전체 — 드롭존, PK select, 토글, 액션 버튼 |
| 03 | `screenshots/03-verdict-fail.png` | 화면 B — **Fail** 상태. 빨강 패널 + × 아이콘 + 사유 + 메타 |
| 04 | `screenshots/04-detail-expanded-diff.png` | 화면 D — 불일치 row 펼침. 컬럼별 As-Is/To-Be 나란히, 헥스 하이라이트 |
| 05 | `screenshots/05-detail-rows-other-states.png` | 화면 D — `only-a/b` row, render-note, 화면 E |
| 06 | `screenshots/06-verdict-pass.png` | 화면 B — **Pass** 상태. 초록 패널 + ✓ 아이콘. 0 메트릭은 grey-out |
| 07 | `screenshots/07-verdict-pass-with-exclusions.png` | Pass + 제외 컬럼. amber 인디케이터로 주의 환기 |
| 08 | `screenshots/08-fail-pk-duplicate-warning.png` | PK 중복 경고(`.warn`) + 펼친 row의 byte hex diff |
| 09 | `screenshots/09-input-error.png` | `.error` 메시지 + 액션 버튼 disabled |
| 10 | `screenshots/10-drop-empty.png` | 드롭존 빈 상태 (점선 보더 + 안내문) |
| 11 | `screenshots/11-drop-drag-over.png` | 드롭존 드래그 오버 (실선 액센트 보더 + soft 배경) |
| 12 | `screenshots/12-detail-residual-and-empty.png` | 길이 차 잔여(`.u.diff.residual` 점선 밑줄) + 빈 값(`.empty` ∅) |

**작업 순서**:
1. 위 스크린샷을 모두 본다 (Read 도구로 하나씩 열어 본다)
2. §4 CSS를 `src/styles.css`에 통째로 덮어쓴다
3. §5.1의 SVG 마크업을 `src/app.js`의 verdict 렌더 자리에 추가한다
4. §5.2의 `data-value` 어트리뷰트를 `.metric`에 추가한다 (선택)
5. §5.3의 sentence case 정리를 `src/app.js` 텍스트에 반영한다
6. `build.mjs` 실행 → 단일 `index.html`로 인라인
7. 빌드된 페이지를 열어서 §6의 스크린샷과 비교 검증

---

## 7. 디자인 토큰 요약 (참고)

전체는 §4 CSS 상단 `:root` 블록에 있다. 주요 의미만:

- **표면**: `--bg`(페이지), `--bg-sunken`(필터/패시브), `--surface`(카드), `--surface-2`(펼친 본문)
- **잉크**: `--ink` → `--ink-4` 4단계 + `--line`/`--line-2`/`--line-3` 보더 3단계
- **액센트**: `--accent`(violet-blue, PK·focus·drag-over)
- **시맨틱**: pass / fail / warn — 각각 `--xxx`, `--xxx-2`, `--xxx-soft`, `--xxx-border` 4단계
- **diff**: `--diff-bg/fg`(amber, 다른 유닛), `--diff-residual-bg/fg`(purple, 길이 차 잔여)
- **타이포**: 시스템 sans + ui-monospace. base 13.5px / 1.55 / letter-spacing -0.005em
- **radius**: 4/6/8/10px
- **shadow**: 거의 안 씀. `--shadow-xs`(카드) / `--shadow-sm`(hover) 두 단계만

---

## 8. 자주 하는 실수 — 미리 차단

- ❌ `build.mjs`나 `src/core.js` 수정
- ❌ className 변경/추가/삭제
- ❌ verdict 뱃지에서 SVG 빼기 (이중 인코딩 위반)
- ❌ 외부 URL/폰트/이미지 추가
- ❌ `.mono`를 일반 폰트로 바꾸기
- ❌ "PASS"/"FAIL" 대문자로 되돌리기

---

## 9. 검증 체크리스트

빌드 후 다음을 확인한다:

- [ ] `screenshots/06-verdict-pass.png`와 동일하게 Pass 뱃지가 보인다 (초록 + ✓ + "Pass")
- [ ] `screenshots/03-verdict-fail.png`와 동일하게 Fail 뱃지가 보인다 (빨강 + × + "Fail")
- [ ] 5개 메트릭이 1줄 그리드로 정렬되고, 0값은 회색으로 표시된다
- [ ] 불일치 row를 클릭하면 펼쳐지고 컬럼별 As-Is/To-Be hex가 나란히 보인다
- [ ] hex의 다른 부분이 amber 배경으로 하이라이트된다
- [ ] 길이 차로 한쪽에만 남은 잔여 바이트는 purple + 점선 underline
- [ ] 빈 값은 `∅ empty` 점선 박스로 표시된다
- [ ] 드롭존 드래그 오버 시 실선 액센트 보더 + soft 배경
- [ ] PK 중복이 있으면 amber `.warn` 박스가 메트릭 아래에 나타난다
- [ ] 입력 오류 시 `.error` 박스 + 액션 버튼 disabled
- [ ] 페이지 어디서도 외부 URL 요청이 발생하지 않는다 (네트워크 탭 확인)

끝.
