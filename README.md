# As-Is / To-Be 데이터 비교 검증 도구

메인프레임(As-Is) → 오픈 시스템(To-Be) 마이그레이션 검증의 결과 책정 도구.
CSV를 **byte-for-byte(String 동일성)** 비교하여 PASS/FAIL을 판정한다.
**여러 테이블 쌍을 한 번에** 비교하고 (요약) 대시보드 + (세부) row 증거로 본다.
스펙: [spec-hex-comparator.md](spec-hex-comparator.md) · 배치 부록: [spec-batch-addendum.md](spec-batch-addendum.md).

## 산출물

[index.html](index.html) — **단일 오프라인 파일**. 모든 의존성(React, ReactDOM, htm, PapaParse) 인라인.
브라우저로 열기만 하면 동작하며 **외부 요청 0** (폐쇄망 사용 가능). 데이터는 브라우저 밖으로 나가지 않는다.

## 핵심 원칙 (불변식)

- 비교는 `String(a) !== String(b)` 단순 동일성만. trim/대소문자/숫자정규화/포맷보정 **일절 없음**.
- PASS ⟺ 불일치 0 + 누락 0 + 초과 0. 그 외 전부 FAIL.
- 제외 컬럼은 판정에 영향 없으나 결과·리포트에 항상 명시.
- 바이트/문자 diff는 **표시 전용** — 판정과 무관.
- UI는 **한국어/일본어/영어** 3개 언어 (브라우저 언어 자동감지). 단, 비교·판정·CSV 리포트는 언어 무관.

## 다건(배치) 비교

- As-Is/To-Be **폴더 통째 선택**(webkitdirectory) 또는 파일 멀티선택/드래그 → **파일명 일치**로 자동 페어링.
- **키는 자동 도출**(autoKey): PK 선택 UI 없음. 단일키는 물론 **복합키(여러 컬럼)도 자동** — 앞 컬럼부터 행이 유일해질 때까지 확장.
- 쌍마다 단건 엔진(`compareData`)을 호출해 비교. **전체 판정**: 모든 쌍 PASS & 미매칭 0 → PASS, 그 외 FAIL.
- **요약 대시보드**(테이블별 판정·건수) → 행 클릭 → **세부**(row별 일치/불일치 + 펼쳐서 값·바이트 diff 증거).
- 드릴인 고급에서 테이블별 키·제외 컬럼 override 가능. 배치 요약 CSV 내보내기.
- 상세 기본 필터 **전체**(일치도 노출). 자세한 규칙: [spec-batch-addendum.md](spec-batch-addendum.md).

## 구조

| 경로 | 역할 |
|---|---|
| `src/core.js` | 비교/판정 코어 (결정론적, React/DOM 무의존). **단일 진실 소스** |
| `src/i18n.js` | UI 문자열 사전 ko/ja/en (표시 전용). 기본 언어 브라우저 자동감지 |
| `src/app.js` | React UI (htm, 빌드 없음). 화면 정보/우선순위는 스펙 §8, 비주얼은 디자인 핸드오프 |
| `src/styles.css` | 시각 디자인 (Claude Design 핸드오프 §4). 디자인 토큰 기반 |
| `vendor/*.js` | 인라인용 라이브러리 소스 (오프라인 빌드 입력) |
| `build.mjs` | vendor + src → 단일 `index.html` 인라인 |
| `test/core.test.mjs` | 코어 단위 테스트 + 산출물 무결성 검사 |
| `test/i18n.test.mjs` | ko/ja/en 키·placeholder 일치 검증 |

### 디자인 핸드오프 자료 (참고)

| 경로 | 역할 |
|---|---|
| `CLAUDE_CODE.md` | 디자인 → 코드 통합 지시서 (§4 CSS 전문, 마크업 변경, 스크린샷 매핑) |
| `design-handoff.md` | 코드 → 디자인 핸드오프 (정보 우선순위·className 계약·제약) |
| `prototype/` | 디자인 검증용 React 프로토타입 (레퍼런스 — 프로덕션 미사용) |
| `screenshots/` | 상태별 시각 레퍼런스 12장 |

## 사용

```sh
node build.mjs          # index.html 재생성 (src/* 수정 후 필수)
node test/core.test.mjs # 코어 로직 + 산출물 외부참조 0 정적 검사
node test/i18n.test.mjs # ko/ja/en 키·placeholder 일치 검증
```
