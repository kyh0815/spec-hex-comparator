# Claude Design 핸드오프 — 배치 대시보드 시각 강화 + 폰트

> 코드 → 디자인 핸드오프 (2차). 기능 v1은 기존 디자인 토큰으로 동작 중. 이 문서는 **대시보드(요약) 화면 시각 강화(#3)** 와 **전체 폰트 스케일(#5)** 두 가지만 요청.
> 기존 시스템: [CLAUDE_CODE.md](CLAUDE_CODE.md)(§4 CSS·토큰), [design-handoff.md](design-handoff.md)(정보 우선순위·className 계약). 그대로 유지하고 **추가/조정**만.

## 절대 제약 (유지)
- 외부 요청 0 → **웹폰트 CDN·원격 자산 금지** (시스템 폰트/인라인만).
- 헥스/원시값 monospace(`.mono`).
- 단일 HTML·className 계약 기반(로직·마크업 구조 보존, CSS 위주 교체).

---

## #3 — 배치 대시보드(요약) 시각 강화

**목적**: 여러 테이블 비교 결과를 *한눈에 스캔*. PASS/FAIL 즉시 인지 + 테이블별 핵심 수치 비교.

**한 테이블(행)이 담아야 할 정보** (전부 현재 데이터로 제공됨):
| 항목 | 현재 노출 위치 | 비고 |
|---|---|---|
| 테이블명 | `.detail-row__key` | |
| 결과(Pass/Fail) | `.badge--match`/`--mismatch` | 색+텍스트 |
| 일치/불일치/누락/초과 건수 | `.detail-row__preview` (dashCounts) | row 단위 집계 |
| 칼럼 수 | 행 하단 data line (현재 인라인 style placeholder) | `common.length` |
| 차이 칼럼 수 | 〃 | `result.diffColumns.length` |
| As-Is 레코드 수 | 〃 | `pair.aCount` |
| To-Be 레코드 수 | 〃 | `pair.bCount` |
| 비교 제외 항목 | 〃 | `result.excludedCols` |

**요청**: 위 정보를 **표/카드형으로 정렬**해 비교 스캔이 쉽게. 지금은 행 아래 회색 텍스트 한 줄(placeholder)이라 — 컬럼 정렬된 테이블 또는 정보 밀도 높은 카드로 승격 희망. 정렬 가능한 느낌·헤더·PASS행 녹/FAIL행 적 좌측보더(현재 `data-state`)는 유지.

**현재 마크업 훅** (이 구조에 스타일):
```
.verdict (배너 재사용: 전체 Pass/Fail)
  .verdict__badge / .verdict__reason / .verdict__meta(dl dt/dd)   ← 전체 판정 + 집계
.card  (대시보드 컨테이너)
  .detail-row[data-state="match|mismatch"]   ← 테이블 1행 (좌측 컬러보더)
    .detail-row__head (클릭→드릴인)
      .detail-row__key (테이블명) · .badge (Pass/Fail) · .detail-row__preview (건수)
    + 데이터 라인 (현재 .small.muted 인라인 — 여기를 표/카드로 재설계)
  .warn  (짝 없는 파일 목록)
```
> 데이터 라인의 인라인 style은 **placeholder**. 자유롭게 컬럼/그리드/카드로 교체. 필요하면 "추가할 className 목록"으로 요청 주면 Claude Code가 `app.js`에 반영.

**드릴인 상세는 기존 디자인 재사용** — 손댈 필요 없음.

---

## #5 — 전체 폰트 스케일

현재 base `font-size: 13.5px`(§4 CSS). **다소 작다는 피드백** → 전반적으로 키워줘.
- 대부분 px 고정값이라(13/12/12.5px 등) base만 키워선 안 커짐 → **타이포 스케일 전반을 비례 상향** 필요 (예: base 14.5~15px 기준 재조정).
- 가독성 우선, 기존 위계(타이틀>카드제목>본문>메타) 유지. mono 비교 가독성도 유지.

---

## 산출물
- 갱신된 `src/styles.css` (외부 자산 0). 마크업 변경 필요 시 className 추가 요청 목록 별도.
- 적용 후 `node build.mjs` → 단일 `index.html` 재생성.
