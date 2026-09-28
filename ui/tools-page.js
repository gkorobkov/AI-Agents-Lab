(async () => {
  'use strict';
  const lib = window.ToolLibrary;
  const $ = id => document.getElementById(id);
  const trashIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  const clone = value => JSON.parse(JSON.stringify(value));
  let english = false;
  try { english = localStorage.getItem('n8n_lang') === 'en'; } catch (_) {}
  const tr = (ru, en) => english ? en : ru;
  const en = {
    library:'LIBRARY',importTool:'Load JSON',exportTool:'Download JSON',create:'+ Custom tool',navNote:'Configure once. Connect to your agent and override only what you need.',modelNote:'The model sees the function name, description and argument schema. It decides when to request a call. The application performs the HTTP request; adding a tool does not guarantee a call.',definition:'Description',title:'Library title',name:'Function name for the model',description:'Description for the model',schema:'Model arguments · JSON Schema',strict:'Strict schema matching (strict)',http:'Request parameters',method:'Method',query:'URL parameters',addParameter:'+ Parameter',mappingHint:'{{name}} reads a model argument. Plain text is a constant, for example language = en.',advanced:'Authentication and request body',body:'Request body (POST, JSON template)',auth:'Authentication',authNone:'Not required',authQuery:'API key in URL parameter',authHeader:'API key in header',authName:'Parameter / header name',authPrefix:'Prefix (optional)',clearKey:'Remove session key',keyHint:'The key is kept only in this browser session and bound to the server. It is never included in the model function definition.',summary:'Library explanation',docs:'Official documentation',provider:'Provider website',test:'Test a real call',arguments:'Function arguments · JSON',run:'Run HTTP request',abort:'Stop',cors:'The request runs in your browser. The tool server must allow CORS.',request:'Request · without secrets',response:'The server response will appear here',saveCopy:'Save a copy',addAgent:'Connect to agent →',delete:'Delete'
  };
  const ru = Object.fromEntries(Array.from(document.querySelectorAll('[data-i18n]'), el => [el.dataset.i18n, el.textContent]));
  function applyLanguage() {
    document.documentElement.lang = english ? 'en' : 'ru';
    document.querySelectorAll('[data-i18n]').forEach(el => { const help = el.querySelector('.api-help'); el.textContent = (english ? en : ru)[el.dataset.i18n] || ru[el.dataset.i18n]; if (help) el.append(' ', help); });
  }
  applyLanguage();
  if (english) $('test-args').value = '{"name":"Berlin"}';
  if (!lib) { $('page-status').textContent = tr('Не удалось загрузить библиотеку инструментов.', 'Could not load the tool library.'); return; }
  await lib.ready;
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
    $('dirty-state').textContent = dirty ? tr('Есть изменения', 'Unsaved changes') : tr('Только чтение · создайте копию для изменений', 'Read-only · create a copy to edit');
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
    const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = trashIcon; remove.setAttribute('aria-label', tr('Удалить параметр', 'Remove parameter')); remove.title = remove.getAttribute('aria-label'); remove.onclick = () => { row.remove(); updateDirty(); };
    row.append(key, value, remove); $('mappings').append(row);
  }
  function safeLink(url, label) {
    try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) return; const a = document.createElement('a'); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label + ': ' + parsed.href + ' ↗'; $('official-links').append(a); } catch (_) {}
  }
  function select(record, force = false) {
    if (!force && dirty && !confirm(tr('Перейти к другому инструменту и потерять несохранённые изменения?', 'Switch tools and discard unsaved changes?'))) return;
    if (controller) { status(tr('Сначала остановите текущий запрос.', 'Stop the current request before switching tools.'), true); return; }
    draft = clone(record); draft.tool.http ||= { url:'', method:'GET', mappings:[], body:'' }; draft.tool.http.auth ||= { placement:'none', name:'', prefix:'', secretId:lib.newId() };
    draft.tool.http.auth.secretId ||= lib.newId();
    Object.entries(fields).forEach(([key, id]) => { $(id).value = draft[key] || ''; });
    $('tool-title').textContent = draft.title || tr('Новый инструмент', 'New tool');
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
    renderArguments(); lockDefinition(); original = JSON.stringify(readDraft()); updateDirty(); renderPicker(); status('');
  }
  function storeKey(record) {
    if ($('edit-key').value) lib.setSecret(record.tool.http.auth.secretId, $('edit-key').value, new URL(record.tool.http.url).origin);
  }
  function save(forAgent = false) {
    if (lib.get(draft.id)) { const record = readDraft(); storeKey(record); return lib.get(draft.id); }
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
  $('delete-tool').onclick = () => { if (confirm(tr('Удалить этот инструмент из библиотеки?', 'Delete this tool from the library?'))) { try { lib.remove(draft.id); lib.list().length ? select(lib.list()[0], true) : $('create-tool').click(); } catch (error) { status(String(error.message || error), true); } } };
  $('add-agent').onclick = () => {
    try {
      const saved = save(true); if (!saved) return;
      if (typeof parent.addLibraryTool !== 'function') { status(tr('Откройте библиотеку внутри AI Agents Lab для подключения.', 'Open this library inside AI Agents Lab to connect a tool.'), true); return; }
      const added = parent.addLibraryTool(saved.id);
      status(added ? tr('Инструмент подключён. Настройки открыты в чате.', 'Tool connected. Settings are open in chat.') : tr('Инструмент не добавлен. Проверьте сообщение в настройках чата.', 'Tool was not added. Check the message in chat settings.'), !added);
    } catch (error) { status(lib.redact(String(error.message || error)), true); }
  };
  $('copy-tool').onclick = () => { const copy = readDraft(); copy.id = lib.newId(); copy.builtin = false; copy.title += tr(' · копия', ' · copy'); copy.tool.http.auth.secretId = lib.newId(); select(copy); };
  $('import-tool').onclick = () => $('tool-file').click();
  $('tool-file').onchange = async () => {
    try {
      const file = $('tool-file').files[0]; if (!file || controller) return;
      if (dirty && !confirm(tr('Загрузить инструмент и потерять несохранённые изменения?', 'Load a tool and discard unsaved changes?'))) return;
      const record = lib.importRecord(await MaterialCatalog.readFile(file));
      select(record, true); status(tr('Инструмент подключён и сохранён в этом браузере.', 'Tool imported and saved in this browser.'));
    } catch (error) { status(error.message, true); }
    finally { $('tool-file').value = ''; }
  };
  $('export-tool').onclick = () => {
    try {
      const record = {...readDraft(), schemaVersion:1}; lib.validateRecord(record); delete record.builtin;
      const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)], {type:'application/json'}));
      const link = document.createElement('a'); link.href = url; link.download = 'tool-' + record.id.replaceAll('_','-') + '.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
    } catch (error) { status(error.message, true); }
  };
  $('abort-test').onclick = () => controller?.abort();
  $('run-test').onclick = async () => {
    if (controller) return;
    let timer, timedOut = false;
    try {
      if (!Array.from($('argument-values').querySelectorAll('input')).every(input => input.reportValidity())) return;
      const record = readDraft();
      if (!record.tool.http.url) throw new Error(tr('Укажите URL инструмента.', 'Enter the tool URL.'));
      const args = JSON.parse($('test-args').value);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(tr('Аргументы должны быть JSON-объектом.', 'Arguments must be a JSON object.'));
      const request = lib.buildRequest(record.tool, args);
      storeKey(record);
      $('request-preview').textContent = lib.redact(JSON.stringify(request, null, 2));
      const authorized = lib.authorizeRequest(request, record.tool.http);
      controller = new AbortController(); const active = controller;
      $('run-test').disabled = true; $('abort-test').hidden = false;
      ['create-tool','copy-tool','import-tool','save-tool','add-agent','delete-tool'].forEach(id => { $(id).disabled = true; });
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
      ['create-tool','copy-tool','import-tool','save-tool','add-agent','delete-tool'].forEach(id => { $(id).disabled = false; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); lockDefinition();
    }
  };

  function lockDefinition() {
    const locked = !!lib.get(draft.id);
    $('tool-form').querySelectorAll('section:not(:last-of-type) input, section:not(:last-of-type) textarea, section:not(:last-of-type) select, section:not(:last-of-type) button').forEach(input => {
      if (['edit-key','clear-key'].includes(input.id) || input.classList.contains('help-button')) return;
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT' && input.type !== 'checkbox') input.readOnly = locked || input.id === 'edit-schema';
      else input.disabled = locked;
    });
    $('save-tool').hidden = locked;
    $('copy-tool').textContent = tr('Создать копию', 'Create a copy');
    $('add-argument').textContent = tr('+ Аргумент', '+ Argument');
  }
  function renderArguments() {
    const schema = JSON.parse($('edit-schema').value);
    const builder = $('schema-builder'); builder.replaceChildren();
    const sync = () => { $('edit-schema').value = JSON.stringify(schema, null, 2); renderValues(schema); updateDirty(); };
    Object.entries(schema.properties || {}).forEach(([key, spec]) => {
      const row = document.createElement('div'); row.className = 'schema-row';
      const field = (caption, input) => { const label = document.createElement('label'); const span = document.createElement('span'); span.textContent = caption; label.append(span,input); row.append(label); return input; };
      const name = field(tr('Имя аргумента', 'Argument name'), document.createElement('input')); name.value = key;
      const type = field(tr('Тип', 'Type'), document.createElement('select'));
      ['string','number','integer','boolean','object','array'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; type.append(option); });
      if (Array.isArray(spec.type) || !type.querySelector(`option[value="${spec.type}"]`)) { const option = document.createElement('option'); option.value = JSON.stringify(spec.type); option.textContent = option.value || 'schema'; type.append(option); type.value = option.value; } else type.value = spec.type;
      const description = field(tr('Описание', 'Description'), document.createElement('input')); description.value = spec.description || '';
      const required = field(tr('Обязательный', 'Required'), document.createElement('input')); required.type = 'checkbox'; required.checked = (schema.required || []).includes(key);
      name.onchange = () => { const next = name.value.trim(); if (!next || ['__proto__','constructor','prototype'].includes(next) || next !== key && Object.hasOwn(schema.properties,next)) { name.value = key; status(tr('Укажите уникальное имя аргумента.', 'Use a unique argument name.'), true); return; } schema.properties = Object.fromEntries(Object.entries(schema.properties).map(([k,v]) => [k === key ? next : k,v])); schema.required = (schema.required || []).map(k => k === key ? next : k); sync(); renderArguments(); lockDefinition(); };
      type.onchange = () => { spec.type = type.value; if (type.value === 'array') spec.items ||= {type:'string'}; if (type.value === 'object') spec.properties ||= {}; sync(); };
      description.oninput = () => { spec.description = description.value; sync(); };
      required.onchange = () => { schema.required = (schema.required || []).filter(k => k !== key); if (required.checked) schema.required.push(key); sync(); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = trashIcon; remove.setAttribute('aria-label', tr('Удалить аргумент ', 'Remove argument ') + key); remove.title = remove.getAttribute('aria-label'); remove.onclick = () => { delete schema.properties[key]; schema.required = (schema.required || []).filter(k => k !== key); sync(); renderArguments(); lockDefinition(); }; row.append(remove); builder.append(row);
    });
    $('add-argument').onclick = () => { let key = 'argument'; let n = 2; while (Object.hasOwn(schema.properties,key)) key = 'argument_' + n++; schema.properties[key] = {type:'string',description:''}; sync(); renderArguments(); lockDefinition(); };
    renderValues(schema);
  }
  function renderValues(schema) {
    let previous = {}; try { previous = JSON.parse($('test-args').value); } catch (_) {}
    const container = $('argument-values'); container.replaceChildren();
    const values = Object.create(null);
    Object.entries(schema.properties || {}).forEach(([key,spec]) => {
      const label = document.createElement('label'), caption = document.createElement('span'); caption.textContent = key + ' · ' + (spec.description || spec.type || 'JSON');
      const input = document.createElement('input'); input.dataset.argument = key;
      const type = Array.isArray(spec.type) ? spec.type.find(t => t !== 'null') : spec.type;
      const fallback = type === 'boolean' ? false : ['number','integer'].includes(type) ? 0 : type === 'object' ? {} : type === 'array' ? [] : '';
      values[key] = previous[key] ?? spec.default ?? spec.enum?.[0] ?? fallback;
      input.value = typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key]);
      const optional = !(schema.required || []).includes(key);
      const include = document.createElement('input'); include.type = 'checkbox'; include.checked = !optional || Object.hasOwn(previous,key); include.setAttribute('aria-label', tr('Передать аргумент ', 'Include argument ') + key); include.hidden = !optional;
      if (!include.checked) delete values[key];
      const sync = () => { input.disabled = !include.checked; input.setCustomValidity(''); if (!include.checked) delete values[key]; else { try { values[key] = type === 'string' ? input.value : JSON.parse(input.value); } catch (_) { input.setCustomValidity(tr('Введите значение JSON нужного типа.', 'Enter a JSON value of the expected type.')); } } $('test-args').value = JSON.stringify(values,null,2); };
      input.oninput = sync; include.onchange = sync; input.disabled = !include.checked;
      label.append(caption,include,input); container.append(label);
    });
    if (!container.children.length) container.textContent = tr('Аргументы не нужны: запрос использует постоянные значения.', 'No arguments needed: the request uses constant values.');
    $('test-args').value = JSON.stringify(values,null,2);
  }
  const help = {
    'edit-name':['Техническое имя, по которому модель вызывает функцию. Для подключения к агенту нужны 1–64 латинские буквы, цифры, _ или -. Для проверки HTTP имя не используется.','The model calls the function by this name: 1–64 Latin letters, digits, _ or -. HTTP testing does not use it.'],
    'edit-description':['Данное поле нужно, чтобы модель понимала, что делает функция, когда её вызывать, какие данные передавать и какой результат ожидать. Описание отправляется модели вместе со схемой аргументов и помогает ей выбрать нужный инструмент. По этому описанию модель также рассказывает пользователю о своих возможностях.','This field helps the model understand what the function does, when to call it, which inputs to provide and what result to expect. The description is sent with the argument schema and helps the model choose the right tool. The model also uses it to describe its capabilities to the user.'],
    'edit-schema':['parameters — описание входных данных для модели, а не сами значения. Например, name имеет тип string. Модель заполнит эти поля при вызове; приложение подставит их в {{name}} в URL, параметрах или теле HTTP-запроса. Добавляйте поля конструктором. Если входные данные не нужны, оставьте список пустым. JSON ниже формируется автоматически.','parameters describes inputs for the model, not their values. For example name is a string. Model values replace {{name}} in the URL, parameters or HTTP body. Use the builder, or leave it empty if no inputs are needed. JSON is generated automatically.'],
    'test-args':['Конкретные значения для пробного вызова: например name = Москва. Здесь вы заполняете их вместо модели. Они подставляются в HTTP-запрос по шаблонам {{name}}. JSON ниже формируется из полей и доступен только для чтения.','Actual values for a test call, supplied by you instead of the model. They replace templates such as {{name}} in the HTTP request. The generated JSON below is read-only.'],
    'edit-url':['Адрес API, куда браузер отправит запрос. Можно использовать {{аргумент}}. Сервер должен разрешать запросы из браузера (CORS).','API address called by the browser. Supports {{argument}} templates. The server must allow browser requests (CORS).'],
    'edit-method':['GET получает данные через параметры URL. POST отправляет данные в JSON-теле. Метод определяется документацией API.','GET sends URL parameters; POST sends a JSON body. Choose the method documented by the API.'],
    'edit-strict':['Просит модель точно соблюдать схему аргументов при вызове функции. Используется в определении tools, отправляемом модели; поддержка зависит от API модели.','Asks the model to follow the argument schema strictly. Sent in the tools definition; support depends on the model API.'],
    'edit-auth':['Способ передачи ключа серверу инструмента. Ключ нужен только для защищённых API и не передаётся модели.','How the tool server receives its API key. Needed for protected APIs; never sent to the model.'],
    'edit-body':['JSON-шаблон тела POST-запроса: значения {{name}} заменяются аргументами. Если пусто, тело строится из списка HTTP-параметров.','POST JSON template: {{name}} is replaced with an argument. When empty, HTTP parameter mappings form the body.'],
    'edit-summary':['Краткое пояснение для пользователя: показывается в разделе «Описание». Помогает понять его назначение при выборе в библиотеке. Модели не отправляется; для неё заполните «Описание для модели».', 'A short explanation for the user, shown in the Description section. Helps people choose a tool from the library. Not sent to the model; use Description for the model for that.'],
    'edit-title':['Название для списка библиотеки. Помогает найти инструмент; модель использует отдельное имя функции.','Display name in the library. Helps you find the tool; the model uses the function name.'],
    'add-mapping':['Слева — имя параметра из документации HTTP API. Справа — постоянное значение или {{имя_аргумента}} из конструктора. Для GET они попадут в URL, для POST — в тело, если отдельный шаблон тела не задан.','Left: HTTP API parameter name. Right: a constant or {{argument_name}} from the builder. Used in the GET URL or the POST body when no body template is set.']
  };
  function attachHelp() {
    Object.entries(help).forEach(([id, texts]) => {
      const host = $(id).closest('label') || $(id).parentElement;
      const caption = host.querySelector('span') || host.querySelector('strong');
      let button = caption.querySelector('.api-help');
      if (!button) {
        button = document.createElement('span'); button.className = 'api-help'; button.tabIndex = 0; button.role = 'button'; button.textContent = '?';
        FieldHelp.attach(button); caption.append(button);
      }
      button.dataset.helpText = tr(...texts);
      button.setAttribute('aria-label', tr('Справка: ', 'Help: ') + caption.firstChild.textContent.trim());
    });
  }
  attachHelp();

  window.addEventListener('storage', event => {
    if (event.key === 'n8n_lang') {
      english = event.newValue === 'en'; applyLanguage(); updateDirty(); lockDefinition();
      FieldHelp.hide(); attachHelp();
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
  if (lib.list().length) select(lib.list()[0], true); else $('create-tool').click();
  if (lib.errors.length) status(lib.errors.join(' · '), true);
})();
