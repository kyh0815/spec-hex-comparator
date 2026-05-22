/*
 * Hex Comparator — UI (React + htm, 빌드 없음)
 * 화면 정보/우선순위는 spec §8. 시각 표현은 Claude Design 몫 → 여기서는 중립 마크업 + className 훅만.
 * 비교/판정 로직은 일절 여기 두지 않는다. 전부 window.HexCore(core.js).
 * UI 문자열은 window.HexI18n(i18n.js) — 표시 전용, 로직/CSV 리포트(영어 고정)와 무관.
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
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect;

  var RENDER_CAP = 500; // 화면 목록 렌더 상한 (§5). 전수는 내보내기로.

  // i18n 컨텍스트: 모든 컴포넌트가 t()를 동일 언어로 사용
  var I18nCtx = React.createContext(null);
  function useT() {
    var c = React.useContext(I18nCtx);
    return c ? c.t : function (k) { return k; };
  }

  function fmt(n) { return Number(n).toLocaleString(); }

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

  // ── 화면 A: 업로드 ──
  function FileDrop(props) {
    var t = useT();
    var role = props.role, data = props.data, onFile = props.onFile;
    var over = useState(false);
    var isOver = over[0], setOver = over[1];
    var inputRef = React.useRef(null);

    function pick(files) {
      if (files && files[0]) onFile(files[0]);
    }
    return html`
      <div
        class=${"drop" + (isOver ? " drop--over" : "") + (data ? " drop--loaded" : "")}
        onClick=${function () { inputRef.current && inputRef.current.click(); }}
        onDragOver=${function (e) { e.preventDefault(); setOver(true); }}
        onDragLeave=${function () { setOver(false); }}
        onDrop=${function (e) { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
      >
        <div class="drop__role">${role}</div>
        ${data
          ? html`
            <div class="drop__name mono">${data.fileName}</div>
            <div class="drop__hint">${t("drop.meta", { rows: fmt(data.rows.length), cols: data.columns.length })}</div>
            <div class="colchips">
              ${data.columns.map(function (c, i) { return html`<span key=${i} class="chip mono">${c}</span>`; })}
            </div>`
          : html`<div class="drop__hint">${t("drop.empty")}</div>`}
        <input
          ref=${inputRef}
          type="file"
          accept=".csv,text/csv"
          style=${{ display: "none" }}
          onChange=${function (e) { pick(e.target.files); e.target.value = ""; }}
        />
      </div>`;
  }

  // ── 화면 B: 판정 ──
  function Verdict(props) {
    var t = useT();
    var r = props.result;
    var pass = r.verdict === "PASS";
    var excludedNote = r.excludedCols.length
      ? t("verdict.exclSome", { n: r.excludedCols.length, list: r.excludedCols.join(", ") })
      : t("verdict.exclNone");
    var reasonLine = pass
      ? (r.excludedCols.length ? t("verdict.reasonPassExcl") : t("verdict.reasonPass"))
      : [
          r.reasons.VALUE_MISMATCH ? t("verdict.rsMismatch", { n: fmt(r.reasons.VALUE_MISMATCH) }) : null,
          r.reasons.MISSING_IN_TOBE ? t("verdict.rsMissing", { n: fmt(r.reasons.MISSING_IN_TOBE) }) : null,
          r.reasons.EXTRA_IN_TOBE ? t("verdict.rsExtra", { n: fmt(r.reasons.EXTRA_IN_TOBE) }) : null
        ].filter(Boolean).join(" · ");
    var totalCommon = r.inspectedCols.length + r.excludedCols.length;
    return html`
      <div class=${"verdict " + (pass ? "verdict--pass" : "verdict--fail")}>
        <div class="verdict__badge">${r.verdict}</div>
        <div class="verdict__reason">${reasonLine}</div>
        <div class="verdict__meta">
          ${t("verdict.metaPk")} <span class="mono">${r.pk}</span>
          · ${t("verdict.metaCommonTotal", { total: totalCommon })}
          <strong>${t("verdict.metaInspectedN", { ins: r.inspectedCols.length })}</strong>
          · ${excludedNote}
        </div>
      </div>`;
  }

  // ── 화면 C: 집계 ──
  function Metrics(props) {
    var t = useT();
    var r = props.result;
    var cells = [
      ["metrics.total", r.summary.total],
      ["metrics.matched", r.summary.matched],
      ["metrics.mismatched", r.summary.mismatched],
      ["metrics.onlyAsIs", r.summary.onlyAsIs],
      ["metrics.onlyToBe", r.summary.onlyToBe]
    ];
    var dupes = r.dupesAsIs.length || r.dupesToBe.length;
    return html`
      <div class="card">
        <div class="card__title">${t("metrics.section")}</div>
        <div class="metrics">
          ${cells.map(function (c, i) {
            return html`<div key=${i} class="metric">
              <div class="metric__num">${fmt(c[1])}</div>
              <div class="metric__label">${t(c[0])}</div>
            </div>`;
          })}
        </div>
        ${dupes
          ? html`<div class="warn" style=${{ marginTop: "12px" }}>
              ${t("metrics.dupeWarn")}
              ${r.dupesAsIs.length ? html`<div class="small mono">${t("metrics.dupeAsIs")} ${r.dupesAsIs.slice(0, 20).join(", ")}${r.dupesAsIs.length > 20 ? " …" : ""}</div>` : null}
              ${r.dupesToBe.length ? html`<div class="small mono">${t("metrics.dupeToBe")} ${r.dupesToBe.slice(0, 20).join(", ")}${r.dupesToBe.length > 20 ? " …" : ""}</div>` : null}
            </div>`
          : null}
      </div>`;
  }

  var BADGE = {
    MATCH: { cls: "badge--match", key: "badge.match" },
    MISMATCH: { cls: "badge--mismatch", key: "badge.mismatch" },
    ONLY_AS_IS: { cls: "badge--only", key: "badge.onlyAsIs" },
    ONLY_TO_BE: { cls: "badge--only", key: "badge.onlyToBe" }
  };

  function Units(props) {
    var t = useT();
    var raw = props.raw, units = props.units;
    if (raw === "" || raw === null || raw === undefined) {
      return html`<span class="empty">${t("detail.emptyVal")}</span>`;
    }
    return units.map(function (u, i) {
      var cls = "u" + (u.diff ? (u.residual ? " diff residual" : " diff") : "");
      return html`<span key=${i} class=${cls}>${u.text}</span>`;
    });
  }

  function DiffPair(props) {
    var col = props.col, aRow = props.aRow, bRow = props.bRow, byteMode = props.byteMode;
    var aVal = aRow ? aRow[col] : "";
    var bVal = bRow ? bRow[col] : "";
    var d = C.diffUnits(aVal, bVal, byteMode);
    return html`
      <div class="diffpair">
        <div class="diffpair__col mono">${col}</div>
        <div class="diffpair__sides">
          <div class="side">
            <span class="side__label">As-Is</span>
            <span class="side__val mono"><${Units} raw=${aVal} units=${d.a} /></span>
          </div>
          <div class="side">
            <span class="side__label">To-Be</span>
            <span class="side__val mono"><${Units} raw=${bVal} units=${d.b} /></span>
          </div>
        </div>
      </div>`;
  }

  function DetailRow(props) {
    var t = useT();
    var r = props.result, row = props.row, byteMode = props.byteMode;
    var exp = useState(false);
    var open = exp[0], setOpen = exp[1];
    var badge = BADGE[row.status];
    var expandable = row.status !== "MATCH";
    var preview;
    if (row.status === "MISMATCH") {
      preview = row.diffCols.slice(0, 5).join(", ") + (row.diffCols.length > 5 ? " +" + (row.diffCols.length - 5) : "");
    } else if (row.status === "ONLY_AS_IS") {
      preview = t("detail.previewMissingToBe");
    } else if (row.status === "ONLY_TO_BE") {
      preview = t("detail.previewMissingAsIs");
    } else {
      preview = "";
    }
    var aRow = r.asIsIndex.get(row.key);
    var bRow = r.toBeIndex.get(row.key);
    return html`
      <div class="detail-row">
        <div
          class=${"detail-row__head" + (expandable ? "" : " detail-row__head--plain")}
          onClick=${expandable ? function () { setOpen(!open); } : null}
        >
          ${expandable ? html`<span class="muted">${open ? "▾" : "▸"}</span>` : html`<span class="muted"> </span>`}
          <span class="badge ${badge.cls}">${t(badge.key)}</span>
          <span class="detail-row__key mono">${row.key}</span>
          <span class="detail-row__preview">${preview}</span>
        </div>
        ${open && expandable
          ? html`<div class="detail-row__body">
              ${row.status === "MISMATCH"
                ? row.diffCols.map(function (col) {
                    return html`<${DiffPair} key=${col} col=${col} aRow=${aRow} bRow=${bRow} byteMode=${byteMode} />`;
                  })
                : html`<div class="small">
                    ${row.status === "ONLY_AS_IS" ? t("detail.bodyOnlyAsIs") : t("detail.bodyOnlyToBe")}
                    <div style=${{ marginTop: "8px" }}>
                      ${r.inspectedCols.map(function (col) {
                        var present = aRow || bRow;
                        return html`<div key=${col} class="side">
                          <span class="side__label mono">${col}</span>
                          <span class="side__val mono">${present && present[col] !== "" && present[col] != null ? present[col] : html`<span class="empty">∅</span>`}</span>
                        </div>`;
                      })}
                    </div>
                  </div>`}
            </div>`
          : null}
      </div>`;
  }

  function Detail(props) {
    var t = useT();
    var r = props.result, byteMode = props.byteMode;
    var f = useState("problems");
    var filter = f[0], setFilter = f[1];

    var filtered = useMemo(function () {
      return r.rows.filter(function (row) {
        if (filter === "all") return true;
        if (filter === "match") return row.status === "MATCH";
        return row.status !== "MATCH"; // problems
      });
    }, [r, filter]);

    var shown = filtered.slice(0, RENDER_CAP);
    var FILTERS = [
      ["problems", "filter.problems"],
      ["match", "filter.match"],
      ["all", "filter.all"]
    ];
    return html`
      <div class="card">
        <div class="card__title">${t("detail.section", { n: fmt(filtered.length) })}</div>
        <div class="filters">
          ${FILTERS.map(function (x) {
            return html`<button
              key=${x[0]}
              class=${"toggle" + (filter === x[0] ? " toggle--on" : "")}
              onClick=${function () { setFilter(x[0]); }}
            >${t(x[1])}</button>`;
          })}
        </div>
        ${filtered.length > RENDER_CAP
          ? html`<div class="render-note">${t("detail.renderNote", { total: fmt(filtered.length), cap: fmt(RENDER_CAP) })}</div>`
          : null}
        ${shown.length === 0
          ? html`<div class="muted small">${t("detail.none")}</div>`
          : shown.map(function (row) {
              return html`<${DetailRow} key=${row.key} result=${r} row=${row} byteMode=${byteMode} />`;
            })}
      </div>`;
  }

  // ── 화면 E: 내보내기 (CSV는 영어 enum/키 고정 — 언어 무관, 감사/기계가독성용) ──
  function exportCsv(r) {
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
    // 전수 내보내기 (렌더 상한과 무관)
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
    a.download = "verification-report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── 최상위 ──
  function App() {
    var s = {
      lang: useState(function () { return I.detectLang(); }), // 브라우저 언어 자동감지
      asIs: useState(null),
      toBe: useState(null),
      pk: useState(""),
      excluded: useState(function () { return new Set(); }),
      byteMode: useState(false),
      result: useState(null),
      error: useState("")
    };
    var lang = s.lang[0], setLang = s.lang[1];
    var asIs = s.asIs[0], setAsIs = s.asIs[1];
    var toBe = s.toBe[0], setToBe = s.toBe[1];
    var pk = s.pk[0], setPk = s.pk[1];
    var excluded = s.excluded[0], setExcluded = s.excluded[1];
    var byteMode = s.byteMode[0], setByteMode = s.byteMode[1];
    var result = s.result[0], setResult = s.result[1];
    var error = s.error[0], setError = s.error[1];

    var t = useMemo(function () { return I.makeT(lang); }, [lang]);

    var commonCols = useMemo(function () {
      if (!asIs || !toBe) return [];
      return C.commonColumns(asIs.columns, toBe.columns);
    }, [asIs, toBe]);

    // 공통 컬럼이 바뀌고 현재 PK가 유효하지 않으면 자동 추측
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
      var res = C.compareData({
        asIsRows: asIs.rows,
        toBeRows: toBe.rows,
        pk: pk,
        inspectCols: inspectCols,
        excludedCols: excludedCols
      });
      setResult(res);
      window.scrollTo(0, 0);
    }

    var header = html`
      <div class="app__header">
        <div class="app__headtext">
          <h1 class="app__title">${t("app.title")}</h1>
          <p class="app__subtitle">${t("app.subtitle")}</p>
        </div>
        <label class="langselect">
          <span class="muted small">${t("lang.label")}</span>
          <select value=${lang} onChange=${function (e) { setLang(e.target.value); }}>
            ${I.LANG_ORDER.map(function (code) {
              return html`<option key=${code} value=${code}>${I.LANG_NAMES[code]}</option>`;
            })}
          </select>
        </label>
      </div>`;

    // ── 결과 뷰 ──
    var view;
    if (result) {
      view = html`
        <div class="app">
          ${header}
          <div class="btnrow" style=${{ marginBottom: "16px" }}>
            <button class="btn btn--secondary" onClick=${function () { setResult(null); }}>${t("header.back")}</button>
            <button class="btn" onClick=${function () { exportCsv(result); }}>${t("header.export")}</button>
          </div>
          <${Verdict} result=${result} />
          <${Metrics} result=${result} />
          <${Detail} result=${result} byteMode=${byteMode} />
        </div>`;
    } else {
      // ── 설정 뷰 (화면 A) ──
      var noCommon = asIs && toBe && commonCols.length === 0;
      view = html`
        <div class="app">
          ${header}
          <div class="card">
            <div class="card__title">${t("upload.section")}</div>
            <div class="uploads">
              <${FileDrop} role=${t("upload.roleAsIs")} data=${asIs} onFile=${function (f) { loadFile(setAsIs, f); }} />
              <${FileDrop} role=${t("upload.roleToBe")} data=${toBe} onFile=${function (f) { loadFile(setToBe, f); }} />
            </div>
            ${noCommon
              ? html`<div class="error" style=${{ marginTop: "12px" }}>${t("err.noCommonUpload")}</div>`
              : null}
          </div>

          ${commonCols.length > 0
            ? html`
              <div class="card">
                <div class="card__title">${t("config.section", { n: commonCols.length })}</div>

                <div class="field">
                  <label class="field__label">${t("config.pkLabel")} <span class="mono">${C.guessPk(commonCols)}</span></label>
                  <select value=${pk} onChange=${function (e) { setPk(e.target.value); }}>
                    ${commonCols.map(function (c) { return html`<option key=${c} value=${c}>${c}</option>`; })}
                  </select>
                </div>

                <div class="field">
                  <label class="field__label">${t("config.inspectLabel", { ex: excludedCols.length, ins: inspectCols.length })}</label>
                  <div class="toggles">
                    ${commonCols.map(function (c) {
                      if (c === pk) return html`<span key=${c} class="toggle toggle--pk mono">${c} ${t("config.pkSuffix")}</span>`;
                      var on = !excluded.has(c);
                      return html`<button
                        key=${c}
                        class=${"toggle mono " + (on ? "toggle--on" : "toggle--off")}
                        onClick=${function () { toggleCol(c); }}
                        title=${on ? t("config.toggleOnTitle") : t("config.toggleOffTitle")}
                      >${c}</button>`;
                    })}
                  </div>
                </div>

                <div class="field">
                  <label class="checkrow">
                    <input type="checkbox" checked=${byteMode} onChange=${function (e) { setByteMode(e.target.checked); }} />
                    ${t("config.byteOption")}
                  </label>
                </div>
              </div>`
            : null}

          ${error ? html`<div class="error" style=${{ marginBottom: "16px" }}>${error}</div>` : null}

          <div class="btnrow">
            <button class="btn" disabled=${!asIs || !toBe} onClick=${run}>${t("run.button")}</button>
            ${(!asIs || !toBe) ? html`<span class="muted small">${t("run.hint")}</span>` : null}
          </div>
        </div>`;
    }

    return html`<${I18nCtx.Provider} value=${{ t: t, lang: lang }}>${view}<//>`;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
