/*
 * i18n.test.mjs — UI 문자열 사전 검증
 *  - 3개 언어(ko/ja/en) 키 집합 완전 일치 (누락/오타 방지)
 *  - 각 키의 {placeholder} 집합도 언어 간 일치 (현지화 시 변수 누락 방지)
 *  - makeT 폴백/보간, detectLang 동작
 *   사용: node test/i18n.test.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const I = require(join(root, "src/i18n.js"));

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }
function eq(name, a, b) { ok(name + ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b)); }

const langs = I.LANG_ORDER;
eq("지원 언어 = ko/ja/en", langs, ["ko", "ja", "en"]);
langs.forEach((l) => ok(`LANG_NAMES[${l}] 존재`, !!I.LANG_NAMES[l]));

// 기준은 en. 모든 언어가 동일한 키 집합을 가져야 함.
const enKeys = Object.keys(I.STRINGS.en).sort();
ok("en 사전 비어있지 않음", enKeys.length > 0);
langs.forEach((l) => {
  const keys = Object.keys(I.STRINGS[l]).sort();
  eq(`[${l}] 키 집합이 en과 동일`, keys, enKeys);
});

// placeholder 집합 일치: {x} 변수가 언어마다 같아야 함
function placeholders(s) {
  return (s.match(/\{(\w+)\}/g) || []).sort();
}
enKeys.forEach((k) => {
  const ref = placeholders(I.STRINGS.en[k]);
  langs.forEach((l) => {
    eq(`[${l}] '${k}' placeholder 일치`, placeholders(I.STRINGS[l][k]), ref);
  });
});

// makeT: 보간 + 폴백
const tk = I.makeT("ko");
ok("makeT 보간", tk("config.section", { n: 7 }).includes("7"));
ok("makeT 미존재 키는 키 자체 반환", I.makeT("ko")("__nope__") === "__nope__");
ok("makeT 미지원 언어 → en 폴백", I.makeT("zz")("metrics.total") === I.STRINGS.en["metrics.total"]);

// detectLang (Node에는 navigator 없음 → en)
ok("detectLang 기본 en (navigator 없음)", I.detectLang() === "en");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + fails.join("\n - ")); process.exit(1); }
