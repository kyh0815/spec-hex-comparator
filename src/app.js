/*
 * Hex Comparator — UI (React + htm, 빌드 없음)
 * 마크업/구조는 Claude Design 핸드오프(CLAUDE_CODE.md §4 CSS, prototype/app.jsx) 기준.
 * 비교/판정 로직은 일절 여기 두지 않는다. 전부 window.HexCore(core.js).
 * UI 문자열은 window.HexI18n(i18n.js) — 표시 전용. CSV 리포트(영어 enum)와 로직은 언어 무관.
 * 데이터는 메모리(React state)에만 존재. 서버 전송/스토리지 없음 (§7).
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
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect;

  var RENDER_CAP = 500; // 화면 목록 렌더 상한 (§5). 전수는 내보내기로.

  // i18n 컨텍스트
  var I18nCtx = React.createContext(null);
  function useT() {
    var c = React.useContext(I18nCtx);
    return c ? c.t : function (k) { return k; };
  }

  function fmt(n) { return Number(n).toLocaleString(); }

  // **bold** / `mono` 토큰을 React 노드 배열로 변환 (표시 전용). 보간은 t()에서 이미 끝난 상태.
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

  function makeFilename() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return "compare_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".csv";
  }

  // PapaParse: header + 빈 줄 스킵 + dynamicTyping:false(문자열 그대로 유지) (§3, §5)
  function parseFile(file, cb) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: function (res) {
        cb(null, {
          fileName: file.name,
          columns: (res.meta && res.meta.fields) || [],
          rows: res.data || [],
          parseErrors: res.errors || []
        });
      },
      error: function (err) { cb(err); }
    });
  }

  // ── 화면 A: 업로드존 ──
  function FileDrop(props) {
    var t = useT();
    var role = props.role, subrole = props.subrole, data = props.data, pk = props.pk, onFile = props.onFile;
    var ov = useState(false); var over = ov[0], setOver = ov[1];
    var inputRef = React.useRef(null);
    function pick(files) { if (files && files[0]) onFile(files[0]); }
    var cls = "drop" + (data ? " drop--loaded" : "") + (over && !data ? " drop--over" : "");
    return html`
      <div class=${cls}
        onClick=${function () { inputRef.current && inputRef.current.click(); }}
        onDragOver=${function (e) { e.preventDefault(); setOver(true); }}
        onDragLeave=${function () { setOver(false); }}
        onDrop=${function (e) { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}>
        <div class="drop__role">${role}<span class="muted" style=${{ marginLeft: "6px", fontWeight: 400, fontFamily: "var(--sans)" }}>· ${subrole}</span></div>
        ${data
          ? html`
            <div class="drop__name">${data.fileName}</div>
            <div class="colchips">
              ${data.columns.map(function (c) { return html`<span key=${c} class="chip">${c}${c === pk ? t("chip.pkMark") : ""}</span>`; })}
            </div>
            <div class="drop__hint"><span class="mono">${t("drop.rows", { rows: fmt(data.rows.length), cols: data.columns.length })}</span></div>`
          : (over
            ? html`
              <div class="drop__name" style=${{ fontFamily: "var(--sans)", fontWeight: 500 }}>${t("drop.droppingName")}</div>
              <div class="drop__hint">${t("drop.droppingHint")}</div>`
            : html`
              <div class="drop__name muted" style=${{ fontWeight: 400, fontFamily: "var(--sans)" }}>${t("drop.emptyName")}</div>
              <div class="drop__hint">${t("drop.emptyHint")}</div>`)}
        <input ref=${inputRef} type="file" accept=".csv,text/csv" style=${{ display: "none" }}
          onChange=${function (e) { pick(e.target.files); e.target.value = ""; }} />
      </div>`;
  }

  // ── 화면 B: 판정 ──
  var ICON_PASS = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5 L6.5 12 L13 4" /></svg>`;
  var ICON_FAIL = html`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" /></svg>`;

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
      : rich(t("verdict.failReason", {
          m: fmt(r.reasons.VALUE_MISMATCH),
          a: fmt(r.reasons.MISSING_IN_TOBE),
          b: fmt(r.reasons.EXTRA_IN_TOBE)
        }));
    return html`
      <div class=${"verdict " + (pass ? "verdict--pass" : "verdict--fail")} role="status" aria-label=${pass ? "Pass" : "Fail"}>
        <div class="verdict__badge">${pass ? ICON_PASS : ICON_FAIL} ${pass ? "Pass" : "Fail"}</div>
        <div class="verdict__reason">${reason}</div>
        <dl class="verdict__meta">
          <dt>${t("verdict.metaPkLabel")}</dt>
          <dd><span class="mono">${r.pk}</span></dd>
          <dt>${t("verdict.metaScopeLabel")}</dt>
          <dd>${rich(t("verdict.metaScopeValue", { total: totalCommon, ins: inspected }))}</dd>
          ${r.excludedCols.length > 0
            ? html`
              <dt>${t("verdict.metaExclLabel")}</dt>
              <dd>${r.excludedCols.map(function (c, i) {
                return html`<span key=${c}><span class="mono">${c}</span>${i < r.excludedCols.length - 1 ? ", " : ""}</span>`;
              })}</dd>`
            : null}
        </dl>
      </div>`;
  }

  // ── 화면 C: 집계 ──
  function Metrics(props) {
    var t = useT();
    var r = props.result;
    var cells = [
      ["total", "metrics.total", r.summary.total],
      ["match", "metrics.matched", r.summary.matched],
      ["mismatch", "metrics.mismatched", r.summary.mismatched],
      ["only-a", "metrics.onlyAsIs", r.summary.onlyAsIs],
      ["only-b", "metrics.onlyToBe", r.summary.onlyToBe]
    ];
    var dupeN = r.dupesAsIs.length + r.dupesToBe.length;
    return html`
      <${Fragment}>
        <div class="metrics">
          ${cells.map(function (c) {
            return html`<div key=${c[0]} class="metric" data-kind=${c[0]} data-value=${c[2]}>
              <div class="metric__num">${fmt(c[2])}</div>
              <div class="metric__label">${t(c[1])}</div>
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
    MATCH: { cls: "badge--match", key: "badge.match" },
    MISMATCH: { cls: "badge--mismatch", key: "badge.mismatch" },
    ONLY_AS_IS: { cls: "badge--only", key: "badge.onlyAsIs" },
    ONLY_TO_BE: { cls: "badge--only", key: "badge.onlyToBe" }
  };
  var STATE_MAP = { MATCH: "match", MISMATCH: "mismatch", ONLY_AS_IS: "only-a", ONLY_TO_BE: "only-b" };

  function Units(props) {
    return props.units.map(function (u, i) {
      var cls = "u" + (u.diff ? (u.residual ? " diff residual" : " diff") : "");
      return html`<span key=${i} class=${cls}>${u.text}</span>`;
    });
  }

  // 화면 D: 컬럼별 As-Is vs To-Be diff. 한쪽이 빈 값이면 present 측은 평문, empty 측은 ∅ 박스 (스크린샷 12)
  function DiffPair(props) {
    var t = useT();
    var col = props.col, aRow = props.aRow, bRow = props.bRow, byteMode = props.byteMode;
    var aVal = aRow && aRow[col] != null ? String(aRow[col]) : "";
    var bVal = bRow && bRow[col] != null ? String(bRow[col]) : "";
    var emptyMarker = html`<span class="empty">${t("detail.emptyVal")}</span>`;
    var aNode, bNode;
    if (aVal === "" || bVal === "") {
      aNode = aVal === "" ? emptyMarker : html`<span class="u">${aVal}</span>`;
      bNode = bVal === "" ? emptyMarker : html`<span class="u">${bVal}</span>`;
    } else {
      var d = C.diffUnits(aVal, bVal, byteMode);
      aNode = html`<${Units} units=${d.a} />`;
      bNode = html`<${Units} units=${d.b} />`;
    }
    return html`
      <div class="diffpair">
        <div class="diffpair__col">
          <span class="mono">${col}</span>
          <span class="badge badge--mismatch">${t("badge.mismatch")}</span>
        </div>
        <div class="diffpair__sides">
          <div class="side">
            <div class="side__label">${t("side.asIs")}</div>
            <div class="side__val">${aNode}</div>
          </div>
          <div class="side">
            <div class="side__label">${t("side.toBe")}</div>
            <div class="side__val">${bNode}</div>
          </div>
        </div>
      </div>`;
  }

  function DetailRow(props) {
    var t = useT();
    var r = props.result, row = props.row, byteMode = props.byteMode;
    var ex = useState(false); var open = ex[0], setOpen = ex[1];
    var badge = BADGE[row.status];
    var expandable = row.status === "MISMATCH";
    var preview = row.status === "MISMATCH" ? row.diffCols.join(", ")
      : row.status === "ONLY_AS_IS" ? t("detail.previewOnlyAsIs")
      : row.status === "ONLY_TO_BE" ? t("detail.previewOnlyToBe")
      : "";
    var aRow = r.asIsIndex.get(row.key);
    var bRow = r.toBeIndex.get(row.key);
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
              ${row.diffCols.map(function (col) {
                return html`<${DiffPair} key=${col} col=${col} aRow=${aRow} bRow=${bRow} byteMode=${byteMode} />`;
              })}
            </div>`
          : null}
      </div>`;
  }

  function Detail(props) {
    var t = useT();
    var r = props.result, byteMode = props.byteMode;
    var fl = useState("problems"); var filter = fl[0], setFilter = fl[1];
    var counts = {
      problems: r.summary.mismatched + r.summary.onlyAsIs + r.summary.onlyToBe,
      match: r.summary.matched,
      all: r.summary.total
    };
    var filtered = useMemo(function () {
      return r.rows.filter(function (row) {
        if (filter === "all") return true;
        if (filter === "match") return row.status === "MATCH";
        return row.status !== "MATCH";
      });
    }, [r, filter]);
    var shown = filtered.slice(0, RENDER_CAP);
    var FILTERS = [["problems", "filter.problems"], ["match", "filter.match"], ["all", "filter.all"]];
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

  // ── 화면 E: 내보내기 (CSV는 영어 enum/키 고정 — 언어 무관, 감사/기계가독성용) ──
  function exportCsv(r, filename) {
    var metaPairs = [
      ["verdict", r.verdict],
      ["total", r.summary.total],
      ["matched", r.summary.matched],
      ["mismatched", r.summary.mismatched],
      ["missing_in_tobe", r.summary.onlyAsIs],
      ["extra_in_tobe", r.summary.onlyToBe],
      ["pk", r.pk],
      ["inspected_columns", r.inspectedCols.join(C.DIFF_SEP)],
      ["excluded_columns", r.excludedCols.join(C.DIFF_SEP)],
      ["dupe_keys_as_is", r.dupesAsIs.join(C.DIFF_SEP)],
      ["dupe_keys_to_be", r.dupesToBe.join(C.DIFF_SEP)]
    ];
    var metaCsv = Papa.unparse(metaPairs, { header: false });
    var rowsCsv = Papa.unparse(
      r.rows.map(function (row) {
        return { key: row.key, status: row.status, diff_columns: row.diffCols.join(C.DIFF_SEP) };
      }),
      { columns: ["key", "status", "diff_columns"] }
    );
    var text = metaCsv + "\r\n\r\n" + rowsCsv;
    var blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function ScreenE(props) {
    var t = useT();
    return html`
      <div class="card">
        <h3 class="card__title">${t("screenE.title")}</h3>
        <p class="card__subtitle small">${t("screenE.subtitle")}</p>
        <div class="btnrow">
          <button class="btn" onClick=${props.onExport}>${t("export.button")}</button>
          <button class="btn btn--secondary" onClick=${props.onBack}>${t("back.button")}</button>
          <span class="small muted" style=${{ marginLeft: "6px" }}>${t("export.filenameLabel")} <span class="mono">${props.filename}</span></span>
        </div>
      </div>`;
  }

  // ── 최상위 ──
  function App() {
    var sLang = useState(function () { return I.detectLang(); });
    var sAsIs = useState(null), sToBe = useState(null), sPk = useState("");
    var sExcl = useState(function () { return new Set(); });
    var sByte = useState(false), sRes = useState(null), sErr = useState("");
    var lang = sLang[0], setLang = sLang[1];
    var asIs = sAsIs[0], setAsIs = sAsIs[1];
    var toBe = sToBe[0], setToBe = sToBe[1];
    var pk = sPk[0], setPk = sPk[1];
    var excluded = sExcl[0], setExcluded = sExcl[1];
    var byteMode = sByte[0], setByteMode = sByte[1];
    var result = sRes[0], setResult = sRes[1];
    var error = sErr[0], setError = sErr[1];

    var t = useMemo(function () { return I.makeT(lang); }, [lang]);

    var commonCols = useMemo(function () {
      if (!asIs || !toBe) return [];
      return C.commonColumns(asIs.columns, toBe.columns);
    }, [asIs, toBe]);

    useEffect(function () {
      if (commonCols.length && commonCols.indexOf(pk) === -1) {
        setPk(C.guessPk(commonCols) || "");
      }
    }, [commonCols]); // eslint-disable-line

    var inspectCols = useMemo(function () {
      return commonCols.filter(function (c) { return c !== pk && !excluded.has(c); });
    }, [commonCols, pk, excluded]);
    var excludedCols = useMemo(function () {
      return commonCols.filter(function (c) { return c !== pk && excluded.has(c); });
    }, [commonCols, pk, excluded]);

    var filename = useMemo(function () { return makeFilename(); }, [result]);

    function loadFile(setter, file) {
      setError("");
      parseFile(file, function (err, parsed) {
        if (err) { setError(t("err.parse", { msg: (err.message || err) })); return; }
        setResult(null);
        setter(parsed);
      });
    }
    function toggleCol(col) {
      var next = new Set(excluded);
      if (next.has(col)) next.delete(col); else next.add(col);
      setExcluded(next);
    }
    function validate() {
      if (!asIs || !toBe) return t("err.bothFiles");
      if (commonCols.length === 0) return t("err.noCommon");
      if (!pk || commonCols.indexOf(pk) === -1) return t("err.noPk");
      if (inspectCols.length === 0) return t("err.noInspect");
      return "";
    }
    function run() {
      var err = validate();
      if (err) { setError(err); return; }
      setError("");
      setResult(C.compareData({
        asIsRows: asIs.rows, toBeRows: toBe.rows,
        pk: pk, inspectCols: inspectCols, excludedCols: excludedCols
      }));
      window.scrollTo(0, 0);
    }
    function reset() {
      setAsIs(null); setToBe(null); setPk(""); setExcluded(new Set());
      setByteMode(false); setResult(null); setError("");
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
    if (result) {
      view = html`
        <div class="app">
          ${header}
          <${Verdict} result=${result} />
          <${Metrics} result=${result} />
          <${Detail} result=${result} byteMode=${byteMode} />
          <${ScreenE} result=${result} filename=${filename}
            onExport=${function () { exportCsv(result, filename); }}
            onBack=${function () { setResult(null); }} />
        </div>`;
    } else {
      var noCommon = asIs && toBe && commonCols.length === 0;
      view = html`
        <div class="app">
          ${header}
          <div class="card">
            <h3 class="card__title">${t("screenA.title")}</h3>
            <p class="card__subtitle small">${t("screenA.subtitle")}</p>

            <div class="uploads">
              <${FileDrop} role=${t("upload.roleAsIs")} subrole=${t("upload.subroleAsIs")} data=${asIs} pk=${pk} onFile=${function (f) { loadFile(setAsIs, f); }} />
              <${FileDrop} role=${t("upload.roleToBe")} subrole=${t("upload.subroleToBe")} data=${toBe} pk=${pk} onFile=${function (f) { loadFile(setToBe, f); }} />
            </div>

            ${commonCols.length > 0
              ? html`
                <div class="field">
                  <label class="field__label">${rich(t("config.pkLabel", { guess: C.guessPk(commonCols) }))}</label>
                  <select value=${pk} onChange=${function (e) { setPk(e.target.value); }}>
                    ${commonCols.map(function (c) { return html`<option key=${c} value=${c}>${c}</option>`; })}
                  </select>
                </div>
                <div class="field">
                  <label class="field__label">${t("config.inspectLabel")}</label>
                  <div class="toggles">
                    ${commonCols.map(function (c) {
                      if (c === pk) return html`<button key=${c} class="toggle toggle--pk mono" disabled>${c}</button>`;
                      var on = !excluded.has(c);
                      return html`<button key=${c} class=${"toggle mono " + (on ? "toggle--on" : "toggle--off")}
                        onClick=${function () { toggleCol(c); }}
                        title=${on ? t("config.toggleOnTitle") : t("config.toggleOffTitle")}>${c}</button>`;
                    })}
                  </div>
                </div>
                <div class="field">
                  <label class="checkrow">
                    <input type="checkbox" checked=${byteMode} onChange=${function (e) { setByteMode(e.target.checked); }} />
                    <span>${t("config.byteOption")} <span class="muted small">${t("config.byteOptionHint")}</span></span>
                  </label>
                </div>`
              : null}

            ${noCommon
              ? html`<div class="error" style=${{ marginTop: "16px" }}><div>${t("err.noCommon")}<div class="small muted" style=${{ marginTop: "2px" }}>${t("err.noCommonHint")}</div></div></div>`
              : (error ? html`<div class="error" style=${{ marginTop: "16px" }}><div>${error}</div></div>` : null)}

            <div class="btnrow" style=${{ marginTop: "18px" }}>
              <button class="btn" disabled=${!asIs || !toBe || noCommon} onClick=${run}>${t("run.button")}</button>
              <button class="btn btn--secondary" onClick=${reset}>${t("reset.button")}</button>
              <span class="small muted" style=${{ marginLeft: "4px" }}>${(asIs && toBe && !noCommon) ? t("run.ready") : t("run.hint")}</span>
            </div>
          </div>
        </div>`;
    }

    return html`<${I18nCtx.Provider} value=${{ t: t, lang: lang }}>${view}<//>`;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
