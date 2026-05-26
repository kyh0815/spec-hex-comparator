/* Charset converter — i18n dictionaries (ko/ja/en).
 * Default language: navigator.language auto-detect, with manual override
 * via the header .langselect. Strings are display-only; conversion
 * behavior and downloaded artifacts are language-independent. */
(function (global) {
  var DICT = {
    ko: {
      "lang.label": "언어",
      "app.title": "문자 코드 변환",
      "app.subtitle": "텍스트와 바이트(헥스/10진/2진/Base64)를 일본어 인코딩 포함 양방향 변환합니다.",

      "mode.text": "텍스트",
      "mode.file": "파일",
      "mode.folder": "폴더",

      "subMode.encode": "텍스트 → 바이트",
      "subMode.decode": "바이트 → 텍스트",

      "field.interpretAs": "파일 해석 방식",
      "interpret.binary": "Binary (그대로)",
      "interpret.hex": "Hex 텍스트",
      "interpret.dec": "10진 텍스트",
      "interpret.bin": "2진 텍스트",
      "interpret.base64": "Base64 텍스트",

      "panel.text": "텍스트",
      "panel.bytes": "바이트",
      "panel.input": "입력",
      "panel.output": "결과",

      "field.outputEncoding": "출력 인코딩",
      "field.inputEncoding": "입력 인코딩",
      "field.targetEncoding": "변환 인코딩",
      "field.format": "표시 형식",
      "field.autoDetect": "자동 감지",
      "field.detected": "감지됨",

      "format.hex": "헥스(16진)",
      "format.dec": "10진",
      "format.bin": "2진",
      "format.base64": "Base64",

      "enc.utf8": "UTF-8",
      "enc.utf8bom": "UTF-8 (BOM)",
      "enc.utf16le": "UTF-16 LE",
      "enc.utf16be": "UTF-16 BE",
      "enc.sjis": "Shift_JIS",
      "enc.eucjp": "EUC-JP",
      "enc.jis": "ISO-2022-JP",
      "enc.jef": "JEF",
      "enc.auto": "자동 감지",

      "action.copy": "복사",
      "action.copied": "복사됨",
      "action.download": "다운로드",
      "action.clear": "지우기",
      "action.swap": "방향 전환",
      "action.encode": "텍스트 → 바이트",
      "action.decode": "바이트 → 텍스트",
      "action.convert": "변환 실행",
      "action.convertAll": "일괄 변환 실행",
      "convert.title": "변환 설정",
      "convert.note": "변환을 실행하면 결과가 여기에 표시됩니다.",

      "stat.byteLen": "바이트 길이",
      "stat.charLen": "문자 수",
      "stat.fileCount": "파일 수",

      "drop.fileHint": "파일을 끌어다 놓거나 클릭해 선택하세요",
      "drop.folderHint": "폴더를 끌어다 놓거나 클릭해 선택하세요",
      "drop.over": "여기에 놓기",

      "file.name": "파일명",
      "file.size": "크기",
      "file.encoding": "인코딩",
      "file.status": "상태",
      "file.status.ok": "정상",
      "file.status.fail": "실패",
      "file.action.convert": "변환",
      "file.action.downloadAll": "전체 ZIP 다운로드",
      "file.action.downloadOne": "다운로드",
      "file.empty": "선택된 파일이 없습니다",

      "result.note.bytes": "바이트는 등폭(monospace)으로 표시됩니다.",
      "result.preview": "미리보기",
      "result.bytes": "바이트(헥스)",
      "result.decoded": "디코딩된 텍스트",

      "err.decode": "선택한 인코딩으로 디코딩할 수 없습니다.",
      "err.encode": "텍스트를 선택한 인코딩으로 인코딩할 수 없습니다.",
      "err.parse": "입력을 해석할 수 없습니다.",
      "err.empty": "입력이 비어 있습니다.",

      "footer.note": "데이터는 브라우저 밖으로 나가지 않습니다."
    },
    ja: {
      "lang.label": "言語",
      "app.title": "文字コード変換",
      "app.subtitle": "テキストとバイト(Hex/10進/2進/Base64)を、日本語エンコーディングを含めて相互変換します。",

      "mode.text": "テキスト",
      "mode.file": "ファイル",
      "mode.folder": "フォルダ",

      "subMode.encode": "テキスト → バイト",
      "subMode.decode": "バイト → テキスト",

      "field.interpretAs": "ファイル解釈",
      "interpret.binary": "Binary (そのまま)",
      "interpret.hex": "Hex テキスト",
      "interpret.dec": "10進 テキスト",
      "interpret.bin": "2進 テキスト",
      "interpret.base64": "Base64 テキスト",

      "panel.text": "テキスト",
      "panel.bytes": "バイト",
      "panel.input": "入力",
      "panel.output": "結果",

      "field.outputEncoding": "出力エンコーディング",
      "field.inputEncoding": "入力エンコーディング",
      "field.targetEncoding": "変換先エンコーディング",
      "field.format": "表示形式",
      "field.autoDetect": "自動判定",
      "field.detected": "判定結果",

      "format.hex": "Hex(16進)",
      "format.dec": "10進",
      "format.bin": "2進",
      "format.base64": "Base64",

      "enc.utf8": "UTF-8",
      "enc.utf8bom": "UTF-8 (BOM)",
      "enc.utf16le": "UTF-16 LE",
      "enc.utf16be": "UTF-16 BE",
      "enc.sjis": "Shift_JIS",
      "enc.eucjp": "EUC-JP",
      "enc.jis": "ISO-2022-JP",
      "enc.jef": "JEF",
      "enc.auto": "自動判定",

      "action.copy": "コピー",
      "action.copied": "コピー済み",
      "action.download": "ダウンロード",
      "action.clear": "クリア",
      "action.swap": "方向切替",
      "action.encode": "テキスト → バイト",
      "action.decode": "バイト → テキスト",
      "action.convert": "変換実行",
      "action.convertAll": "一括変換実行",
      "convert.title": "変換設定",
      "convert.note": "変換を実行すると、ここに結果が表示されます。",

      "stat.byteLen": "バイト長",
      "stat.charLen": "文字数",
      "stat.fileCount": "ファイル数",

      "drop.fileHint": "ファイルをドロップまたはクリックで選択",
      "drop.folderHint": "フォルダをドロップまたはクリックで選択",
      "drop.over": "ここにドロップ",

      "file.name": "ファイル名",
      "file.size": "サイズ",
      "file.encoding": "エンコーディング",
      "file.status": "状態",
      "file.status.ok": "成功",
      "file.status.fail": "失敗",
      "file.action.convert": "変換",
      "file.action.downloadAll": "ZIP 一括ダウンロード",
      "file.action.downloadOne": "ダウンロード",
      "file.empty": "選択されたファイルはありません",

      "result.note.bytes": "バイトは等幅(monospace)で表示されます。",
      "result.preview": "プレビュー",
      "result.bytes": "バイト(Hex)",
      "result.decoded": "デコード結果",

      "err.decode": "選択したエンコーディングではデコードできません。",
      "err.encode": "テキストを選択したエンコーディングに変換できません。",
      "err.parse": "入力を解釈できません。",
      "err.empty": "入力が空です。",

      "footer.note": "データはブラウザ外に送信されません。"
    },
    en: {
      "lang.label": "Language",
      "app.title": "Charset converter",
      "app.subtitle": "Convert text and bytes (hex / decimal / binary / Base64) across Japanese encodings.",

      "mode.text": "Text",
      "mode.file": "File",
      "mode.folder": "Folder",

      "subMode.encode": "Text → Bytes",
      "subMode.decode": "Bytes → Text",

      "field.interpretAs": "Interpret file as",
      "interpret.binary": "Binary (raw)",
      "interpret.hex": "Hex text",
      "interpret.dec": "Decimal text",
      "interpret.bin": "Binary text",
      "interpret.base64": "Base64 text",

      "panel.text": "Text",
      "panel.bytes": "Bytes",
      "panel.input": "Input",
      "panel.output": "Output",

      "field.outputEncoding": "Output encoding",
      "field.inputEncoding": "Input encoding",
      "field.targetEncoding": "Target encoding",
      "field.format": "Format",
      "field.autoDetect": "Auto detect",
      "field.detected": "Detected",

      "format.hex": "Hex",
      "format.dec": "Decimal",
      "format.bin": "Binary",
      "format.base64": "Base64",

      "enc.utf8": "UTF-8",
      "enc.utf8bom": "UTF-8 (BOM)",
      "enc.utf16le": "UTF-16 LE",
      "enc.utf16be": "UTF-16 BE",
      "enc.sjis": "Shift_JIS",
      "enc.eucjp": "EUC-JP",
      "enc.jis": "ISO-2022-JP",
      "enc.jef": "JEF",
      "enc.auto": "Auto detect",

      "action.copy": "Copy",
      "action.copied": "Copied",
      "action.download": "Download",
      "action.clear": "Clear",
      "action.swap": "Swap direction",
      "action.encode": "Text → Bytes",
      "action.decode": "Bytes → Text",
      "action.convert": "Convert",
      "action.convertAll": "Convert all",
      "convert.title": "Conversion settings",
      "convert.note": "Click Convert to see the result here.",

      "stat.byteLen": "Byte length",
      "stat.charLen": "Character count",
      "stat.fileCount": "File count",

      "drop.fileHint": "Drop a file here or click to browse",
      "drop.folderHint": "Drop a folder here or click to browse",
      "drop.over": "Drop here",

      "file.name": "Name",
      "file.size": "Size",
      "file.encoding": "Encoding",
      "file.status": "Status",
      "file.status.ok": "OK",
      "file.status.fail": "Failed",
      "file.action.convert": "Convert",
      "file.action.downloadAll": "Download all (ZIP)",
      "file.action.downloadOne": "Download",
      "file.empty": "No files selected",

      "result.note.bytes": "Bytes are shown in monospace.",
      "result.preview": "Preview",
      "result.bytes": "Bytes (hex)",
      "result.decoded": "Decoded text",

      "err.decode": "Cannot decode with the selected encoding.",
      "err.encode": "Cannot encode text into the selected encoding.",
      "err.parse": "Cannot parse the input.",
      "err.empty": "Input is empty.",

      "footer.note": "Data never leaves your browser."
    }
  };

  var LANGS = ["ko", "ja", "en"];
  var NAMES = { ko: "한국어", ja: "日本語", en: "English" };

  function detect() {
    var l = (navigator.language || "en").toLowerCase();
    if (l.indexOf("ko") === 0) return "ko";
    if (l.indexOf("ja") === 0) return "ja";
    return "en";
  }

  global.CharsetI18n = {
    DICT: DICT,
    LANGS: LANGS,
    NAMES: NAMES,
    detect: detect,
    t: function (lang, key) {
      var d = DICT[lang] || DICT.en;
      return d[key] != null ? d[key] : (DICT.en[key] != null ? DICT.en[key] : key);
    }
  };
})(window);
