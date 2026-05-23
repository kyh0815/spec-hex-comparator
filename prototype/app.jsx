// app.jsx — Interactive prototype demonstrating all visual states
// of the As-Is/To-Be hex data comparator. Uses the exact className
// contract from spec §4 so the styling can be lifted directly into
// src/styles.css.

const { useState, useMemo } = React;

// ── Fixtures ─────────────────────────────────────────────────────────────
const COLS_A = ["UNIQUE_NUMBER", "FBWI5M", "TXN_AMT", "TXN_DT", "STATUS_CD", "REMARK"];
const COLS_B = ["UNIQUE_NUMBER", "FBWI5M", "TXN_AMT", "TXN_DT", "STATUS_CD", "REMARK"];

const PASS_FIXTURE = {
  total: 4096, match: 4096, mismatch: 0, onlyA: 0, onlyB: 0,
  pk: "UNIQUE_NUMBER", excluded: [], pkDup: false,
  fileA: { name: "asis_20260315_TXN.csv", rows: "4,096 row · 6 col" },
  fileB: { name: "tobe_20260315_TXN.csv", rows: "4,096 row · 6 col" },
};

const PASS_WITH_EXCL_FIXTURE = {
  ...PASS_FIXTURE,
  total: 4096, match: 4096,
  excluded: ["REMARK", "TXN_DT"],
};

const FAIL_FIXTURE = {
  total: 4096, match: 4087, mismatch: 6, onlyA: 2, onlyB: 1,
  pk: "UNIQUE_NUMBER", excluded: ["REMARK"], pkDup: false,
  fileA: { name: "asis_20260315_TXN.csv", rows: "4,098 row · 6 col" },
  fileB: { name: "tobe_20260315_TXN.csv", rows: "4,097 row · 6 col" },
};

const FAIL_PK_DUP_FIXTURE = {
  ...FAIL_FIXTURE,
  pkDup: true, total: 4096, match: 4080, mismatch: 12, onlyA: 3, onlyB: 1,
};

// Detail row data — hex-like long strings to exercise wrapping
const DETAIL_FIXTURES = [
  {
    pk: "TXN-000041", state: "mismatch",
    preview: "TXN_AMT, STATUS_CD",
    diffs: [
      {
        col: "TXN_AMT",
        a: "4A6F686E446F6500000000000000000000000000",
        b: "4A6F686E446F6500000000000000000000000001",
        // simple char-level diff highlights for demo
        aHi: [{ s: 38, e: 40 }],
        bHi: [{ s: 38, e: 40 }],
      },
      {
        col: "STATUS_CD",
        a: "504149440000",
        b: "504F535400FF",
        aHi: [{ s: 2, e: 4 }, { s: 8, e: 12 }],
        bHi: [{ s: 2, e: 4 }, { s: 8, e: 12 }],
      },
    ],
  },
  {
    pk: "TXN-000118", state: "mismatch",
    preview: "FBWI5M (length differs)",
    diffs: [
      {
        col: "FBWI5M",
        a: "1A2B3C4D5E6F7081928374A5B6C7D8E9F0",
        b: "1A2B3C4D5E6F7081928374A5B6C7D8E9F012345678",
        aHi: [],
        bHi: [{ s: 34, e: 42, residual: true }],
      },
    ],
  },
  {
    pk: "TXN-000219", state: "mismatch",
    preview: "REMARK (empty on To-Be)",
    diffs: [
      {
        col: "REMARK",
        a: "EA80B0EC9DBCEBB3B4EBA3A8EC8AB52E",
        b: "",
        empty: "b",
      },
    ],
  },
  {
    pk: "TXN-000402", state: "only-a",
    preview: "row exists only in As-Is",
  },
  {
    pk: "TXN-000891", state: "only-b",
    preview: "row exists only in To-Be",
  },
  {
    pk: "TXN-000004", state: "match",
    preview: "all 6 columns identical",
  },
  {
    pk: "TXN-000005", state: "match",
    preview: "all 6 columns identical",
  },
];

// ── Tiny helpers ─────────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString("ko-KR"); }

function renderHexWithHi(text, ranges) {
  if (!text) return null;
  if (!ranges || !ranges.length) {
    return <span className="u">{text}</span>;
  }
  const sorted = [...ranges].sort((x, y) => x.s - y.s);
  const out = [];
  let cur = 0;
  sorted.forEach((r, i) => {
    if (r.s > cur) out.push(<span className="u" key={`p${i}`}>{text.slice(cur, r.s)}</span>);
    const cls = r.residual ? "u diff residual" : "u diff";
    out.push(<span className={cls} key={`d${i}`}>{text.slice(r.s, r.e)}</span>);
    cur = r.e;
  });
  if (cur < text.length) out.push(<span className="u" key="tail">{text.slice(cur)}</span>);
  return out;
}

// ── Components ───────────────────────────────────────────────────────────

function DropZone({ role, subrole, loaded, over, file, cols, pk }) {
  const cls = ["drop"];
  if (loaded) cls.push("drop--loaded");
  if (over) cls.push("drop--over");
  return (
    <div className={cls.join(" ")}>
      <div className="drop__role">{role}<span className="muted" style={{marginLeft: 6, fontWeight: 400, fontFamily: 'var(--sans)'}}>· {subrole}</span></div>
      {loaded ? (
        <>
          <div className="drop__name">{file.name}</div>
          <div className="colchips">
            {cols.map((c) => (
              <span className="chip" key={c}>{c}{c === pk ? " ·PK" : ""}</span>
            ))}
          </div>
          <div className="drop__hint"><span className="mono">{file.rows}</span></div>
        </>
      ) : over ? (
        <>
          <div className="drop__name" style={{ fontFamily: 'var(--sans)', fontWeight: 500 }}>파일 놓기</div>
          <div className="drop__hint">CSV 파일을 여기에 드롭하세요</div>
        </>
      ) : (
        <>
          <div className="drop__name muted" style={{ fontWeight: 400, fontFamily: 'var(--sans)' }}>
            CSV 파일을 끌어 놓거나 클릭
          </div>
          <div className="drop__hint">
            최대 수천 row까지 처리. 파싱은 브라우저 내에서만 수행됩니다.
          </div>
        </>
      )}
    </div>
  );
}

function ScreenA({ scenario, dropState }) {
  const fixture = scenario === "pass" ? PASS_FIXTURE
                : scenario === "pass-excl" ? PASS_WITH_EXCL_FIXTURE
                : scenario === "fail-pk-dup" ? FAIL_PK_DUP_FIXTURE
                : FAIL_FIXTURE;
  // dropState controls upload-zone presentation: 'both' | 'one' | 'empty' | 'over-a' | 'over-b'
  const loadedA = dropState === "both" || dropState === "one";
  const loadedB = dropState === "both";
  const over = dropState === "over-a" ? "a" : dropState === "over-b" ? "b" : null;
  const [byteDiff, setByteDiff] = useState(false);
  const [pk, setPk] = useState(fixture.pk);
  const [excluded, setExcluded] = useState(fixture.excluded);

  const toggle = (c) => {
    if (c === pk) return;
    setExcluded((e) => e.includes(c) ? e.filter((x) => x !== c) : [...e, c]);
  };

  // demo: simulate drag-over by clicking a fake button
  return (
    <div className="card">
      <h3 className="card__title">파일 업로드 및 검사 설정</h3>
      <p className="card__subtitle small">검사할 As-Is·To-Be CSV 파일을 올리고, PK와 대상 컬럼을 확인하세요.</p>

      <div className="uploads">
        <DropZone
          role="As-Is"
          subrole="메인프레임 원본"
          loaded={loadedA}
          over={over === "a"}
          file={fixture.fileA}
          cols={COLS_A}
          pk={pk}
        />
        <DropZone
          role="To-Be"
          subrole="오픈시스템 적재"
          loaded={loadedB}
          over={over === "b"}
          file={fixture.fileB}
          cols={COLS_B}
          pk={pk}
        />
      </div>

      <div className="field">
        <label className="field__label">PK 컬럼 (자동 추측: <span className="mono">UNIQUE_NUMBER</span>)</label>
        <select value={pk} onChange={(e) => setPk(e.target.value)}>
          {COLS_A.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field__label">검사 대상 컬럼 (클릭해서 제외 토글, PK는 항상 포함)</label>
        <div className="toggles">
          {COLS_A.map((c) => {
            const isPk = c === pk;
            const off = excluded.includes(c);
            const cls = ["toggle"];
            if (isPk) cls.push("toggle--pk");
            else if (off) cls.push("toggle--off");
            else cls.push("toggle--on");
            return (
              <button key={c} className={cls.join(" ")} onClick={() => toggle(c)} disabled={isPk}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label className="checkrow">
          <input type="checkbox" checked={byteDiff} onChange={(e) => setByteDiff(e.target.checked)} />
          <span>바이트 단위로 diff 표시 <span className="muted small">(기본: 문자 단위)</span></span>
        </label>
      </div>

      {scenario === "input-error" && (
        <div className="error" style={{ marginBottom: 14 }}>
          <div>
            검사 가능한 공통 컬럼이 없습니다. 두 파일의 컬럼명을 확인해 주세요.
            <div className="small muted" style={{ marginTop: 2 }}>
              As-Is·To-Be 양쪽에 존재하는 컬럼만 비교 대상으로 잡힙니다.
            </div>
          </div>
        </div>
      )}

      <div className="btnrow">
        <button className="btn" disabled={!loadedA || !loadedB || scenario === "input-error"}>
          비교 실행 및 판정
        </button>
        <button className="btn btn--secondary">초기화</button>
        <span className="small muted" style={{ marginLeft: 4 }}>
          {loadedA && loadedB ? "준비됨 · 두 파일 모두 로드" : "두 파일을 모두 업로드해 주세요"}
        </span>
      </div>
    </div>
  );
}

function ScreenB({ scenario }) {
  const f = scenario === "pass" ? PASS_FIXTURE
          : scenario === "pass-excl" ? PASS_WITH_EXCL_FIXTURE
          : scenario === "fail-pk-dup" ? FAIL_PK_DUP_FIXTURE
          : FAIL_FIXTURE;
  const isPass = f.mismatch === 0 && f.onlyA === 0 && f.onlyB === 0;
  const cls = isPass ? "verdict verdict--pass" : "verdict verdict--fail";

  const inspected = COLS_A.length - f.excluded.length;
  return (
    <div className={cls} role="status" aria-label={isPass ? "PASS — 검증 합격" : "FAIL — 검증 불합격"}>
      <div className="verdict__badge">
        {isPass ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5 L6.5 12 L13 4"/>
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4 L12 12 M12 4 L4 12"/>
          </svg>
        )}
        {isPass ? "Pass" : "Fail"}
      </div>

      <div className="verdict__reason">
        {isPass ? (
          f.excluded.length === 0 ? (
            <>모든 row와 컬럼이 <b>완전 일치</b>합니다.</>
          ) : (
            <>검사 대상 컬럼이 <b>완전 일치</b>합니다.
              <div className="small">제외된 컬럼이 있어 일부 항목은 비교되지 않았습니다.</div>
            </>
          )
        ) : (
          <>
            불일치 <b>{fmt(f.mismatch)}</b>건, As-Is만 존재 <b>{fmt(f.onlyA)}</b>건, To-Be만 존재 <b>{fmt(f.onlyB)}</b>건.
          </>
        )}
      </div>

      <dl className="verdict__meta">
        <dt>PK 컬럼</dt>
        <dd><span className="mono">{f.pk}</span></dd>
        <dt>검사 범위</dt>
        <dd>
          전체 <span className="mono">{COLS_A.length}</span>개 중 <span className="mono">{inspected}</span>개 검사
        </dd>
        {f.excluded.length > 0 && (
          <>
            <dt>제외 컬럼</dt>
            <dd>
              {f.excluded.map((c, i) => (
                <span key={c}>
                  <span className="mono">{c}</span>{i < f.excluded.length - 1 ? ", " : ""}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function ScreenC({ scenario }) {
  const f = scenario === "pass" ? PASS_FIXTURE
          : scenario === "pass-excl" ? PASS_WITH_EXCL_FIXTURE
          : scenario === "fail-pk-dup" ? FAIL_PK_DUP_FIXTURE
          : FAIL_FIXTURE;
  return (
    <>
      <div className="metrics">
        <div className="metric" data-kind="total" data-value={f.total}>
          <div className="metric__num">{fmt(f.total)}</div>
          <div className="metric__label">전체 row</div>
        </div>
        <div className="metric" data-kind="match" data-value={f.match}>
          <div className="metric__num">{fmt(f.match)}</div>
          <div className="metric__label">일치</div>
        </div>
        <div className="metric" data-kind="mismatch" data-value={f.mismatch}>
          <div className="metric__num">{fmt(f.mismatch)}</div>
          <div className="metric__label">불일치</div>
        </div>
        <div className="metric" data-kind="only-a" data-value={f.onlyA}>
          <div className="metric__num">{fmt(f.onlyA)}</div>
          <div className="metric__label">As-Is만 존재</div>
        </div>
        <div className="metric" data-kind="only-b" data-value={f.onlyB}>
          <div className="metric__num">{fmt(f.onlyB)}</div>
          <div className="metric__label">To-Be만 존재</div>
        </div>
      </div>
      {f.pkDup && (
        <div className="warn" style={{ marginBottom: 14 }}>
          <div>
            PK 중복이 감지되었습니다 — <span className="mono">UNIQUE_NUMBER</span> 컬럼에서 중복 키 <b>4건</b>.
            <div className="small" style={{ marginTop: 2, opacity: 0.85 }}>
              중복된 PK는 비교 대상에서 제외되며 결과 정확도에 영향을 줄 수 있습니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ row }) {
  const [open, setOpen] = useState(row.state === "mismatch" && row.pk === "TXN-000041");

  const badge = row.state === "match" ? <span className="badge badge--match">일치</span>
              : row.state === "mismatch" ? <span className="badge badge--mismatch">불일치</span>
              : <span className="badge badge--only">{row.state === "only-a" ? "As-Is만" : "To-Be만"}</span>;

  const expandable = row.state === "mismatch";

  return (
    <div className="detail-row" data-state={row.state} data-open={open}>
      <div className={`detail-row__head${expandable ? "" : " detail-row__head--plain"}`}
           onClick={() => expandable && setOpen(!open)}>
        <span className="detail-row__key">{row.pk}</span>
        {badge}
        <span className="detail-row__preview">{row.preview}</span>
      </div>
      {open && row.diffs && (
        <div className="detail-row__body">
          {row.diffs.map((d, i) => (
            <div className="diffpair" key={i}>
              <div className="diffpair__col">
                <span className="mono">{d.col}</span>
                <span className="badge badge--mismatch">불일치</span>
              </div>
              <div className="diffpair__sides">
                <div className="side">
                  <div className="side__label" data-side="A">As-Is</div>
                  <div className="side__val">
                    {d.empty === "a"
                      ? <span className="empty">empty</span>
                      : renderHexWithHi(d.a, d.aHi)}
                  </div>
                </div>
                <div className="side">
                  <div className="side__label" data-side="B">To-Be</div>
                  <div className="side__val">
                    {d.empty === "b"
                      ? <span className="empty">empty</span>
                      : renderHexWithHi(d.b, d.bHi)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenD({ scenario }) {
  const [filter, setFilter] = useState("issues");
  const isPassScenario = scenario === "pass" || scenario === "pass-excl";

  const rows = isPassScenario
    ? DETAIL_FIXTURES.filter((r) => r.state === "match")
    : DETAIL_FIXTURES;

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "match") return rows.filter((r) => r.state === "match");
    return rows.filter((r) => r.state !== "match");
  }, [filter, rows]);

  const counts = useMemo(() => ({
    issues: rows.filter((r) => r.state !== "match").length,
    match:  rows.filter((r) => r.state === "match").length,
    all:    rows.length,
  }), [rows]);

  return (
    <div className="card">
      <h3 className="card__title">상세 결과</h3>
      <p className="card__subtitle small">row별 비교 결과. 불일치 row를 펼치면 컬럼별 값을 나란히 확인할 수 있습니다.</p>

      <div className="filters" role="tablist">
        <button aria-pressed={filter === "issues"} onClick={() => setFilter("issues")}>
          문제만 <span className="count">{counts.issues}</span>
        </button>
        <button aria-pressed={filter === "match"} onClick={() => setFilter("match")}>
          일치만 <span className="count">{counts.match}</span>
        </button>
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          전체 <span className="count">{counts.all}</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="render-note">
          <div>표시할 row가 없습니다. 다른 필터를 선택해 보세요.</div>
        </div>
      ) : (
        filtered.map((r) => <DetailRow key={r.pk} row={r} />)
      )}

      {scenario === "fail" && filter !== "match" && (
        <div className="render-note" style={{ marginTop: 8 }}>
          <div>
            상위 <span className="mono">500</span>건만 렌더링됨 — 전체 결과는 CSV 내보내기를 사용하세요.
            (남은 row: <span className="mono">{fmt(2_741)}</span>건)
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenE() {
  return (
    <div className="card">
      <h3 className="card__title">내보내기</h3>
      <p className="card__subtitle small">전체 비교 결과를 CSV 파일로 저장합니다. 일치·불일치 row 모두 포함되며 컬럼별 As-Is/To-Be 값과 판정 상태가 기록됩니다.</p>
      <div className="btnrow">
        <button className="btn">CSV 리포트 내보내기</button>
        <button className="btn btn--secondary">설정 다시 보기</button>
        <span className="small muted" style={{ marginLeft: 6 }}>
          파일명: <span className="mono">compare_20260315_153402.csv</span>
        </span>
      </div>
    </div>
  );
}

// ── App root ─────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scenario": "fail",
  "dropState": "both",
  "showA": true,
  "showB": true,
  "showC": true,
  "showD": true,
  "showE": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [scenario, setScenarioState] = useState(t.scenario);

  // sync scenario from tweak panel
  React.useEffect(() => { setScenarioState(t.scenario); }, [t.scenario]);

  return (
    <div className="app">
      <h1 className="app__title">데이터 마이그레이션 검증 도구</h1>
      <p className="app__subtitle">
        As-Is(메인프레임) → To-Be(오픈시스템) CSV를 byte-for-byte 비교하여
        <span className="mono"> Pass / Fail </span>을 판정합니다. 모든 처리는 브라우저 내에서 이루어지며 외부 요청이 없습니다.
      </p>

      {t.showA && <ScreenA scenario={scenario} dropState={t.dropState} />}

      {t.showB && (
        <>
          {(scenario === "pass" || scenario === "pass-excl" || scenario === "fail" || scenario === "fail-pk-dup") && (
            <ScreenB scenario={scenario} />
          )}
        </>
      )}

      {t.showC && (scenario !== "input-error") && <ScreenC scenario={scenario} />}

      {t.showD && (scenario !== "input-error") && <ScreenD scenario={scenario} />}

      {t.showE && (scenario !== "input-error") && <ScreenE />}

      <TweaksPanel title="Tweaks · 시나리오/화면">
        <TweakSection label="판정 시나리오" />
        <TweakSelect
          label="결과"
          value={t.scenario}
          options={[
            { value: "pass",        label: "Pass — 완전 일치" },
            { value: "pass-excl",   label: "Pass — 제외 컬럼 있음" },
            { value: "fail",        label: "Fail — 불일치/누락 존재" },
            { value: "fail-pk-dup", label: "Fail — PK 중복 경고" },
            { value: "input-error", label: "오류 — 공통 컬럼 0개" },
          ]}
          onChange={(v) => setTweak("scenario", v)}
        />

        <TweakSection label="업로드존 상태" />
        <TweakSelect
          label="Drop zone"
          value={t.dropState}
          options={[
            { value: "both",   label: "두 파일 모두 로드" },
            { value: "one",    label: "As-Is만 로드" },
            { value: "empty",  label: "비어 있음" },
            { value: "over-a", label: "As-Is 드래그 오버" },
            { value: "over-b", label: "To-Be 드래그 오버" },
          ]}
          onChange={(v) => setTweak("dropState", v)}
        />

        <TweakSection label="표시할 화면" />
        <TweakToggle label="A · 업로드/설정" value={t.showA} onChange={(v) => setTweak("showA", v)} />
        <TweakToggle label="B · 판정"        value={t.showB} onChange={(v) => setTweak("showB", v)} />
        <TweakToggle label="C · 집계"        value={t.showC} onChange={(v) => setTweak("showC", v)} />
        <TweakToggle label="D · 상세"        value={t.showD} onChange={(v) => setTweak("showD", v)} />
        <TweakToggle label="E · 내보내기"     value={t.showE} onChange={(v) => setTweak("showE", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
