(() => {
  'use strict';
  const lib = window.ToolLibrary;
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  let english = false;
  try { english = localStorage.getItem('n8n_lang') === 'en'; } catch (_) {}
  const tr = (ru, en) => english ? en : ru;
  const en = {
    library:'LIBRARY',create:'+ Custom tool',navNote:'Configure once. Connect to your agent and override only what you need.',modelNote:'The model sees the function name, description and argument schema. It decides when to request a call. The application performs the HTTP request; adding a tool does not guarantee a call.',definition:'What the tool does',title:'Library title',name:'Function name for the model',description:'Description for the model',descriptionHint:'Explain when to call the function, what input to provide and what the result contains. The model also uses this description to explain its capabilities.',schema:'Model arguments · JSON Schema',strict:'Strict schema matching (strict)',http:'Where to send the request',method:'Method',query:'URL parameters',addParameter:'+ Parameter',mappingHint:'{{name}} reads a model argument. Plain text is a constant, for example language = en.',advanced:'Authentication, request body and library description',body:'Request body (POST, JSON template)',auth:'Authentication',authNone:'Not required',authQuery:'API key in URL parameter',authHeader:'API key in header',authName:'Parameter / header name',authPrefix:'Prefix (optional)',clearKey:'Remove session key',keyHint:'The key is kept only in this browser session and bound to the server. It is never included in the model function definition.',summary:'Library explanation',docs:'Official documentation',provider:'Provider website',test:'Test a real call',arguments:'Function arguments · JSON',run:'Run HTTP request',abort:'Stop',cors:'The request runs in your browser. The tool server must allow CORS.',request:'Request · without secrets',response:'The server response will appear here',saveCopy:'Save a copy',addAgent:'Connect to agent →',delete:'Delete'
  };
  const ru = Object.fromEntries(Array.from(document.querySelectorAll('[data-i18n]'), el => [el.dataset.i18n, el.textContent]));
  function applyLanguage() {
    document.documentElement.lang = english ? 'en' : 'ru';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = (english ? en : ru)[el.dataset.i18n] || ru[el.dataset.i18n]; });
  }
  applyLanguage();
  if (english) $('test-args').value = '{"name":"Berlin"}';
  if (!lib) { $('page-status').textContent = tr('Не удалось загрузить библиотеку инструментов.', 'Could not load the tool library.'); return; }
  let draft, original = '', dirty = false, controller = null;
  const fields = { title:'edit-title', summary:'edit-summary', docsUrl:'edit-docs', providerUrl:'edit-provider' };
  function status(message, error = false) { $('page-status').textContent = message; $('page-status').classList.toggle('error', error); }
  function readDraft() {
    const next = clone(draft);
    Object.entries(fields).forEach(([key, id]) => { next[key] = $(id).value.trim(); });
    next.tool.name = $('edit-name').value.trim();
    next.tool.description = $('edit-description').value.trim();
    next.tool.parameters = $('edit-schema').value;
    next.tool.strict = $('edit-strict').checked;
    next.tool.http = { ...next.tool.http, url:$('edit-url').value.trim(), method:$('edit-method').value,
      mappings:Array.from($('mappings').children).map(row => ({ key:row.querySelector('[data-key]').value.trim(), value:row.querySelector('[data-value]').value })).filter(item => item.key),
      body:$('edit-body').value, auth:{ ...next.tool.http.auth, placement:$('edit-auth').value, name:$('edit-auth-name').value.trim(), prefix:$('edit-auth-prefix').value } };
    return next;
  }
  function updateDirty() {
    dirty = !lib.get(draft.id) || JSON.stringify(readDraft()) !== original || !!$('edit-key').value;
    $('dirty-state').textContent = dirty ? tr('Есть изменения', 'Unsaved changes') : tr('Сохранено', 'Saved');
    $('dirty-state').classList.toggle('dirty', dirty);
    $('auth-fields').hidden = $('edit-auth').value === 'none';
  }
  function renderPicker() {
    $('library-list').replaceChildren();
    lib.list().forEach(record => {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('aria-current', String(record.id === draft?.id)); button.disabled = !!controller;
      const title = document.createElement('span'); title.textContent = record.title;
      const name = document.createElement('small'); name.textContent = record.tool.name;
      button.append(title, name); button.onclick = () => select(record); $('library-list').append(button);
    });
  }
  function mappingRow(item = { key:'', value:'' }) {
    const row = document.createElement('div'); row.className = 'mapping';
    const key = document.createElement('input'); key.dataset.key = ''; key.value = item.key; key.placeholder = 'name'; key.setAttribute('aria-label', tr('Имя параметра', 'Parameter name'));
    const value = document.createElement('input'); value.dataset.value = ''; value.value = item.value; value.placeholder = '{{name}}'; value.setAttribute('aria-label', tr('Значение параметра', 'Parameter value'));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', tr('Удалить параметр', 'Remove parameter')); remove.onclick = () => { row.remove(); updateDirty(); };
    row.append(key, value, remove); $('mappings').append(row);
  }
  function safeLink(url, label) {
    try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) return; const a = document.createElement('a'); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label + ' ↗'; $('official-links').append(a); } catch (_) {}
  }
  function renderSummary() {
    $('tool-summary').textContent = english && draft.builtin ? 'Find cities and their coordinates with Open-Meteo Geocoding. Returns matching places, latitude, longitude and country. Use the coordinates in a separate weather tool.' : draft.summary || tr('Опишите назначение инструмента, затем настройте его вызов.', 'Describe what this tool does, then configure its request.');
  }
  function select(record, force = false) {
    if (!force && dirty && !confirm(tr('Перейти к другому инструменту и потерять несохранённые изменения?', 'Switch tools and discard unsaved changes?'))) return;
    if (controller) { status(tr('Сначала остановите текущий запрос.', 'Stop the current request before switching tools.'), true); return; }
    draft = clone(record); draft.tool.http ||= { url:'', method:'GET', mappings:[], body:'' }; draft.tool.http.auth ||= { placement:'none', name:'', prefix:'', secretId:lib.newId() };
    draft.tool.http.auth.secretId ||= lib.newId();
    Object.entries(fields).forEach(([key, id]) => { $(id).value = draft[key] || ''; });
    $('tool-title').textContent = draft.title || tr('Новый инструмент', 'New tool');
    renderSummary();
    $('tool-kind').textContent = draft.builtin ? tr('ПРЕДУСТАНОВКА', 'BUILT-IN') : tr('ВАШ ИНСТРУМЕНТ', 'CUSTOM TOOL');
    $('official-links').replaceChildren(); safeLink(draft.docsUrl, tr('Документация', 'Documentation')); safeLink(draft.providerUrl, tr('Провайдер', 'Provider'));
    $('edit-name').value = draft.tool.name || ''; $('edit-description').value = draft.tool.description || ''; $('edit-schema').value = typeof draft.tool.parameters === 'string' ? draft.tool.parameters : JSON.stringify(draft.tool.parameters, null, 2);
    $('edit-strict').checked = !!draft.tool.strict; $('edit-url').value = draft.tool.http.url || ''; $('edit-method').value = draft.tool.http.method || 'GET'; $('edit-body').value = draft.tool.http.body || '';
    $('edit-auth').value = draft.tool.http.auth.placement || 'none'; $('edit-auth-name').value = draft.tool.http.auth.name || ''; $('edit-auth-prefix').value = draft.tool.http.auth.prefix || ''; $('edit-key').value = '';
    $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
    $('mappings').replaceChildren(); (draft.tool.http.mappings || []).forEach(mappingRow);
    $('delete-tool').hidden = !!draft.builtin || !lib.get(draft.id);
    $('save-tool').textContent = draft.builtin ? tr('Сохранить копию', 'Save a copy') : tr('Сохранить изменения', 'Save changes');
    $('request-preview').textContent = '—'; $('response-output').textContent = '—'; $('test-status').textContent = tr('Ответ сервера появится здесь', 'The server response will appear here'); $('test-status').classList.remove('error');
    original = JSON.stringify(readDraft()); updateDirty(); renderPicker(); status('');
  }
  function storeKey(record) {
    if ($('edit-key').value) lib.setSecret(record.tool.http.auth.secretId, $('edit-key').value, new URL(record.tool.http.url).origin);
  }
  function save(forAgent = false) {
    if (!$('tool-form').reportValidity()) return null;
    const record = readDraft(); lib.validate(record.tool); storeKey(record);
    const saved = forAgent && record.builtin && JSON.stringify(record) === original ? lib.get(record.id) : lib.save(record);
    select(saved, true); status(tr('Инструмент сохранён в библиотеке.', 'Tool saved to the library.')); return saved;
  }
  $('tool-form').addEventListener('input', updateDirty);
  $('tool-form').addEventListener('change', updateDirty);
  $('tool-form').addEventListener('submit', event => { event.preventDefault(); try { save(); } catch (error) { status(lib.redact(String(error.message || error)), true); } });
  $('add-mapping').onclick = () => { mappingRow(); updateDirty(); $('mappings').lastElementChild.querySelector('input').focus(); };
  $('create-tool').onclick = () => select({ id:lib.newId(), title:tr('Мой инструмент', 'My tool'), summary:'', docsUrl:'', providerUrl:'', builtin:false, tool:{ name:'my_tool', description:'', parameters:'{"type":"object","properties":{},"required":[]}', strict:false, http:{url:'',method:'GET',mappings:[],body:'',auth:{placement:'none',name:'',prefix:'',secretId:lib.newId()}} } });
  $('clear-key').onclick = () => { lib.clearSecret(draft.tool.http.auth.secretId); $('edit-key').value = ''; $('key-state').textContent = tr('Ключ удалён из сессии.', 'Session key removed.'); updateDirty(); };
  $('delete-tool').onclick = () => { if (confirm(tr('Удалить этот инструмент из библиотеки?', 'Delete this tool from the library?'))) { try { lib.remove(draft.id); select(lib.list()[0], true); } catch (error) { status(String(error.message || error), true); } } };
  $('add-agent').onclick = () => {
    try {
      const saved = save(true); if (!saved) return;
      if (typeof parent.addLibraryTool !== 'function') { status(tr('Откройте библиотеку внутри AI Agents Lab для подключения.', 'Open this library inside AI Agents Lab to connect a tool.'), true); return; }
      const added = parent.addLibraryTool(saved.id);
      status(added ? tr('Инструмент подключён. Настройки открыты в чате.', 'Tool connected. Settings are open in chat.') : tr('Инструмент не добавлен. Проверьте сообщение в настройках чата.', 'Tool was not added. Check the message in chat settings.'), !added);
    } catch (error) { status(lib.redact(String(error.message || error)), true); }
  };
  $('abort-test').onclick = () => controller?.abort();
  $('run-test').onclick = async () => {
    if (controller) return;
    let timer, timedOut = false;
    try {
      const record = readDraft(); lib.validate(record.tool);
      if (!record.tool.http.url) throw new Error(tr('Укажите URL инструмента.', 'Enter the tool URL.'));
      const args = JSON.parse($('test-args').value);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(tr('Аргументы должны быть JSON-объектом.', 'Arguments must be a JSON object.'));
      const request = lib.buildRequest(record.tool, args);
      storeKey(record);
      $('request-preview').textContent = lib.redact(JSON.stringify(request, null, 2));
      const authorized = lib.authorizeRequest(request, record.tool.http);
      controller = new AbortController(); const active = controller;
      $('run-test').disabled = true; $('abort-test').hidden = false;
      ['create-tool','save-tool','add-agent','delete-tool'].forEach(id => { $(id).disabled = true; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
      $('test-status').textContent = tr('Выполняется запрос…', 'Request in progress…'); $('test-status').classList.remove('error'); $('response-output').textContent = '—';
      timer = setTimeout(() => { timedOut = true; active.abort(); }, 15000);
      const started = performance.now();
      const response = await fetch(authorized.url, { method:authorized.method, headers:authorized.headers, body:authorized.body || undefined, signal:active.signal, credentials:'omit', redirect:'error' });
      const body = await response.text();
      let display = body; try { display = JSON.stringify(JSON.parse(body), null, 2); } catch (_) {}
      $('response-output').textContent = lib.redact(display || tr('(пустое тело ответа)', '(empty response body)'));
      $('test-status').textContent = 'HTTP ' + response.status + ' · ' + Math.round(performance.now() - started) + ' ms'; $('test-status').classList.toggle('error', !response.ok);
    } catch (error) {
      $('test-status').textContent = error.name === 'AbortError' ? (timedOut ? tr('Превышено время ожидания: 15 с.', 'Request timed out after 15 seconds.') : tr('Запрос остановлен.', 'Request stopped.')) : lib.redact(String(error.message || error)); $('test-status').classList.add('error');
    } finally {
      clearTimeout(timer); controller = null; $('run-test').disabled = false; $('abort-test').hidden = true;
      ['create-tool','save-tool','add-agent','delete-tool'].forEach(id => { $(id).disabled = false; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  };
  window.addEventListener('storage', event => {
    if (event.key === 'n8n_lang') {
      english = event.newValue === 'en'; applyLanguage(); updateDirty(); renderSummary();
      $('tool-kind').textContent = draft.builtin ? tr('ПРЕДУСТАНОВКА', 'BUILT-IN') : tr('ВАШ ИНСТРУМЕНТ', 'CUSTOM TOOL');
      $('save-tool').textContent = draft.builtin ? tr('Сохранить копию', 'Save a copy') : tr('Сохранить изменения', 'Save changes');
      $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
      $('official-links').replaceChildren(); safeLink(draft.docsUrl, tr('Документация', 'Documentation')); safeLink(draft.providerUrl, tr('Провайдер', 'Provider'));
      $('mappings').querySelectorAll('[data-key]').forEach(input => input.setAttribute('aria-label', tr('Имя параметра', 'Parameter name')));
      $('mappings').querySelectorAll('[data-value]').forEach(input => input.setAttribute('aria-label', tr('Значение параметра', 'Parameter value')));
      $('mappings').querySelectorAll('button').forEach(button => button.setAttribute('aria-label', tr('Удалить параметр', 'Remove parameter')));
    }
    renderPicker();
  });
  window.addEventListener('tool-library:change', () => renderPicker());
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  select(lib.list()[0], true);
})();
