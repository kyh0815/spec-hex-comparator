/*
 * Hex Comparator — UI (React + htm, 빌드 없음)
 * 다건(배치): spec-batch-addendum.md. 결과 화면 시각은 Claude Design 2차(design-handoff-batch.md):
 *   전체 판정 배너 + 집계 메트릭 + 정렬 테이블(batch-table) + 인라인 드릴다운.
 * 비교/판정 로직은 전부 window.HexCore(core.js). UI 문자열은 window.HexI18n(i18n.js, 표시 전용).
 * 데이터는 메모리(React state)에만 존재. 서버 전송/스토리지 없음.
 */
(function () {
  "use strict";
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var Papa = window.Papa;
  var C = window.HexCore;
  var I = window.HexI18n;
  var html = window.htm.bind(React.createElement);
  var Fragment = React.Fragment;
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect, useRef = React.useRef;

  var RENDER_CAP = 500;

  var I18nCtx = React.createContext(null);
  function useT() { var c = React.useContext(I18nCtx); return c ? c.t : function (k) { return k; }; }
  function fmt(n) { return Number(n).toLocaleString(); }

  // **bold** / `mono` 토큰 → React 노드 (표시 전용)
  function rich(str) {
    if (str == null) return null;
    var nodes = [], re = /\*\*([^*]+)\*\*|`([^`]+)`/g, last = 0, m, k = 0;
    while ((m = re.exec(str))) {
      if (m.index > last) nodes.push(str.slice(last, m.index));
      if (m[1] != null) nodes.push(html`<b key=${"b" + (k++)}>${m[1]}</b>`);
      else nodes.push(html`<span key=${"m" + (k++)} class="mono">${m[2]}</span>`);
      last = re.lastIndex;
    }
    if (last < str.length) nodes.push(str.slice(last));
    return nodes;
  }
  function ts() {
    var d = new Date(); function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function baseName(name) { return name.replace(/\.csv$/i, ""); }

  // 파일을 ArrayBuffer로 직접 읽어 1바이트=U+00xx로 1:1 매핑한 문자열로 변환.
  // (FileReader.readAsText('iso-8859-1')은 실제로 windows-1252로 디코딩되어 0x80-0x9F 영역이
  //  의도와 다른 코드포인트로 바뀌므로 우회 필요. 어떤 인코딩의 CSV든 바이트를 무손실 보존.)
  function bytesToByteString(buf) {
    var u = new Uint8Array(buf), s = "", CHUNK = 0x8000;
    for (var i = 0; i < u.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, u.subarray(i, Math.min(i + CHUNK, u.length)));
    }
    return s;
  }
  function parseFile(file, cb) {
    var fr = new FileReader();
    fr.onerror = function () { cb(fr.error || new Error("read failed")); };
    fr.onload = function () {
      var bytes = bytesToByteString(fr.result);
      var encoding = detectEncoding(bytes);
      Papa.parse(bytes, {
        header: true, skipEmptyLines: true, dynamicTyping: false,
        complete: function (res) {
          var fields = (res.meta && res.meta.fields) || [];
          var rows = res.data || [];
          if (fields.length) {
            var origFirst = fields[0], strippedFirst = stripBom(origFirst);
            if (strippedFirst !== origFirst) {
              fields[0] = strippedFirst;
              for (var i = 0; i < rows.length; i++) {
                var r = rows[i]; if (origFirst in r) { r[strippedFirst] = r[origFirst]; delete r[origFirst]; }
              }
            }
          }
          cb(null, { fileName: file.name, bytes: file.size, encoding: encoding, columns: fields, rows: rows });
        },
        error: function (err) { cb(err); }
      });
    };
    fr.readAsArrayBuffer(file);
  }
  function stripBom(s) {
    return (typeof s === "string" && s.length >= 3 && s.charCodeAt(0) === 0xEF && s.charCodeAt(1) === 0xBB && s.charCodeAt(2) === 0xBF) ? s.slice(3) : s;
  }
  // 셀의 바이트(iso-8859-1 문자 = 코드포인트 0..255)를 대문자 hex 연속 문자열로
  function strToHex(s) {
    if (s == null) return "";
    s = String(s); var hex = "", c;
    for (var i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      hex += (c < 16 ? "0" : "") + c.toString(16).toUpperCase();
    }
    return hex;
  }
  function hexifyRow(row, pkSet) {
    var out = {}; for (var k in row) { out[k] = pkSet[k] ? row[k] : strToHex(row[k]); } return out;
  }
  // 12 → "12 B", 4321 → "4.2 KB", 1234567 → "1.2 MB"
  function fmtBytes(n) {
    if (n == null) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace(/\.0$/, "") + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1048576).toFixed(1).replace(/\.0$/, "") + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }
  function parseFiles(fileList, cb) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return /\.csv$/i.test(f.name); });
    if (!files.length) { cb([]); return; }
    var out = [], pending = files.length;
    files.forEach(function (f) { parseFile(f, function (err, parsed) { if (!err && parsed) out.push(parsed); if (--pending === 0) cb(out); }); });
  }
  function download(text, filename) {
    var blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  var ICON_PASS = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5 L6.5 12 L13 4" /></svg>`;
  var ICON_FAIL = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" /></svg>`;

  // ── 업로드존 (멀티선택 + 폴더 + 드래그) ──
  function MultiDrop(props) {
    var t = useT();
    var role = props.role, subrole = props.subrole, files = props.files, onPick = props.onPick;
    var ov = useState(false); var over = ov[0], setOver = ov[1];
    var fileRef = useRef(null), folderRef = useRef(null);
    useEffect(function () { if (folderRef.current) { folderRef.current.setAttribute("webkitdirectory", ""); folderRef.current.setAttribute("directory", ""); } }, []);
    var loaded = files && files.length;
    var cls = "drop" + (loaded ? " drop--loaded" : "") + (over && !loaded ? " drop--over" : "");
    return html`
      <div class=${cls}
        onDragOver=${function (e) { e.preventDefault(); setOver(true); }}
        onDragLeave=${function () { setOver(false); }}
        onDrop=${function (e) { e.preventDefault(); setOver(false); onPick(e.dataTransfer.files); }}>
        <div class="drop__role">${role}<span class="muted" style=${{ marginLeft: "6px", fontWeight: 400, fontFamily: "var(--sans)" }}>· ${subrole}</span></div>
        ${loaded
          ? html`
            <div class="drop__name" style=${{ fontFamily: "var(--sans)" }}>${t("drop.filesLoaded", { n: files.length })}</div>
            <div class="colchips">${files.map(function (f) {
              var tip = f.bytes != null ? fmt(f.bytes) + " bytes" + (f.encoding ? " · " + encodingLabel(f.encoding) : "") : null;
              return html`<span key=${f.fileName} class="chip" title=${tip}>${f.fileName}${f.bytes != null ? html`<span class="chip__size"> · ${fmtBytes(f.bytes)}</span>` : null}${f.encoding ? html`<span class="chip__enc"> · ${encodingLabel(f.encoding)}</span>` : null}</span>`;
            })}</div>`
          : (over
            ? html`<div class="drop__name" style=${{ fontFamily: "var(--sans)", fontWeight: 500 }}>${t("drop.droppingName")}</div>`
            : html`
              <div class="drop__name muted" style=${{ fontWeight: 400, fontFamily: "var(--sans)" }}>${t("drop.batchEmptyName")}</div>
              <div class="drop__hint">${t("drop.batchEmptyHint")}</div>`)}
        <div class="btnrow" style=${{ marginTop: "auto", paddingTop: "8px" }}>
          <button class="btn btn--secondary" onClick=${function () { fileRef.current && fileRef.current.click(); }}>${t("upload.pickFiles")}</button>
          <button class="btn btn--secondary" onClick=${function () { folderRef.current && folderRef.current.click(); }}>${t("upload.pickFolder")}</button>
        </div>
        <input ref=${fileRef} type="file" accept=".csv,text/csv" multiple style=${{ display: "none" }} onChange=${function (e) { onPick(e.target.files); e.target.value = ""; }} />
        <input ref=${folderRef} type="file" multiple style=${{ display: "none" }} onChange=${function (e) { onPick(e.target.files); e.target.value = ""; }} />
      </div>`;
  }

  // ── 페어링 미리보기 — 파일별 포함/제외 토글 (#1) ──
  function PairingPreview(props) {
    var t = useT();
    var aFiles = props.aFiles, bFiles = props.bFiles, excluded = props.excluded, onToggle = props.onToggle;
    var aSet = {}, bSet = {};
    aFiles.forEach(function (f) { aSet[f.fileName] = 1; });
    bFiles.forEach(function (f) { bSet[f.fileName] = 1; });
    var matched = [], unmatched = [];
    aFiles.forEach(function (f) { (bSet[f.fileName] ? matched : unmatched).push(f.fileName); });
    bFiles.forEach(function (f) { if (!aSet[f.fileName]) unmatched.push(f.fileName); });
    function toggleBtn(name) {
      var off = excluded.has(name);
      return html`<button key=${name} class=${"toggle mono " + (off ? "toggle--off" : "toggle--on")} onClick=${function () { onToggle(name); }} title=${t("pairing.excludeHint")}>${name}</button>`;
    }
    var incMatched = matched.filter(function (n) { return !excluded.has(n); }).length;
    var incUnmatched = unmatched.filter(function (n) { return !excluded.has(n); }).length;
    return html`
      <div class="card">
        <div class="card__title">${t("pairing.title")}</div>
        <p class="card__subtitle small">${t("pairing.excludeHint")}</p>
        ${matched.length
          ? html`<div class="field"><label class="field__label">${t("pairing.matched", { n: incMatched })}</label><div class="toggles">${matched.map(toggleBtn)}</div></div>`
          : html`<div class="error"><div>${t("pairing.none")}</div></div>`}
        ${unmatched.length
          ? html`<div class="field"><label class="field__label">${t("pairing.unmatchedCount", { n: incUnmatched })}</label><div class="toggles">${unmatched.map(toggleBtn)}</div></div>`
          : null}
      </div>`;
  }

  // ── 레코드(row) 단위 컴포넌트 (드릴다운에서 재사용) ──
  var BADGE = {
    MATCH: { cls: "badge--match", key: "badge.match" }, MISMATCH: { cls: "badge--mismatch", key: "badge.mismatch" },
    ONLY_AS_IS: { cls: "badge--only", key: "badge.onlyAsIs" }, ONLY_TO_BE: { cls: "badge--only", key: "badge.onlyToBe" }
  };
  var STATE_MAP = { MATCH: "match", MISMATCH: "mismatch", ONLY_AS_IS: "only-a", ONLY_TO_BE: "only-b" };

  function Units(props) {
    return props.units.map(function (u, i) {
      var cls = "u" + (u.diff ? (u.residual ? " diff residual" : " diff") : "");
      return html`<span key=${i} class=${cls}>${u.text}</span>`;
    });
  }
  function hexToBytes(s) {
    if (!s) return new Uint8Array(0);
    var n = (s.length / 2) | 0, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = parseInt(s.substr(i * 2, 2), 16);
    return u;
  }
  // byte-string → 표준 인코딩 라벨. BOM 우선, 다음 UTF-8/SJIS/EUC-JP fatal 시도, 폴백은 windows-1252.
  function byteStringToU8(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function detectEncoding(byteStr) {
    if (!byteStr) return "ascii";
    if (byteStr.length >= 3 && byteStr.charCodeAt(0) === 0xEF && byteStr.charCodeAt(1) === 0xBB && byteStr.charCodeAt(2) === 0xBF) return "utf-8";
    if (byteStr.length >= 2) {
      var b0 = byteStr.charCodeAt(0), b1 = byteStr.charCodeAt(1);
      if (b0 === 0xFF && b1 === 0xFE) return "utf-16le";
      if (b0 === 0xFE && b1 === 0xFF) return "utf-16be";
    }
    var hasHigh = false;
    for (var i = 0; i < byteStr.length; i++) if (byteStr.charCodeAt(i) >= 0x80) { hasHigh = true; break; }
    if (!hasHigh) return "ascii";
    var u = byteStringToU8(byteStr);
    try { new TextDecoder("utf-8", { fatal: true }).decode(u); return "utf-8"; } catch (e) {}
    try { new TextDecoder("shift_jis", { fatal: true }).decode(u); return "shift_jis"; } catch (e) {}
    try { new TextDecoder("euc-jp", { fatal: true }).decode(u); return "euc-jp"; } catch (e) {}
    return "windows-1252";
  }
  // 표시용 짧은 라벨
  function encodingLabel(enc) {
    if (enc === "shift_jis") return "Shift-JIS";
    if (enc === "euc-jp") return "EUC-JP";
    if (enc === "utf-8") return "UTF-8";
    if (enc === "utf-16le") return "UTF-16LE";
    if (enc === "utf-16be") return "UTF-16BE";
    if (enc === "ascii") return "ASCII";
    if (enc === "windows-1252") return "Win-1252";
    return enc;
  }
  function decodeHex(hexStr, encoding) {
    var bytes = hexToBytes(hexStr);
    if (!bytes.length) return "";
    var enc = encoding === "ascii" ? "utf-8" : (encoding || "utf-8");
    try { return new TextDecoder(enc, { fatal: false }).decode(bytes); } catch (e) { return ""; }
  }
  function DiffPair(props) {
    var t = useT();
    var col = props.col, aRow = props.aRow, bRow = props.bRow, byteMode = props.byteMode;
    var aEncoding = props.aEncoding, bEncoding = props.bEncoding;
    var label = props.label != null ? props.label : col; // 칼럼 피벗에선 레코드 키를 라벨로
    var aVal = aRow && aRow[col] != null ? String(aRow[col]) : "";
    var bVal = bRow && bRow[col] != null ? String(bRow[col]) : "";
    var differs = aVal !== bVal;
    var emptyMarker = html`<span class="empty">${t("detail.emptyVal")}</span>`;
    var aNode, bNode;
    if (aVal === "" || bVal === "") {
      aNode = aVal === "" ? emptyMarker : html`<span class="u">${aVal}</span>`;
      bNode = bVal === "" ? emptyMarker : html`<span class="u">${bVal}</span>`;
    } else if (!differs) {
      aNode = html`<span class="u">${aVal}</span>`; bNode = html`<span class="u">${bVal}</span>`;
    } else {
      var d = C.diffUnits(aVal, bVal, byteMode);
      aNode = html`<${Units} units=${d.a} />`; bNode = html`<${Units} units=${d.b} />`;
    }
    var aDec = aVal ? decodeHex(aVal, aEncoding) : "";
    var bDec = bVal ? decodeHex(bVal, bEncoding) : "";
    return html`
      <div class="diffpair" data-state=${differs ? "diff" : "match"}>
        <div class="diffpair__col">
          <span class="mono">${label}</span>
          ${differs
            ? html`<span class="badge badge--mismatch">${t("badge.mismatch")}</span>`
            : html`<span class="badge badge--match">${t("badge.match")}</span>`}
        </div>
        <div class="diffpair__sides">
          <div class="side">
            <div class="side__label">${t("side.asIs")}</div>
            <div class="side__val">${aNode}</div>
            ${aDec ? html`<div class="side__decoded">${aDec}</div>` : null}
          </div>
          <div class="side">
            <div class="side__label">${t("side.toBe")}</div>
            <div class="side__val">${bNode}</div>
            ${bDec ? html`<div class="side__decoded">${bDec}</div>` : null}
          </div>
        </div>
      </div>`;
  }
  function DetailRow(props) {
    var t = useT();
    var r = props.result, row = props.row, byteMode = props.byteMode;
    var aEncoding = props.aEncoding, bEncoding = props.bEncoding;
    var colFilter = props.colFilter || "all"; // "all" 전체 inspected · "diff" 차이 칼럼만
    var ex = useState(false); var open = ex[0], setOpen = ex[1];
    var badge = BADGE[row.status];
    var expandable = row.status === "MATCH" || row.status === "MISMATCH";
    var preview = row.status === "MISMATCH" ? row.diffCols.join(", ")
      : row.status === "ONLY_AS_IS" ? t("detail.previewOnlyAsIs")
      : row.status === "ONLY_TO_BE" ? t("detail.previewOnlyToBe") : "";
    var aRow = r.asIsIndex.get(row.key), bRow = r.toBeIndex.get(row.key);
    // 'all' = 전체 inspected 칼럼 (일치/불일치 모두) · 'diff' = 차이 칼럼만 (포커스)
    var cols = colFilter === "diff" ? (row.diffCols || []) : r.inspectedCols;
    return html`
      <div class="detail-row" data-state=${STATE_MAP[row.status]} data-open=${open ? "true" : "false"}>
        <div class=${"detail-row__head" + (expandable ? "" : " detail-row__head--plain")} onClick=${expandable ? function () { setOpen(!open); } : null}>
          <span class="detail-row__key">
            <span class="detail-row__keyLbl">${(r.pk || []).join(" | ")}</span>
            <span class="detail-row__keyVal mono">${row.key}</span>
          </span>
          <span class="badge ${badge.cls}">${t(badge.key)}</span>
          <span class="detail-row__preview">${preview}</span>
        </div>
        ${open && expandable
          ? html`<div class="detail-row__body">${cols.length
              ? cols.map(function (col) { return html`<${DiffPair} key=${col} col=${col} aRow=${aRow} bRow=${bRow} byteMode=${byteMode} aEncoding=${aEncoding} bEncoding=${bEncoding} />`; })
              : html`<div class="render-note"><div>${t("drilldown.noColDiff")}</div></div>`}</div>`
          : null}
      </div>`;
  }

  // ── 인라인 드릴다운 (레코드 상세: PK별 레코드 목록 → 펼치면 칼럼값을 리스트로) ──
  function Drilldown(props) {
    var t = useT();
    var pair = props.pair, byteMode = props.byteMode, onClose = props.onClose;
    var r = pair.result;
    // 디폴트: 차이가 있으면 '실패만'(바로 문제 확인), 전건 일치면 '전체'(확인 가능하도록)
    var fl = useState(function () {
      var p = r.summary.mismatched + r.summary.onlyAsIs + r.summary.onlyToBe;
      return p > 0 ? "problems" : "all";
    });
    var filter = fl[0], setFilter = fl[1];
    // 펼친 레코드 본문에서 보여줄 칼럼: 전체 inspected vs 차이 칼럼만 (글로벌 토글)
    var cf = useState("all"); var colFilter = cf[0], setColFilter = cf[1];
    var counts = {
      all: r.summary.total, match: r.summary.matched,
      problems: r.summary.mismatched + r.summary.onlyAsIs + r.summary.onlyToBe
    };
    var filtered = useMemo(function () {
      return r.rows.filter(function (row) {
        if (filter === "all") return true;
        if (filter === "match") return row.status === "MATCH";
        return row.status !== "MATCH";
      });
    }, [r, filter]);
    var shown = filtered.slice(0, RENDER_CAP);
    // 레코드 필터(전체 레코드 / 실패만 / 통과만) — 보드의 "전체 테이블"과 모호성 분리
    var FILTERS = [["all", "drilldown.recFilterAll"], ["problems", "drilldown.recFilterFail"], ["match", "drilldown.recFilterPass"]];
    return html`
      <div class="drilldown">
        <header class="drilldown__head">
          <span class="drilldown__title"><span class="mono">${pair.name}</span><span class="drilldown__sep">·</span>${t("drilldown.title")}</span>
          <span class="drilldown__meta">
            <span class="mono">${fmt(pair.aCount)}</span><span class="drilldown__arrow">↔</span><span class="mono">${fmt(pair.bCount)}</span>
            <span class="drilldown__metaLbl">${t("drilldown.metaLbl")}</span>
            <button class="btn btn--secondary" style=${{ height: "28px", padding: "0 10px", fontSize: "12.5px" }}
              onClick=${function () { exportPairCsv(r, "compare_" + baseName(pair.name) + "_" + ts() + ".csv"); }}>${t("export.button")}</button>
            ${onClose ? html`<button class="btn btn--secondary drilldown__close" type="button" aria-label=${t("drilldown.close")}
              style=${{ height: "28px", padding: "0 10px", fontSize: "12.5px" }}
              onClick=${function () { onClose(); }}>× ${t("drilldown.close")}</button>` : null}
          </span>
        </header>
        <div class="filters-bar">
          <div class="filters" role="tablist">
            ${FILTERS.map(function (x) {
              return html`<button key=${x[0]} aria-pressed=${filter === x[0]} onClick=${function () { setFilter(x[0]); }}>${t(x[1])} <span class="count">${fmt(counts[x[0]])}</span></button>`;
            })}
          </div>
          <div class="filters" role="tablist">
            <button aria-pressed=${colFilter === "all"} onClick=${function () { setColFilter("all"); }}>${t("drilldown.colFilterAll")}</button>
            <button aria-pressed=${colFilter === "diff"} onClick=${function () { setColFilter("diff"); }}>${t("drilldown.colFilterDiff")}</button>
          </div>
        </div>
        <div class="drilldown__rows">
          ${shown.length === 0
            ? html`<div class="render-note"><div>${t("detail.none")}</div></div>`
            : shown.map(function (row) { return html`<${DetailRow} key=${row.key} result=${r} row=${row} byteMode=${byteMode} aEncoding=${pair.aEncoding} bEncoding=${pair.bEncoding} colFilter=${colFilter} />`; })}
          ${filtered.length > RENDER_CAP
            ? html`<div class="render-note" style=${{ marginTop: "8px" }}><div>${rich(t("detail.renderNote", { cap: fmt(RENDER_CAP), rest: fmt(filtered.length - RENDER_CAP) }))}</div></div>`
            : null}
        </div>
      </div>`;
  }

  // ── 전체 판정 배너 ──
  function BatchVerdict(props) {
    var t = useT(); var batch = props.batch; var s = batch.summary; var pass = s.verdict === "PASS";
    var totalDiff = s.agg.mismatched + s.agg.onlyAsIs + s.agg.onlyToBe;
    var failed = batch.pairs.filter(function (p) { return p.result.verdict === "FAIL"; }).map(function (p) { return p.name; });
    var reason = pass
      ? rich(t("batchVerdict.passReason", { n: fmt(s.tables) }))
      : html`
          ${rich(t("batchVerdict.failReason", { n: fmt(s.failed), m: fmt(totalDiff) }))}
          ${failed.length ? html`<div class="small" style=${{ marginTop: "6px" }}>${t("batchVerdict.failTablesLabel")} ${failed.map(function (n) { return html`<span key=${n} class="chip" style=${{ marginLeft: "2px" }}>${n}</span>`; })}</div>` : null}`;
    return html`
      <div class=${"verdict " + (pass ? "verdict--pass" : "verdict--fail")} role="status" aria-label=${pass ? "Pass" : "Fail"}>
        <div class="verdict__badge">${pass ? ICON_PASS : ICON_FAIL} ${pass ? "Pass" : "Fail"}</div>
        <div class="verdict__reason">${reason}</div>
        <div class="verdict__statbar">
          <span class="verdict__stat-item">${t("batchVerdict.metaTables")} <b>${fmt(s.tables)}</b></span>
          <span class="verdict__stat-item">${t("batch.metaPassed")} <b>${fmt(s.passed)}</b></span>
          <span class="verdict__stat-item">${t("batch.metaFailed")} <b>${fmt(s.failed)}</b></span>
          ${s.unmatched ? html`<span class="verdict__stat-item">${t("batch.metaUnmatched")} <b>${fmt(s.unmatched)}</b></span>` : null}
        </div>
      </div>`;
  }

  // ── 집계 메트릭 (전 테이블 합산) ──
  function BatchMetrics(props) {
    var t = useT(); var a = props.batch.summary.agg;
    var cells = [["total", "metrics.total", a.total], ["match", "metrics.matched", a.matched], ["mismatch", "metrics.mismatched", a.mismatched], ["only-a", "metrics.onlyAsIs", a.onlyAsIs], ["only-b", "metrics.onlyToBe", a.onlyToBe]];
    return html`<div class="metrics">${cells.map(function (c) { return html`<div key=${c[0]} class="metric" data-kind=${c[0]} data-value=${c[2]}><div class="metric__num">${fmt(c[2])}</div><div class="metric__label">${t(c[1])}</div></div>`; })}</div>`;
  }

  // 펼침/닫힘으로 페이지 길이가 변할 때, 클릭한 행이 같은 viewport 위치에 머무르게
  // 잡아두는 헬퍼. 두 번 rAF로 React 재렌더 + 레이아웃 완료를 기다린 뒤 delta만큼 보정.
  function anchorScroll(el, mutate) {
    if (!el) { mutate(); return; }
    var before = el.getBoundingClientRect().top;
    mutate();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var after = el.getBoundingClientRect().top;
        var delta = after - before;
        if (delta) window.scrollBy(0, delta);
      });
    });
  }

  // ── 정렬 테이블 (한 테이블 = 한 행, 클릭 시 인라인 드릴다운) ──
  function BatchTable(props) {
    var t = useT();
    var rows = props.rows, byteMode = props.byteMode, sortKey = props.sortKey, sortDir = props.sortDir, onSort = props.onSort;
    var op = useState(null); var openName = op[0], setOpenName = op[1];
    if (!rows.length) return html`<div class="render-note"><div>${t("board.noTables")}</div></div>`;
    function aria(k) { return sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : undefined; }
    function th(k, label, num, title) {
      return html`<th class=${num ? "num" : null} aria-sort=${aria(k)} data-sortable="1" data-tip=${title} onClick=${function () { onSort(k); }}><span>${label}</span></th>`;
    }
    return html`
      <table class="batch-table" role="grid">
        <thead><tr>
          ${th("name", "Table", false, t("th.table"))}
          <th data-tip=${t("th.result")}>Result</th>
          ${th("match", "Match", true, t("th.match"))}
          ${th("mismatch", "Mismatch", true, t("th.mismatch"))}
          ${th("miss", "Miss", true, t("th.miss"))}
          ${th("extra", "Extra", true, t("th.extra"))}
          ${th("cols", "Col", true, t("th.cols"))}
          ${th("diffCols", "Diff", true, t("th.delta"))}
          ${th("aCount", "As-Is", true, t("th.aCount"))}
          ${th("bCount", "To-Be", true, t("th.bCount"))}
          <th data-tip=${t("th.excluded")}>Excluded</th>
        </tr></thead>
        <tbody>
          ${rows.map(function (p) {
            var pass = p.verdict === "PASS";
            var expandable = !p.configError;
            var open = openName === p.name;
            return html`<${Fragment} key=${p.name}>
              <tr data-state=${pass ? "match" : "mismatch"} data-open=${open ? "true" : "false"}
                  data-row-name=${p.name}
                  aria-expanded=${expandable ? (open ? "true" : "false") : null}
                  class=${expandable ? "batch-table__row batch-table__row--expandable" : "batch-table__row"}
                  onClick=${expandable ? function (e) { anchorScroll(e.currentTarget, function () { setOpenName(open ? null : p.name); }); } : null}>
                <td class="cell-name">${expandable ? html`<span class="batch-table__chev" aria-hidden="true">${open ? "▾" : "▸"}</span>` : null}<span class="mono">${p.name}</span></td>
                <td class="cell-badge"><span class="badge ${pass ? "badge--match" : "badge--mismatch"}">${pass ? "Pass" : "Fail"}</span></td>
                <td class="num cell-match" data-zero=${p.match === 0 ? "1" : "0"}>${fmt(p.match)}</td>
                <td class="num cell-mismatch" data-zero=${p.mismatch === 0 ? "1" : "0"}>${fmt(p.mismatch)}</td>
                <td class="num cell-miss" data-zero=${p.miss === 0 ? "1" : "0"}>${fmt(p.miss)}</td>
                <td class="num cell-extra" data-zero=${p.extra === 0 ? "1" : "0"}>${fmt(p.extra)}</td>
                <td class="num">${p.configError ? "—" : fmt(p.cols)}</td>
                <td class="num cell-delta" data-zero=${p.diffCols === 0 ? "1" : "0"}>${p.configError ? "—" : fmt(p.diffCols)}</td>
                <td class="num">${fmt(p.aCount)}</td>
                <td class="num">${fmt(p.bCount)}</td>
                <td class="cell-excl" data-empty=${p.excluded.length === 0 ? "1" : "0"}>
                  ${p.configError
                    ? html`<span class="excl-empty" title=${p.configError === "noCommon" ? t("err.noCommon") : t("err.noInspect")}>⚠</span>`
                    : (p.excluded.length === 0 ? html`<span class="excl-empty">—</span>` : html`<span class="excl-chips">${p.excluded.map(function (c) { return html`<span key=${c} class="chip">${c}</span>`; })}</span>`)}
                </td>
              </tr>
              ${open && expandable ? html`<tr class="batch-table__drilldown" data-state=${pass ? "match" : "mismatch"}><td colSpan="11"><div class="batch-table__drilldown-inner"><${Drilldown} pair=${p.pair} byteMode=${byteMode} onClose=${function () { anchorScroll(document.querySelector('tr[data-row-name="' + (window.CSS && CSS.escape ? CSS.escape(p.name) : p.name.replace(/"/g, '\\"')) + '"]'), function () { setOpenName(null); }); }} /></div></td></tr>` : null}
            <//>`;
          })}
        </tbody>
      </table>`;
  }

  // ── 대시보드 보드 (필터 + 정렬 테이블 + 미매칭) ──
  function BatchBoard(props) {
    var t = useT(); var batch = props.batch, byteMode = props.byteMode;
    var fl = useState("all");
    var filter = fl[0], setFilter = fl[1];
    var sk = useState("name"); var sortKey = sk[0], setSortKey = sk[1];
    var sd = useState("asc"); var sortDir = sd[0], setSortDir = sd[1];
    var rows = useMemo(function () {
      return batch.pairs.map(function (p) {
        var r = p.result;
        return {
          name: p.name, verdict: r.verdict, state: r.verdict === "PASS" ? "match" : "mismatch",
          match: r.summary.matched, mismatch: r.summary.mismatched, miss: r.summary.onlyAsIs, extra: r.summary.onlyToBe,
          cols: p.common.length, diffCols: (r.diffColumns || []).length, aCount: p.aCount, bCount: p.bCount,
          excluded: r.excludedCols || [], configError: r.configError, pair: p
        };
      });
    }, [batch]);
    var counts = { all: rows.length, match: rows.filter(function (r) { return r.state === "match"; }).length, problems: rows.filter(function (r) { return r.state !== "match"; }).length };
    var filtered = useMemo(function () {
      var rs = rows;
      if (filter === "problems") rs = rs.filter(function (r) { return r.state !== "match"; });
      else if (filter === "match") rs = rs.filter(function (r) { return r.state === "match"; });
      return rs.slice().sort(function (a, b) {
        var av = a[sortKey], bv = b[sortKey];
        var cmp = typeof av === "string" ? String(av).localeCompare(bv) : av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }, [rows, filter, sortKey, sortDir]);
    function toggleSort(k) { if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); } }
    var FILTERS = [["all", "board.filterAll"], ["problems", "board.filterFail"], ["match", "board.filterPass"]];
    var unmatched = batch.onlyAsIs.length + batch.onlyToBe.length;
    return html`
      <div class="card">
        <h3 class="card__title">${t("dash.title")}</h3>
        <p class="card__subtitle small">${rich(t("dash.subtitle", { n: batch.pairs.length }))}</p>
        <div class="filters" role="tablist">
          ${FILTERS.map(function (x) { return html`<button key=${x[0]} aria-pressed=${filter === x[0]} onClick=${function () { setFilter(x[0]); }}>${t(x[1])} <span class="count">${fmt(counts[x[0]])}</span></button>`; })}
        </div>
        <div class="batch-board">
          <${BatchTable} rows=${filtered} byteMode=${byteMode} sortKey=${sortKey} sortDir=${sortDir} onSort=${toggleSort} />
          ${unmatched
            ? html`<div class="batch-board__unpaired">
                ${batch.onlyAsIs.length ? html`<div class="warn"><div>${rich(t("board.unpairedAsIs", { n: batch.onlyAsIs.length }))}<span class="small">${batch.onlyAsIs.join(", ")}</span></div></div>` : null}
                ${batch.onlyToBe.length ? html`<div class="warn"><div>${rich(t("board.unpairedToBe", { n: batch.onlyToBe.length }))}<span class="small">${batch.onlyToBe.join(", ")}</span></div></div>` : null}
              </div>`
            : null}
        </div>
      </div>`;
  }

  // ── CSV 내보내기 (영어 enum/키 고정 — 다운스트림 툴링 호환) ──
  // 본문: key / status / diff_columns + 검사 칼럼마다 `COL[As-Is]`, `COL[To-Be]` 두 열로
  // 실제 값을 노출 → Excel에서 한 줄로 전체 칼럼 값과 차이를 동시에 확인.
  function exportPairCsv(r, filename) {
    var meta = [
      ["verdict", r.verdict], ["total", r.summary.total], ["matched", r.summary.matched], ["mismatched", r.summary.mismatched],
      ["missing_in_tobe", r.summary.onlyAsIs], ["extra_in_tobe", r.summary.onlyToBe],
      ["pk", (r.pk || []).join(C.DIFF_SEP)], ["inspected_columns", r.inspectedCols.join(C.DIFF_SEP)], ["excluded_columns", r.excludedCols.join(C.DIFF_SEP)],
      ["dupe_keys_as_is", r.dupesAsIs.join(C.DIFF_SEP)], ["dupe_keys_to_be", r.dupesToBe.join(C.DIFF_SEP)]
    ];
    var inspected = r.inspectedCols;
    var headers = ["key", "status", "diff_columns"];
    inspected.forEach(function (c) { headers.push(c + "[As-Is]", c + "[To-Be]"); });
    var rows = r.rows.map(function (row) {
      var aRow = r.asIsIndex.get(row.key), bRow = r.toBeIndex.get(row.key);
      var rec = { key: row.key, status: row.status, diff_columns: row.diffCols.join(C.DIFF_SEP) };
      inspected.forEach(function (c) {
        rec[c + "[As-Is]"] = aRow && aRow[c] != null ? String(aRow[c]) : "";
        rec[c + "[To-Be]"] = bRow && bRow[c] != null ? String(bRow[c]) : "";
      });
      return rec;
    });
    download(Papa.unparse(meta, { header: false }) + "\r\n\r\n" + Papa.unparse(rows, { columns: headers }), filename);
  }
  // 실무자가 Excel/메모장에서 한눈에 읽도록 설계한 사람-친화 리포트(3 섹션 · 언어 따름):
  //   1) 상단 요약(생성일시·전체 판정·누적 레코드)  2) 짝 없는 파일  3) 테이블별 결과(테이블명 맨 왼쪽)
  function exportBatchCsv(t, batch, filename) {
    var s = batch.summary;
    function fmtTs() {
      var d = new Date(); function p(n) { return String(n).padStart(2, "0"); }
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    var verdictLabel = s.verdict === "PASS" ? "Pass" : "Fail";
    var verdictSummary = verdictLabel + " — " +
      t("batchVerdict.metaTables") + " " + s.tables +
      " (" + t("batch.metaPassed") + " " + s.passed +
      " · " + t("batch.metaFailed") + " " + s.failed +
      (s.unmatched ? " · " + t("batch.metaUnmatched") + " " + s.unmatched : "") + ")";
    var rowsSummary = s.agg.total +
      " (" + t("metrics.matched") + " " + s.agg.matched +
      " · " + t("metrics.mismatched") + " " + s.agg.mismatched +
      " · " + t("metrics.onlyAsIs") + " " + s.agg.onlyAsIs +
      " · " + t("metrics.onlyToBe") + " " + s.agg.onlyToBe + ")";

    // 섹션 1 — 요약
    var sections = [
      [t("csv.title")],
      [""],
      [t("csv.generatedAt"), fmtTs()],
      [t("csv.verdictLabel"), verdictSummary],
      [t("csv.rowsLabel"), rowsSummary]
    ];

    // 섹션 2 — 짝 없는 파일 (있을 때만)
    var unmatchedRows = [].concat(
      batch.onlyAsIs.map(function (n) { return [n, t("metrics.onlyAsIs")]; }),
      batch.onlyToBe.map(function (n) { return [n, t("metrics.onlyToBe")]; })
    );
    if (unmatchedRows.length) {
      sections.push([""], [t("csv.unmatchedSection")], [t("csv.fileColumn"), t("csv.sideColumn")]);
      unmatchedRows.forEach(function (r) { sections.push(r); });
    }

    // 섹션 3 — 테이블별 결과 (테이블명 맨 왼쪽)
    sections.push([""], [t("csv.tablesSection")], [
      t("csv.colTable"), t("csv.colVerdict"),
      t("csv.colTotal"), t("csv.colMatch"), t("csv.colMismatch"), t("csv.colMiss"), t("csv.colExtra"),
      t("csv.colCols"), t("csv.colDiffCols"), t("csv.colDiffList"),
      t("csv.colPk"), t("csv.colExcluded"),
      t("csv.colACount"), t("csv.colBCount")
    ]);
    // 실패가 먼저, 그 안에서는 알파벳 순 — 실무자가 위에서부터 문제 테이블을 바로 확인.
    var orderedPairs = batch.pairs.slice().sort(function (a, b) {
      var fa = a.result.verdict === "FAIL" ? 0 : 1, fb = b.result.verdict === "FAIL" ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    orderedPairs.forEach(function (p) {
      var r = p.result;
      sections.push([
        p.name, r.verdict === "PASS" ? "Pass" : "Fail",
        r.summary.total, r.summary.matched, r.summary.mismatched, r.summary.onlyAsIs, r.summary.onlyToBe,
        p.common.length, (r.diffColumns || []).length, (r.diffColumns || []).join(" | "),
        (r.pk || []).join(" | "), (r.excludedCols || []).join(" | "),
        p.aCount, p.bCount
      ]);
    });

    download(Papa.unparse(sections, { header: false }), filename);
  }

  // ── 배치 계산 (순수) ──
  function computeBatch(aFiles, bFiles, overrides, byteMode) {
    var aMap = {}, bMap = {};
    aFiles.forEach(function (f) { if (!(f.fileName in aMap)) aMap[f.fileName] = f; });
    bFiles.forEach(function (f) { if (!(f.fileName in bMap)) bMap[f.fileName] = f; });
    var p = C.pairByName(aFiles.map(function (f) { return f.fileName; }), bFiles.map(function (f) { return f.fileName; }));
    var pairs = p.pairs.map(function (name) {
      var a = aMap[name], b = bMap[name];
      var common = C.commonColumns(a.columns, b.columns);
      var ov = overrides[name] || {};
      var keyCols = (ov.pk && ov.pk.length) ? ov.pk.filter(function (c) { return common.indexOf(c) >= 0; }) : C.autoKey(a.rows, common);
      if (!keyCols.length && common.length) keyCols = common.slice(0, 1);
      var excludedSet = ov.excluded || new Set();
      var inspect = common.filter(function (c) { return keyCols.indexOf(c) < 0 && !excludedSet.has(c); });
      var excludedCols = common.filter(function (c) { return keyCols.indexOf(c) < 0 && excludedSet.has(c); });
      // PK 칼럼은 매칭 키로 그대로 사용. 나머지 셀은 원본 바이트를 무조건 hex로 변환해 비교.
      var pkSet = {}; keyCols.forEach(function (c) { pkSet[c] = true; });
      var aRows = a.rows.map(function (r) { return hexifyRow(r, pkSet); });
      var bRows = b.rows.map(function (r) { return hexifyRow(r, pkSet); });
      var result;
      if (common.length === 0 || inspect.length === 0) {
        result = {
          verdict: "FAIL", summary: { total: 0, matched: 0, mismatched: 0, onlyAsIs: 0, onlyToBe: 0 },
          reasons: { VALUE_MISMATCH: 0, MISSING_IN_TOBE: 0, EXTRA_IN_TOBE: 0 }, rows: [], diffColumns: [], dupesAsIs: [], dupesToBe: [],
          inspectedCols: inspect, excludedCols: excludedCols, pk: keyCols, asIsIndex: new Map(), toBeIndex: new Map(),
          configError: common.length === 0 ? "noCommon" : "noInspect"
        };
      } else {
        result = C.compareData({ asIsRows: aRows, toBeRows: bRows, pk: keyCols, inspectCols: inspect, excludedCols: excludedCols });
      }
      return { name: name, common: common, result: result, aCount: (aRows || []).length, bCount: (bRows || []).length, aEncoding: a.encoding, bEncoding: b.encoding };
    });
    var summary = C.batchVerdict(pairs.map(function (x) { return x.result; }), p.onlyAsIs.length + p.onlyToBe.length);
    return { pairs: pairs, onlyAsIs: p.onlyAsIs, onlyToBe: p.onlyToBe, summary: summary };
  }

  // ── 최상위 ──
  function App() {
    var sLang = useState(function () { return I.detectLang(); });
    var sA = useState([]), sB = useState([]);
    var sXF = useState(function () { return new Set(); });
    var sRan = useState(false);
    var lang = sLang[0], setLang = sLang[1];
    var aFiles = sA[0], setAFiles = sA[1];
    var bFiles = sB[0], setBFiles = sB[1];
    // diff 표시는 항상 바이트(hex 페어) 단위 — 셀 hex는 항상 짝수 길이고
    // byte-faithful 검증에 맞는 자연 단위. (이전엔 문자 단위 옵션을 두었으나 제거.)
    var byteMode = true;
    var excludedFiles = sXF[0], setExcludedFiles = sXF[1];
    var ran = sRan[0], setRan = sRan[1];

    var t = useMemo(function () { return I.makeT(lang); }, [lang]);

    var activeA = useMemo(function () { return aFiles.filter(function (f) { return !excludedFiles.has(f.fileName); }); }, [aFiles, excludedFiles]);
    var activeB = useMemo(function () { return bFiles.filter(function (f) { return !excludedFiles.has(f.fileName); }); }, [bFiles, excludedFiles]);
    var pairing = useMemo(function () {
      if (!activeA.length || !activeB.length) return null;
      return C.pairByName(activeA.map(function (f) { return f.fileName; }), activeB.map(function (f) { return f.fileName; }));
    }, [activeA, activeB]);
    var batch = useMemo(function () {
      if (!ran || !activeA.length || !activeB.length) return null;
      return computeBatch(activeA, activeB, {}, byteMode);
    }, [ran, activeA, activeB, byteMode]);

    function pick(setter, fileList) { setRan(false); setExcludedFiles(new Set()); parseFiles(fileList, function (arr) { setter(arr); }); }
    function toggleFile(name) { var nx = new Set(excludedFiles); if (nx.has(name)) nx.delete(name); else nx.add(name); setExcludedFiles(nx); setRan(false); }
    function run() { if (!pairing || !pairing.pairs.length) return; setRan(true); window.scrollTo(0, 0); }
    function reset() { setAFiles([]); setBFiles([]); setExcludedFiles(new Set()); setRan(false); }

    var header = html`
      <div class="app__header">
        <div class="app__headtext">
          <h1 class="app__title">${t("app.title")}</h1>
        </div>
        <label class="langselect">
          <span>${t("lang.label")}</span>
          <select value=${lang} onChange=${function (e) { setLang(e.target.value); }}>
            ${I.LANG_ORDER.map(function (code) { return html`<option key=${code} value=${code}>${I.LANG_NAMES[code]}</option>`; })}
          </select>
        </label>
      </div>`;

    var view;
    if (batch) {
      view = html`
        <div class="app">
          ${header}
          <div class="btnrow" style=${{ marginBottom: "16px" }}>
            <button class="btn btn--secondary" onClick=${function () { reset(); window.scrollTo(0, 0); }}>${t("restart.button")}</button>
            <button class="btn" onClick=${function () { exportBatchCsv(t, batch, "batch_summary_" + ts() + ".csv"); }}>${t("export.batchButton")}</button>
          </div>
          <${BatchVerdict} batch=${batch} />
          <${BatchMetrics} batch=${batch} />
          <${BatchBoard} batch=${batch} byteMode=${byteMode} />
        </div>`;
    } else {
      var canRun = pairing && pairing.pairs.length > 0;
      view = html`
        <div class="app">
          ${header}
          <div class="card">
            <h3 class="card__title">${t("screenA.title")}</h3>
            <p class="card__subtitle small">${t("screenA.subtitle")}</p>
            <div class="uploads">
              <${MultiDrop} role=${t("upload.roleAsIs")} subrole=${t("upload.subroleAsIs")} files=${aFiles} onPick=${function (fl) { pick(setAFiles, fl); }} />
              <${MultiDrop} role=${t("upload.roleToBe")} subrole=${t("upload.subroleToBe")} files=${bFiles} onPick=${function (fl) { pick(setBFiles, fl); }} />
            </div>
          </div>
          ${(aFiles.length && bFiles.length) ? html`<${PairingPreview} aFiles=${aFiles} bFiles=${bFiles} excluded=${excludedFiles} onToggle=${toggleFile} />` : null}
          <div class="btnrow">
            <button class="btn" disabled=${!canRun} onClick=${run}>${t("run.batchButton")}</button>
            <button class="btn btn--secondary" onClick=${reset}>${t("reset.button")}</button>
            <span class="small muted" style=${{ marginLeft: "4px" }}>${canRun ? t("pairing.matched", { n: pairing.pairs.length }) : t("run.batchHint")}</span>
          </div>
        </div>`;
    }

    return html`<${I18nCtx.Provider} value=${{ t: t, lang: lang }}>${view}<//>`;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
