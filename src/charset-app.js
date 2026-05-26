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
    { id: "jis",     ej: "JIS",   label: "enc.jis",     bom: false },
    // JEF: Fujitsu Japanese EBCDIC. Decode-only (no re-encode path).
    { id: "jef",     ej: "JEF",   label: "enc.jef",     bom: false, decodeOnly: true }
  ];

  function encById(id) {
    for (var i = 0; i < ENCS.length; i++) if (ENCS[i].id === id) return ENCS[i];
    return ENCS[0];
  }

  // ── Encoding core: text → bytes ─────────────────────────────
  function encodeText(text, encId) {
    var spec = encById(encId);
    if (spec.decodeOnly) throw new Error("encode");  // e.g. JEF — no re-encode path
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
    // JEF: custom decoder (not in encoding-japanese).
    if (encId === "jef") {
      return { text: decodeJef(bytes), detected: "JEF" };
    }
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

  // ── JEF (Fujitsu Japanese EBCDIC) decoder ────────────────────
  // Phase 2: SBCS + DBCS Kanji via vendor/jef-dbcs.js (IBM-1390 base).
  //
  // Two shift modes supported transparently:
  //   - Implicit (no SO/SI): bytes valid in SBCS table → SBCS; otherwise
  //     start a DBCS pair. Matches the Fujitsu samples we have.
  //   - Explicit SO(0x28)/SI(0x29): toggle DBCS mode; bytes inside DBCS
  //     mode always parsed as pairs regardless of SBCS validity.
  //
  // Empty slots in JEF_SBCS = undefined → "not a printable SBCS byte" →
  // treat as DBCS lead in implicit mode.
  // Strict SBCS set for Fujitsu JEF implicit-shift mode.
  // EBCDIC 037 has many printable bytes (¢, ., %, ?, } …) that Fujitsu
  // reserves as DBCS lead bytes in JEF. We only mark unambiguous SBCS
  // bytes here; everything else is treated as a DBCS lead.
  var JEF_SBCS = (function () {
    var t = new Array(256);

    // Control / line breaks
    t[0x00] = 0x00; t[0x05] = 0x09; t[0x0D] = 0x0D;
    t[0x15] = 0x0A; t[0x25] = 0x0A;  // NEL/LF → LF

    // Space + minimal punctuation that's safe to keep SBCS.
    t[0x40] = 0x20;  // space
    t[0x60] = 0x2D;  // -
    t[0x6B] = 0x2C;  // ,
    t[0x6D] = 0x5F;  // _
    t[0x7A] = 0x3A;  // :

    // Letters A-Z (uppercase only — lowercase ranges overlap with DBCS leads).
    for (var i = 0; i <= 8; i++) t[0xC1 + i] = 0x41 + i;  // A-I
    for (var i = 0; i <= 8; i++) t[0xD1 + i] = 0x4A + i;  // J-R
    for (var i = 0; i <= 7; i++) t[0xE2 + i] = 0x53 + i;  // S-Z

    // Digits 0-9.
    for (var i = 0; i <= 9; i++) t[0xF0 + i] = 0x30 + i;

    return t;
  })();

  function decodeJef(bytes) {
    if (!bytes || !bytes.length) return "";
    var sbcs = JEF_SBCS;
    var dbcs = window.JEF_DBCS_MAP;
    var out = "";
    var i = 0;
    var inDbcsMode = false;   // explicit SO/SI state
    while (i < bytes.length) {
      var b = bytes[i];

      // Explicit SO/SI handling (some JEF variants).
      if (b === 0x28) { inDbcsMode = true;  i++; continue; }
      if (b === 0x29) { inDbcsMode = false; i++; continue; }

      var sb = sbcs[b];
      var asDbcs = inDbcsMode || sb == null;  // implicit: invalid SBCS → DBCS lead
      if (!asDbcs) {
        out += String.fromCharCode(sb);
        i++;
      } else if (i + 1 < bytes.length) {
        var pair = (b << 8) | bytes[i + 1];
        var u = dbcs && dbcs.get(pair);
        out += u != null ? String.fromCharCode(u) : "�";
        i += 2;
      } else {
        out += "�";
        i++;
      }
    }
    return out;
  }

  // ── Heuristics: EBCDIC / JEF source detection ────────────────
  function fileNameSuggestsJef(name) {
    if (!name) return false;
    return /(^|[_.\-])(jef|ebcdic)(\.|$|[_.\-])/i.test(name);
  }
  function looksLikeEbcdic(bytes) {
    if (!bytes || bytes.length < 8) return false;
    var ebcdic = 0, ascii = 0;
    var sample = Math.min(bytes.length, 512);
    for (var i = 0; i < sample; i++) {
      var b = bytes[i];
      // EBCDIC letter/digit ranges.
      if ((b >= 0xC1 && b <= 0xC9) || (b >= 0xD1 && b <= 0xD9) ||
          (b >= 0xE2 && b <= 0xE9) || (b >= 0xF0 && b <= 0xF9)) ebcdic++;
      // ASCII letter/digit ranges.
      if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5A) ||
          (b >= 0x61 && b <= 0x7A)) ascii++;
    }
    return ebcdic > ascii && ebcdic >= sample * 0.25;
  }

  // ── Interpret-as auto-detection ──────────────────────────────
  // Combines filename hints with content pattern matching to suggest
  // the file's interpretation. Returns one of: binary | hex | dec | bin | base64.
  function detectInterpretAs(rawBytes, filename) {
    if (!rawBytes || !rawBytes.length) return "binary";

    var name = (filename || "").toLowerCase();
    // 1) Filename hints — strong signal, return immediately.
    if (/(^|[_.\-])hex(\.|$)/.test(name) || /\.hex$/.test(name)) return "hex";
    if (/(^|[_.\-])(b64|base64)(\.|$)/.test(name) || /\.b64$|\.base64$/.test(name)) return "base64";
    if (/(^|[_.\-])(bin|binary)text(\.|$)/.test(name)) return "bin";
    if (/(^|[_.\-])dec(\.|$)/.test(name)) return "dec";

    // 2) Content pattern — sample first 1KB as UTF-8 lossy text.
    var sample;
    try {
      var end = Math.min(rawBytes.length, 1024);
      sample = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes.subarray(0, end));
    } catch (e) { return "binary"; }

    var trimmed = sample.trim();
    if (!trimmed.length) return "binary";

    // Hex: only hex digits + whitespace + optional 0x prefixes, even count.
    var hexStripped = trimmed.replace(/0x/gi, "").replace(/\s+/g, "");
    if (hexStripped.length >= 4 && /^[0-9a-fA-F]+$/.test(hexStripped) && hexStripped.length % 2 === 0) {
      return "hex";
    }

    // Binary text: 0/1 + whitespace, length multiple of 8.
    var binStripped = trimmed.replace(/\s+/g, "");
    if (binStripped.length >= 8 && /^[01]+$/.test(binStripped) && binStripped.length % 8 === 0) {
      return "bin";
    }

    // Decimal text: digits + whitespace/commas, each token 0..255.
    if (/^[0-9\s,]+$/.test(trimmed)) {
      var tokens = trimmed.split(/[\s,]+/).filter(Boolean);
      if (tokens.length >= 2 && tokens.every(function (n) {
        if (!/^\d+$/.test(n)) return false;
        var x = parseInt(n, 10);
        return x >= 0 && x <= 255;
      })) return "dec";
    }

    // Base64: base64 alphabet + padding, length multiple of 4.
    var b64Stripped = trimmed.replace(/\s+/g, "");
    if (b64Stripped.length >= 8 && /^[A-Za-z0-9+/]+=*$/.test(b64Stripped) && b64Stripped.length % 4 === 0) {
      return "base64";
    }

    return "binary";
  }

  // ── Interpret raw file bytes ─────────────────────────────────
  // When `interpretAs` is "binary", the file's raw bytes are the bytes
  // to decode. For "hex"/"dec"/"bin"/"base64", the file content is
  // treated as ASCII/UTF-8 text describing bytes; we parse that text
  // into the actual bytes (e.g. a .txt with "82 B1 82 F1" → [0x82,0xB1,…]).
  function interpretFileBytes(rawBytes, interpretAs) {
    if (!rawBytes) return null;
    if (interpretAs === "binary" || !interpretAs) return rawBytes;
    var text = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes);
    return parseFormat(text, interpretAs);
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
    mode: "text",                                 // "text" | "file" | "folder"
    text: {
      subMode: "encode",                          // "encode" | "decode"
      encode: { text: "", enc: "utf8", fmt: "hex" },
      decode: { bytes: "", enc: "auto", fmt: "hex" },
      error: null
    },
    file: {
      file: null,
      rawBytes: null,                             // file-as-read (no interpretation)
      interpretAs: "binary",                      // "binary" | "hex" | "dec" | "bin" | "base64"
      sourceEnc: "auto",                          // encoding of the (interpreted) bytes
      targetEnc: "utf8",                          // re-encode target for download
      outFmt: "hex",                              // how to display bytes
      converted: false,                           // explicit Convert was clicked
      decodedText: "",                            // cached decode (only when converted)
      reEncodedBytes: null,                       // cached re-encode (only when converted)
      detectedEnc: null,                          // detected encoding of parsed bytes
      error: null
    },
    folder: {
      // Per-row settings — each file decides its own interpret-as and
      // source encoding (auto-detected on upload, user-overridable in
      // the table). Target encoding is folder-level (uniform output).
      files: [],                                  // [{path, file, rawBytes, interpretAs, sourceEnc, parsedBytes, detectedEj, ok, converted}]
      targetEnc: "utf8",
      converted: false                            // explicit ConvertAll was clicked
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
    // Autofocus the active textarea on text mode so the cursor blinks
    // ready for input. Place caret at end so existing content isn't selected.
    if (state.mode === "text") {
      var ta = root.querySelector(".panel--active textarea:not([readonly])");
      if (ta) {
        try {
          ta.focus({ preventScroll: true });
          var pos = ta.value.length;
          ta.setSelectionRange(pos, pos);
        } catch (e) {}
      }
    }
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
    var wrap = el("div");

    // Direction toggle is the swap button (⇄) inside the active panel head.
    // Left is always the input (active, accent border); right is always the
    // readonly result. Clicking ⇄ flips what the left panel represents
    // (text → bytes vs bytes → text).

    var card = el("div", { class: "card" });
    if (s.subMode === "encode") card.appendChild(renderEncodePane(s));
    else card.appendChild(renderDecodePane(s));
    if (s.error) card.appendChild(el("div", { class: "error" }, t(s.error)));
    wrap.appendChild(card);
    return wrap;
  }

  // Encode pane: text input (left, editable) → bytes output (right, readonly).
  function renderEncodePane(s) {
    var e = s.encode;
    var split = el("div", { class: "split" });

    var bytesTa, byteStatRight, byteStatLeft, charStatLeft, errSink;

    function placeholderFor(fmt) {
      return fmt === "hex" ? "DE AD BE EF"
           : fmt === "dec" ? "222 173 190 239"
           : fmt === "bin" ? "11011110 10101101" : "3q2+7w==";
    }

    function recompute() {
      try {
        var bytes = encodeText(e.text, e.enc);
        bytesTa.value = formatBytes(bytes, e.fmt);
        byteStatRight.textContent = String(bytes.length);
        byteStatLeft.textContent = String(bytes.length);
        s.error = null;
        if (errSink) errSink.style.display = "none";
      } catch (err) {
        bytesTa.value = "";
        byteStatRight.textContent = "0";
        byteStatLeft.textContent = "0";
        s.error = "err.encode";
        if (errSink) { errSink.textContent = t(s.error); errSink.style.display = ""; }
      }
    }

    // Left: editable text (active panel, accent border)
    var leftPanel = el("div", { class: "panel panel--active" });
    var leftTa = el("textarea", {
      class: "ta ta--text",
      spellcheck: "false",
      placeholder: t("panel.text"),
      oninput: function (ev) {
        e.text = ev.target.value;
        charStatLeft.textContent = String(charLen(e.text));
        recompute();
      }
    });
    leftTa.value = e.text;
    charStatLeft = el("b", null, String(charLen(e.text)));
    byteStatLeft = el("b", null, "0");
    leftPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.text")),
      renderSwapBtn()
    ]));
    leftPanel.appendChild(el("div", { class: "panel__body" }, [leftTa]));
    leftPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.charLen"), " ", charStatLeft]),
        el("span", { class: "small muted" }, [t("stat.byteLen"), " ", byteStatLeft])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", { class: "btn--ghost btn", onclick: function (ev) { copyToClipboard(e.text, ev.currentTarget); } }, t("action.copy")),
        el("button", { class: "btn--ghost btn", onclick: function () { e.text = ""; render(); } }, t("action.clear"))
      ])
    ]));

    // Right: readonly bytes preview. Output (encode-target) encoding —
    // JEF excluded since we can't encode TO it.
    var encSel = renderEncSelect(e.enc, false, function (v) { e.enc = v; recompute(); }, true);
    var fmtSel = renderFmtSelect(e.fmt, function (v) { e.fmt = v; bytesTa.placeholder = placeholderFor(v); recompute(); });
    byteStatRight = el("b", null, "0");
    bytesTa = el("textarea", { class: "ta", readonly: "true", spellcheck: "false", placeholder: placeholderFor(e.fmt) });

    var rightPanel = el("div", { class: "panel panel--readonly" });
    rightPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.bytes")),
      el("div", { class: "panel__opts" }, [
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.outputEncoding")), encSel]),
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.format")), fmtSel])
      ])
    ]));
    rightPanel.appendChild(el("div", { class: "panel__body" }, [bytesTa]));
    rightPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.byteLen"), " ", byteStatRight])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", { class: "btn--ghost btn", onclick: function (ev) { copyToClipboard(bytesTa.value, ev.currentTarget); } }, t("action.copy")),
        el("button", {
          class: "btn--ghost btn",
          onclick: function () { try { download(encodeText(e.text, e.enc), "bytes.bin"); } catch (err) {} }
        }, t("action.download"))
      ])
    ]));

    split.appendChild(leftPanel);
    split.appendChild(rightPanel);
    recompute();
    return split;
  }

  // Decode pane: bytes input (left, editable) → text output (right, readonly).
  function renderDecodePane(s) {
    var d = s.decode;
    var split = el("div", { class: "split" });

    var textTa, byteStatLeft, charStatRight, detectedSpan, errSink;

    function placeholderFor(fmt) {
      return fmt === "hex" ? "DE AD BE EF"
           : fmt === "dec" ? "222 173 190 239"
           : fmt === "bin" ? "11011110 10101101" : "3q2+7w==";
    }

    function recompute() {
      try {
        var bytes = parseFormat(d.bytes, d.fmt);
        var dec = decodeBytes(bytes, d.enc);
        textTa.value = dec.text;
        byteStatLeft.textContent = String(bytes.length);
        charStatRight.textContent = String(charLen(dec.text));
        if (d.enc === "auto" && bytes.length) {
          detectedSpan.textContent = t("field.detected") + ": " + ejToLabel(dec.detected);
        } else {
          detectedSpan.textContent = "";
        }
        s.error = null;
      } catch (err) {
        textTa.value = "";
        charStatRight.textContent = "0";
        byteStatLeft.textContent = "0";
        detectedSpan.textContent = "";
        s.error = err.message === "parse" ? "err.parse" : "err.decode";
      }
    }

    // Left: editable bytes
    var encSel = renderEncSelect(d.enc, true, function (v) { d.enc = v; recompute(); });
    var fmtSel = renderFmtSelect(d.fmt, function (v) { d.fmt = v; bytesTa.placeholder = placeholderFor(v); recompute(); });
    byteStatLeft = el("b", null, "0");

    var bytesTa = el("textarea", {
      class: "ta",
      spellcheck: "false",
      placeholder: placeholderFor(d.fmt),
      oninput: function (ev) { d.bytes = ev.target.value; recompute(); }
    });
    bytesTa.value = d.bytes;

    var leftPanel = el("div", { class: "panel panel--active" });
    leftPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.bytes")),
      el("div", { class: "panel__opts" }, [
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.inputEncoding")), encSel]),
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.format")), fmtSel]),
        renderSwapBtn()
      ])
    ]));
    leftPanel.appendChild(el("div", { class: "panel__body" }, [bytesTa]));
    leftPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.byteLen"), " ", byteStatLeft])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", { class: "btn--ghost btn", onclick: function (ev) { copyToClipboard(d.bytes, ev.currentTarget); } }, t("action.copy")),
        el("button", { class: "btn--ghost btn", onclick: function () { d.bytes = ""; render(); } }, t("action.clear"))
      ])
    ]));

    // Right: readonly decoded text
    charStatRight = el("b", null, "0");
    detectedSpan = el("span", { class: "small muted" }, "");
    textTa = el("textarea", { class: "ta ta--text", readonly: "true", spellcheck: "false" });

    var rightPanel = el("div", { class: "panel panel--readonly" });
    rightPanel.appendChild(el("div", { class: "panel__head" }, [
      el("div", { class: "panel__title" }, t("panel.text")),
      el("div", { class: "panel__opts" }, [detectedSpan])
    ]));
    rightPanel.appendChild(el("div", { class: "panel__body" }, [textTa]));
    rightPanel.appendChild(el("div", { class: "panel__footer" }, [
      el("div", { class: "panel__stats" }, [
        el("span", { class: "small muted" }, [t("stat.charLen"), " ", charStatRight])
      ]),
      el("div", { class: "panel__actions" }, [
        el("button", { class: "btn--ghost btn", onclick: function (ev) { copyToClipboard(textTa.value, ev.currentTarget); } }, t("action.copy"))
      ])
    ]));

    split.appendChild(leftPanel);
    split.appendChild(rightPanel);
    recompute();
    return split;
  }
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

  function renderEncSelect(value, allowAuto, onchange, excludeDecodeOnly) {
    var sel = el("select", { class: "select mono", onchange: function (e) { onchange(e.target.value); } });
    if (allowAuto) {
      var optA = el("option", { value: "auto" }, I.t(state.lang, "enc.auto"));
      if (value === "auto") optA.selected = true;
      sel.appendChild(optA);
    }
    ENCS.forEach(function (sp) {
      if (excludeDecodeOnly && sp.decodeOnly) return;
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
  function renderSwapBtn() {
    var btn = el("button", {
      class: "swap-btn",
      type: "button",
      title: t("subMode." + (state.text.subMode === "encode" ? "decode" : "encode")),
      "aria-label": t("subMode." + (state.text.subMode === "encode" ? "decode" : "encode")),
      onclick: function () {
        state.text.subMode = state.text.subMode === "encode" ? "decode" : "encode";
        state.text.error = null;
        render();
      }
    });
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 5.5 L13 5.5 M10.5 3 L13 5.5 L10.5 8"/>' +
      '<path d="M13 10.5 L3 10.5 M5.5 8 L3 10.5 L5.5 13"/>' +
      '</svg>';
    return btn;
  }

  function renderInterpretSelect(value, onchange) {
    var sel = el("select", { class: "select", onchange: function (e) { onchange(e.target.value); } });
    [
      ["binary", "interpret.binary"], ["hex", "interpret.hex"], ["dec", "interpret.dec"],
      ["bin", "interpret.bin"], ["base64", "interpret.base64"]
    ].forEach(function (p) {
      var o = el("option", { value: p[0] }, t(p[1]));
      if (value === p[0]) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function resetFileResult() {
    var s = state.file;
    s.converted = false;
    s.decodedText = "";
    s.reEncodedBytes = null;
    s.error = null;
  }

  function runFileConvert() {
    var s = state.file;
    var parsedBytes;
    try { parsedBytes = interpretFileBytes(s.rawBytes, s.interpretAs); }
    catch (e) { s.error = "err.parse"; render(); return; }
    if (!parsedBytes || !parsedBytes.length) { s.error = "err.empty"; render(); return; }
    try {
      var dec = decodeBytes(parsedBytes, s.sourceEnc);
      s.decodedText = dec.text;
      s.reEncodedBytes = encodeText(dec.text, s.targetEnc);
      s.converted = true;
      s.error = null;
    } catch (e) {
      s.error = "err.decode";
      s.converted = false;
    }
    render();
  }

  function renderFileMode() {
    var s = state.file;
    var card = el("div", { class: "card" });

    if (!s.file) {
      card.appendChild(renderDropZone("file", function (files) {
        loadFile(files[0]);
      }));
      return card;
    }

    // Derive parsed bytes (for preview + detected display) without
    // committing to a full decode/re-encode. Full conversion only runs
    // when the user clicks Convert.
    var parsedBytes = null, parseError = null;
    try { parsedBytes = interpretFileBytes(s.rawBytes, s.interpretAs); }
    catch (e) { parsedBytes = null; parseError = true; }
    var detected = null;
    if (parsedBytes && parsedBytes.length) {
      try { detected = detectEncoding(parsedBytes); } catch (e) {}
    }
    s.detectedEnc = detected;

    var info = el("div", { class: "fileinfo" }, [
      el("div", { class: "fileinfo__name" }, [
        el("b", { class: "mono" }, s.file.name),
        el("span", { class: "fileinfo__meta" },
          " · " + fmtBytes(s.rawBytes ? s.rawBytes.length : s.file.size) +
          (parsedBytes && s.interpretAs !== "binary"
            ? " · " + t("interpret." + s.interpretAs) + " → " + parsedBytes.length + " B"
            : "") +
          (detected ? " · " + t("field.detected") + ": " + ejToLabel(detected) : "")
        )
      ]),
      el("button", {
        class: "btn--ghost btn",
        onclick: function () {
          state.file = { file: null, rawBytes: null, interpretAs: "binary", sourceEnc: "auto", targetEnc: "utf8", outFmt: "hex", converted: false, decodedText: "", reEncodedBytes: null, detectedEnc: null, error: null };
          render();
        }
      }, t("action.clear"))
    ]);

    // Convert settings card — explicit Convert button gates the result.
    // Any setting change invalidates the previous result.
    var onSettingChange = function () { resetFileResult(); render(); };
    var interpretSel = renderInterpretSelect(s.interpretAs, function (v) {
      s.interpretAs = v;
      redetectFileSource();  // parsed bytes changed → re-detect source
      onSettingChange();
    });
    var srcSel = renderEncSelect(s.sourceEnc, false, function (v) { s.sourceEnc = v; onSettingChange(); });
    var tgtSel = renderEncSelect(s.targetEnc, false, function (v) { s.targetEnc = v; onSettingChange(); }, true);
    var convertBtn = el("button", {
      class: "btn",
      onclick: runFileConvert,
      disabled: parseError || !parsedBytes || !parsedBytes.length ? "disabled" : null
    }, t("action.convert"));
    var convertBox = el("div", { class: "convertbox" }, [
      el("div", { class: "convertbox__title" }, t("convert.title")),
      el("div", { class: "convertbox__fields" }, [
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.interpretAs")), interpretSel]),
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.inputEncoding")), srcSel]),
        el("div", { class: "field" }, [el("span", { class: "field__label" }, t("field.targetEncoding")), tgtSel])
      ]),
      el("div", { class: "convertbox__action" }, [convertBtn])
    ]);

    card.appendChild(info);
    card.appendChild(convertBox);
    if (parseError) card.appendChild(el("div", { class: "error" }, t("err.parse")));
    else if (s.error) card.appendChild(el("div", { class: "error" }, t(s.error)));

    // After Convert: present a single result row focused on download.
    // No text/bytes preview — the user downloads and inspects the file
    // externally to preserve the original format (CSV, txt, etc.).
    if (s.converted && s.reEncodedBytes) {
      var outName = suggestFileName(s.file.name, s.targetEnc);
      card.appendChild(el("div", { class: "resultbox" }, [
        el("div", { class: "resultbox__info" }, [
          el("div", { class: "resultbox__name" }, outName),
          el("div", { class: "resultbox__meta" }, fmtBytes(s.reEncodedBytes.length))
        ]),
        el("button", {
          class: "btn",
          onclick: function () { download(s.reEncodedBytes, outName); }
        }, t("action.download"))
      ]));
    }
    return card;
  }

  function loadFile(file) {
    if (!file) return;
    var s = state.file;
    s.file = file; s.rawBytes = null; s.error = null;
    s.converted = false; s.decodedText = ""; s.reEncodedBytes = null;
    var reader = new FileReader();
    reader.onload = function () {
      s.rawBytes = new Uint8Array(reader.result);
      // Smart interpret-as detection (filename hints + content patterns),
      // then source-encoding detection on the resulting parsed bytes.
      try {
        s.interpretAs = detectInterpretAs(s.rawBytes, s.file && s.file.name);
        var parsed = interpretFileBytes(s.rawBytes, s.interpretAs);
        var name = s.file && s.file.name;
        // JEF/EBCDIC takes precedence (filename hint > content heuristic)
        // since encoding-japanese can't detect EBCDIC at all.
        if (fileNameSuggestsJef(name) || looksLikeEbcdic(parsed)) {
          s.sourceEnc = "jef";
        } else if (parsed && parsed.length) {
          s.sourceEnc = ejToId(detectEncoding(parsed));
        }
      } catch (e) {}
      render();
    };
    reader.onerror = function () { s.error = "err.decode"; render(); };
    reader.readAsArrayBuffer(file);
    render();
  }

  // Re-detect source encoding from current rawBytes + interpretAs.
  // Called when the user changes the interpret-as select so the source
  // encoding stays in sync with what's actually being parsed.
  function redetectFileSource() {
    var s = state.file;
    if (!s.rawBytes) return;
    try {
      var parsed = interpretFileBytes(s.rawBytes, s.interpretAs);
      if (parsed && parsed.length) s.sourceEnc = ejToId(detectEncoding(parsed));
    } catch (e) {}
  }

  // ── Mode 3: Folder ──────────────────────────────────────────
  function resetFolderResult() {
    var s = state.folder;
    s.converted = false;
    s.files.forEach(function (r) { r.converted = null; r.ok = false; });
  }

  function renderFolderMode() {
    var s = state.folder;
    var card = el("div", { class: "card" });

    if (!s.files.length) {
      card.appendChild(renderDropZone("folder", function (files) {
        loadFolder(files);
      }));
      return card;
    }

    var onSettingChange = function () { resetFolderResult(); render(); };

    // Top: target encoding (folder-level) + Convert all button.
    // Per-row interpret-as and source encoding live in the table.
    var convertBtn = el("button", { class: "btn", onclick: runFolderConvert }, t("action.convertAll"));
    var convertBox = el("div", { class: "convertbox" }, [
      el("div", { class: "convertbox__title" }, t("convert.title")),
      el("div", { class: "convertbox__fields" }, [
        el("div", { class: "field" }, [
          el("span", { class: "field__label" }, t("field.targetEncoding")),
          renderEncSelect(s.targetEnc, false, function (v) { s.targetEnc = v; onSettingChange(); }, true)
        ]),
        el("span", { class: "optsbar__spacer" }),
        el("span", { class: "small muted" }, [
          t("stat.fileCount"), ": ", el("b", null, String(s.files.length))
        ])
      ]),
      el("div", { class: "convertbox__action" }, [convertBtn])
    ]);

    var clearBtn = el("button", {
      class: "btn btn--secondary",
      onclick: function () { state.folder = { files: [], targetEnc: "utf8", converted: false }; render(); }
    }, t("action.clear"));
    var actions = el("div", { class: "btnrow", style: { margin: "0 0 12px 0" } }, [
      el("button", {
        class: "btn",
        onclick: downloadFolderZip,
        disabled: s.converted ? null : "disabled"
      }, t("file.action.downloadAll")),
      clearBtn
    ]);

    card.appendChild(convertBox);
    card.appendChild(actions);
    card.appendChild(el("div", { class: "tablewrap" }, [renderFolderTable(s)]));
    return card;
  }

  // Re-detect a single row's source encoding from its current interpret-as.
  function redetectRowSource(row) {
    try {
      var parsed = interpretFileBytes(row.rawBytes, row.interpretAs);
      row.parsedBytes = parsed;
      var name = row.file && row.file.name;
      // JEF/EBCDIC takes precedence over encoding-japanese detect.
      if (fileNameSuggestsJef(name) || looksLikeEbcdic(parsed)) {
        row.sourceEnc = "jef";
        row.detectedEj = "JEF";
      } else if (parsed && parsed.length) {
        row.detectedEj = detectEncoding(parsed);
        row.sourceEnc = ejToId(row.detectedEj);
      } else {
        row.detectedEj = null;
      }
    } catch (e) { row.parsedBytes = null; row.detectedEj = null; }
  }

  function renderFolderTable(s) {
    var table = el("table", { class: "filetable" });
    var headCells = [
      el("th", null, t("file.name")),
      el("th", { class: "num" }, t("file.size")),
      el("th", null, t("field.interpretAs")),
      el("th", null, t("field.inputEncoding"))
    ];
    if (s.converted) {
      headCells.push(el("th", null, t("file.status")));
      headCells.push(el("th", { class: "actions" }, ""));
    }
    var thead = el("thead", null, el("tr", null, headCells));
    var tbody = el("tbody");
    s.files.forEach(function (row) {
      // Make sure parsedBytes is current with row.interpretAs (for size display).
      var parsed;
      try { parsed = interpretFileBytes(row.rawBytes, row.interpretAs); } catch (e) { parsed = null; }
      var displaySize = parsed ? parsed.length : (row.rawBytes ? row.rawBytes.length : 0);

      var interpretSel = renderInterpretSelect(row.interpretAs, function (v) {
        row.interpretAs = v;
        redetectRowSource(row);
        resetFolderResult();
        render();
      });
      var srcSel = renderEncSelect(row.sourceEnc, false, function (v) {
        row.sourceEnc = v;
        resetFolderResult();
        render();
      });

      var cells = [
        el("td", { class: "mono" }, row.path),
        el("td", { class: "num mono" }, fmtBytes(displaySize)),
        el("td", null, interpretSel),
        el("td", null, srcSel)
      ];
      if (s.converted) {
        cells.push(el("td", null,
          row.ok
            ? el("span", { class: "badge badge--ok" }, t("file.status.ok"))
            : el("span", { class: "badge badge--fail" }, t("file.status.fail"))
        ));
        cells.push(el("td", { class: "actions" },
          row.converted
            ? el("button", {
                class: "btn--ghost btn",
                onclick: function () { download(row.converted, suggestFileName(row.path, state.folder.targetEnc)); }
              }, t("file.action.downloadOne"))
            : null
        ));
      }
      tbody.appendChild(el("tr", null, cells));
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
    s.converted = false;
    if (!pending) { render(); return; }
    files.forEach(function (file, idx) {
      var path = file.webkitRelativePath || file.name;
      var reader = new FileReader();
      reader.onload = function () {
        var raw = new Uint8Array(reader.result);
        var row = {
          path: path, file: file, rawBytes: raw,
          interpretAs: detectInterpretAs(raw, file.name),
          sourceEnc: "utf8",
          parsedBytes: null, detectedEj: null,
          ok: false, converted: null
        };
        redetectRowSource(row);
        rows[idx] = row;
        pending--;
        if (pending === 0) { s.files = rows.filter(Boolean); render(); }
      };
      reader.onerror = function () {
        rows[idx] = {
          path: path, file: file, rawBytes: new Uint8Array(0),
          interpretAs: "binary", sourceEnc: "utf8",
          parsedBytes: null, detectedEj: null,
          ok: false, converted: null
        };
        pending--;
        if (pending === 0) { s.files = rows.filter(Boolean); render(); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function runFolderConvert() {
    var s = state.folder;
    s.files.forEach(function (row) {
      try {
        var parsed = interpretFileBytes(row.rawBytes, row.interpretAs);
        if (!parsed || !parsed.length) throw new Error("empty");
        var dec = decodeBytes(parsed, row.sourceEnc);
        row.converted = encodeText(dec.text, s.targetEnc);
        row.ok = true;
      } catch (e) { row.converted = null; row.ok = false; }
    });
    s.converted = true;
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
  // Map encoding-japanese detected name to our short encoding id.
  // Detection may return names outside ENCS (ASCII, BINARY, UNICODE) —
  // treat those as UTF-8 since they're all UTF-8-compatible.
  function ejToId(ej) {
    if (!ej) return "utf8";
    if (ej === "UTF8" || ej === "ASCII" || ej === "BINARY" || ej === "UNICODE" || ej === "UTF8N") return "utf8";
    if (ej === "UTF16BE") return "utf16be";
    if (ej === "UTF16LE" || ej === "UTF16") return "utf16le";
    if (ej === "SJIS") return "sjis";
    if (ej === "EUCJP") return "eucjp";
    if (ej === "JIS" || ej === "ISO-2022-JP") return "jis";
    return "utf8";
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
