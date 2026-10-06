/* ghzh profile-page probe (run via CDP Runtime.evaluate with awaitPromise).
 * Expects the userscript already injected (window.__ghzh present).
 * Returns a JSON string with:
 *   - bughits: English text that translateCore() WOULD translate but is still
 *     English on the page (timing misses / late-rendered nodes);
 *   - unknown: English text that is not in the dictionary (candidates);
 *   - recoveredByForcedRescan: how many bughits a forced full rescan fixes.
 * ASCII-only source.
 */
(async function () {
  'use strict';
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var SKIP = 'script,style,noscript,template,code,pre,kbd,samp,var,tt,' +
    'textarea,input,select,option,[contenteditable="true"],' +
    '.markdown-body,.comment-body,.blob-code,.highlight,.js-file-line-container,' +
    '.react-code-lines,.cm-editor,.CodeMirror,.monaco-editor,.js-issue-title,' +
    '[data-ghzh-skip]';

  var CJK = /[\u4e00-\u9fff]/;
  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

  function collect() {
    var bughits = [], unknown = [], skipped = 0;
    var seen = {};
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var text = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 300 || !/[A-Za-z]/.test(text)) continue;
      if (CJK.test(text)) continue;
      var el = n.parentElement;
      if (!el || !el.getClientRects || el.getClientRects().length === 0) continue;
      var cs;
      try { cs = getComputedStyle(el); } catch (e0) { continue; }
      if (cs.visibility === 'hidden') continue;
      var inSkip = false;
      try { inSkip = !!el.closest(SKIP); } catch (e1) {}
      var hit = null;
      try { hit = window.__ghzh && window.__ghzh.translateCore ? window.__ghzh.translateCore(text) : null; } catch (e2) {}
      var t = null;
      try { t = el.closest('[data-testid]'); } catch (e3) {}
      var sec = null;
      try { sec = el.closest('section,article,aside,header,footer,nav,main,details,li,div[role]'); } catch (e4) {}
      var secName = '';
      if (sec) {
        secName = sec.tagName.toLowerCase();
        var al = sec.getAttribute('aria-label');
        if (al) secName += '["' + al.slice(0, 50) + '"]';
        if (sec.id) secName += '#' + sec.id;
        var cls = typeof sec.className === 'string' ? sec.className : '';
        if (cls) secName += '.' + cls.trim().split(/\s+/).slice(0, 2).join('.');
      }
      var key = text + '|' + (t ? t.getAttribute('data-testid') : '') + '|' + secName;
      if (seen[key]) continue;
      seen[key] = 1;
      var rec = { text: text.slice(0, 220), testid: t ? String(t.getAttribute('data-testid') || '').slice(0, 60) : null, sec: secName.slice(0, 90) };
      if (inSkip) { skipped++; }
      else if (hit != null) { bughits.push(rec); }
      else { unknown.push(rec); }
    }
    return { bughits: bughits, unknown: unknown, skipped: skipped, total: Object.keys(seen).length, keys: seen };
  }

  function collectAttrs() {
    var unknown = [], translatable = [];
    var sig = {};
    var els = document.querySelectorAll('[title],[aria-label],[placeholder],[alt]');
    for (var i = 0; i < els.length && i < 5000; i++) {
      var el = els[i];
      try { if (el.closest(SKIP)) continue; } catch (e0) {}
      for (var j = 0; j < ATTRS.length; j++) {
        var name = ATTRS[j];
        var v = el.getAttribute(name);
        if (!v || v.length > 200 || !/[A-Za-z]/.test(v) || CJK.test(v)) continue;
        var s = v.replace(/\d+/g, 'N').slice(0, 60);
        if (sig[s]) continue;
        sig[s] = 1;
        var hit = null;
        try { hit = window.__ghzh && window.__ghzh.translateCore ? window.__ghzh.translateCore(v) : null; } catch (e1) {}
        var rec = { attr: name, text: v.slice(0, 160), tag: el.tagName.toLowerCase() };
        if (hit != null) { if (translatable.length < 200) translatable.push(rec); }
        else if (unknown.length < 500) unknown.push(rec);
      }
    }
    return { unknown: unknown, translatable: translatable };
  }

  function collectActivity() {
    var out = { entries: [], tooltips: [] };
    try {
      var heads = document.querySelectorAll('h2,h3,h4,summary');
      var sec = null;
      for (var i = 0; i < heads.length; i++) {
        if (/Contribution activity/i.test(heads[i].textContent || '')) { sec = heads[i].closest('section') || heads[i].parentElement; break; }
      }
      if (sec) {
        var seenE = {};
        var items = sec.querySelectorAll('li,details,.TimelineItem,[class*="activity"]');
        for (var k = 0; k < items.length && out.entries.length < 60; k++) {
          var it = items[k];
          if (!it.getClientRects || it.getClientRects().length === 0) continue;
          var txt = (it.innerText || '').replace(/\s+/g, ' ').trim();
          if (!txt) continue;
          var ks = txt.replace(/\d+/g, 'N').slice(0, 70);
          if (seenE[ks]) continue;
          seenE[ks] = 1;
          out.entries.push({ tag: it.tagName.toLowerCase(), text: txt.slice(0, 220), cls: String(it.className || '').slice(0, 80) });
        }
      }
      var seenT = {};
      var cands = document.querySelectorAll('[title],[aria-label]');
      for (var m = 0; m < cands.length && out.tooltips.length < 40; m++) {
        var el2 = cands[m];
        var v1 = el2.getAttribute('title') || '';
        var v2 = el2.getAttribute('aria-label') || '';
        var v = v1 || v2;
        if (!v || !/contribution/i.test(v) || CJK.test(v)) continue;
        var ts = v.replace(/\d+/g, 'N').slice(0, 70);
        if (seenT[ts]) continue;
        seenT[ts] = 1;
        out.tooltips.push({ attr: v1 ? 'title' : 'aria-label', text: v.slice(0, 160) });
      }
    } catch (e) {}
    return out;
  }

  function collectShadow() {
    var out = [];
    var els = document.querySelectorAll('relative-time,time-ago,time-until,include-fragment,clipboard-copy,details-menu,action-list');
    for (var i = 0; i < els.length && out.length < 15; i++) {
      var el = els[i];
      out.push({
        tag: el.tagName.toLowerCase(),
        light: (el.textContent || '').trim().slice(0, 40),
        hasShadow: !!el.shadowRoot,
        shadowText: el.shadowRoot ? (el.shadowRoot.textContent || '').trim().slice(0, 60) : null
      });
    }
    return out;
  }

  await sleep(1500);
  var a = collect();

  var recoveredTexts = [];
  var b = a;
  if (a.bughits.length) {
    try { if (window.__ghzh && window.__ghzh.translateRoot) window.__ghzh.translateRoot(document); } catch (e) {}
    await sleep(1500);
    b = collect();
    for (var i = 0; i < a.bughits.length; i++) {
      var rec = a.bughits[i];
      var key = rec.text + '|' + (rec.testid || '') + '|' + rec.sec;
      if (!b.keys[key]) recoveredTexts.push(rec.text);
    }
  }
  delete b.keys;

  var attrs = collectAttrs();
  var activity = collectActivity();
  var shadow = collectShadow();

  var out = {
    url: location.href,
    title: document.title,
    version: (window.__ghzh && window.__ghzh.version) || null,
    countsA: { bughits: a.bughits.length, unknown: a.unknown.length, skipped: a.skipped, total: a.total },
    recoveredByForcedRescan: recoveredTexts.length,
    recoveredTexts: recoveredTexts.slice(0, 100),
    bughits: b.bughits.slice(0, 400),
    unknown: b.unknown.slice(0, 800),
    attrsUnknown: attrs.unknown,
    attrsTranslatable: attrs.translatable,
    activity: activity,
    shadow: shadow
  };
  return JSON.stringify(out);
})()
