/*
 * core.test.mjs — 비교/판정 코어 단위 테스트 (§5, §6, §9)
 * src/core.js를 직접 import (build가 verbatim 인라인하므로 index.html과 동일 로직).
 * 추가로 산출물 무결성(외부 요청 0) 정적 검사 포함.
 *   사용: node test/core.test.mjs
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const C = require(join(root, "src/core.js"));

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); }
}
function eq(name, a, b) { ok(name + ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b)); }

// ── §3 공통 컬럼 (교집합, As-Is 순서 유지) ──
eq("commonColumns 교집합/순서",
  C.commonColumns(["id", "a", "b", "c"], ["c", "id", "a", "x"]),
  ["id", "a", "c"]);
eq("commonColumns 없음", C.commonColumns(["a"], ["b"]), []);

// ── §4 PK 자동 추측 ──
eq("guessPk p1 unique_number", C.guessPk(["FOO", "UNIQUE_NUMBER", "id"]), "UNIQUE_NUMBER");
eq("guessPk p1 id 우선", C.guessPk(["row_id", "id", "no"]), "id");
eq("guessPk p2 suffix", C.guessPk(["foo", "cust_no"]), "cust_no");
eq("guessPk fallback 첫 컬럼", C.guessPk(["alpha", "beta"]), "alpha");

// ── §5 핵심 비교 + §6 판정 ──
const base = {
  asIsRows: [
    { id: "1", v: "AA", w: "01" },
    { id: "2", v: "BB", w: "02" },
    { id: "3", v: "CC", w: "03" }
  ],
  toBeRows: [
    { id: "1", v: "AA", w: "01" },
    { id: "2", v: "ZZ", w: "02" }, // v 불일치
    { id: "4", v: "DD", w: "04" }  // To-Be만
  ],
  pk: "id",
  inspectCols: ["v", "w"]
};
const r1 = C.compareData(base);
eq("MATCH 카운트", r1.summary.matched, 1);
eq("MISMATCH 카운트", r1.summary.mismatched, 1);
eq("ONLY_AS_IS 카운트(id 3)", r1.summary.onlyAsIs, 1);
eq("ONLY_TO_BE 카운트(id 4)", r1.summary.onlyToBe, 1);
eq("total = 합집합", r1.summary.total, 4);
eq("reasons.VALUE_MISMATCH", r1.reasons.VALUE_MISMATCH, 1);
eq("reasons.MISSING_IN_TOBE", r1.reasons.MISSING_IN_TOBE, 1);
eq("reasons.EXTRA_IN_TOBE", r1.reasons.EXTRA_IN_TOBE, 1);
eq("diffCols 기록", r1.rows.find((x) => x.key === "2").diffCols, ["v"]);
eq("verdict FAIL", r1.verdict, "FAIL");

// 완전 일치 → PASS
const allMatch = C.compareData({
  asIsRows: [{ id: "1", v: "AA" }],
  toBeRows: [{ id: "1", v: "AA" }],
  pk: "id",
  inspectCols: ["v"]
});
eq("완전 일치 → PASS", allMatch.verdict, "PASS");

// ── §6 제외 컬럼은 PASS를 막지 않음 ──
const excl = C.compareData({
  asIsRows: [{ id: "1", v: "AA", w: "01" }],
  toBeRows: [{ id: "1", v: "AA", w: "99" }], // w만 다름
  pk: "id",
  inspectCols: ["v"], // w 제외
  excludedCols: ["w"]
});
eq("제외 컬럼 차이 → PASS 유지", excl.verdict, "PASS");
eq("제외 컬럼 목록 명시", excl.excludedCols, ["w"]);

// w를 검사에 포함하면 FAIL
const inclW = C.compareData({
  asIsRows: [{ id: "1", v: "AA", w: "01" }],
  toBeRows: [{ id: "1", v: "AA", w: "99" }],
  pk: "id",
  inspectCols: ["v", "w"]
});
eq("w 포함 시 FAIL", inclW.verdict, "FAIL");

// ── 보정 금지: String 동일성만 (trim/대소문자/숫자정규화 없음) ──
function mismatchOn(a, b) {
  return C.compareData({
    asIsRows: [{ id: "1", v: a }],
    toBeRows: [{ id: "1", v: b }],
    pk: "id",
    inspectCols: ["v"]
  }).summary.mismatched;
}
eq("trim 안 함: ' a' vs 'a' → 불일치", mismatchOn(" a", "a"), 1);
eq("대소문자 구분: 'A' vs 'a' → 불일치", mismatchOn("A", "a"), 1);
eq("숫자정규화 안 함: '01' vs '1' → 불일치", mismatchOn("01", "1"), 1);
eq("숫자정규화 안 함: '1.0' vs '1' → 불일치", mismatchOn("1.0", "1"), 1);
eq("동일 문자열 → 일치", mismatchOn("4A6F", "4A6F"), 0);

// ── §9 빈 PK 스킵 ──
const emptyPk = C.compareData({
  asIsRows: [{ id: "", v: "X" }, { id: "1", v: "A" }],
  toBeRows: [{ id: "1", v: "A" }],
  pk: "id",
  inspectCols: ["v"]
});
eq("빈 PK row 스킵 → total 1", emptyPk.summary.total, 1);
eq("빈 PK 제외 후 PASS", emptyPk.verdict, "PASS");

// ── §9 PK 중복: 첫 row 채택 + 중복키 수집 ──
const dup = C.compareData({
  asIsRows: [{ id: "1", v: "FIRST" }, { id: "1", v: "SECOND" }],
  toBeRows: [{ id: "1", v: "FIRST" }],
  pk: "id",
  inspectCols: ["v"]
});
eq("중복 PK: 첫 row(FIRST) 채택 → PASS", dup.verdict, "PASS");
eq("중복 PK 수집", dup.dupesAsIs, ["1"]);
eq("중복 키 1회만 수집", C.compareData({
  asIsRows: [{ id: "1", v: "a" }, { id: "1", v: "b" }, { id: "1", v: "c" }],
  toBeRows: [], pk: "id", inspectCols: ["v"]
}).dupesAsIs, ["1"]);

// ── §4-3 / §9 diff 유닛 (표시 전용, 위치 기준) ──
ok("isHex true", C.isHex("4A6F") === true);
ok("isHex 홀수길이 false", C.isHex("4A6") === false);
ok("isHex 비헥스 false", C.isHex("ZZ") === false);
ok("isHex 빈문자 false", C.isHex("") === false);

const dHex = C.diffUnits("4A6F", "4A70", true);
eq("바이트 모드 적용", dHex.byteMode, true);
eq("바이트 단위 분할/하이라이트", dHex.a.map((u) => [u.text, u.diff]), [["4A", false], ["6F", true]]);

const dChar = C.diffUnits("abc", "abx", true); // 헥스 아님 → 문자 모드 폴백
eq("비헥스 → 문자 모드 폴백", dChar.byteMode, false);
eq("문자 단위 diff", dChar.a.map((u) => u.diff), [false, false, true]);

const dLen = C.diffUnits("4A6F", "4A", true); // 길이 차이
eq("잔여 유닛 residual 표시", dLen.a.map((u) => [u.text, !!u.residual]), [["4A", false], ["6F", true]]);
eq("짧은 쪽엔 잔여 없음", dLen.b.length, 1);

const dOneHex = C.diffUnits("4A6F", "zz", true); // 한쪽만 헥스 → 문자 모드
eq("한쪽만 헥스 → 바이트 모드 아님", dOneHex.byteMode, false);

// ── 상수 ──
eq("DIFF_SEP = |", C.DIFF_SEP, "|");

// ── 산출물 무결성: index.html 외부 요청 0 (정적 검사) ──
const idxPath = join(root, "index.html");
if (existsSync(idxPath)) {
  const htmlRaw = readFileSync(idxPath, "utf8");
  // 1) 외부 리소스를 가리키는 src/href 속성이 없어야 함
  const extAttr = htmlRaw.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+["']/gi) || [];
  eq("외부 src/href 0개", extAttr, []);
  // 2) 런타임 네트워크 호출 API 미사용 (코드 영역). license 주석의 URL은 요청이 아니므로 무관.
  const fetchCalls = htmlRaw.match(/\bfetch\s*\(\s*["'`]https?:/gi) || [];
  eq("fetch(URL) 호출 0개", fetchCalls, []);
  const xhrOpen = htmlRaw.match(/\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["']https?:/gi) || [];
  eq("XHR(URL) 호출 0개", xhrOpen, []);
  const dynImport = htmlRaw.match(/\bimport\s*\(\s*["'`]https?:/gi) || [];
  eq("동적 import(URL) 0개", dynImport, []);
  // 3) 코어가 실제로 인라인되어 있어야 함
  ok("hex-core 스크립트 인라인됨", /id="hex-core"/.test(htmlRaw) && htmlRaw.includes("function compareData"));
} else {
  console.log("(index.html 없음 — build.mjs 먼저 실행 시 무결성 검사 수행)");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + fails.join("\n - ")); process.exit(1); }
