(() => {
  'use strict';
  const storageKey = 'ai_proxy_url';
  const targetHeader = 'X-Proxy-Target-URL';
  let defaultUrl = typeof CFG_LOCAL_PROXY_DEFAULT_URL === 'string' ? CFG_LOCAL_PROXY_DEFAULT_URL : '';
  let healthTimeoutMs = typeof CFG_LOCAL_PROXY_HEALTH_TIMEOUT_MS === 'number' ? CFG_LOCAL_PROXY_HEALTH_TIMEOUT_MS : undefined;
  let defaultsRequest;
  const tr = (ru, en) => (localStorage.getItem('n8n_lang') || document.documentElement.lang) === 'en' ? en : ru;

  // Standalone pages consume the same defaults as the main page.
  function ready() {
    if (defaultUrl && healthTimeoutMs) return Promise.resolve(defaultUrl);
    if (!defaultsRequest) {
      defaultsRequest = fetch('index.html').then(async response => {
        if (!response.ok) throw new Error();
        const html = await response.text();
        const url = html.match(/^const CFG_LOCAL_PROXY_DEFAULT_URL = '([^']+)';$/m);
        const timeout = html.match(/^const CFG_LOCAL_PROXY_HEALTH_TIMEOUT_MS = ([1-9]\d*);$/m);
        if (!url || !timeout) throw new Error();
        healthTimeoutMs = Number(timeout[1]);
        return (defaultUrl = url[1]);
      }).catch(() => {
        defaultsRequest = null;
        throw new Error(tr('Не удалось загрузить адрес прокси по умолчанию.', 'Could not load the default proxy URL.'));
      });
    }
    return defaultsRequest;
  }

  function getUrl() { return localStorage.getItem(storageKey) || defaultUrl; }

  function setUrl(value) {
    const url = baseUrl(value.trim() || defaultUrl).href.replace(/\/+$/, '');
    if (getUrl() === url) return;
    localStorage.setItem(storageKey, url);
    window.dispatchEvent(new Event('ai-proxy:url-change'));
  }

  function baseUrl(value) {
    let url;
    try { url = new URL(value); } catch (_) {}
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[?#]/.test(url.href)) {
      throw new Error(tr('Некорректный URL прокси. Укажите HTTP(S) адрес без учётных данных, параметров или фрагмента.', 'Invalid proxy URL. Use an HTTP(S) address without credentials, query or fragment.'));
    }
    return url;
  }

  function metadata(enabled) {
    if (enabled !== true) return null;
    try { return {mode:'proxy', url:baseUrl(getUrl()).href}; }
    catch (_) { return {mode:'proxy', url:null}; }
  }

  function endpoint(base, path) { return base.href.replace(/\/+$/, '') + '/' + path; }

  function isLocal(base) {
    const host = base.hostname.replace(/\.$/, '');
    return host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || /^127\.(?:\d+\.){2}\d+$/.test(host);
  }

  async function proxyFetch(originalUrl, options, enabled) {
    if (enabled !== true) return fetch(originalUrl, options);
    if (!getUrl()) await ready();
    const base = baseUrl(getUrl());
    const target = new URL(originalUrl, location.href);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
      throw new Error(tr('Некорректный исходный URL.', 'Invalid original URL.'));
    }
    target.hash = '';
    const headers = new Headers(options?.headers);
    if (headers.has(targetHeader)) throw new Error(tr('Заголовок прокси зарезервирован.', 'The proxy header is reserved.'));
    if (options?.mode === 'no-cors') throw new Error(tr('Для прокси требуется CORS.', 'Proxy mode requires CORS.'));
    headers.set(targetHeader, target.href);
    try {
      return await fetch(endpoint(base, 'proxy'), { ...options, headers, credentials:'omit', redirect:'error' });
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      throw new Error(tr('Прокси недоступен или браузер заблокировал запрос. Проверьте прокси и разрешения браузера.', 'The proxy is unavailable or the browser blocked the request. Check the proxy and browser permissions.'), {cause:error});
    }
  }

  async function check(signal) {
    await ready();
    const base = baseUrl(getUrl());
    const timeout = AbortSignal.timeout(healthTimeoutMs);
    signal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const url = endpoint(base, 'health');
    let response;
    try {
      response = await fetch(url, { signal, credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', cache:'no-store' });
    } catch (_) {
      for (const name of ['loopback-network', 'local-network-access']) {
        try {
          if (isLocal(base) && (await navigator.permissions?.query({name}))?.state === 'denied') return {status:'blocked', url};
        } catch (_) { /* This permission is not available in all browsers. */ }
      }
      return {status:navigator.onLine === false ? 'offline' : 'unreachable', url};
    }
    const value = response.ok ? await response.json().catch(() => null) : null;
    if (value?.service !== 'ai-agents-local-proxy' || value.status !== 'ok') return { status:'invalid', url };
    return { status:'connected', url, version:typeof value.version === 'string' ? value.version : '' };
  }

  globalThis.LocalProxyTransport = { fetch:proxyFetch, ready, getUrl, setUrl, storageKey, metadata, check, tr };
})();
