// 네이버 부동산 화면 안에서 실행된다.
// 1) 화면이 주고받는 매물 응답을 기록한다 (사용자가 직접 둘러볼 때도 모인다)
// 2) 지시를 받으면 동을 찾아 이동하고, 그 동의 매물 목록을 천천히 넘기며 모은다
(function () {
  if (window.__rsaPage) return;
  window.__rsaPage = true;

  var GAP = 1500;        // 요청 사이 간격(ms)
  var MAX_REQUESTS = 200; // 한 번 수집에서 보내는 요청 상한
  var TYPES = { apt: 'APT:ABYG:JGC', opst: 'OPST', villa: 'VL:DDDGG:JWJT:SGJT:HOJT', shop: 'SG:SMS:GJCG:APTHGJ:GM:TJ' };

  var responses = [], index = {}, log = [], token = '', sent = 0, running = false;
  var toExt = function (m) { m.__rsa = 'to-ext'; window.postMessage(m, location.origin); };
  var status = function (text) { toExt({ type: 'status', text: text }); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

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
  function record(url, text) {
    if (!text || text.length < 2 || text.length > 3000000) return null;
    var data; try { data = JSON.parse(text); } catch (e) { return null; }
    var n = countItems(data, 0);
    if (n || /"(cortarNo|legalDivisionNumber)"/.test(text)) {
      var item = { url: String(url), count: n, data: data };
      if (index[item.url] != null) responses[index[item.url]] = item;
      else if (responses.length < 600) { index[item.url] = responses.length; responses.push(item); }
    }
    return data;
  }

  // ── 화면이 보내는 요청 지켜보기 (응답 기록 + 화면이 쓰는 인증 값 확인) ──
  var origFetch = window.fetch;
  function noteAuth(h) {
    try {
      if (!h) return;
      var v = typeof h.get === 'function' ? h.get('authorization') : (h.authorization || h.Authorization);
      if (v) token = v;
    } catch (e) {}
  }
  if (origFetch) {
    window.fetch = function (input, init) {
      noteAuth(init && init.headers); noteAuth(input && input.headers);
      return origFetch.apply(this, arguments).then(function (r) {
        try {
          if ((r.headers.get('content-type') || '').indexOf('json') >= 0) r.clone().text().then(function (t) { record(r.url || input, t); }).catch(function () {});
        } catch (e) {}
        return r;
      });
    };
  }
  var xo = XMLHttpRequest.prototype.open, xh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    var xhr = this;
    xhr.addEventListener('load', function () {
      try {
        if (xhr.responseType === '' || xhr.responseType === 'text') record(url, xhr.responseText);
        else if (xhr.responseType === 'json') record(url, JSON.stringify(xhr.response));
      } catch (e) {}
    });
    return xo.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (/^authorization$/i.test(k)) token = v;
    return xh.apply(this, arguments);
  };

  // ── 직접 요청 (천천히, 막히면 즉시 중단) ──
  function Blocked(code) { this.code = code; }
  async function api(path) {
    if (sent >= MAX_REQUESTS) throw new Blocked('limit');
    if (sent) await sleep(GAP);
    sent++;
    var r = await origFetch(path, { headers: token ? { authorization: token } : {}, credentials: 'include' });
    log.push({ url: path, status: r.status });
    if (r.status === 429 || r.status === 401 || r.status === 403) throw new Blocked(r.status);
    if (!r.ok) return null;
    return record(path, await r.text());
  }
  async function waitToken() {
    for (var i = 0; i < 16 && !token; i++) await sleep(500);
  }

  function file(extra) {
    var out = { source: 'realtor-super-app-collector', version: 2, savedAt: new Date().toISOString(), pageUrl: location.href, title: document.title, responses: responses, log: log, pageText: ((document.body && document.body.innerText) || '').slice(0, 30000) };
    for (var k in extra) out[k] = extra[k];
    return out;
  }
  function total() { var t = 0; for (var i = 0; i < responses.length; i++) t += responses[i].count; return t; }

  // 1단계: 구 코드와 동 이름으로 지역을 찾는다
  async function locate(task) {
    status('‘' + task.dong + '’을(를) 찾는 중…');
    await waitToken();
    var data = await api('/api/regions/list?cortarNo=' + task.gu + '00000');
    var list = (data && (data.regionList || data.result || data.list)) || [];
    var want = task.dong.replace(/\s/g, '');
    var hit = list.filter(function (r) { return r.cortarName === want; })[0] || list.filter(function (r) { return String(r.cortarName || '').indexOf(want) >= 0; })[0];
    if (!hit) {
      var names = list.map(function (r) { return r.cortarName; }).filter(Boolean).slice(0, 40).join(', ');
      throw new Error(list.length ? '‘' + task.dong + '’을(를) 찾지 못했습니다. 이 구의 동: ' + names : '지역 목록을 받지 못했습니다. 네이버 화면 구조가 달라졌을 수 있습니다.');
    }
    var url = '';
    if (hit.centerLat && hit.centerLon) url = location.origin + '/complexes?ms=' + hit.centerLat + ',' + hit.centerLon + ',16&a=' + TYPES[task.type || 'apt'] + '&e=RETAIL';
    toExt({ type: 'located', region: { cortarNo: String(hit.cortarNo), name: hit.cortarName }, url: url });
  }

  function listOf(d) { return (d && (d.articleList || d.body || d.list)) || []; }
  function more(d) { return !!(d && (d.isMoreData || d.more)); }

  // 2단계: 그 동의 매물 목록을 끝까지 넘기며 모은다
  async function collect(task) {
    var code = task.region.cortarNo, name = task.region.name, types = encodeURIComponent(TYPES[task.type || 'apt']);
    var complete = false, pages = 0, names = {};
    names[code] = name;
    await waitToken();
    status(name + ' 매물을 모으는 중…');

    // (가) 동 전체 목록
    var q = '/api/articles?cortarNo=' + code + '&order=rank&realEstateType=' + types + '&tradeType=&priceType=RETAIL&sameAddressGroup=true&page=';
    var d = await api(q + 1);
    if (listOf(d).length) {
      pages = 1;
      while (more(d) && pages < 100) { d = await api(q + (++pages)); status(name + ' 매물 목록 ' + pages + '쪽 · 약 ' + total() + '건'); }
      complete = !more(d);
    } else if (task.type === 'apt' || task.type === 'opst' || !task.type) {
      // (나) 단지 목록 → 단지별 매물
      var cd = await api('/api/regions/complexes?cortarNo=' + code + '&realEstateType=' + types + '&order=');
      var complexes = (cd && (cd.complexList || cd.list)) || [];
      complete = complexes.length > 0;
      for (var i = 0; i < complexes.length; i++) {
        var c = complexes[i];
        var cnt = (c.dealCount || 0) + (c.leaseCount || 0) + (c.rentCount || 0) + (c.shortTermRentCount || 0);
        if ('dealCount' in c && !cnt) continue; // 매물이 없는 단지는 건너뛴다
        status(name + ' · ' + (c.complexName || c.complexNo) + ' (' + (i + 1) + '/' + complexes.length + ') · 약 ' + total() + '건');
        var cq = '/api/articles/complex/' + c.complexNo + '?realEstateType=' + types + '&tradeType=&priceType=RETAIL&order=rank&sameAddressGroup=true&type=list&complexNo=' + c.complexNo + '&page=';
        var p = 1, cdta = await api(cq + p);
        while (more(cdta) && p < 30) cdta = await api(cq + (++p));
        if (more(cdta)) complete = false;
      }
    }
    var n = total();
    toExt({ type: 'done', text: name + ' 매물 약 ' + n + '건을 모았습니다.' + (complete ? '' : ' (일부만 모였을 수 있습니다)'), file: file({ fullRegions: complete && n ? [code] : [], regionName: name, regionNames: names }) });
  }

  async function guard(fn, task) {
    if (running) return;
    running = true; sent = 0;
    try { await fn(task); }
    catch (e) {
      var n = total();
      var why = e instanceof Blocked
        ? (e.code === 'limit' ? '요청 상한(' + MAX_REQUESTS + '회)에 도달해 멈췄습니다.' : '네이버가 요청을 거절했습니다(' + e.code + '). 더 시도하지 않고 멈췄습니다. 잠시 뒤 다시 해 주세요.')
        : (e && e.message) || String(e);
      if (n) toExt({ type: 'done', text: why + ' 그때까지 모은 약 ' + n + '건은 저장했습니다.', file: file({ fullRegions: [] }) });
      else toExt({ type: 'error', text: why });
    }
    running = false;
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.__rsa !== 'to-page') return;
    var d = e.data;
    if (d.cmd === 'locate') guard(locate, d.task);
    if (d.cmd === 'collect') guard(collect, d.task);
    if (d.cmd === 'snapshot') toExt({ type: 'done', text: '지금까지 화면에서 모은 매물 약 ' + total() + '건을 저장했습니다.', file: file({ fullRegions: [] }) });
  });
})();
