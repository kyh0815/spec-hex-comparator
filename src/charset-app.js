/* Charset converter — vanilla JS app.
 *
 * Three modes (tabs):
 *   - Text:   live two-pane converter (plain text ↔ bytes view).
 *   - File:   drop a single file, view bytes / re-encode and download.
 *   - Folder: drop a folder, batch re-encode all files to a chosen
 *             encoding, download as a single store-mode ZIP.
 *
 * Encoding library: `encoding-japanese` (vendored, inlined at build).
 * Outputs are produced entirely client-side; nothing is uploaded.
 */
(function () {
  "use strict";

  var I = window.CharsetI18n;
  var Encoding = window.Encoding; // from encoding-japanese
  if (!I || !Encoding) {
    console.error("CharsetI18n or Encoding library missing");
    return;
  }

  // ── Encoding registry ───────────────────────────────────────
  // Maps our short ids to encoding-japanese's encoding names. UTF-8N
  // means UTF-8 without BOM; UTF8 with hasBom adds a BOM on encode.
  var ENCS = [
    { id: "utf8",    ej: "UTF8",  label: "enc.utf8",    bom: false },
    { id: "utf8bom", ej: "UTF8",  label: "enc.utf8bom", bom: true },
    { id: "utf16le", ej: "UTF16", label: "enc.utf16le", bom: false, utf16: "le" },
    { id: "utf16be", ej: "UTF16", label: "enc.utf16be", bom: false, utf16: "be" },
    { id: "sjis",    ej: "SJIS",  label: "enc.sjis",    bom: false },
    { id: "eucjp",   ej: "EUCJP", label: "enc.eucjp",   bom: false },
    { id: "jis",     ej: "JIS",   label: "enc.jis",     bom: false }
  ];

  function encById(id) {
    for (var i = 0; i < ENCS.length; i++) if (ENCS[i].id === id) return ENCS[i];
    return ENCS[0];
  }

  // ── Encoding core: text → bytes ─────────────────────────────
  function encodeText(text, encId) {
    var spec = encById(encId);
    var unicodeArr;
    try {
      unicodeArr = Encoding.stringToCode(text);
    } catch (e) { throw new Error("encode"); }
    var bytes;
    if (spec.ej === "UTF16") {
      bytes = Encoding.convert(unicodeArr, { to: "UTF16", from: "UNICODE", bom: spec.utf16 });
    } else {
      bytes = Encoding.convert(unicodeArr, { to: spec.ej, from: "UNICODE" });
    }
    // encoding-japanese returns a plain array; copy to Uint8Array.
    var u8 = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) u8[i] = bytes[i] & 0xFF;
    if (spec.id === "utf8bom") {
      var withBom = new Uint8Array(u8.length + 3);
      withBom[0] = 0xEF; withBom[1] = 0xBB; withBom[2] = 0xBF;
      withBom.set(u8, 3);
      return withBom;
    }
    return u8;
  }

  // ── Encoding core: bytes → text ─────────────────────────────
  function decodeBytes(bytes, encId) {
    var spec = encId === "auto" ? null : encById(encId);
    var arr = Array.prototype.slice.call(bytes);
    var from;
    if (spec) {
      from = spec.ej;
    } else {
      from = Encoding.detect(arr) || "UTF8";
    }
    try {
      var unicodeArr = Encoding.convert(arr, { to: "UNICODE", from: from });
      return { text: Encoding.codeToString(unicodeArr), detected: from };
    } catch (e) {
      throw new Error("decode");
    }
  }

  function detectEncoding(bytes) {
    var arr = Array.prototype.slice.call(bytes);
    return Encoding.detect(arr) || "UTF8";
  }

  // ── Format conversion: bytes ↔ string-rep ────────────────────
  function bytesToHex(bytes, sep) {
    sep = sep == null ? " " : sep;
    var out = [];
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16).toUpperCase();
      if (h.length === 1) h = "0" + h;
      out.push(h);
    }
    return out.join(sep);
  }
  function bytesToDec(bytes) {
    var out = [];
    for (var i = 0; i < bytes.length; i++) out.push(bytes[i].toString(10));
    return out.join(" ");
  }
  function bytesToBin(bytes) {
    var out = [];
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i].toString(2);
      while (b.length < 8) b = "0" + b;
      out.push(b);
    }
    return out.join(" ");
  }
  function bytesToBase64(bytes) {
    var s = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    return btoa(s);
  }

  function parseHex(str) {
    var clean = str.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "");
    if (clean.length === 0) return new Uint8Array(0);
    if (clean.length % 2 !== 0) throw new Error("parse");
    var u = new Uint8Array(clean.length / 2);
    for (var i = 0; i < u.length; i++) u[i] = parseInt(clean.substr(i * 2, 2), 16);
    return u;
  }
  function parseDec(str) {
    var tokens = str.trim().split(/[\s,]+/).filter(Boolean);
    if (!tokens.length) return new Uint8Array(0);
    var u = new Uint8Array(tokens.length);
    for (var i = 0; i < tokens.length; i++) {
      var n = parseInt(tokens[i], 10);
      if (!isFinite(n) || n < 0 || n > 255) throw new Error("parse");
      u[i] = n;
    }
    return u;
  }
  function parseBin(str) {
    var clean = str.replace(/[^01]/g, "");
    if (!clean.length) return new Uint8Array(0);
    if (clean.length % 8 !== 0) throw new Error("parse");
    var u = new Uint8Array(clean.length / 8);
    for (var i = 0; i < u.length; i++) u[i] = parseInt(clean.substr(i * 8, 8), 2);
    return u;
  }
  function parseBase64(str) {
    try {
      var bin = atob(str.trim());
      var u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    } catch (e) { throw new Error("parse"); }
  }

  function formatBytes(bytes, fmt) {
    if (fmt === "hex") return bytesToHex(bytes);
    if (fmt === "dec") return bytesToDec(bytes);
    if (fmt === "bin") return bytesToBin(bytes);
    if (fmt === "base64") return bytesToBase64(bytes);
    return "";
  }
  function parseFormat(str, fmt) {
    if (fmt === "hex") return parseHex(str);
    if (fmt === "dec") return parseDec(str);
    if (fmt === "bin") return parseBin(str);
    if (fmt === "base64") return parseBase64(str);
    return new Uint8Array(0);
  }

  // ── ZIP store-mode writer (no compression) ──────────────────
  // Produces a valid .zip with stored entries (compression method 0).
  // Suitable for batch downloads of small text artifacts.
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16le(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
  function u32le(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }
  function concatBytes(list) {
    var len = 0, i;
    for (i = 0; i < list.length; i++) len += list[i].length;
    var out = new Uint8Array(len);
    var p = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], p); p += list[i].length; }
    return out;
  }
  function bytesFrom(arr) { return arr instanceof Uint8Array ? arr : new Uint8Array(arr); }

  function makeZip(entries) {
    // entries: [{ path: string, data: Uint8Array }]
    var enc = new TextEncoder();
    var records = [];
    var central = [];
    var offset = 0;
    var dosTime = 0; var dosDate = 0x21; // 1980-01-01

    for (var i = 0; i < entries.length; i++) {
      var name = enc.encode(entries[i].path);
      var data = entries[i].data;
      var crc = crc32(data);
      var lh = bytesFrom([].concat(
        u32le(0x04034b50),  // local file header signature
        u16le(20),          // version needed
        u16le(0x0800),      // general purpose bit flag (UTF-8 names)
        u16le(0),           // method 0 = stored
        u16le(dosTime), u16le(dosDate),
        u32le(crc),
        u32le(data.length), u32le(data.length),
        u16le(name.length), u16le(0)
      ));
      records.push(lh);
      records.push(name);
      records.push(data);
      var cd = bytesFrom([].concat(
        u32le(0x02014b50),  // central directory header signature
        u16le(0x031e),      // version made by (UNIX, zip 3.0)
        u16le(20),          // version needed
        u16le(0x0800),
        u16le(0),
        u16le(dosTime), u16le(dosDate),
        u32le(crc),
        u32le(data.length), u32le(data.length),
        u16le(name.length), u16le(0), u16le(0),  // name/extra/comment len
        u16le(0), u16le(0),                       // disk no / int attrs
        u32le(0),                                 // external attrs
        u32le(offset)                             // local header offset
      ));
      central.push(cd);
      central.push(name);
      offset += lh.length + name.length + data.length;
    }
    var cdStart = offset;
    var cdBuf = concatBytes(central);
    var eocd = bytesFrom([].concat(
      u32le(0x06054b50),
      u16le(0), u16le(0),
      u16le(entries.length), u16le(entries.length),
      u32le(cdBuf.length),
      u32le(cdStart),
      u16le(0)
    ));
    return concatBytes(records.concat([cdBuf, eocd]));
  }

  // ── DOM helpers ─────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    if (children != null) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === "string" || typeof c === "number") n.appendChild(document.createTextNode(String(c)));
        else n.appendChild(c);
      });
    }
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function download(bytes, filename, mime) {
    var blob = new Blob([bytes], { type: mime || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }
  function encLabelOf(spec) { return I.t(state.lang, spec.label); }
  function encLabelById(id) {
    if (id === "auto") return I.t(state.lang, "enc.auto");
    return I.t(state.lang, encById(id).label);
  }

  function copyToClipboard(text, btn) {
    var fn = function () {
      var orig = btn.textContent;
      btn.textContent = I.t(state.lang, "action.copied");
      btn.classList.add("btn--copied");
      setTimeout(function () { btn.textContent = orig; btn.classList.remove("btn--copied"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(fn).catch(function () {
        legacyCopy(text); fn();
      });
    } else { legacyCopy(text); fn(); }
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ── App state ───────────────────────────────────────────────
  var state = {
    lang: I.detect(),
    mode: "text",          // "text" | "file" | "folder"
    text: {
      direction: "encode", // "encode" (text→bytes) | "decode" (bytes→text)
      textValue: "",
      bytesValue: "",
      outEnc: "utf8",
      outFmt: "hex",
      inEnc: "auto",
      inFmt: "hex",
      error: null
    },
    file: {
      file: null,
      bytes: null,
      detected: null,
      sourceEnc: "auto",
      targetEnc: "utf8",
      outFmt: "hex",
      error: null
    },
    folder: {
      files: [],           // [{path, file, bytes, detected, ok, error, converted}]
      sourceEnc: "auto",
      targetEnc: "utf8",
      processed: false
    }
  };

  function t(key) { return I.t(state.lang, key); }

  // ── Render ──────────────────────────────────────────────────
  var root = document.getElementById("root");

  function render() {
    clear(root);
    var app = el("div", { class: "app" });
    app.appendChild(renderHeader());
    app.appendChild(renderModes());
    if (state.mode === "text") app.appendChild(renderTextMode());
    else if (state.mode === "file") app.appendChild(renderFileMode());
    else if (state.mode === "folder") app.appendChild(renderFolderMode());
    app.appendChild(el("div", { class: "app__footer small" }, t("footer.note")));
    root.appendChild(app);
    // notify sitenav of language
    try { window.dispatchEvent(new CustomEvent("langchange", { detail: state.lang })); } catch (e) {}
  }

  function renderHeader() {
    var head = el("div", { class: "app__header" }, [
      el("div", { class: "app__headtext" }, [
        el("h1", { class: "app__title" }, t("app.title")),
        el("p", { class: "app__subtitle" }, t("app.subtitle"))
      ]),
      renderLangSelect()
    ]);
    return head;
  }

  function renderLangSelect() {
    var sel = el("select", {
      "aria-label": t("lang.label"),
      onchange: function (e) { state.lang = e.target.value; render(); }
    });
    I.LANGS.forEach(function (code) {
      var opt = el("option", { value: code }, I.NAMES[code]);
      if (code === state.lang) opt.selected = true;
      sel.appendChild(opt);
    });
    return el("label", { class: "langselect" }, [el("span", null, t("lang.label")), sel]);
  }

  function renderModes() {
    var wrap = el("div", { class: "modes", role: "tablist", "aria-label": "Mode" });
    [["text", "mode.text"], ["file", "mode.file"], ["folder", "mode.folder"]].forEach(function (m) {
      var btn = el("button", {
        class: "modes__btn",
        role: "tab",
        "aria-pressed": state.mode === m[0] ? "true" : "false",
        onclick: function () { state.mode = m[0]; render(); }
      }, t(m[1]));
      wrap.appendChild(btn);
    });
    return wrap;
  }

  // ── Mode 1: Text ────────────────────────────────────────────
  function renderTextMode() {
    var s = state.text;

    var card = el("div", { class: "card" });

    var textPanel = renderTextPanel(s);
    var bytesPanel = renderBytesPanel(s);

    var split = el("div", { class: "split" }, [textPanel, bytesPanel]);
    card.appendChild(split);

    if (s.error) {
      card.appendChild(el("div", { class: "error" }, t(s.error)));
    }

    return card;
  }

  function renderTextPanel(s) {
    var panel = el("div", { class: "panel" });
    var head = el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.text")),
      el("div", { class: "panel__opts" })
    ]);
    var ta = el("textarea", {
      class: "ta ta--text",
      spellcheck: "false",
      placeholder: t("panel.text"),
      oninput: function (e) {
        s.textValue = e.target.value;
        s.error = null;
        s.direction = "encode";
        try {
          var bytes = encodeText(s.textValue, s.outEnc);
          s.bytesValue = formatBytes(bytes, s.outFmt);
          updateTextStats(panel, footerStats, s);
          syncBytesView(s);
        } catch (err) {
          s.error = "err.encode";
          renderError();
        }
      }
    });
    ta.value = s.textValue;
    var byteLen = (function () { try { return encodeText(s.textValue, s.outEnc).length; } catch (e) { return 0; } })();
    var footerStats = el("div", { class: "panel__stats" }, [
      el("span", { class: "small muted" }, [t("stat.charLen"), el("b", null, String(charLen(s.textValue)))]),
      el("span", { class: "small muted" }, [t("stat.byteLen"), el("b", null, String(byteLen))])
    ]);
    var copyBtn = el("button", {
      class: "btn--ghost btn",
      onclick: function (e) { copyToClipboard(s.textValue, e.currentTarget); }
    }, t("action.copy"));
    var clearBtn = el("button", {
      class: "btn--ghost btn",
      onclick: function () { s.textValue = ""; s.bytesValue = ""; s.error = null; render(); }
    }, t("action.clear"));
    var footer = el("div", { class: "panel__footer" }, [
      footerStats,
      el("div", { class: "panel__actions" }, [copyBtn, clearBtn])
    ]);
    panel.appendChild(head);
    panel.appendChild(el("div", { class: "panel__body" }, [ta]));
    panel.appendChild(footer);
    panel._ta = ta;
    state.text._textPanel = panel;
    return panel;
  }

  function renderBytesPanel(s) {
    var panel = el("div", { class: "panel" });

    var encSel = renderEncSelect(s.outEnc, false, function (v) {
      s.outEnc = v;
      s.error = null;
      try {
        var bytes = encodeText(s.textValue, s.outEnc);
        s.bytesValue = formatBytes(bytes, s.outFmt);
        render();
      } catch (e) { s.error = "err.encode"; render(); }
    });
    var fmtSel = renderFmtSelect(s.outFmt, function (v) {
      s.outFmt = v;
      s.error = null;
      try {
        if (s.direction === "encode") {
          var bytes = encodeText(s.textValue, s.outEnc);
          s.bytesValue = formatBytes(bytes, s.outFmt);
        } else {
          // re-derive from current bytesValue parsing
          try {
            var b2 = parseFormat(s.bytesValue, s.inFmt);
            s.bytesValue = formatBytes(b2, s.outFmt);
            s.inFmt = s.outFmt;
          } catch (e) { /* keep raw */ }
        }
        render();
      } catch (e) { render(); }
    });
    var opts = el("div", { class: "panel__opts" }, [
      el("div", { class: "field" }, [
        el("span", { class: "field__label" }, t("field.outputEncoding")), encSel
      ]),
      el("div", { class: "field" }, [
        el("span", { class: "field__label" }, t("field.format")), fmtSel
      ])
    ]);
    var head = el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.bytes")),
      opts
    ]);
    var ta = el("textarea", {
      class: "ta",
      spellcheck: "false",
      placeholder: s.outFmt === "hex" ? "DE AD BE EF" :
                   s.outFmt === "dec" ? "222 173 190 239" :
                   s.outFmt === "bin" ? "11011110 10101101" : "3q2+7w==",
      oninput: function (e) {
        s.bytesValue = e.target.value;
        s.error = null;
        s.direction = "decode";
        s.inFmt = s.outFmt;
        try {
          var bytes = parseFormat(s.bytesValue, s.inFmt);
          var srcEnc = s.outEnc; // when reverse-flowing, use selected output enc as input enc
          var decoded = decodeBytes(bytes, srcEnc);
          s.textValue = decoded.text;
          syncTextView(s);
        } catch (err) {
          s.error = err.message === "parse" ? "err.parse" : "err.decode";
          renderError();
        }
      }
    });
    ta.value = s.bytesValue;
    var copyBtn = el("button", {
      class: "btn--ghost btn",
      onclick: function (e) { copyToClipboard(s.bytesValue, e.currentTarget); }
    }, t("action.copy"));
    var dlBtn = el("button", {
      class: "btn--ghost btn",
      onclick: function () {
        try {
          var bytes = s.direction === "encode" ? encodeText(s.textValue, s.outEnc) : parseFormat(s.bytesValue, s.inFmt);
          download(bytes, "bytes.bin");
        } catch (e) {}
      }
    }, t("action.download"));
    var clearBtn = el("button", {
      class: "btn--ghost btn",
      onclick: function () { s.bytesValue = ""; s.textValue = ""; s.error = null; render(); }
    }, t("action.clear"));
    var byteCount = (function () {
      try { return s.direction === "encode" ? encodeText(s.textValue, s.outEnc).length : parseFormat(s.bytesValue, s.inFmt).length; }
      catch (e) { return 0; }
    })();
    var footerStats = el("div", { class: "panel__stats" }, [
      el("span", { class: "small muted" }, [t("stat.byteLen"), el("b", null, String(byteCount))])
    ]);
    var footer = el("div", { class: "panel__footer" }, [
      footerStats,
      el("div", { class: "panel__actions" }, [copyBtn, dlBtn, clearBtn])
    ]);
    panel.appendChild(head);
    panel.appendChild(el("div", { class: "panel__body" }, [ta]));
    panel.appendChild(footer);
    return panel;
  }

  function syncBytesView(s) {
    // Update bytes textarea content without full re-render.
    var bytesTa = document.querySelectorAll(".panel .ta")[1];
    if (bytesTa) bytesTa.value = s.bytesValue;
    updateByteStats(s);
  }
  function syncTextView(s) {
    var textTa = document.querySelectorAll(".panel .ta")[0];
    if (textTa) textTa.value = s.textValue;
    updateTextStats(null, null, s);
    updateByteStats(s);
  }
  function updateTextStats(panel, statsNode, s) {
    var panels = document.querySelectorAll(".panel");
    if (!panels.length) return;
    var statRow = panels[0].querySelector(".panel__stats");
    if (!statRow) return;
    var bs = statRow.querySelectorAll("b");
    if (bs.length >= 2) {
      bs[0].textContent = String(charLen(s.textValue));
      try { bs[1].textContent = String(encodeText(s.textValue, s.outEnc).length); } catch (e) { bs[1].textContent = "0"; }
    }
  }
  function updateByteStats(s) {
    var panels = document.querySelectorAll(".panel");
    if (panels.length < 2) return;
    var statRow = panels[1].querySelector(".panel__stats");
    if (!statRow) return;
    var b = statRow.querySelector("b");
    if (!b) return;
    try {
      var n = s.direction === "encode" ? encodeText(s.textValue, s.outEnc).length : parseFormat(s.bytesValue, s.inFmt).length;
      b.textContent = String(n);
    } catch (e) { b.textContent = "0"; }
  }
  function renderError() { render(); }
  function charLen(s) {
    // Counts code points (so surrogate pairs count as one).
    if (typeof s !== "string") return 0;
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) i++;
      n++;
    }
    return n;
  }

  function renderEncSelect(value, allowAuto, onchange) {
    var sel = el("select", { class: "select mono", onchange: function (e) { onchange(e.target.value); } });
    if (allowAuto) {
      var optA = el("option", { value: "auto" }, I.t(state.lang, "enc.auto"));
      if (value === "auto") optA.selected = true;
      sel.appendChild(optA);
    }
    ENCS.forEach(function (sp) {
      var o = el("option", { value: sp.id }, I.t(state.lang, sp.label));
      if (value === sp.id) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }
  function renderFmtSelect(value, onchange) {
    var sel = el("select", { class: "select", onchange: function (e) { onchange(e.target.value); } });
    [["hex", "format.hex"], ["dec", "format.dec"], ["bin", "format.bin"], ["base64", "format.base64"]].forEach(function (p) {
      var o = el("option", { value: p[0] }, t(p[1]));
      if (value === p[0]) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  // ── Mode 2: File ────────────────────────────────────────────
  function renderFileMode() {
    var s = state.file;
    var card = el("div", { class: "card" });

    if (!s.file) {
      card.appendChild(renderDropZone("file", function (files) {
        loadFile(files[0]);
      }));
      return card;
    }

    var info = el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title mono" }, s.file.name + " · " + fmtBytes(s.bytes ? s.bytes.length : s.file.size) +
        (s.detected ? " · " + t("field.detected") + ": " + ejToLabel(s.detected) : "")),
      el("div", { class: "panel__opts" }, [
        el("button", {
          class: "btn--ghost btn",
          onclick: function () { state.file = { file: null, bytes: null, detected: null, sourceEnc: "auto", targetEnc: "utf8", outFmt: "hex", error: null }; render(); }
        }, t("action.clear"))
      ])
    ]);

    // Two columns: bytes (hex view) + re-encoded text preview
    var bytesPanel = el("div", { class: "panel" });
    var srcSel = renderEncSelect(s.sourceEnc, true, function (v) { s.sourceEnc = v; render(); });
    var fmtSel = renderFmtSelect(s.outFmt, function (v) { s.outFmt = v; render(); });
    bytesPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("result.bytes")),
      el("div", { class: "panel__opts" }, [
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.format")), fmtSel])
      ])
    ]));
    var bytesPreview = el("textarea", { class: "ta", readonly: "true", spellcheck: "false" });
    bytesPreview.value = s.bytes ? formatBytes(s.bytes, s.outFmt) : "";
    bytesPanel.appendChild(el("div", { class: "panel__body" }, [bytesPreview]));
    bytesPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.byteLen"), el("b", null, String(s.bytes ? s.bytes.length : 0))])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", {
          class: "btn--ghost btn",
          onclick: function (e) { copyToClipboard(bytesPreview.value, e.currentTarget); }
        }, t("action.copy")),
        el("button", {
          class: "btn--ghost btn",
          onclick: function () { if (s.bytes) download(s.bytes, s.file.name + ".bin"); }
        }, t("action.download"))
      ])
    ]));

    var textPanel = el("div", { class: "panel" });
    var tgtSel = renderEncSelect(s.targetEnc, false, function (v) { s.targetEnc = v; render(); });
    textPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("result.decoded")),
      el("div", { class: "panel__opts" }, [
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.inputEncoding")), srcSel]),
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.targetEncoding")), tgtSel])
      ])
    ]));
    var decoded = "";
    var reEncoded = null;
    try {
      if (s.bytes) {
        var dec = decodeBytes(s.bytes, s.sourceEnc);
        decoded = dec.text;
        reEncoded = encodeText(decoded, s.targetEnc);
      }
    } catch (e) { s.error = "err.decode"; }
    var textPreview = el("textarea", { class: "ta ta--text", readonly: "true", spellcheck: "false" });
    textPreview.value = decoded;
    textPanel.appendChild(el("div", { class: "panel__body" }, [textPreview]));
    textPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.charLen"), el("b", null, String(charLen(decoded)))]),
        el("span", { class: "small muted" }, [t("stat.byteLen"), el("b", null, String(reEncoded ? reEncoded.length : 0))])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", {
          class: "btn--ghost btn",
          onclick: function (e) { copyToClipboard(decoded, e.currentTarget); }
        }, t("action.copy")),
        el("button", {
          class: "btn--ghost btn",
          onclick: function () {
            if (reEncoded) download(reEncoded, suggestFileName(s.file.name, s.targetEnc));
          }
        }, t("action.download"))
      ])
    ]));

    card.appendChild(info);
    if (s.error) card.appendChild(el("div", { class: "error" }, t(s.error)));
    card.appendChild(el("div", { class: "split", style: { marginTop: "12px" } }, [bytesPanel, textPanel]));
    return card;
  }

  function loadFile(file) {
    if (!file) return;
    var s = state.file;
    s.file = file; s.bytes = null; s.detected = null; s.error = null;
    var reader = new FileReader();
    reader.onload = function () {
      s.bytes = new Uint8Array(reader.result);
      s.detected = detectEncoding(s.bytes);
      render();
    };
    reader.onerror = function () { s.error = "err.decode"; render(); };
    reader.readAsArrayBuffer(file);
    render();
  }

  // ── Mode 3: Folder ──────────────────────────────────────────
  function renderFolderMode() {
    var s = state.folder;
    var card = el("div", { class: "card" });

    if (!s.files.length) {
      card.appendChild(renderDropZone("folder", function (files) {
        loadFolder(files);
      }));
      return card;
    }

    var opts = el("div", { class: "panel__opts", style: { marginBottom: "12px" } }, [
      el("div", { class: "field" }, [
        el("span", { class: "field__label" }, t("field.inputEncoding")),
        renderEncSelect(s.sourceEnc, true, function (v) { s.sourceEnc = v; processFolder(); })
      ]),
      el("div", { class: "field" }, [
        el("span", { class: "field__label" }, t("field.targetEncoding")),
        renderEncSelect(s.targetEnc, false, function (v) { s.targetEnc = v; processFolder(); })
      ]),
      el("span", { class: "small muted", style: { marginLeft: "8px" } }, [
        t("stat.fileCount"), ": ", el("b", null, String(s.files.length))
      ])
    ]);
    var actions = el("div", { class: "btnrow", style: { margin: "0 0 12px 0" } }, [
      el("button", { class: "btn", onclick: downloadFolderZip }, t("file.action.downloadAll")),
      el("button", {
        class: "btn btn--secondary",
        onclick: function () { state.folder = { files: [], sourceEnc: "auto", targetEnc: "utf8", processed: false }; render(); }
      }, t("action.clear"))
    ]);
    card.appendChild(opts);
    card.appendChild(actions);
    card.appendChild(renderFolderTable(s));
    return card;
  }

  function renderFolderTable(s) {
    var table = el("table", { class: "filetable" });
    var thead = el("thead", null, el("tr", null, [
      el("th", null, t("file.name")),
      el("th", { class: "num" }, t("file.size")),
      el("th", null, t("field.detected")),
      el("th", null, t("file.status")),
      el("th", null, "")
    ]));
    var tbody = el("tbody");
    s.files.forEach(function (row) {
      var tr = el("tr", null, [
        el("td", { class: "mono" }, row.path),
        el("td", { class: "num mono" }, fmtBytes(row.bytes ? row.bytes.length : 0)),
        el("td", { class: "mono" }, row.detected ? ejToLabel(row.detected) : "—"),
        el("td", null,
          row.ok
            ? el("span", { class: "badge badge--ok" }, t("file.status.ok"))
            : el("span", { class: "badge badge--fail" }, t("file.status.fail"))
        ),
        el("td", null,
          row.converted
            ? el("button", {
                class: "btn--ghost btn",
                onclick: function () { download(row.converted, suggestFileName(row.path, state.folder.targetEnc)); }
              }, t("file.action.downloadOne"))
            : null
        )
      ]);
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  function loadFolder(files) {
    var pending = files.length;
    var rows = [];
    var s = state.folder;
    s.files = [];
    if (!pending) { render(); return; }
    files.forEach(function (file, idx) {
      var path = file.webkitRelativePath || file.name;
      var reader = new FileReader();
      reader.onload = function () {
        rows[idx] = { path: path, file: file, bytes: new Uint8Array(reader.result), detected: null, ok: false, converted: null };
        try { rows[idx].detected = detectEncoding(rows[idx].bytes); } catch (e) {}
        pending--;
        if (pending === 0) { s.files = rows.filter(Boolean); processFolder(); }
      };
      reader.onerror = function () {
        rows[idx] = { path: path, file: file, bytes: new Uint8Array(0), detected: null, ok: false, converted: null };
        pending--;
        if (pending === 0) { s.files = rows.filter(Boolean); processFolder(); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function processFolder() {
    var s = state.folder;
    s.files.forEach(function (row) {
      try {
        var dec = decodeBytes(row.bytes, s.sourceEnc);
        var enc = encodeText(dec.text, s.targetEnc);
        row.converted = enc;
        row.ok = true;
      } catch (e) { row.converted = null; row.ok = false; }
    });
    s.processed = true;
    render();
  }

  function downloadFolderZip() {
    var s = state.folder;
    var entries = s.files.filter(function (r) { return r.converted; }).map(function (r) {
      return { path: suggestFileName(r.path, s.targetEnc), data: r.converted };
    });
    if (!entries.length) return;
    var zip = makeZip(entries);
    var stamp = (function () {
      var d = new Date();
      function p(n) { return n < 10 ? "0" + n : "" + n; }
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    })();
    download(zip, "charset_converted_" + stamp + ".zip", "application/zip");
  }

  // ── Drop zones ──────────────────────────────────────────────
  function renderDropZone(kind, onFiles) {
    var hint = kind === "folder" ? t("drop.folderHint") : t("drop.fileHint");
    var input = el("input", { type: "file" });
    if (kind === "folder") {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.setAttribute("multiple", "");
    }
    input.addEventListener("change", function (e) {
      var fl = Array.prototype.slice.call(e.target.files || []);
      if (fl.length) onFiles(fl);
    });
    var drop = el("label", { class: "drop" }, [
      el("div", { class: "drop__hint" }, hint),
      input
    ]);
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("drop--over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("drop--over"); });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      drop.classList.remove("drop--over");
      if (kind === "folder") {
        traverseDataTransfer(e.dataTransfer, function (files) {
          if (files.length) onFiles(files);
        });
      } else {
        var fl = Array.prototype.slice.call(e.dataTransfer.files || []);
        if (fl.length) onFiles(fl);
      }
    });
    return drop;
  }

  // Recursively read DataTransfer items (folder support on drop).
  function traverseDataTransfer(dt, cb) {
    var items = dt.items;
    if (!items || !items[0] || !items[0].webkitGetAsEntry) {
      cb(Array.prototype.slice.call(dt.files || []));
      return;
    }
    var files = [];
    var pending = 0;
    function done() { if (pending === 0) cb(files); }
    function walk(entry, path) {
      if (entry.isFile) {
        pending++;
        entry.file(function (f) {
          // emulate webkitRelativePath
          try { Object.defineProperty(f, "webkitRelativePath", { value: path }); } catch (e) {}
          files.push(f);
          pending--; done();
        });
      } else if (entry.isDirectory) {
        var reader = entry.createReader();
        pending++;
        var readBatch = function () {
          reader.readEntries(function (ents) {
            if (ents.length) {
              ents.forEach(function (en) { walk(en, path + "/" + en.name); });
              readBatch();
            } else {
              pending--; done();
            }
          });
        };
        readBatch();
      }
    }
    for (var i = 0; i < items.length; i++) {
      var ent = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
      if (ent) walk(ent, ent.name);
    }
    setTimeout(done, 0);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function ejToLabel(ej) {
    // Reverse-map encoding-japanese names to our short ids' labels.
    for (var i = 0; i < ENCS.length; i++) {
      if (ENCS[i].ej === ej) return I.t(state.lang, ENCS[i].label);
    }
    return ej;
  }
  function suggestFileName(name, targetEncId) {
    var spec = encById(targetEncId);
    var enc = spec.id.replace(/[^a-z0-9]+/gi, "");
    if (/\.[a-z0-9]+$/i.test(name)) {
      return name.replace(/(\.[a-z0-9]+)$/i, "." + enc + "$1");
    }
    return name + "." + enc;
  }

  // ── Boot ────────────────────────────────────────────────────
  render();
})();
