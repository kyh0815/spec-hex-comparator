/*
 * i18n — UI 문자열 사전 (ko/ja/en). 표시 전용.
 *  - 비교/판정 로직(core.js)과 CSV 리포트(영어 enum/키 고정)는 언어 무관.
 *  - 외부 i18n 라이브러리 없음 → 단일 오프라인 파일 유지.
 *  - 키는 3개 언어 동일해야 함 (test/i18n.test.mjs가 검증).
 *  - 일부 문자열은 **bold**, `mono` 토큰을 포함 — app.js의 rich() 가 노드로 변환(표시 전용).
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
      "app.title": "데이터 마이그레이션 검증 도구",
      "app.subtitle": "As-Is(메인프레임) → To-Be(오픈시스템) CSV를 byte-for-byte 비교하여 `Pass / Fail`을 판정합니다. 모든 처리는 브라우저 내에서 이루어지며 외부 요청이 없습니다.",
      "lang.label": "언어",

      "screenA.title": "파일 업로드 및 검사 설정",
      "screenA.subtitle": "검사할 As-Is·To-Be CSV 파일을 올리고, PK와 대상 컬럼을 확인하세요.",

      "upload.roleAsIs": "As-Is",
      "upload.roleToBe": "To-Be",
      "upload.subroleAsIs": "메인프레임 원본",
      "upload.subroleToBe": "오픈시스템 적재",
      "drop.emptyName": "CSV 파일을 끌어 놓거나 클릭",
      "drop.emptyHint": "최대 수천 row까지 처리. 파싱은 브라우저 내에서만 수행됩니다.",
      "drop.droppingName": "파일 놓기",
      "drop.droppingHint": "CSV 파일을 여기에 드롭하세요",
      "drop.rows": "{rows} row · {cols} col",
      "chip.pkMark": " ·PK",

      "config.pkLabel": "PK 컬럼 (자동 추측: `{guess}`)",
      "config.inspectLabel": "검사 대상 컬럼 (클릭해서 제외 토글, PK는 항상 포함)",
      "config.toggleOnTitle": "검사 중 — 클릭하여 제외",
      "config.toggleOffTitle": "제외됨 — 클릭하여 복원",
      "config.byteOption": "바이트 단위로 diff 표시",
      "config.byteOptionHint": "(기본: 문자 단위)",

      "run.button": "비교 실행 및 판정",
      "reset.button": "초기화",
      "run.ready": "준비됨 · 두 파일 모두 로드",
      "run.hint": "두 파일을 모두 업로드해 주세요",

      "err.bothFiles": "두 파일(As-Is, To-Be)을 모두 업로드하세요.",
      "err.noCommon": "검사 가능한 공통 컬럼이 없습니다. 두 파일의 컬럼명을 확인해 주세요.",
      "err.noCommonHint": "As-Is·To-Be 양쪽에 존재하는 컬럼만 비교 대상으로 잡힙니다.",
      "err.noPk": "PK 컬럼을 선택하세요.",
      "err.noInspect": "검사 대상 컬럼이 최소 1개 이상이어야 합니다.",
      "err.parse": "CSV 파싱 실패: {msg}",

      "verdict.passReason": "모든 row와 컬럼이 **완전 일치**합니다.",
      "verdict.passExclReason": "검사 대상 컬럼이 **완전 일치**합니다.",
      "verdict.passExclNote": "제외된 컬럼이 있어 일부 항목은 비교되지 않았습니다.",
      "verdict.failReason": "불일치 **{m}**건, As-Is만 존재 **{a}**건, To-Be만 존재 **{b}**건.",
      "verdict.metaPkLabel": "PK 컬럼",
      "verdict.metaScopeLabel": "검사 범위",
      "verdict.metaScopeValue": "전체 `{total}`개 중 `{ins}`개 검사",
      "verdict.metaExclLabel": "제외 컬럼",

      "metrics.total": "전체 row",
      "metrics.matched": "일치",
      "metrics.mismatched": "불일치",
      "metrics.onlyAsIs": "As-Is만 존재",
      "metrics.onlyToBe": "To-Be만 존재",
      "metrics.dupeWarn": "PK 중복이 감지되었습니다 — `{pk}` 컬럼에서 중복 키 **{n}**건.",
      "metrics.dupeWarnNote": "중복된 PK는 첫 row만 비교에 사용되며 결과 정확도에 영향을 줄 수 있습니다.",
      "metrics.dupeKeysAsIs": "As-Is 중복키:",
      "metrics.dupeKeysToBe": "To-Be 중복키:",

      "badge.match": "일치",
      "badge.mismatch": "불일치",
      "badge.onlyAsIs": "As-Is만",
      "badge.onlyToBe": "To-Be만",

      "detail.title": "상세 결과",
      "detail.subtitle": "row별 비교 결과. 불일치 row를 펼치면 컬럼별 값을 나란히 확인할 수 있습니다.",
      "filter.problems": "문제만",
      "filter.match": "일치만",
      "filter.all": "전체",
      "detail.none": "표시할 row가 없습니다. 다른 필터를 선택해 보세요.",
      "detail.renderNote": "상위 `{cap}`건만 렌더링됨 — 전체 결과는 CSV 내보내기를 사용하세요. (남은 row: `{rest}`건)",
      "detail.previewOnlyAsIs": "As-Is에만 존재하는 row",
      "detail.previewOnlyToBe": "To-Be에만 존재하는 row",
      "detail.emptyVal": "빈 값",

      "side.asIs": "As-Is",
      "side.toBe": "To-Be",

      "screenE.title": "내보내기",
      "screenE.subtitle": "전체 비교 결과를 CSV로 저장합니다. 상단 메타(판정·집계·제외 컬럼)와 row별 키·상태·다른 컬럼이 기록됩니다. (전수 — 렌더 상한과 무관)",
      "export.button": "CSV 리포트 내보내기",
      "back.button": "설정 다시 보기",
      "restart.button": "새로 시작",
      "export.filenameLabel": "파일명:"
    },

    ja: {
      "app.title": "データ移行検証ツール",
      "app.subtitle": "As-Is(メインフレーム) → To-Be(オープン系) のCSVをbyte-for-byte比較して `Pass / Fail` を判定します。すべての処理はブラウザ内で行われ、外部リクエストはありません。",
      "lang.label": "言語",

      "screenA.title": "ファイルのアップロードと検査設定",
      "screenA.subtitle": "検査するAs-Is・To-Be CSVをアップロードし、PKと対象カラムを確認してください。",

      "upload.roleAsIs": "As-Is",
      "upload.roleToBe": "To-Be",
      "upload.subroleAsIs": "メインフレーム原本",
      "upload.subroleToBe": "オープン系へ移行",
      "drop.emptyName": "CSVをドラッグ、またはクリック",
      "drop.emptyHint": "数千行まで処理可能。解析はブラウザ内でのみ行われます。",
      "drop.droppingName": "ここにドロップ",
      "drop.droppingHint": "CSVファイルをここにドロップしてください",
      "drop.rows": "{rows} 行 · {cols} 列",
      "chip.pkMark": " ·PK",

      "config.pkLabel": "PKカラム (自動推測: `{guess}`)",
      "config.inspectLabel": "検査対象カラム (クリックで除外を切り替え、PKは常に含む)",
      "config.toggleOnTitle": "検査中 — クリックで除外",
      "config.toggleOffTitle": "除外中 — クリックで復元",
      "config.byteOption": "バイト単位でdiff表示",
      "config.byteOptionHint": "(既定: 文字単位)",

      "run.button": "比較を実行して判定",
      "reset.button": "リセット",
      "run.ready": "準備完了 · 両ファイル読み込み済み",
      "run.hint": "両方のファイルをアップロードしてください",

      "err.bothFiles": "両方のファイル(As-Is、To-Be)をアップロードしてください。",
      "err.noCommon": "検査可能な共通カラムがありません。2ファイルのカラム名を確認してください。",
      "err.noCommonHint": "As-Is・To-Beの両方に存在するカラムのみが比較対象になります。",
      "err.noPk": "PKカラムを選択してください。",
      "err.noInspect": "検査対象カラムは最低1つ必要です。",
      "err.parse": "CSVの解析に失敗しました: {msg}",

      "verdict.passReason": "すべての行とカラムが **完全一致** しています。",
      "verdict.passExclReason": "検査対象カラムは **完全一致** しています。",
      "verdict.passExclNote": "除外されたカラムがあり、一部の項目は比較されていません。",
      "verdict.failReason": "不一致 **{m}**件、As-Isのみ **{a}**件、To-Beのみ **{b}**件。",
      "verdict.metaPkLabel": "PKカラム",
      "verdict.metaScopeLabel": "検査範囲",
      "verdict.metaScopeValue": "全 `{total}` 個中 `{ins}` 個を検査",
      "verdict.metaExclLabel": "除外カラム",

      "metrics.total": "全 row",
      "metrics.matched": "一致",
      "metrics.mismatched": "不一致",
      "metrics.onlyAsIs": "As-Isのみ",
      "metrics.onlyToBe": "To-Beのみ",
      "metrics.dupeWarn": "PK重複を検出 — `{pk}` カラムで重複キー **{n}**件。",
      "metrics.dupeWarnNote": "重複したPKは最初の行のみ比較に使用され、結果の精度に影響する可能性があります。",
      "metrics.dupeKeysAsIs": "As-Is 重複キー:",
      "metrics.dupeKeysToBe": "To-Be 重複キー:",

      "badge.match": "一致",
      "badge.mismatch": "不一致",
      "badge.onlyAsIs": "As-Isのみ",
      "badge.onlyToBe": "To-Beのみ",

      "detail.title": "詳細結果",
      "detail.subtitle": "行ごとの比較結果。不一致の行を展開すると、カラム別の値を並べて確認できます。",
      "filter.problems": "問題のみ",
      "filter.match": "一致のみ",
      "filter.all": "すべて",
      "detail.none": "表示する行がありません。別のフィルターを選択してください。",
      "detail.renderNote": "上位 `{cap}` 件のみ表示 — 全件はCSV書き出しをご利用ください。(残り: `{rest}` 件)",
      "detail.previewOnlyAsIs": "As-Isにのみ存在する行",
      "detail.previewOnlyToBe": "To-Beにのみ存在する行",
      "detail.emptyVal": "空値",

      "side.asIs": "As-Is",
      "side.toBe": "To-Be",

      "screenE.title": "書き出し",
      "screenE.subtitle": "全比較結果をCSVに保存します。上部メタ(判定・集計・除外カラム)と行ごとのキー・状態・差異カラムが記録されます。(全件 — 表示上限とは無関係)",
      "export.button": "CSVレポートを書き出す",
      "back.button": "設定に戻る",
      "restart.button": "最初からやり直す",
      "export.filenameLabel": "ファイル名:"
    },

    en: {
      "app.title": "Data Migration Verification Tool",
      "app.subtitle": "Compares As-Is (mainframe) → To-Be (open system) CSVs byte-for-byte to determine `Pass / Fail`. All processing happens in your browser with no external requests.",
      "lang.label": "Language",

      "screenA.title": "Upload files & inspection settings",
      "screenA.subtitle": "Upload the As-Is and To-Be CSV files, then confirm the PK and target columns.",

      "upload.roleAsIs": "As-Is",
      "upload.roleToBe": "To-Be",
      "upload.subroleAsIs": "Mainframe source",
      "upload.subroleToBe": "Open-system target",
      "drop.emptyName": "Drag a CSV here, or click",
      "drop.emptyHint": "Handles thousands of rows. Parsing happens only in your browser.",
      "drop.droppingName": "Drop the file",
      "drop.droppingHint": "Drop your CSV file here",
      "drop.rows": "{rows} rows · {cols} cols",
      "chip.pkMark": " ·PK",

      "config.pkLabel": "PK column (auto-guess: `{guess}`)",
      "config.inspectLabel": "Columns to inspect (click to toggle exclusion; PK always included)",
      "config.toggleOnTitle": "Inspecting — click to exclude",
      "config.toggleOffTitle": "Excluded — click to restore",
      "config.byteOption": "Show diff by byte",
      "config.byteOptionHint": "(default: by character)",

      "run.button": "Run comparison & verdict",
      "reset.button": "Reset",
      "run.ready": "Ready · both files loaded",
      "run.hint": "Please upload both files",

      "err.bothFiles": "Please upload both files (As-Is and To-Be).",
      "err.noCommon": "No common columns to inspect. Please check the column names in both files.",
      "err.noCommonHint": "Only columns present in both As-Is and To-Be are compared.",
      "err.noPk": "Please select a PK column.",
      "err.noInspect": "At least one column must be selected for inspection.",
      "err.parse": "CSV parse failed: {msg}",

      "verdict.passReason": "All rows and columns are a **full match**.",
      "verdict.passExclReason": "Inspected columns are a **full match**.",
      "verdict.passExclNote": "Some columns were excluded and were not compared.",
      "verdict.failReason": "**{m}** mismatches, **{a}** only in As-Is, **{b}** only in To-Be.",
      "verdict.metaPkLabel": "PK column",
      "verdict.metaScopeLabel": "Inspection scope",
      "verdict.metaScopeValue": "`{ins}` of `{total}` columns inspected",
      "verdict.metaExclLabel": "Excluded columns",

      "metrics.total": "Total rows",
      "metrics.matched": "Matched",
      "metrics.mismatched": "Mismatched",
      "metrics.onlyAsIs": "Only in As-Is",
      "metrics.onlyToBe": "Only in To-Be",
      "metrics.dupeWarn": "Duplicate PKs detected — **{n}** duplicate keys in `{pk}`.",
      "metrics.dupeWarnNote": "Only the first row of a duplicate PK is compared, which may affect accuracy.",
      "metrics.dupeKeysAsIs": "As-Is duplicate keys:",
      "metrics.dupeKeysToBe": "To-Be duplicate keys:",

      "badge.match": "Match",
      "badge.mismatch": "Mismatch",
      "badge.onlyAsIs": "As-Is only",
      "badge.onlyToBe": "To-Be only",

      "detail.title": "Detailed results",
      "detail.subtitle": "Per-row comparison. Expand a mismatched row to compare column values side by side.",
      "filter.problems": "Issues",
      "filter.match": "Matched",
      "filter.all": "All",
      "detail.none": "No rows to display. Try another filter.",
      "detail.renderNote": "Showing the first `{cap}` — use CSV export for the full set. (`{rest}` more rows)",
      "detail.previewOnlyAsIs": "Row exists only in As-Is",
      "detail.previewOnlyToBe": "Row exists only in To-Be",
      "detail.emptyVal": "empty",

      "side.asIs": "As-Is",
      "side.toBe": "To-Be",

      "screenE.title": "Export",
      "screenE.subtitle": "Saves the full comparison result as a CSV. Includes top-level meta (verdict, summary, excluded columns) and per-row key, status, and differing columns. (Full set — independent of the render cap.)",
      "export.button": "Export CSV report",
      "back.button": "Back to settings",
      "restart.button": "Start over",
      "export.filenameLabel": "Filename:"
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
