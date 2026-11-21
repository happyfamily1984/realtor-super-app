(function () {
  if (window.__rsaCollector) { window.__rsaCollector.show(); return; }
  var responses = [], index = {}, panel, statusEl, scrollTimer = null;

  function countItems(d, depth) {
    if (!d || typeof d !== 'object' || depth > 6) return 0;
    var best = 0, i, n;
    if (Array.isArray(d)) {
      if (d.length && d[0] && typeof d[0] === 'object' && !Array.isArray(d[0])) {
        var sample = '';
        try { sample = JSON.stringify(d[0]).slice(0, 4000); } catch (e) {}
        if (/prc|price/i.test(sample)) best = d.length;
      }
      for (i = 0; i < Math.min(d.length, 3); i++) { n = countItems(d[i], depth + 1); if (n > best) best = n; }
      return best;
    }
    for (var k in d) { n = countItems(d[k], depth + 1); if (n > best) best = n; }
    return best;
  }

  function total() { var t = 0; for (var i = 0; i < responses.length; i++) t += responses[i].count; return t; }

  function record(url, text) {
    if (!text || text.length < 2 || text.length > 3000000) return;
    var data; try { data = JSON.parse(text); } catch (e) { return; }
    var n = countItems(data, 0);
    if (!n && !/"(cortarNo|legalDivisionNumber)"/.test(text)) return;
    var item = { url: String(url), count: n, data: data };
    if (index[item.url] != null) responses[index[item.url]] = item;
    else if (responses.length < 400) { index[item.url] = responses.length; responses.push(item); }
    render();
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function () {
      var args = arguments;
      return origFetch.apply(this, args).then(function (r) {
        try {
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('json') >= 0) r.clone().text().then(function (t) { record(r.url || args[0], t); }).catch(function () {});
        } catch (e) {}
        return r;
      });
    };
  }
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var xhr = this;
    xhr.addEventListener('load', function () {
      try {
        if (xhr.responseType === '' || xhr.responseType === 'text') record(url, xhr.responseText);
        else if (xhr.responseType === 'json') record(url, JSON.stringify(xhr.response));
      } catch (e) {}
    });
    return origOpen.apply(this, arguments);
  };

  function findScroller() {
    var all = document.querySelectorAll('div,ul,section,main'), best = null, score = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (panel.contains(el) || el.scrollHeight <= el.clientHeight + 80) continue;
      var oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      var m = (el.innerText || '').match(/매매|전세|월세/g);
      var s = m ? m.length : 0;
      if (s > score) { score = s; best = el; }
    }
    return best;
  }

  function toggleScroll(btn) {
    if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; btn.textContent = '목록 자동 넘기기'; return; }
    var el = findScroller(), ticks = 0, still = 0, last = -1;
    btn.textContent = '넘기기 멈춤';
    scrollTimer = setInterval(function () {
      var h = el ? el.scrollHeight : document.documentElement.scrollHeight;
      if (el) el.scrollTop = h; else window.scrollTo(0, h);
      still = h === last ? still + 1 : 0; last = h; ticks++;
      if (still >= 3 || ticks >= 60) toggleScroll(btn);
    }, 1500);
  }

  function save() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var name = 'naver_매물_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + '.json';
    var out = { source: 'realtor-super-app-collector', version: 1, savedAt: d.toISOString(), pageUrl: location.href, title: document.title, responses: responses, pageText: (document.body.innerText || '').slice(0, 30000) };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  function render() { if (statusEl) statusEl.textContent = '모은 매물 약 ' + total() + '건 (응답 ' + responses.length + '개)'; }

  function button(label, fn, primary) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin-top:6px;padding:9px 10px;border-radius:8px;border:1px solid #0e6b57;font:600 13px sans-serif;cursor:pointer;' + (primary ? 'background:#0e6b57;color:#fff;' : 'background:#fff;color:#0e6b57;');
    b.onclick = function () { fn(b); };
    return b;
  }

  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:230px;padding:12px;border-radius:12px;background:#fff;border:2px solid #0e6b57;box-shadow:0 6px 24px rgba(0,0,0,.25);font:13px/1.45 sans-serif;color:#17211d;text-align:left;';
  var title = document.createElement('b'); title.textContent = '매물 수집기'; title.style.fontSize = '14px';
  statusEl = document.createElement('div'); statusEl.style.margin = '4px 0';
  var hint = document.createElement('div'); hint.style.cssText = 'color:#66736d;font-size:12px;';
  hint.textContent = '지금부터 화면에 새로 뜨는 매물을 모읍니다. 단지를 누르거나 목록을 내려 보세요.';
  panel.appendChild(title); panel.appendChild(statusEl); panel.appendChild(hint);
  panel.appendChild(button('목록 자동 넘기기', toggleScroll));
  panel.appendChild(button('파일로 저장', save, true));
  panel.appendChild(button('숨기기', function () { panel.style.display = 'none'; }));
  document.body.appendChild(panel);
  render();
  window.__rsaCollector = { show: function () { panel.style.display = 'block'; } };
})();
