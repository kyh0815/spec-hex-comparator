/*
 * Hex Comparator — 비교/판정 코어 (결정론적, AI 미사용)
 * 스펙: spec-hex-comparator.md §5(알고리즘), §6(판정), §9(엣지 케이스)
 *
 * 불변식:
 *  - 비교는 String(a) !== String(b) 단순 동일성만. trim/대소문자/숫자정규화/포맷보정 일절 없음.
 *  - 이 파일은 React/DOM에 의존하지 않는다. (브라우저 global + Node module.exports 양쪽 동작)
 *  - 바이트/문자 diff(diffUnits)는 "표시 전용". 판정 로직과 무관.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HexCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // CSV 내보내기에서 다중 컬럼 결합자 (reference jsx와 통일)
  var DIFF_SEP = "|";

  // As-Is 컬럼 순서를 유지하며 To-Be와의 교집합만 반환 (§3)
  function commonColumns(aCols, bCols) {
    var bSet = new Set(bCols || []);
    var out = [];
    (aCols || []).forEach(function (c) {
      if (bSet.has(c)) out.push(c);
    });
    return out;
  }

  // PK 자동 추측: 정규식 우선순위 → 첫 컬럼 (§4)
  function guessPk(cols) {
    if (!cols || !cols.length) return null;
    var p1 = /^(unique_number|id|pk|key)$/i;
    var p2 = /(id|number|no)$/i;
    var hit = cols.find(function (c) { return p1.test(c); });
    if (hit) return hit;
    hit = cols.find(function (c) { return p2.test(c); });
    if (hit) return hit;
    return cols[0];
  }

  function isEmptyKey(v) {
    return v === null || v === undefined || v === "";
  }

  // 키 구분자 (복합키 표시·매칭용). 단일키는 구분자 없이 값 그대로.
  var KEY_SEP = " | ";
  function asCols(pk) { return Array.isArray(pk) ? pk : [pk]; }
  function keyOf(row, pkCols) {
    return pkCols.map(function (c) { var v = row ? row[c] : undefined; return v == null ? "" : String(v); }).join(KEY_SEP);
  }
  function emptyComposite(row, pkCols) {
    return pkCols.every(function (c) { return isEmptyKey(row ? row[c] : undefined); });
  }

  // pk(단일 또는 복합 배열) → row 인덱싱. 빈 키는 스킵, 중복은 첫 row 채택 + 중복키 수집 (§5-1, §9)
  function indexByPk(rows, pk) {
    var pkCols = asCols(pk);
    var map = new Map(), dupes = [], seen = new Set();
    (rows || []).forEach(function (row) {
      if (!row || emptyComposite(row, pkCols)) return; // 빈 키 row 스킵
      var key = keyOf(row, pkCols);
      if (map.has(key)) {
        if (!seen.has(key)) { dupes.push(key); seen.add(key); } // 중복 키 1회만 수집
        return; // 첫 row만 사용
      }
      map.set(key, row);
    });
    return { map: map, dupes: dupes };
  }

  // 주어진 키 컬럼들로 행이 유일한가
  function isUnique(rows, keyCols) {
    if (!keyCols || !keyCols.length) return false;
    var seen = new Set();
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
      if (emptyComposite(rows[i], keyCols)) continue;
      var k = keyOf(rows[i], keyCols);
      if (seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  }

  // 자동 키 도출: 이름 힌트(단일) → 유일하면 채택. 아니면 앞 컬럼부터 유일해질 때까지 확장(복합키). (§4 자동 키)
  function autoKey(rows, columns) {
    columns = columns || [];
    if (!columns.length) return [];
    rows = rows || [];
    var g = guessPk(columns);
    if (g && isUnique(rows, [g])) return [g];
    var key = [];
    for (var i = 0; i < columns.length; i++) {
      key.push(columns[i]);
      if (isUnique(rows, key)) return key.slice();
    }
    return columns.slice(); // 전부 써도 유일하지 않으면 전체 반환(상위에서 경고)
  }

  // PASS ⟺ 불일치 0 + 누락 0 + 초과 0. 그 외 전부 FAIL. (§6)
  function computeVerdict(summary) {
    return (summary.mismatched === 0 && summary.onlyAsIs === 0 && summary.onlyToBe === 0)
      ? "PASS"
      : "FAIL";
  }

  // 핵심 비교 (§5)
  // opts: { asIsRows[], toBeRows[], pk, inspectCols[], excludedCols[]? }
  function compareData(opts) {
    var asIsRows = opts.asIsRows || [];
    var toBeRows = opts.toBeRows || [];
    var pk = opts.pk;
    var inspectCols = opts.inspectCols || [];

    var aIdx = indexByPk(asIsRows, pk);
    var bIdx = indexByPk(toBeRows, pk);
    var aMap = aIdx.map, bMap = bIdx.map;

    // 키 합집합 (As-Is 순서 우선, 이후 To-Be 단독 키)
    var keys = [];
    var seen = new Set();
    aMap.forEach(function (_v, k) { if (!seen.has(k)) { seen.add(k); keys.push(k); } });
    bMap.forEach(function (_v, k) { if (!seen.has(k)) { seen.add(k); keys.push(k); } });

    var rows = [];
    var matched = 0, mismatched = 0, onlyAsIs = 0, onlyToBe = 0;

    keys.forEach(function (key) {
      var inA = aMap.has(key), inB = bMap.has(key);
      if (inA && !inB) {
        onlyAsIs++;
        rows.push({ key: key, status: "ONLY_AS_IS", diffCols: [] });
      } else if (!inA && inB) {
        onlyToBe++;
        rows.push({ key: key, status: "ONLY_TO_BE", diffCols: [] });
      } else {
        var a = aMap.get(key), b = bMap.get(key);
        var diffCols = [];
        inspectCols.forEach(function (c) {
          // 유일한 비교 규칙: 단순 문자열 동일성. 어떤 보정도 없음.
          if (String(a[c]) !== String(b[c])) diffCols.push(c);
        });
        if (diffCols.length === 0) {
          matched++;
          rows.push({ key: key, status: "MATCH", diffCols: [] });
        } else {
          mismatched++;
          rows.push({ key: key, status: "MISMATCH", diffCols: diffCols });
        }
      }
    });

    // 차이 컬럼(어느 검사 컬럼이 한 건이라도 달랐나) — inspectCols 순서 유지
    var diffColSet = {};
    rows.forEach(function (r) { r.diffCols.forEach(function (c) { diffColSet[c] = 1; }); });
    var diffColumns = inspectCols.filter(function (c) { return diffColSet[c]; });

    var summary = {
      total: rows.length,
      matched: matched,
      mismatched: mismatched,
      onlyAsIs: onlyAsIs,
      onlyToBe: onlyToBe
    };
    var reasons = {
      VALUE_MISMATCH: mismatched,
      MISSING_IN_TOBE: onlyAsIs,
      EXTRA_IN_TOBE: onlyToBe
    };

    return {
      verdict: computeVerdict(summary),
      summary: summary,
      reasons: reasons,
      rows: rows,
      diffColumns: diffColumns,
      dupesAsIs: aIdx.dupes,
      dupesToBe: bIdx.dupes,
      inspectedCols: inspectCols.slice(),
      excludedCols: (opts.excludedCols || []).slice(),
      pk: asCols(pk),
      // 상세 보기에서 값 조회용 (첫 row 채택본과 동일)
      asIsIndex: aMap,
      toBeIndex: bMap
    };
  }

  // ── 표시 전용 diff 유틸 (§4-3, §8-D, §9) — 판정과 무관 ──

  // 헥스 판별: 짝수 길이 + 16진수 문자
  function isHex(str) {
    return typeof str === "string" && str.length > 0 && str.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(str);
  }

  // byteMode면 2자(=1바이트)씩, 아니면 코드포인트(문자) 단위
  function splitUnits(str, byteMode) {
    str = String(str == null ? "" : str);
    if (byteMode) {
      var out = [];
      for (var i = 0; i < str.length; i += 2) out.push(str.slice(i, i + 2));
      return out;
    }
    return Array.from(str);
  }

  // 위치 기준(positional) 유닛 비교. LCS 아님.
  // 길이 다르면 긴 쪽 잔여 유닛에 residual 표시 (§9 "한쪽에만 잔여 유닛")
  // byteMode는 byteOption이 켜져 있고 양쪽 모두 헥스일 때만 적용.
  function diffUnits(aRaw, bRaw, byteOption) {
    var a = String(aRaw == null ? "" : aRaw);
    var b = String(bRaw == null ? "" : bRaw);
    var byteMode = !!byteOption && isHex(a) && isHex(b);
    var ua = splitUnits(a, byteMode);
    var ub = splitUnits(b, byteMode);
    var n = Math.max(ua.length, ub.length);
    var ra = [], rb = [];
    for (var i = 0; i < n; i++) {
      var x = i < ua.length ? ua[i] : null;
      var y = i < ub.length ? ub[i] : null;
      if (x !== null && y !== null) {
        var d = x !== y;
        ra.push({ text: x, diff: d });
        rb.push({ text: y, diff: d });
      } else if (x !== null) {
        ra.push({ text: x, diff: true, residual: true });
      } else {
        rb.push({ text: y, diff: true, residual: true });
      }
    }
    return { byteMode: byteMode, a: ra, b: rb };
  }

  // ── 배치(다건) 헬퍼 (순수) — 부록 spec-batch-addendum.md ──

  // 파일명 정확히 일치로 As-Is/To-Be 짝지음. As-Is 순서 유지.
  function pairByName(asIsNames, toBeNames) {
    var aSet = new Set(asIsNames || []);
    var bSet = new Set(toBeNames || []);
    var pairs = [], onlyAsIs = [], onlyToBe = [];
    (asIsNames || []).forEach(function (n) { if (bSet.has(n)) pairs.push(n); else onlyAsIs.push(n); });
    (toBeNames || []).forEach(function (n) { if (!aSet.has(n)) onlyToBe.push(n); });
    return { pairs: pairs, onlyAsIs: onlyAsIs, onlyToBe: onlyToBe };
  }

  // 전체 판정: 모든 쌍 PASS AND 미매칭 0 → PASS. (§4)
  // pairResults: compareData 결과 객체 배열. unmatchedCount: 짝 없는 파일 수.
  function batchVerdict(pairResults, unmatchedCount) {
    pairResults = pairResults || [];
    unmatchedCount = unmatchedCount || 0;
    var passed = 0, failed = 0;
    var agg = { total: 0, matched: 0, mismatched: 0, onlyAsIs: 0, onlyToBe: 0 };
    pairResults.forEach(function (r) {
      if (r.verdict === "PASS") passed++; else failed++;
      agg.total += r.summary.total;
      agg.matched += r.summary.matched;
      agg.mismatched += r.summary.mismatched;
      agg.onlyAsIs += r.summary.onlyAsIs;
      agg.onlyToBe += r.summary.onlyToBe;
    });
    return {
      verdict: (failed === 0 && unmatchedCount === 0) ? "PASS" : "FAIL",
      tables: pairResults.length,
      passed: passed,
      failed: failed,
      unmatched: unmatchedCount,
      agg: agg
    };
  }

  return {
    DIFF_SEP: DIFF_SEP,
    commonColumns: commonColumns,
    guessPk: guessPk,
    indexByPk: indexByPk,
    compareData: compareData,
    computeVerdict: computeVerdict,
    isHex: isHex,
    splitUnits: splitUnits,
    diffUnits: diffUnits,
    keyOf: keyOf,
    autoKey: autoKey,
    pairByName: pairByName,
    batchVerdict: batchVerdict
  };
});
