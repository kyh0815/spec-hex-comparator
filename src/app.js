/*
 * Hex Comparator — UI (React + htm, 빌드 없음)
 * 다건(배치) 구조: spec-batch-addendum.md. 단건 비교 엔진(core.js)을 쌍마다 호출.
 * 비교/판정 로직은 일절 여기 두지 않는다. 전부 window.HexCore(core.js).
 * UI 문자열은 window.HexI18n(i18n.js) — 표시 전용. CSV 리포트(영어 enum)와 로직은 언어 무관.
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
  function useT() {
    var c = React.useContext(I18nCtx);
    return c ? c.t : function (k) { return k; };
  }

  function fmt(n) { return Number(n).toLocaleString(); }

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
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function baseName(name) { return name.replace(/\.csv$/i, ""); }

  // PapaParse: header + 빈 줄 스킵 + dynamicTyping:false (문자열 그대로 유지)
  function parseFile(file, cb) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: function (res) {
        cb(null, { fileName: file.name, columns: (res.meta && res.meta.fields) || [], rows: res.data || [] });
      },
      error: function (err) { cb(err); }
    });
  }
  // 여러 파일 파싱 (.csv만). 폴더 선택/멀티선택 공통.
  function parseFiles(fileList, cb) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return /\.csv$/i.test(f.name); });
    if (!files.length) { cb([]); return; }
    var out = [], pending = files.length;
    files.forEach(function (f) {
      parseFile(f, function (err, parsed) {
        if (!err && parsed) out.push(parsed);
        if (--pending === 0) cb(out);
      });
    });
  }

  function download(text, filename) {
    var blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var ICON_PASS = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5 L6.5 12 L13 4" /></svg>`;
  var ICON_FAIL = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" /></svg>`;

  // ── 다건 업로드존 (멀티선택 + 폴더 통째 선택 + 드래그) ──
  function MultiDrop(props) {
    var t = useT();
    var role = props.role, subrole = props.subrole, files = props.files, onPick = props.onPick;
    var ov = useState(false); var over = ov[0], setOver = ov[1];
    var fileRef = useRef(null), folderRef = useRef(null);
    useEffect(function () {
      if (folderRef.current) { folderRef.current.setAttribute("webkitdirectory", ""); folderRef.current.setAttribute("directory", ""); }
    }, []);
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
            <div class="colchips">${files.map(function (f) { return html`<span key=${f.fileName} class="chip">${f.fileName}</span>`; })}</div>`
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

  // 페어링 미리보기 — 파일별 포함/제외 토글 (#1). 매칭/짝없음 상태별로 묶어 표시.
  function PairingPreview(props) {
    var t = useT();
    var aFiles = props.aFiles, bFiles = props.bFiles, excluded = props.excluded, onToggle = props.onToggle;
    var aSet = {}, bSet = {};
    aFiles.forEach(function (f) { aSet[f.fileName] = 1; });
    bFiles.forEach(function (f) { bSet[f.fileName] = 1; });
    var matched = [], onlyA = [], onlyB = [];
    aFiles.forEach(function (f) { (bSet[f.fileName] ? matched : onlyA).push(f.fileName); });
    bFiles.forEach(function (f) { if (!aSet[f.fileName]) onlyB.push(f.fileName); });
    function toggleBtn(name) {
      var off = excluded.has(name);
      return html`<button key=${name} class=${"toggle mono " + (off ? "toggle--off" : "toggle--on")}
        onClick=${function () { onToggle(name); }}
        title=${t("pairing.excludeHint")}>${name}</button>`;
    }
    var includedMatched = matched.filter(function (n) { return !excluded.has(n); }).length;
    var includedUnmatched = onlyA.concat(onlyB).filter(function (n) { return !excluded.has(n); }).length;
    return html`
      <div class="card">
        <div class="card__title">${t("pairing.title")}</div>
        <p class="card__subtitle small">${t("pairing.excludeHint")}</p>
        ${matched.length
          ? html`<div class="field">
              <label class="field__label">${t("pairing.matched", { n: includedMatched })}</label>
              <div class="toggles">${matched.map(toggleBtn)}</div>
            </div>`
          : html`<div class="error"><div>${t("pairing.none")}</div></div>`}
        ${(onlyA.length || onlyB.length)
          ? html`<div class="warn" style=${{ marginTop: "12px" }}><div>
              <div class="small">${t("dash.unmatchedTitle", { n: includedUnmatched })}</div>
              ${onlyA.length ? html`<div style=${{ marginTop: "6px" }}><span class="small">${t("pairing.onlyAsIsLabel")}:</span> <span class="toggles" style=${{ display: "inline-flex" }}>${onlyA.map(toggleBtn)}</span></div>` : null}
              ${onlyB.length ? html`<div style=${{ marginTop: "6px" }}><span class="small">${t("pairing.onlyToBeLabel")}:</span> <span class="toggles" style=${{ display: "inline-flex" }}>${onlyB.map(toggleBtn)}</span></div>` : null}
            </div></div>`
          : null}
      </div>`;
  }

  // ── 단건 결과 컴포넌트 (드릴인에서 재사용) ──
  function Verdict(props) {
    var t = useT();
    var r = props.result;
    var pass = r.verdict === "PASS";
    var inspected = r.inspectedCols.length;
    var totalCommon = inspected + r.excludedCols.length;
    var reason = pass
      ? (r.excludedCols.length
          ? html`${rich(t("verdict.passExclReason"))}<div class="small">${t("verdict.passExclNote")}</div>`
          : rich(t("verdict.passReason")))
      : rich(t("verdict.failReason", { m: fmt(r.reasons.VALUE_MISMATCH), a: fmt(r.reasons.MISSING_IN_TOBE), b: fmt(r.reasons.EXTRA_IN_TOBE) }));
    return html`
      <div class=${"verdict " + (pass ? "verdict--pass" : "verdict--fail")} role="status" aria-label=${pass ? "Pass" : "Fail"}>
        <div class="verdict__badge">${pass ? ICON_PASS : ICON_FAIL} ${pass ? "Pass" : "Fail"}</div>
        <div class="verdict__reason">${reason}</div>
        <dl class="verdict__meta">
          <dt>${t("verdict.metaPkLabel")}</dt>
          <dd><span class="mono">${(r.pk || []).join(" · ")}</span></dd>
          <dt>${t("verdict.metaScopeLabel")}</dt>
          <dd>${rich(t("verdict.metaScopeValue", { total: totalCommon, ins: inspected }))}</dd>
          ${r.excludedCols.length > 0
            ? html`<dt>${t("verdict.metaExclLabel")}</dt>
              <dd>${r.excludedCols.map(function (c, i) { return html`<span key=${c}><span class="mono">${c}</span>${i < r.excludedCols.length - 1 ? ", " : ""}</span>`; })}</dd>`
            : null}
        </dl>
      </div>`;
  }

  function Metrics(props) {
    var t = useT();
    var r = props.result;
    var cells = [
      ["total", "metrics.total", r.summary.total], ["match", "metrics.matched", r.summary.matched],
      ["mismatch", "metrics.mismatched", r.summary.mismatched], ["only-a", "metrics.onlyAsIs", r.summary.onlyAsIs],
      ["only-b", "metrics.onlyToBe", r.summary.onlyToBe]
    ];
    var dupeN = r.dupesAsIs.length + r.dupesToBe.length;
    return html`
      <${Fragment}>
        <div class="metrics">
          ${cells.map(function (c) {
            return html`<div key=${c[0]} class="metric" data-kind=${c[0]} data-value=${c[2]}>
              <div class="metric__num">${fmt(c[2])}</div><div class="metric__label">${t(c[1])}</div>
            </div>`;
          })}
        </div>
        ${dupeN > 0
          ? html`<div class="warn"><div>
              ${rich(t("metrics.dupeWarn", { pk: r.pk, n: fmt(dupeN) }))}
              <div class="small" style=${{ marginTop: "2px", opacity: 0.85 }}>${t("metrics.dupeWarnNote")}</div>
              ${r.dupesAsIs.length ? html`<div class="small mono" style=${{ marginTop: "2px" }}>${t("metrics.dupeKeysAsIs")} ${r.dupesAsIs.slice(0, 20).join(", ")}${r.dupesAsIs.length > 20 ? " …" : ""}</div>` : null}
              ${r.dupesToBe.length ? html`<div class="small mono" style=${{ marginTop: "2px" }}>${t("metrics.dupeKeysToBe")} ${r.dupesToBe.slice(0, 20).join(", ")}${r.dupesToBe.length > 20 ? " …" : ""}</div>` : null}
            </div></div>`
          : null}
      <//>`;
  }

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

  // 컬럼별 As-Is vs To-Be. 다르면 불일치 배지+하이라이트, 같으면 평문(일치 row 펼침용).
  function DiffPair(props) {
    var t = useT();
    var col = props.col, aRow = props.aRow, bRow = props.bRow, byteMode = props.byteMode;
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
    return html`
      <div class="diffpair">
        <div class="diffpair__col">
          <span class="mono">${col}</span>
          ${differs ? html`<span class="badge badge--mismatch">${t("badge.mismatch")}</span>` : null}
        </div>
        <div class="diffpair__sides">
          <div class="side"><div class="side__label">${t("side.asIs")}</div><div class="side__val">${aNode}</div></div>
          <div class="side"><div class="side__label">${t("side.toBe")}</div><div class="side__val">${bNode}</div></div>
        </div>
      </div>`;
  }

  function DetailRow(props) {
    var t = useT();
    var r = props.result, row = props.row, byteMode = props.byteMode;
    var ex = useState(false); var open = ex[0], setOpen = ex[1];
    var badge = BADGE[row.status];
    // 양쪽 다 존재(MATCH/MISMATCH)면 펼침 가능 — 일치도 값 확인 가능
    var expandable = row.status === "MATCH" || row.status === "MISMATCH";
    var preview = row.status === "MISMATCH" ? row.diffCols.join(", ")
      : row.status === "ONLY_AS_IS" ? t("detail.previewOnlyAsIs")
      : row.status === "ONLY_TO_BE" ? t("detail.previewOnlyToBe") : "";
    var aRow = r.asIsIndex.get(row.key);
    var bRow = r.toBeIndex.get(row.key);
    var cols = row.status === "MISMATCH" ? row.diffCols : r.inspectedCols;
    return html`
      <div class="detail-row" data-state=${STATE_MAP[row.status]} data-open=${open ? "true" : "false"}>
        <div class=${"detail-row__head" + (expandable ? "" : " detail-row__head--plain")}
          onClick=${expandable ? function () { setOpen(!open); } : null}>
          <span class="detail-row__key">${row.key}</span>
          <span class="badge ${badge.cls}">${t(badge.key)}</span>
          <span class="detail-row__preview">${preview}</span>
        </div>
        ${open && expandable
          ? html`<div class="detail-row__body">
              ${cols.map(function (col) { return html`<${DiffPair} key=${col} col=${col} aRow=${aRow} bRow=${bRow} byteMode=${byteMode} />`; })}
            </div>`
          : null}
      </div>`;
  }

  function Detail(props) {
    var t = useT();
    var r = props.result, byteMode = props.byteMode;
    var fl = useState("all"); var filter = fl[0], setFilter = fl[1]; // 기본 전체 (일치도 노출)
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
    var FILTERS = [["all", "filter.all"], ["match", "filter.match"], ["problems", "filter.problems"]];
    return html`
      <div class="card">
        <h3 class="card__title">${t("detail.title")}</h3>
        <p class="card__subtitle small">${t("detail.subtitle")}</p>
        <div class="filters" role="tablist">
          ${FILTERS.map(function (x) {
            return html`<button key=${x[0]} aria-pressed=${filter === x[0]} onClick=${function () { setFilter(x[0]); }}>
              ${t(x[1])} <span class="count">${fmt(counts[x[0]])}</span>
            </button>`;
          })}
        </div>
        ${shown.length === 0
          ? html`<div class="render-note"><div>${t("detail.none")}</div></div>`
          : shown.map(function (row) { return html`<${DetailRow} key=${row.key} result=${r} row=${row} byteMode=${byteMode} />`; })}
        ${filtered.length > RENDER_CAP
          ? html`<div class="render-note" style=${{ marginTop: "8px" }}><div>${rich(t("detail.renderNote", { cap: fmt(RENDER_CAP), rest: fmt(filtered.length - RENDER_CAP) }))}</div></div>`
          : null}
      </div>`;
  }

  // 단건 CSV (드릴인 내보내기)
  function exportPairCsv(r, filename) {
    var meta = [
      ["verdict", r.verdict], ["total", r.summary.total], ["matched", r.summary.matched],
      ["mismatched", r.summary.mismatched], ["missing_in_tobe", r.summary.onlyAsIs], ["extra_in_tobe", r.summary.onlyToBe],
      ["pk", (r.pk || []).join(C.DIFF_SEP)], ["inspected_columns", r.inspectedCols.join(C.DIFF_SEP)], ["excluded_columns", r.excludedCols.join(C.DIFF_SEP)],
      ["dupe_keys_as_is", r.dupesAsIs.join(C.DIFF_SEP)], ["dupe_keys_to_be", r.dupesToBe.join(C.DIFF_SEP)]
    ];
    var rows = r.rows.map(function (row) { return { key: row.key, status: row.status, diff_columns: row.diffCols.join(C.DIFF_SEP) }; });
    download(Papa.unparse(meta, { header: false }) + "\r\n\r\n" + Papa.unparse(rows, { columns: ["key", "status", "diff_columns"] }), filename);
  }

  // 배치 요약 CSV
  function exportBatchCsv(batch, filename) {
    var s = batch.summary;
    var meta = [
      ["batch_verdict", s.verdict], ["tables", s.tables], ["passed", s.passed], ["failed", s.failed], ["unmatched", s.unmatched],
      ["total_rows", s.agg.total], ["matched_rows", s.agg.matched], ["mismatched_rows", s.agg.mismatched],
      ["missing_in_tobe_rows", s.agg.onlyAsIs], ["extra_in_tobe_rows", s.agg.onlyToBe],
      ["unmatched_as_is", batch.onlyAsIs.join(C.DIFF_SEP)], ["unmatched_to_be", batch.onlyToBe.join(C.DIFF_SEP)]
    ];
    var rows = batch.pairs.map(function (p) {
      var r = p.result;
      return {
        table: p.name, verdict: r.verdict, total: r.summary.total, matched: r.summary.matched, mismatched: r.summary.mismatched,
        missing_in_tobe: r.summary.onlyAsIs, extra_in_tobe: r.summary.onlyToBe, pk: (r.pk || []).join(C.DIFF_SEP), excluded_columns: (r.excludedCols || []).join(C.DIFF_SEP)
      };
    });
    var cols = ["table", "verdict", "total", "matched", "mismatched", "missing_in_tobe", "extra_in_tobe", "pk", "excluded_columns"];
    download(Papa.unparse(meta, { header: false }) + "\r\n\r\n" + Papa.unparse(rows, { columns: cols }), filename);
  }

  // ── 대시보드 (요약) ──
  function dashCounts(t, r) {
    if (r.configError) return r.configError === "noCommon" ? t("err.noCommon") : t("err.noInspect");
    var parts = [t("metrics.matched") + " " + fmt(r.summary.matched), t("metrics.mismatched") + " " + fmt(r.summary.mismatched)];
    if (r.summary.onlyAsIs) parts.push(t("badge.onlyAsIs") + " " + fmt(r.summary.onlyAsIs));
    if (r.summary.onlyToBe) parts.push(t("badge.onlyToBe") + " " + fmt(r.summary.onlyToBe));
    return parts.join(" · ");
  }

  function BatchBanner(props) {
    var t = useT();
    var s = props.batch.summary;
    var pass = s.verdict === "PASS";
    return html`
      <div class=${"verdict " + (pass ? "verdict--pass" : "verdict--fail")} role="status" aria-label=${pass ? "Pass" : "Fail"}>
        <div class="verdict__badge">${pass ? ICON_PASS : ICON_FAIL} ${pass ? "Pass" : "Fail"}</div>
        <div class="verdict__reason">
          ${t("dash.tables", { n: s.tables })} · <b>${t("dash.passed", { n: s.passed })}</b> · <b>${t("dash.failed", { n: s.failed })}</b>${s.unmatched ? html` · <b>${t("dash.unmatched", { n: s.unmatched })}</b>` : null}
        </div>
        <dl class="verdict__meta">
          <dt>${t("metrics.matched")}</dt>
          <dd><span class="mono">${fmt(s.agg.matched)}</span></dd>
          <dt>${t("metrics.mismatched")}</dt>
          <dd><span class="mono">${fmt(s.agg.mismatched)}</span></dd>
        </dl>
      </div>`;
  }

  function Dashboard(props) {
    var t = useT();
    var batch = props.batch, onSelect = props.onSelect;
    var unmatched = batch.onlyAsIs.length + batch.onlyToBe.length;
    return html`
      <div class="card">
        <h3 class="card__title">${t("dash.title")}</h3>
        <p class="card__subtitle small">${t("dash.subtitle")}</p>
        ${batch.pairs.map(function (p) {
          var r = p.result, pass = r.verdict === "PASS";
          var meta = r.configError ? "" : [
            t("dash.cols") + " " + fmt(p.common.length),
            t("dash.diffCols") + " " + fmt((r.diffColumns || []).length),
            "As-Is " + fmt(p.aCount), "To-Be " + fmt(p.bCount),
            (r.excludedCols && r.excludedCols.length) ? t("verdict.metaExclLabel") + " " + r.excludedCols.join(", ") : null
          ].filter(Boolean).join("  ·  ");
          return html`<div key=${p.name} class="detail-row" data-state=${pass ? "match" : "mismatch"} data-open="false">
            <div class="detail-row__head" onClick=${function () { onSelect(p.name); }}>
              <span class="detail-row__key">${p.name}</span>
              <span class="badge ${pass ? "badge--match" : "badge--mismatch"}">${pass ? "Pass" : "Fail"}</span>
              <span class="detail-row__preview">${dashCounts(t, r)}</span>
            </div>
            ${meta ? html`<div class="small muted" style=${{ padding: "0 14px 8px 12px" }}>${meta}</div>` : null}
          </div>`;
        })}
        ${unmatched
          ? html`<div class="warn" style=${{ marginTop: "12px" }}><div>
              <div class="small">${t("dash.unmatchedTitle", { n: unmatched })}</div>
              ${batch.onlyAsIs.length ? html`<div class="small mono">${t("pairing.onlyAsIsLabel")}: ${batch.onlyAsIs.join(", ")}</div>` : null}
              ${batch.onlyToBe.length ? html`<div class="small mono">${t("pairing.onlyToBeLabel")}: ${batch.onlyToBe.join(", ")}</div>` : null}
            </div></div>`
          : null}
      </div>`;
  }

  // 드릴인 테이블별 설정 (override)
  // 드릴인 고급 override — 키 컬럼(자동, 변경 가능) + 검사 제외
  function PairConfig(props) {
    var t = useT();
    var pair = props.pair, onChange = props.onChange;
    var common = pair.common, r = pair.result;
    var keyCols = r.pk || [];
    var keySet = new Set(keyCols);
    var excludedSet = new Set(r.excludedCols);
    function toggleKey(c) {
      var nk = new Set(keySet);
      if (nk.has(c)) { if (nk.size > 1) nk.delete(c); } else nk.add(c); // 최소 1개 키 유지
      var nex = new Set(excludedSet); nex.delete(c);
      onChange({ pk: common.filter(function (x) { return nk.has(x); }), excluded: nex });
    }
    function toggleExcl(c) {
      var nex = new Set(excludedSet); if (nex.has(c)) nex.delete(c); else nex.add(c);
      onChange({ pk: keyCols.slice(), excluded: nex });
    }
    return html`
      <div class="card">
        <div class="card__title">${t("drill.configTitle")}</div>
        <div class="field">
          <label class="field__label">${t("drill.keyLabel")}</label>
          <div class="toggles">
            ${common.map(function (c) {
              var on = keySet.has(c);
              return html`<button key=${c} class=${"toggle mono " + (on ? "toggle--pk" : "toggle--off")} onClick=${function () { toggleKey(c); }}>${c}</button>`;
            })}
          </div>
        </div>
        <div class="field">
          <label class="field__label">${t("config.inspectLabel")}</label>
          <div class="toggles">
            ${common.filter(function (c) { return !keySet.has(c); }).map(function (c) {
              var on = !excludedSet.has(c);
              return html`<button key=${c} class=${"toggle mono " + (on ? "toggle--on" : "toggle--off")}
                onClick=${function () { toggleExcl(c); }}
                title=${on ? t("config.toggleOnTitle") : t("config.toggleOffTitle")}>${c}</button>`;
            })}
          </div>
        </div>
      </div>`;
  }

  // 쌍별 배치 계산 (순수 — 파일/오버라이드로부터)
  function computeBatch(aFiles, bFiles, overrides, byteMode) {
    var aMap = {}, bMap = {};
    aFiles.forEach(function (f) { if (!(f.fileName in aMap)) aMap[f.fileName] = f; });
    bFiles.forEach(function (f) { if (!(f.fileName in bMap)) bMap[f.fileName] = f; });
    var p = C.pairByName(aFiles.map(function (f) { return f.fileName; }), bFiles.map(function (f) { return f.fileName; }));
    var pairs = p.pairs.map(function (name) {
      var a = aMap[name], b = bMap[name];
      var common = C.commonColumns(a.columns, b.columns);
      var ov = overrides[name] || {};
      // 키: override가 있으면 그 컬럼들, 없으면 자동 도출(단일·복합 자동). (§4 자동 키)
      var keyCols = (ov.pk && ov.pk.length) ? ov.pk.filter(function (c) { return common.indexOf(c) >= 0; }) : C.autoKey(a.rows, common);
      if (!keyCols.length && common.length) keyCols = common.slice(0, 1);
      var excludedSet = ov.excluded || new Set();
      var inspect = common.filter(function (c) { return keyCols.indexOf(c) < 0 && !excludedSet.has(c); });
      var excludedCols = common.filter(function (c) { return keyCols.indexOf(c) < 0 && excludedSet.has(c); });
      var result;
      if (common.length === 0 || inspect.length === 0) {
        result = {
          verdict: "FAIL", summary: { total: 0, matched: 0, mismatched: 0, onlyAsIs: 0, onlyToBe: 0 },
          reasons: { VALUE_MISMATCH: 0, MISSING_IN_TOBE: 0, EXTRA_IN_TOBE: 0 }, rows: [], dupesAsIs: [], dupesToBe: [],
          inspectedCols: inspect, excludedCols: excludedCols, pk: keyCols, asIsIndex: new Map(), toBeIndex: new Map(),
          configError: common.length === 0 ? "noCommon" : "noInspect"
        };
      } else {
        result = C.compareData({ asIsRows: a.rows, toBeRows: b.rows, pk: keyCols, inspectCols: inspect, excludedCols: excludedCols });
      }
      return { name: name, common: common, result: result, aCount: (a.rows || []).length, bCount: (b.rows || []).length };
    });
    var summary = C.batchVerdict(pairs.map(function (x) { return x.result; }), p.onlyAsIs.length + p.onlyToBe.length);
    return { pairs: pairs, onlyAsIs: p.onlyAsIs, onlyToBe: p.onlyToBe, summary: summary };
  }

  // ── 최상위 ──
  function App() {
    var sLang = useState(function () { return I.detectLang(); });
    var sA = useState([]), sB = useState([]);
    var sByte = useState(false);
    var sOv = useState({});            // overrides: name -> {pk, excluded:Set}
    var sXF = useState(function () { return new Set(); }); // 제외된 파일명 (#1)
    var sRan = useState(false);
    var sSel = useState(null);         // 드릴인 선택 테이블명
    var lang = sLang[0], setLang = sLang[1];
    var aFiles = sA[0], setAFiles = sA[1];
    var bFiles = sB[0], setBFiles = sB[1];
    var byteMode = sByte[0], setByteMode = sByte[1];
    var overrides = sOv[0], setOverrides = sOv[1];
    var excludedFiles = sXF[0], setExcludedFiles = sXF[1];
    var ran = sRan[0], setRan = sRan[1];
    var selected = sSel[0], setSelected = sSel[1];

    var t = useMemo(function () { return I.makeT(lang); }, [lang]);

    // 제외 파일 반영한 활성 목록
    var activeA = useMemo(function () { return aFiles.filter(function (f) { return !excludedFiles.has(f.fileName); }); }, [aFiles, excludedFiles]);
    var activeB = useMemo(function () { return bFiles.filter(function (f) { return !excludedFiles.has(f.fileName); }); }, [bFiles, excludedFiles]);

    var pairing = useMemo(function () {
      if (!activeA.length || !activeB.length) return null;
      return C.pairByName(activeA.map(function (f) { return f.fileName; }), activeB.map(function (f) { return f.fileName; }));
    }, [activeA, activeB]);

    var batch = useMemo(function () {
      if (!ran || !activeA.length || !activeB.length) return null;
      return computeBatch(activeA, activeB, overrides, byteMode);
    }, [ran, activeA, activeB, overrides, byteMode]);

    function pick(setter, fileList) {
      setRan(false); setSelected(null); setExcludedFiles(new Set());
      parseFiles(fileList, function (arr) { setter(arr); });
    }
    function toggleFile(name) {
      var nx = new Set(excludedFiles);
      if (nx.has(name)) nx.delete(name); else nx.add(name);
      setExcludedFiles(nx); setRan(false); setSelected(null);
    }
    function run() {
      if (!pairing || !pairing.pairs.length) return;
      setSelected(null); setRan(true); window.scrollTo(0, 0);
    }
    function reset() {
      setAFiles([]); setBFiles([]); setOverrides({}); setExcludedFiles(new Set()); setByteMode(false); setRan(false); setSelected(null);
    }
    function setOverrideFor(name, ov) {
      var next = {}; for (var k in overrides) next[k] = overrides[k];
      next[name] = ov; setOverrides(next);
    }

    var header = html`
      <div class="app__header">
        <div class="app__headtext">
          <h1 class="app__title">${t("app.title")}</h1>
          <p class="app__subtitle">${rich(t("app.subtitle"))}</p>
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
      // 쌍이 1개 + 미매칭 없음 → 바로 드릴인
      var sel = selected;
      if (sel == null && batch.pairs.length === 1 && !batch.onlyAsIs.length && !batch.onlyToBe.length) sel = batch.pairs[0].name;
      var drill = sel != null ? batch.pairs.filter(function (p) { return p.name === sel; })[0] : null;

      if (drill) {
        var r = drill.result;
        var fileBack = function () { setSelected(null); window.scrollTo(0, 0); };
        view = html`
          <div class="app">
            ${header}
            <div class="btnrow" style=${{ marginBottom: "16px" }}>
              <button class="btn btn--secondary" onClick=${fileBack}>${t("nav.backToList")}</button>
              <span class="small muted">${t("dash.colTable")}: <span class="mono">${drill.name}</span></span>
            </div>
            ${r.configError
              ? html`<div class="error"><div>${r.configError === "noCommon" ? t("err.noCommon") : t("err.noInspect")}</div></div>`
              : html`
                <${Verdict} result=${r} />
                <${Metrics} result=${r} />
                <${Detail} result=${r} byteMode=${byteMode} />`}
            <${PairConfig} pair=${drill} onChange=${function (ov) { setOverrideFor(drill.name, ov); }} />
            <div class="card">
              <div class="btnrow">
                <button class="btn" disabled=${!!r.configError} onClick=${function () { exportPairCsv(r, "compare_" + baseName(drill.name) + "_" + ts() + ".csv"); }}>${t("export.button")}</button>
                <button class="btn btn--secondary" onClick=${fileBack}>${t("nav.backToList")}</button>
              </div>
            </div>
          </div>`;
      } else {
        view = html`
          <div class="app">
            ${header}
            <div class="btnrow" style=${{ marginBottom: "16px" }}>
              <button class="btn btn--secondary" onClick=${function () { reset(); window.scrollTo(0, 0); }}>${t("restart.button")}</button>
              <button class="btn" onClick=${function () { exportBatchCsv(batch, "batch_compare_" + ts() + ".csv"); }}>${t("export.batchButton")}</button>
            </div>
            <${BatchBanner} batch=${batch} />
            <${Dashboard} batch=${batch} onSelect=${function (name) { setSelected(name); window.scrollTo(0, 0); }} />
          </div>`;
      }
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
            <div class="field" style=${{ marginTop: "18px" }}>
              <label class="checkrow">
                <input type="checkbox" checked=${byteMode} onChange=${function (e) { setByteMode(e.target.checked); }} />
                <span>${t("config.byteOption")} <span class="muted small">${t("config.byteOptionHint")}</span></span>
              </label>
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
