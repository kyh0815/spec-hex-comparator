/*
 * i18n — UI 문자열 사전 (ko/ja/en). 표시 전용.
 *  - 비교/판정 로직(core.js)과 CSV 리포트(영어 enum/키 고정)는 언어 무관.
 *  - 외부 i18n 라이브러리 없음 → 단일 오프라인 파일 유지.
 *  - 키는 3개 언어 동일해야 함 (test/i18n.test.mjs가 검증).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HexI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LANG_ORDER = ["ko", "ja", "en"];
  var LANG_NAMES = { ko: "한국어", ja: "日本語", en: "English" };

  var STRINGS = {
    ko: {
      "app.title": "As-Is / To-Be 데이터 비교 검증",
      "app.subtitle": "CSV 2개를 byte-for-byte 비교하여 PASS/FAIL을 책정합니다. 데이터는 브라우저 밖으로 나가지 않습니다.",
      "lang.label": "언어",
      "header.back": "← 설정으로 돌아가기",
      "header.export": "CSV 리포트 내보내기",
      "upload.section": "1. 파일 업로드",
      "upload.roleAsIs": "As-Is (현행)",
      "upload.roleToBe": "To-Be (신규)",
      "drop.meta": "{rows} 행 · {cols} 열 · 클릭하여 교체",
      "drop.empty": "CSV를 드래그하거나 클릭하여 선택",
      "config.section": "2. 비교 설정 (공통 컬럼 {n}개)",
      "config.pkLabel": "PK 컬럼 (매칭 키) — 자동 추측:",
      "config.inspectLabel": "검사 대상 컬럼 — 기본 전체 검사, 클릭하여 제외/복원 (제외 {ex}개 / 검사 {ins}개)",
      "config.pkSuffix": "(PK)",
      "config.toggleOnTitle": "검사 중 — 클릭하여 제외",
      "config.toggleOffTitle": "제외됨 — 클릭하여 복원",
      "config.byteOption": "바이트 단위 diff 표시 (헥스값을 2자리씩 끊어 비교 — 표시 전용, 판정과 무관)",
      "run.button": "비교 실행 및 판정",
      "run.hint": "두 파일을 모두 업로드하면 활성화됩니다.",
      "err.bothFiles": "두 파일(As-Is, To-Be)을 모두 업로드하세요.",
      "err.noCommon": "공통 컬럼이 0개입니다. 두 파일의 컬럼명이 일치하는지 확인하세요.",
      "err.noCommonUpload": "공통 컬럼이 0개입니다. 두 파일의 컬럼명(헤더)이 일치하는지 확인하세요.",
      "err.noPk": "PK 컬럼을 선택하세요.",
      "err.noInspect": "검사 대상 컬럼이 최소 1개 이상이어야 합니다.",
      "err.parse": "CSV 파싱 실패: {msg}",
      "verdict.reasonPass": "검사 대상 기준 완전 일치",
      "verdict.reasonPassExcl": "검사 대상 컬럼 완전 일치 (단, 위 제외 컬럼은 검사 안 함)",
      "verdict.rsMismatch": "값 불일치 {n}건",
      "verdict.rsMissing": "To-Be 누락 {n}건",
      "verdict.rsExtra": "To-Be 초과 {n}건",
      "verdict.exclNone": "제외 컬럼 없음",
      "verdict.exclSome": "제외 컬럼 {n}개 있음: {list}",
      "verdict.metaPk": "PK:",
      "verdict.metaCommonTotal": "전체 공통 컬럼 {total}개 중",
      "verdict.metaInspectedN": "{ins}개 검사",
      "metrics.section": "집계",
      "metrics.total": "전체",
      "metrics.matched": "일치",
      "metrics.mismatched": "불일치",
      "metrics.onlyAsIs": "As-Is만",
      "metrics.onlyToBe": "To-Be만",
      "metrics.dupeWarn": "⚠ PK 중복 감지 (첫 row만 비교에 사용 — 정확도 영향 가능)",
      "metrics.dupeAsIs": "As-Is 중복키:",
      "metrics.dupeToBe": "To-Be 중복키:",
      "badge.match": "일치",
      "badge.mismatch": "불일치",
      "badge.onlyAsIs": "As-Is만",
      "badge.onlyToBe": "To-Be만",
      "detail.emptyVal": "∅ (빈 값)",
      "detail.previewMissingToBe": "To-Be에 없음",
      "detail.previewMissingAsIs": "As-Is에 없음",
      "detail.bodyOnlyAsIs": "이 키는 To-Be에 존재하지 않습니다 (MISSING_IN_TOBE).",
      "detail.bodyOnlyToBe": "이 키는 As-Is에 존재하지 않습니다 (EXTRA_IN_TOBE).",
      "detail.section": "상세 ({n}건)",
      "filter.problems": "문제만 (불일치·누락·초과)",
      "filter.match": "일치만",
      "filter.all": "전체",
      "detail.renderNote": "{total}건 중 상위 {cap}건만 표시합니다. 전체는 CSV 내보내기를 사용하세요.",
      "detail.none": "표시할 항목이 없습니다."
    },
    ja: {
      "app.title": "As-Is / To-Be データ比較検証",
      "app.subtitle": "2つのCSVをbyte-for-byteで比較してPASS/FAILを判定します。データはブラウザの外に出ません。",
      "lang.label": "言語",
      "header.back": "← 設定に戻る",
      "header.export": "CSVレポートを書き出す",
      "upload.section": "1. ファイルのアップロード",
      "upload.roleAsIs": "As-Is (現行)",
      "upload.roleToBe": "To-Be (新規)",
      "drop.meta": "{rows} 行 · {cols} 列 · クリックで差し替え",
      "drop.empty": "CSVをドラッグ、またはクリックして選択",
      "config.section": "2. 比較設定 (共通カラム {n}個)",
      "config.pkLabel": "PKカラム (マッチングキー) — 自動推測:",
      "config.inspectLabel": "検査対象カラム — 既定は全検査、クリックで除外/復元 (除外 {ex}個 / 検査 {ins}個)",
      "config.pkSuffix": "(PK)",
      "config.toggleOnTitle": "検査中 — クリックで除外",
      "config.toggleOffTitle": "除外中 — クリックで復元",
      "config.byteOption": "バイト単位diff表示 (16進値を2桁ずつ区切って比較 — 表示専用、判定には影響しません)",
      "run.button": "比較を実行して判定",
      "run.hint": "両方のファイルをアップロードすると有効になります。",
      "err.bothFiles": "両方のファイル(As-Is、To-Be)をアップロードしてください。",
      "err.noCommon": "共通カラムが0個です。2ファイルのカラム名が一致しているか確認してください。",
      "err.noCommonUpload": "共通カラムが0個です。2ファイルのカラム名(ヘッダー)が一致しているか確認してください。",
      "err.noPk": "PKカラムを選択してください。",
      "err.noInspect": "検査対象カラムは最低1つ必要です。",
      "err.parse": "CSVの解析に失敗しました: {msg}",
      "verdict.reasonPass": "検査対象において完全一致",
      "verdict.reasonPassExcl": "検査対象カラムは完全一致 (ただし上記の除外カラムは未検査)",
      "verdict.rsMismatch": "値不一致 {n}件",
      "verdict.rsMissing": "To-Be 欠落 {n}件",
      "verdict.rsExtra": "To-Be 余剰 {n}件",
      "verdict.exclNone": "除外カラムなし",
      "verdict.exclSome": "除外カラム {n}個: {list}",
      "verdict.metaPk": "PK:",
      "verdict.metaCommonTotal": "共通カラム {total}個のうち",
      "verdict.metaInspectedN": "{ins}個を検査",
      "metrics.section": "集計",
      "metrics.total": "全体",
      "metrics.matched": "一致",
      "metrics.mismatched": "不一致",
      "metrics.onlyAsIs": "As-Isのみ",
      "metrics.onlyToBe": "To-Beのみ",
      "metrics.dupeWarn": "⚠ PK重複を検出 (最初の行のみ使用 — 精度に影響する可能性)",
      "metrics.dupeAsIs": "As-Is 重複キー:",
      "metrics.dupeToBe": "To-Be 重複キー:",
      "badge.match": "一致",
      "badge.mismatch": "不一致",
      "badge.onlyAsIs": "As-Isのみ",
      "badge.onlyToBe": "To-Beのみ",
      "detail.emptyVal": "∅ (空値)",
      "detail.previewMissingToBe": "To-Beに無し",
      "detail.previewMissingAsIs": "As-Isに無し",
      "detail.bodyOnlyAsIs": "このキーはTo-Beに存在しません (MISSING_IN_TOBE)。",
      "detail.bodyOnlyToBe": "このキーはAs-Isに存在しません (EXTRA_IN_TOBE)。",
      "detail.section": "詳細 ({n}件)",
      "filter.problems": "問題のみ (不一致・欠落・余剰)",
      "filter.match": "一致のみ",
      "filter.all": "すべて",
      "detail.renderNote": "{total}件のうち上位{cap}件のみ表示しています。全件はCSV書き出しをご利用ください。",
      "detail.none": "表示する項目がありません。"
    },
    en: {
      "app.title": "As-Is / To-Be Data Comparison Verification",
      "app.subtitle": "Compares two CSVs byte-for-byte to determine PASS/FAIL. Your data never leaves the browser.",
      "lang.label": "Language",
      "header.back": "← Back to settings",
      "header.export": "Export CSV report",
      "upload.section": "1. Upload files",
      "upload.roleAsIs": "As-Is (current)",
      "upload.roleToBe": "To-Be (new)",
      "drop.meta": "{rows} rows · {cols} columns · click to replace",
      "drop.empty": "Drag a CSV here, or click to select",
      "config.section": "2. Comparison settings ({n} common columns)",
      "config.pkLabel": "PK column (matching key) — auto-guess:",
      "config.inspectLabel": "Columns to inspect — all on by default, click to exclude/restore (excluded {ex} / inspected {ins})",
      "config.pkSuffix": "(PK)",
      "config.toggleOnTitle": "Inspecting — click to exclude",
      "config.toggleOffTitle": "Excluded — click to restore",
      "config.byteOption": "Byte-wise diff view (split hex values into 2-char bytes — display only, does not affect verdict)",
      "run.button": "Run comparison & verdict",
      "run.hint": "Enabled once both files are uploaded.",
      "err.bothFiles": "Please upload both files (As-Is and To-Be).",
      "err.noCommon": "No common columns. Check that both files share the same column names.",
      "err.noCommonUpload": "No common columns. Check that both files share the same column names (headers).",
      "err.noPk": "Please select a PK column.",
      "err.noInspect": "At least one column must be selected for inspection.",
      "err.parse": "CSV parse failed: {msg}",
      "verdict.reasonPass": "Full match across all inspected columns",
      "verdict.reasonPassExcl": "Full match on inspected columns (note: excluded columns above were not checked)",
      "verdict.rsMismatch": "{n} value mismatches",
      "verdict.rsMissing": "{n} missing in To-Be",
      "verdict.rsExtra": "{n} extra in To-Be",
      "verdict.exclNone": "No excluded columns",
      "verdict.exclSome": "{n} excluded columns: {list}",
      "verdict.metaPk": "PK:",
      "verdict.metaCommonTotal": "of {total} common columns,",
      "verdict.metaInspectedN": "{ins} inspected",
      "metrics.section": "Summary",
      "metrics.total": "Total",
      "metrics.matched": "Matched",
      "metrics.mismatched": "Mismatched",
      "metrics.onlyAsIs": "As-Is only",
      "metrics.onlyToBe": "To-Be only",
      "metrics.dupeWarn": "⚠ Duplicate PKs detected (only the first row is used — may affect accuracy)",
      "metrics.dupeAsIs": "As-Is duplicate keys:",
      "metrics.dupeToBe": "To-Be duplicate keys:",
      "badge.match": "Match",
      "badge.mismatch": "Mismatch",
      "badge.onlyAsIs": "As-Is only",
      "badge.onlyToBe": "To-Be only",
      "detail.emptyVal": "∅ (empty)",
      "detail.previewMissingToBe": "Missing in To-Be",
      "detail.previewMissingAsIs": "Missing in As-Is",
      "detail.bodyOnlyAsIs": "This key does not exist in To-Be (MISSING_IN_TOBE).",
      "detail.bodyOnlyToBe": "This key does not exist in As-Is (EXTRA_IN_TOBE).",
      "detail.section": "Details ({n})",
      "filter.problems": "Problems only (mismatch · missing · extra)",
      "filter.match": "Matched only",
      "filter.all": "All",
      "detail.renderNote": "Showing the first {cap} of {total}. Use CSV export for the full set.",
      "detail.none": "No items to display."
    }
  };

  function interp(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      return params[k] != null ? params[k] : "{" + k + "}";
    });
  }

  function makeT(lang) {
    var dict = STRINGS[lang] || STRINGS.en;
    return function (key, params) {
      var s = dict[key];
      if (s == null) s = STRINGS.en[key];
      if (s == null) s = key;
      return params ? interp(s, params) : s;
    };
  }

  // 브라우저 언어 자동감지: ko/ja → 해당, 그 외 en
  function detectLang() {
    var nav = (typeof navigator !== "undefined" && navigator.language) ? navigator.language : "en";
    var l = String(nav).toLowerCase();
    if (l.indexOf("ko") === 0) return "ko";
    if (l.indexOf("ja") === 0) return "ja";
    return "en";
  }

  return {
    STRINGS: STRINGS,
    LANG_ORDER: LANG_ORDER,
    LANG_NAMES: LANG_NAMES,
    interp: interp,
    makeT: makeT,
    detectLang: detectLang
  };
});
