/*
 * build.mjs — vendor 라이브러리 + src를 단일 오프라인 HTML로 인라인.
 * 산출물: index.html (Hex comparator) + charset.html (Charset converter).
 * 두 페이지 모두 외부 요청 0 (모든 의존성 내장).
 *   사용: node build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

// </script> 가 인라인 JS 안에 있으면 파서가 조기 종료하므로 무력화
const safe = (js) => js.replace(/<\/script>/gi, "<\\/script>");

// 두 페이지 공통 사이트 네비
const sitenavCss = read("src/sitenav.css");
const sitenavJs  = read("src/sitenav.js");
const siteNavHtml = `<nav class="sitenav" id="sitenav" aria-label="Tools"></nav>`;

// ── Page 1: Hex comparator ────────────────────────────────────
{
  const react    = read("vendor/react.js");
  const reactDom = read("vendor/react-dom.js");
  const htm      = read("vendor/htm.js");
  const papa     = read("vendor/papaparse.js");
  const core     = read("src/core.js");
  const i18n     = read("src/i18n.js");
  const app      = read("src/app.js");
  const styles   = read("src/styles.css");

  const out = `<!doctype html>
<html lang="ko" data-tool="hex">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>As-Is / To-Be 데이터 비교 검증</title>
<style>
${styles}
${sitenavCss}</style>
</head>
<body>
${siteNavHtml}
<div id="root"></div>
<!-- 모든 의존성 인라인: 폐쇄망/오프라인에서 외부 요청 없이 동작 -->
<script>${safe(react)}</script>
<script>${safe(reactDom)}</script>
<script>${safe(htm)}</script>
<script>${safe(papa)}</script>
<script id="hex-core">${safe(core)}</script>
<script id="hex-i18n">${safe(i18n)}</script>
<script>${safe(app)}</script>
<script id="sitenav-js">${safe(sitenavJs)}</script>
</body>
</html>
`;
  const target = join(root, "index.html");
  writeFileSync(target, out, "utf8");
  const kb = (Buffer.byteLength(out, "utf8") / 1024).toFixed(0);
  console.log(`built index.html (${kb} KB)`);
}

// ── Page 2: Charset converter ─────────────────────────────────
{
  const encJp    = read("vendor/encoding-japanese.js");
  const csI18n   = read("src/charset-i18n.js");
  const csApp    = read("src/charset-app.js");
  const csStyles = read("src/charset-styles.css");

  const out = `<!doctype html>
<html lang="ko" data-tool="charset">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>문자 코드 변환 · Charset converter</title>
<style>
${csStyles}
${sitenavCss}</style>
</head>
<body>
${siteNavHtml}
<div id="root"></div>
<!-- 모든 의존성 인라인: 폐쇄망/오프라인에서 외부 요청 없이 동작 -->
<script>${safe(encJp)}</script>
<script id="charset-i18n">${safe(csI18n)}</script>
<script>${safe(csApp)}</script>
<script id="sitenav-js">${safe(sitenavJs)}</script>
</body>
</html>
`;
  const target = join(root, "charset.html");
  writeFileSync(target, out, "utf8");
  const kb = (Buffer.byteLength(out, "utf8") / 1024).toFixed(0);
  console.log(`built charset.html (${kb} KB)`);
}
