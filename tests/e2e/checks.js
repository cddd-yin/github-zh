/* ghzh E2E checks (run via CDP Runtime.evaluate with awaitPromise).
 * Expects on the page:
 *   - the userscript already injected (window.__ghzh present),
 *   - window.__ghzhBefore holding a JSON string {len, head} sampled from the
 *     README before injection.
 * Returns a JSON report string. ASCII-only; Chinese via \u escapes.
 */
(async function () {
  'use strict';
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var ZH_ISSUES = '\u8bae\u9898';             /* 议题 */
  var ZH_PR = '\u62c9\u53d6\u8bf7\u6c42';     /* 拉取请求 */
  var ZH_CODE = '\u4ee3\u7801';               /* 代码 */
  var ZH_GOFILE = '\u8f6c\u5230\u6587\u4ef6'; /* 转到文件 */
  var ZH_COMMITS = '\u4e2a\u63d0\u4ea4';      /* 个提交 */
  var ZH_FORK = '\u590d\u523b';               /* 复刻 */
  var ZH_STAR = '\u661f\u6807';               /* 星标 */

  function cnt(text) {
    var els = document.querySelectorAll('a,button,span,summary,h2,h3');
    var n = 0;
    for (var i = 0; i < els.length; i++) {
      if ((els[i].textContent || '').trim() === text) n++;
    }
    return n;
  }

  function addProbes() {
    var wrap = document.createElement('div');
    wrap.id = 'ghzh-probes';
    wrap.innerHTML =
      '<div class="markdown-body" id="p-md"><p>Issues</p></div>' +
      '<pre id="p-pre">Star</pre>' +
      '<a id="p-blob" href="/x/blob/main/Settings">Settings</a>' +
      '<div class="FilterInputWrapper" id="p-filter"><span>Issues</span></div>' +
      '<span id="p-ctl">Issues</span>' +
      '<input id="p-input" placeholder="Search GitHub">';
    document.body.appendChild(wrap);
  }

  function probeText(id) {
    var el = document.getElementById(id);
    return el ? (el.textContent || '').trim() : null;
  }

  function readProbes() {
    var inp = document.getElementById('p-input');
    return {
      md: probeText('p-md'),         /* expect Issues   (skipped) */
      pre: probeText('p-pre'),       /* expect Star     (skipped) */
      blob: probeText('p-blob'),     /* expect Settings (skipped) */
      filter: probeText('p-filter'), /* expect Issues   (skipped) */
      ctl: probeText('p-ctl'),       /* expect translated */
      input: inp ? inp.placeholder : null /* expect translated */
    };
  }

  var report = { page: location.href, stages: {} };

  var mb = document.querySelector('.markdown-body');
  var before = null;
  try { before = JSON.parse(window.__ghzhBefore || 'null'); } catch (e) { /* ignore */ }

  addProbes();
  await sleep(600);

  report.probes = readProbes();
  /* README 完整性：正文不得出现中文（翻译需要跳过它），且首段文本保持原样。
   * 注意：innerText 长度会随页面后续渲染波动，不做跨时刻相等断言。 */
  var readmeNow = mb ? mb.innerText : null;
  var cjkCount = readmeNow ? (readmeNow.match(/[\u4e00-\u9fff]/g) || []).length : -1;
  report.readme = {
    beforeLen: before ? before.len : null,
    afterLen: readmeNow ? readmeNow.length : -1,
    headSame: !!(before && readmeNow && before.head === readmeNow.slice(0, 200)),
    cjkInReadme: cjkCount,
    unchanged: !!(before && readmeNow && cjkCount === 0 && before.head === readmeNow.slice(0, 200))
  };

  report.counts = {
    issuesZh: cnt(ZH_ISSUES), issuesEn: cnt('Issues'),
    prZh: cnt(ZH_PR), prEn: cnt('Pull requests'),
    codeZh: cnt(ZH_CODE),
    goToFileZh: cnt(ZH_GOFILE), goToFileEn: cnt('Go to file'),
    forkZh: cnt(ZH_FORK), starZh: cnt(ZH_STAR)
  };

  report.ui = {
    placeholder: (function () { var i = document.querySelector('input[placeholder]'); return i ? i.placeholder : null; })(),
    commitsZh: document.body.innerText.indexOf(ZH_COMMITS) !== -1,
    title: document.title.slice(0, 150)
  };

  window.__ghzh.setEnabled(false, true);
  report.off = { issuesZh: cnt(ZH_ISSUES), issuesEn: cnt('Issues'), goToFileZh: cnt(ZH_GOFILE), goToFileEn: cnt('Go to file') };
  window.__ghzh.setEnabled(true, true);
  report.on = { issuesZh: cnt(ZH_ISSUES), issuesEn: cnt('Issues') };

  var probes = document.getElementById('ghzh-probes');
  if (probes && probes.parentNode) probes.parentNode.removeChild(probes);
  var keys = Object.keys(localStorage).filter(function (k) { return k.indexOf('ghzh:') === 0; });
  keys.forEach(function (k) { localStorage.removeItem(k); });
  report.cleanedKeys = keys.length;

  return JSON.stringify(report);
})()
