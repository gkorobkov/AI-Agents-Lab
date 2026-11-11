// GDELT adapter shared by the Tools workbench and agent tool calls.
(() => {
  let cfg;
  const ready = (async () => {
    try { cfg = window.gdeltDefaults || parent.gdeltDefaults; } catch (_) {}
    if (!cfg) {
      // Standalone tools.html consumes the same defaults as the application.
      const response = await fetch('index.html');
      if (!response.ok) throw new Error('GDELT configuration unavailable.');
      const match = (await response.text()).match(/const CFG_GDELT_DEFAULTS = (\{[\s\S]*?\n\});/);
      if (!match) throw new Error('GDELT configuration unavailable.');
      cfg = JSON.parse(match[1]);
    }
  })();
  const fail = message => { throw Object.assign(new Error(message), {category:'invalid_parameters'}); };
  const text = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : null;
  function plain(value, key) {
    if (value === undefined) return '';
    const result = text(value);
    if (result === null || result.length > cfg.maxTextLength || result && (!/^[\p{L}\p{N}\s.'’\-]+$/u.test(result) || /(?:^|\s)(?:OR|AND|NOT)(?:\s|$)|(?:^|\s)-/i.test(result))) fail('Invalid plain-text field: ' + key + '. GDELT operators are not accepted.');
    return result;
  }
  function date(value, key) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) fail(key + ' must be an ISO 8601 UTC timestamp ending in Z.');
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,19) !== value.slice(0,19)) fail('Invalid date: ' + key);
    return parsed;
  }
  function prepare(args, now = new Date()) {
    if (!cfg) fail('GDELT configuration is not ready.');
    if (!args || typeof args !== 'object' || Array.isArray(args)) fail('Arguments must be an object.');
    const allowed = ['city','keywords','timespan','start_date','end_date','source_language','source_country','sort','limit'];
    if (Object.keys(args).some(key => !allowed.includes(key))) fail('Unknown GDELT argument.');
    let city = plain(args.city, 'city'), keywords = plain(args.keywords, 'keywords');
    city = cfg.cityAliases[city.toLowerCase()] || city;
    if (!city && !keywords) fail('Specify city or keywords.');
    const limit = args.limit ?? cfg.limit, sort = args.sort ?? cfg.sort;
    if (!Number.isInteger(limit) || limit < 1 || limit > cfg.maxLimit) fail('limit must be an integer from 1 to ' + cfg.maxLimit + '.');
    if (!['datedesc','hybridrel'].includes(sort)) fail('sort must be datedesc or hybridrel.');
    const query = { ...(city ? {city} : {}), ...(keywords ? {keywords} : {}), sort, limit };
    const expression = [city, keywords].filter(Boolean).map(value => '"' + value + '"');
    for (const [field, operator, aliases] of [['source_language','sourcelang',cfg.languageAliases],['source_country','sourcecountry',cfg.countryAliases]]) {
      const value = plain(args[field],field);
      if (!value) continue;
      const normalized = aliases[value.toLowerCase()] || value.toLowerCase().replace(/\s/g,'');
      if (!/^[a-z]+$/.test(normalized)) fail(field + ' must be an English name or supported GDELT code.');
      query[field] = normalized; expression.push(operator + ':' + normalized);
    }
    const url = new URL(cfg.endpoint);
    url.searchParams.set('mode','artlist'); url.searchParams.set('format','json');
    url.searchParams.set('query',expression.join(' ')); url.searchParams.set('sort',sort); url.searchParams.set('maxrecords',limit);
    // Calendar months, with end-of-month clamping, rather than an approximate 90 days.
    const earliest = new Date(now); earliest.setUTCDate(1); earliest.setUTCMonth(earliest.getUTCMonth() - cfg.historyMonths);
    const lastDay = new Date(Date.UTC(earliest.getUTCFullYear(),earliest.getUTCMonth()+1,0)).getUTCDate();
    earliest.setUTCDate(Math.min(now.getUTCDate(),lastDay));
    if (args.start_date || args.end_date) {
      const start = args.start_date ? date(args.start_date,'start_date') : earliest;
      const end = args.end_date ? date(args.end_date,'end_date') : now;
      if (start < earliest || end < earliest || start > now || end > now || end - start < cfg.minWindowMs) fail('Dates must be within the last ' + cfg.historyMonths + ' months, not in the future, and at least 15 minutes apart.');
      query.start_date = start.toISOString(); query.end_date = end.toISOString();
      const stamp = value => value.toISOString().slice(0,19).replace(/[-:T]/g,'');
      url.searchParams.set('startdatetime',stamp(start)); url.searchParams.set('enddatetime',stamp(end));
    } else {
      const timespan = args.timespan ?? cfg.timespan;
      const match = typeof timespan === 'string' && timespan.match(/^([1-9]\d*)(min|h|d|w|m)$/);
      if (!match) fail('timespan must use min, h, d, w or m, for example 24h or 7d.');
      const amount = Number(match[1]), unit = match[2];
      const duration = amount * ({min:60000,h:3600000,d:86400000,w:604800000,m:0}[unit]);
      if (unit === 'm' ? amount > cfg.historyMonths : duration < cfg.minWindowMs || duration > now - earliest) fail('timespan is outside the available GDELT window (15 minutes to ' + cfg.historyMonths + ' months).');
      query.timespan = timespan; url.searchParams.set('timespan',timespan);
    }
    return {url:url.href,method:'GET',query};
  }
  function buildRequest(tool, args) {
    if (tool.http.method !== 'GET' || tool.http.url !== cfg.endpoint || tool.http.auth?.placement && tool.http.auth.placement !== 'none') fail('The GDELT adapter requires its configured public GET endpoint without credentials.');
    return prepare(args);
  }
  function safeURL(value, deduplicate = false) {
    try {
      if (typeof value !== 'string' || !value.trim()) return null;
      const url = new URL(value);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
      url.hash = '';
      if (deduplicate) { for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key); url.searchParams.sort(); }
      return url.href;
    } catch (_) { return null; }
  }
  function normalize(payload, query, now = new Date()) {
    if (!payload || !Array.isArray(payload.articles)) throw Object.assign(new Error('GDELT returned an invalid articles response.'),{category:'invalid_response'});
    const articles = [], seen = new Set(), nullable = value => typeof value === 'string' && value.trim() ? value.trim() : null;
    for (const item of payload.articles) {
      if (!item || typeof item !== 'object') continue;
      const url = safeURL(item.url,true); if (!url || seen.has(url)) continue;
      let published = null;
      if (typeof item.seendate === 'string') {
        const value = item.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
        try { const parsed = date(value,'seendate'); if (parsed > now) continue; published = parsed.toISOString().replace('.000Z','Z'); } catch (_) {}
      }
      seen.add(url);
      articles.push({title:nullable(item.title),url,published_at:published,domain:nullable(item.domain),language:nullable(item.language),source_country:nullable(item.sourcecountry),image_url:safeURL(item.socialimage)});
      if (articles.length >= query.limit) break;
    }
    return {source:'gdelt',status:articles.length ? 'ok' : 'empty',query,count:articles.length,articles};
  }
  function pause(ms, signal) {
    return new Promise((resolve,reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled','AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort',abort); resolve(); },ms);
      if (signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
    });
  }
  let queue = Promise.resolve(), nextRequestAt = 0;
  async function requestSlot(operation, signal, onProgress) {
    const run = async () => {
      signal?.throwIfAborted();
      let stored = 0;
      try { stored = Number(localStorage.getItem(cfg.requestGateKey)) || 0; } catch (_) {}
      const delay = Math.min(cfg.minRequestIntervalMs, Math.max(0, Math.max(stored,nextRequestAt) - Date.now()));
      if (delay) { onProgress?.({stage:'waiting',wait_ms:delay}); await pause(delay,signal); }
      signal?.throwIfAborted();
      try { return await operation(); }
      finally {
        nextRequestAt = Date.now() + cfg.minRequestIntervalMs;
        try { localStorage.setItem(cfg.requestGateKey,String(nextRequestAt)); } catch (_) {}
      }
    };
    onProgress?.({stage:'queued'});
    // Web Locks coordinates the chat, Tools iframe and other same-origin tabs.
    if (globalThis.navigator?.locks) return navigator.locks.request(cfg.requestGateKey, signal ? {signal} : {}, run);
    const pending = queue.then(run,run);
    queue = pending.catch(() => {});
    return pending;
  }

  async function execute(tool, args, {signal,onProgress} = {}) {
    const started = performance.now(), requestId = crypto.randomUUID();
    let query = {}, externalStatus = null, result;
    try {
      await ready;
      const request = buildRequest(tool,args); query = request.query;
      for (let attempt = 0; ; attempt++) {
        let retryMs = cfg.retryDelayMs;
        try {
          signal?.throwIfAborted();
          result = await requestSlot(async () => {
            const controller = new AbortController(), abort = () => controller.abort();
            signal?.addEventListener('abort',abort,{once:true});
            const timer = setTimeout(abort,cfg.timeoutMs);
            onProgress?.({stage:'request',attempt:attempt+1,timeout_ms:cfg.timeoutMs});
            try {
              const response = await fetch(request.url,{method:'GET',credentials:'omit',redirect:'error',signal:controller.signal});
              externalStatus = response.status;
              if (!response.ok) {
                const header = response.headers.get('Retry-After');
                const seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
                if (Number.isFinite(seconds) && seconds > 0) retryMs = Math.max(retryMs,seconds);
                // Do not wait for an error body or echo arbitrary upstream text.
                response.body?.cancel().catch(() => {});
                throw Object.assign(new Error(response.status === 429 ? 'GDELT rate limit (HTTP 429). Wait before trying again; the limit may be shared by other users of your IP.' : 'GDELT HTTP ' + response.status + '.'),{category:response.status === 429 ? 'rate_limit' : 'http',retryable:retryMs <= cfg.maxRetryDelayMs && (response.status === 429 || response.status >= 500)});
              }
              if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('Content-Type') || '')) throw Object.assign(new Error('GDELT returned text or HTML instead of JSON. Check search terms and filters.'),{category:'invalid_response'});
              const body = await response.text();
              let payload;
              try { payload = JSON.parse(body); } catch (_) { throw Object.assign(new Error('GDELT returned malformed JSON.'),{category:'invalid_json'}); }
              return normalize(payload,query);
            } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
          },signal,onProgress);
          break;
        } catch (error) {
          if (signal?.aborted) throw Object.assign(new Error('GDELT request cancelled.'),{category:'cancelled'});
          const category = error.category || (error.name === 'AbortError' ? 'timeout' : 'unavailable');
          if (attempt >= cfg.retries || error.retryable === false || error.category && !error.retryable) throw Object.assign(new Error(error.category ? error.message : category === 'timeout' ? 'GDELT request timed out. Try a shorter period or a simpler query.' : 'No readable HTTP response from GDELT. Possible network failure or browser CORS block, including a rate-limit response without CORS headers. Check DevTools Network and retry later.'),{category});
          onProgress?.({stage:'retry',attempt:attempt+2,wait_ms:retryMs});
          await pause(retryMs,signal);
        }
      }
    } catch (error) {
      result = {source:'gdelt',status:'error',query,count:0,articles:[],error:{category:signal?.aborted ? 'cancelled' : error.category || 'unavailable',message:error.category ? error.message : 'GDELT request could not be completed.'}};
    }
    const telemetry = {tool_name:tool.name,request_id:requestId,duration_ms:Math.round(performance.now()-started),external_http_status:externalStatus,result_count:result.count,error_category:result.error?.category || null};
    window.dispatchEvent(new CustomEvent('tool:request',{detail:telemetry}));
    return {...result,meta:telemetry};
  }
  window.GdeltTool = {ready,prepare,buildRequest,normalize,execute};
})();
