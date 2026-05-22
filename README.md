# As-Is / To-Be 데이터 비교 검증 도구

메인프레임(As-Is) → 오픈 시스템(To-Be) 마이그레이션 검증의 결과 책정 도구.
CSV 2개를 **byte-for-byte(String 동일성)** 비교하여 PASS/FAIL을 책정한다.
스펙: [spec-hex-comparator.md](spec-hex-comparator.md).

## 산출물

[index.html](index.html) — **단일 오프라인 파일**. 모든 의존성(React, ReactDOM, htm, PapaParse) 인라인.
브라우저로 열기만 하면 동작하며 **외부 요청 0** (폐쇄망 사용 가능). 데이터는 브라우저 밖으로 나가지 않는다.

## 핵심 원칙 (불변식)

- 비교는 `String(a) !== String(b)` 단순 동일성만. trim/대소문자/숫자정규화/포맷보정 **일절 없음**.
- PASS ⟺ 불일치 0 + 누락 0 + 초과 0. 그 외 전부 FAIL.
- 제외 컬럼은 판정에 영향 없으나 결과·리포트에 항상 명시.
- 바이트/문자 diff는 **표시 전용** — 판정과 무관.

## 구조

| 경로 | 역할 |
|---|---|
| `src/core.js` | 비교/판정 코어 (결정론적, React/DOM 무의존). **단일 진실 소스** |
| `src/i18n.js` | UI 문자열 사전 ko/ja/en (표시 전용). 기본 언어 브라우저 자동감지 |
| `src/app.js` | React UI (htm, 빌드 없음). 화면 정보/우선순위는 스펙 §8 |
| `src/styles.css` | 중립 placeholder 스타일. 시각 표현은 Claude Design 몫 |
| `vendor/*.js` | 인라인용 라이브러리 소스 (오프라인 빌드 입력) |
| `build.mjs` | vendor + src → 단일 `index.html` 인라인 |
| `test/core.test.mjs` | 코어 단위 테스트 + 산출물 무결성 검사 |

## 사용

```sh
node build.mjs          # index.html 재생성
node test/core.test.mjs # 코어 로직 + 산출물 외부참조 0 정적 검사
node test/i18n.test.mjs # ko/ja/en 키·placeholder 일치 검증
```

`src/*` 수정 후에는 `node build.mjs`로 `index.html`을 다시 빌드한다.
