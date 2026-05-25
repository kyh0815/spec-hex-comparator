/* Site-wide tool navigation localizer.
 * Renders the .sitenav contents based on detected/selected language and
 * the data-tool attribute on <html>. Listens for 'langchange' events so
 * either page's language selector can keep the nav in sync. */
(function () {
  var DICT = {
    ko: { hex: "데이터 비교", charset: "문자 코드 변환" },
    ja: { hex: "データ比較", charset: "文字コード変換" },
    en: { hex: "Hex comparator", charset: "Charset converter" }
  };
  var LANGS = ["ko", "ja", "en"];

  function detect() {
    var l = (navigator.language || "en").toLowerCase();
    if (l.indexOf("ko") === 0) return "ko";
    if (l.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function render(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "en";
    var d = DICT[lang];
    var active = document.documentElement.getAttribute("data-tool") || "hex";
    var nav = document.querySelector(".sitenav");
    if (!nav) return;
    var hexActive = active === "hex";
    var csActive = active === "charset";
    nav.setAttribute("data-lang", lang);
    nav.innerHTML =
      '<div class="sitenav__inner">' +
        '<div class="sitenav__tabs" role="tablist">' +
          '<a class="sitenav__tab' + (hexActive ? " sitenav__tab--active" : "") + '"' +
            ' href="./index.html" role="tab" aria-selected="' + (hexActive ? "true" : "false") + '"' +
            (hexActive ? ' aria-current="page"' : "") +
            '>' + escapeAttr(d.hex) + '</a>' +
          '<a class="sitenav__tab' + (csActive ? " sitenav__tab--active" : "") + '"' +
            ' href="./charset.html" role="tab" aria-selected="' + (csActive ? "true" : "false") + '"' +
            (csActive ? ' aria-current="page"' : "") +
            '>' + escapeAttr(d.charset) + '</a>' +
        '</div>' +
      '</div>';
  }

  function init() {
    render(detect());
    window.addEventListener("langchange", function (e) {
      var lang = e && e.detail;
      if (typeof lang === "string") render(lang);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
