// Editable OpenAI-compatible model selector. Fetch only on explicit opening.
(() => {
  let sequence = 0;
  const instances = new WeakMap();
  function attach(input, options) {
    if (input.closest('.model-picker')) return;
    const ru = () => options.language() === 'ru';
    const text = (r, e) => ru() ? r : e;
    const host = document.createElement('span'); host.className = 'model-picker';
    input.before(host); host.append(input);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'model-picker-trigger';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    host.append(button);
    const popup = document.createElement('div'); popup.className = 'model-picker-popup'; popup.hidden = true; popup.id = 'model-picker-' + ++sequence; popup.role = 'listbox';
    document.body.append(popup);
    input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-controls',popup.id); input.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls',popup.id); button.setAttribute('aria-expanded','false');
    let controller = null, ids = [], visible = [], active = -1;
    const label = () => { button.title = text('Загрузить список моделей','Load available models'); button.setAttribute('aria-label',button.title); };
    label();
    function close() {
      if (controller) { controller.abort(); options.onResult?.(); }
      controller = null; popup.hidden = true;
      input.setAttribute('aria-expanded','false'); button.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant');
    }
    function position() {
      if (popup.hidden) return;
      const r = host.getBoundingClientRect(), below = innerHeight - r.bottom - 8, above = r.top - 8;
      const height = Math.min(280, Math.max(below,above));
      popup.style.width = Math.min(Math.max(r.width,200),innerWidth - 16) + 'px';
      popup.style.left = Math.max(8,Math.min(r.left,innerWidth - parseFloat(popup.style.width) - 8)) + 'px';
      popup.style.maxHeight = Math.max(40,height) + 'px';
      popup.style.top = below >= Math.min(160,above) ? r.bottom + 3 + 'px' : Math.max(8,r.top - popup.offsetHeight - 3) + 'px';
    }
    function status(message) {
      popup.replaceChildren(); const node = document.createElement('div'); node.className = 'model-picker-status'; node.role = 'status'; node.textContent = message; popup.append(node); position();
    }
    function select(id) {
      input.value = id; close();
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); input.focus();
    }
    function activate(index) {
      active = index;
      [...popup.querySelectorAll('[role=option]')].forEach((node,i) => node.setAttribute('aria-selected',String(i === active)));
      const node = popup.querySelectorAll('[role=option]')[active];
      if (node) { input.setAttribute('aria-activedescendant',node.id); node.scrollIntoView({block:'nearest'}); }
      else input.removeAttribute('aria-activedescendant');
    }
    function render(filter = '') {
      visible = ids.filter(id => id.toLowerCase().includes(filter.toLowerCase())); active = -1; popup.replaceChildren(); input.removeAttribute('aria-activedescendant');
      if (!visible.length) return status(text('Модели не найдены. Можно ввести имя вручную.','No models found. You can enter a model name manually.'));
      visible.forEach((id,index) => {
        const node = document.createElement('div'); node.className = 'model-picker-option'; node.role = 'option'; node.id = popup.id + '-' + index; node.setAttribute('aria-selected','false'); node.textContent = id;
        node.addEventListener('pointerdown',event => event.preventDefault());
        node.addEventListener('click',() => select(id)); popup.append(node);
      }); position();
    }
    async function open() {
      if (input.matches(':disabled') || input.readOnly) return;
      close(); label(); ids = []; visible = []; active = -1;
      popup.hidden = false; input.setAttribute('aria-expanded','true'); button.setAttribute('aria-expanded','true');
      const loading = text('Загрузка моделей…','Loading models…');
      status(loading); options.onResult?.('loading', loading);
      const request = new AbortController(); controller = request;
      const timer = setTimeout(() => request.abort(),options.timeout);
      try {
        const connection = options.connection();
        const proxyUrl = connection.useProxy ? LocalProxyTransport.getUrl() : null;
        const url = new URL(connection.baseUrl,location.href);
        if (!connection.baseUrl || !['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(text('Проверьте Base URL API.','Check the API Base URL.'));
        url.pathname = url.pathname.replace(/\/+$/,'').replace(/\/(chat\/completions|embeddings|models)$/,'') + '/models';
        const response = await LocalProxyTransport.fetch(url.href,{method:'GET',headers:connection.headers,signal:request.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'},connection.useProxy);
        if (!response.ok) throw new Error('HTTP ' + response.status + '. ' + text('Проверьте Base URL, ключ и доступ к списку моделей.','Check Base URL, API key and access to the model list.'));
        const data = await response.json();
        if (controller !== request || popup.hidden) return;
        // Ignore results if credentials or endpoint changed while loading.
        const current = options.connection();
        if (current.baseUrl !== connection.baseUrl || JSON.stringify(current.headers) !== JSON.stringify(connection.headers) || current.useProxy !== connection.useProxy || (proxyUrl && proxyUrl !== LocalProxyTransport.getUrl())) return close();
        const models = Array.isArray(data) ? data : data?.data ?? data?.models;
        if (!Array.isArray(models)) throw new Error(text('API вернул некорректный список моделей.','The API returned an invalid model list.'));
        ids = [...new Set(models.map(model => typeof model === 'string' ? model : model?.id).filter(id => typeof id === 'string' && id.trim()))].sort((a,b) => a.localeCompare(b));
        render();
        options.onResult?.('ready', text('Подключено. Моделей: ', 'Connected. Models: ') + ids.length);
      } catch (error) {
        if (controller !== request || popup.hidden) return;
        const message = request.signal.aborted ? text('Время ожидания истекло. Откройте список повторно.','Request timed out. Open the list again.') : error instanceof TypeError ? text('Не удалось загрузить модели. Проверьте сеть, Base URL и CORS сервера.','Could not load models. Check network, Base URL and server CORS.') : error instanceof SyntaxError ? text('API вернул не JSON. Проверьте Base URL.','The API returned non-JSON data. Check Base URL.') : error.message;
        if (options.onResult?.('error', message)) {
          controller = null;
          close();
        } else status(message);
      } finally {
        clearTimeout(timer);
        if (controller === request) controller = null;
      }
    }
    button.addEventListener('focus',label); button.addEventListener('pointerenter',label);
    button.addEventListener('click',event => { event.preventDefault(); popup.hidden ? open() : close(); });
    input.addEventListener('input',() => { if (!popup.hidden && ids.length) render(input.value); });
    input.addEventListener('keydown',event => {
      if (event.key === 'Escape' && !popup.hidden) { event.preventDefault(); close(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); if (popup.hidden) { open(); return; }
        if (visible.length) activate(active < 0 ? (event.key === 'ArrowDown' ? 0 : visible.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length);
      } else if (event.key === 'Enter' && !popup.hidden && active >= 0) { event.preventDefault(); select(visible[active]); }
      else if (event.key === 'Tab') close();
    });
    document.addEventListener('pointerdown',event => { if (!host.contains(event.target) && !popup.contains(event.target)) close(); });
    document.addEventListener('scroll',position,true); window.addEventListener('resize',position); window.addEventListener('pagehide',close);
    const reset = () => { close(); options.onResult?.(); };
    (options.sources || []).forEach(source => { source.addEventListener('input',reset); source.addEventListener('change',reset); });
    const sync = () => { button.disabled = input.disabled || input.readOnly; if (button.disabled) close(); };
    new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled','readonly']}); sync();
    instances.set(input,{open,close});
  }
  window.ModelPicker = {attach,open:input=>instances.get(input)?.open()};
  const input = document.getElementById('openai-model');
  const connectionStatus = document.getElementById('openai-model-status');
  if (input) attach(input,{
    onResult(state, message) {
      if (connectionStatus) connectionStatus.textContent = connectionStatus.title = state === 'ready' ? message : '';
    },
    language: () => lang,
    connection: () => { const config = readOpenAIForm(); return {baseUrl:config.baseUrl,headers:openAIRequestHeaders(config),useProxy:config.useProxy}; },
    timeout: CFG_REQUEST_TIMEOUT_MS,
    sources: [document.getElementById('openai-base-url'),document.getElementById('openai-api-key'),document.getElementById('openai-profile-select'),openAIProxyControl.input]
  });
})();
