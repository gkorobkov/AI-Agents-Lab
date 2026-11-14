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
    httpErrorHelp:'Possible causes and troubleshooting',
    copyUrl:'Copy URL',
    alternativeUrl:'Alternative URL',useAlternativeUrl:'Use alternative URL',
    httpRequest:'Request',httpResponse:'Response',httpPreview:'Preview',httpServer:'Response from service',requestHeaders:'HTTP request headers',responseHeaders:'HTTP response headers',requestBody:'Request body',responseBody:'Response body',
    getApiKey:'How to get an API key ↗',
    parameterColumn:'Parameter',valueColumn:'Value',modelColumn:'Filled by model',actionsColumn:'Actions',argumentColumn:'Argument',typeColumn:'Type',descriptionColumn:'Description',requiredColumn:'Required',
    llmTest:'Test an LLM call requesting tool selection',llmHint:'The default LLM task is generated from URL parameter values marked Filled by model. You can edit it. The model receives the task text and the tool definition with its argument schema. Local values are excluded from JSON Schema and included in the default task text. After you click Call LLM, the returned arguments populate the URL parameter fields. Run the HTTP request separately using the button in section 3.',llmPrompt:'Task for the LLM model',llmRun:'Call LLM',library:'LIBRARY',importTool:'Load JSON',exportTool:'Download JSON',create:'Create tool',navNote:'Configure once. Connect to your agent and override only what you need.',modelNote:'The model sees the function name, description and argument schema. It decides when to request a call. The application performs the HTTP request; adding a tool does not guarantee a call.',definition:'Description',title:'Library title',name:'Function name for the LLM model',description:'Description for the LLM model',schema:'Arguments for the LLM model · JSON Schema',strict:'Strict schema matching for the LLM model (strict)',http:'Request parameters',method:'Method',query:'URL parameters',addParameter:'+ Parameter',mappingHint:'Enter a value for testing. Enable Filled by model to add the parameter to JSON Schema.',advanced:'Authentication and request body',body:'Request body (POST, JSON template)',auth:'Authentication',authNone:'Not required',authQuery:'API key in URL parameter',authHeader:'API key in header',authName:'Parameter / header name',authPrefix:'Prefix (optional)',clearKey:'Remove session key',keyHint:'The key is kept only in this browser session and bound to the server. It is never included in the model function definition.',summary:'Library explanation',docs:'Official documentation',provider:'Provider website',test:'Test HTTP request',arguments:'Function arguments · JSON',run:'Run HTTP request to Tool',abort:'Stop',cors:'The request runs in your browser. The tool server must allow CORS.',request:'Request · without secrets',response:'The server response will appear here',saveCopy:'Save a copy',addAgent:'Connect to agent →',delete:'Delete'
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
  const httpBodyViews = Object.fromEntries(['request-body','response-output'].map(id => {
    const pre = $(id);
    return [id,JsonViewer.create({pre,heading:pre.parentElement.querySelector('summary'),language:() => english ? 'en' : 'ru'})];
  }));
  let draft, original = '', dirty = false, controller = null, saveTimer, savedTimer, lastEditedField, selecting = false;
  const testValuesByTool = new Map();
  const fields = { title:'edit-title', docsUrl:'edit-docs', providerUrl:'edit-provider' };
  function status(message, error = false) { $('page-status').textContent = message; $('page-status').classList.toggle('error', error); }
  function readDraft() {
    const next = clone(draft);
    Object.entries(fields).forEach(([key, id]) => { next[key] = $(id).value.trim(); });
    next.tool.name = $('edit-name').value.trim();
    next.tool.description = $('edit-description').value.trim();
    delete next.summary;
    next.tool.parameters = $('edit-schema').value;
    next.tool.strict = $('edit-strict').checked;
    next.tool.http = { ...next.tool.http, url:$('edit-url').value.trim(), alternativeUrl:$('edit-alternative-url').value.trim(), useAlternativeUrl:$('edit-use-alternative-url').checked, method:$('edit-method').value,
      mappings:Array.from($('mappings').children).map(row => ({ ...row.mappingOptions, key:row.querySelector('[data-key]').value.trim(), value:row.querySelector('[data-value]').value, testValue:row.querySelector('.local-test-value').value })).filter(item => item.key),
      body:$('edit-body').value, auth:{ ...next.tool.http.auth, placement:$('edit-auth').value, name:$('edit-auth-name').value.trim(), prefix:$('edit-auth-prefix').value } };
    return next;
  }
  function updateDirty() {
    dirty = !draft.builtin && (!lib.get(draft.id) || JSON.stringify(readDraft()) !== original);
    $('dirty-state').textContent = dirty ? tr('Есть изменения', 'Unsaved changes') : (draft.builtin ? tr('Только чтение · создайте копию для изменений', 'Read-only · create a copy to edit') : tr('Сохранено', 'Saved'));
    $('dirty-state').classList.toggle('dirty', dirty);
    syncLinks(); syncDefinitionPreview(); syncTestPrompt(); syncHttpPreview();
    $('auth-fields').hidden = $('edit-auth').value === 'none';
    $('edit-body').closest('label').hidden = $('edit-method').value !== 'POST';
    $('edit-url').required = !$('edit-use-alternative-url').checked;
    $('edit-alternative-url').required = $('edit-use-alternative-url').checked;
    clearTimeout(saveTimer); if (dirty && !selecting) saveTimer = setTimeout(autoSave, 300);
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
  function refreshMappingSources() {
    $('mappings').querySelectorAll('.mapping').forEach(row => row.refreshSource());
  }
  function mappingRow(item = { key:'', value:'' }) {
    const row = document.createElement('tr'); row.className = 'mapping';
    row.mappingOptions = item.omitIfEmpty ? {omitIfEmpty:true} : {};
    const key = document.createElement('input'); key.dataset.key = ''; key.value = item.key; key.placeholder = 'name'; key.setAttribute('aria-label',tr('Имя HTTP-параметра','HTTP parameter name'));
    const editor = document.createElement('div'); editor.className = 'mapping-value';
    const binding = document.createElement('input'); binding.type = 'hidden'; binding.dataset.value = ''; binding.value = item.value;
    const value = document.createElement('input'); value.className = 'local-test-value'; value.value = item.testValue ?? (item.value.includes('{{') ? '' : item.value); value.setAttribute('aria-label',tr('Значение параметра','Parameter value'));
    const label = document.createElement('label'); label.className = 'mapping-model';
    const model = document.createElement('input'); model.type = 'checkbox';
    model.setAttribute('aria-label',tr('Заполняет модель','Filled by model')); label.append(model);
    const argumentName = () => binding.value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)?.[1];
    row.refreshSource = () => {
      model.checked = !!argumentName();
      value.readOnly = false;
    };
    value.oninput = () => {
      const name = argumentName();
      value.setCustomValidity('');
      if (name) {
        const schema = JSON.parse($('edit-schema').value), args = JSON.parse($('test-args').value);
        const type = schema.properties?.[name]?.type;
        try { args[name] = type === 'string' || Array.isArray(type) && type.includes('string') ? value.value : JSON.parse(value.value); }
        catch (_) { value.setCustomValidity(tr('Введите значение JSON нужного типа.','Enter a JSON value of the expected type.')); return; }
        $('test-args').value = JSON.stringify(args); testValuesByTool.set(draft.id,args); syncTestPrompt();
      } else binding.value = value.value;
      updateDirty();
    };
    model.onchange = () => {
      const schema = JSON.parse($('edit-schema').value), name = key.value.trim();
      if (model.checked) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || ['__proto__','prototype','constructor'].includes(name)) {
          model.checked = false; status(tr('Укажите имя параметра латинскими буквами, цифрами и _.','Use a parameter name with letters, digits and _.'),true); key.focus(); return;
        }
        schema.properties ||= {};
        schema.properties[name] ||= {type:'string',description:tr('Значение параметра ','Value for parameter ') + name};
        schema.required = [...new Set([...(schema.required || []),name])];
        binding.value = '{{' + name + '}}';
        $('edit-schema').value = JSON.stringify(schema,null,2);
        value.oninput();
      } else {
        const previousName = argumentName();
        binding.value = value.value;
        const token = '{{' + previousName + '}}';
        const used = [...$('mappings').querySelectorAll('[data-value]')].some(input => input.value.includes(token)) || $('edit-body').value.includes(token) || $('edit-url').value.includes(token);
        if (!used) {
          delete schema.properties[previousName];
          schema.required = (schema.required || []).filter(name => name !== previousName);
          $('edit-schema').value = JSON.stringify(schema,null,2);
        }
      }
      renderArguments(); lockDefinition(); updateDirty();
    };
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mapping-delete'; remove.innerHTML = trashIcon; remove.title = tr('Удалить параметр','Remove parameter'); remove.setAttribute('aria-label',remove.title); remove.onclick = () => { row.remove(); renderValues(JSON.parse($('edit-schema').value)); updateDirty(); };
    editor.append(value,binding);
    [key,editor,label,remove].forEach(control => { const cell = document.createElement('td'); cell.append(control); row.append(cell); }); $('mappings').append(row); row.refreshSource();
  }
  document.addEventListener('pointerdown', event => { document.querySelectorAll('.argument-chooser[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.argument-chooser[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); }); });
  function syncLinks() {
    for (const key of ['docs','provider']) { const anchor = $('open-' + key); try { const url = new URL($('edit-' + key).value); if (!['https:','http:'].includes(url.protocol)) throw new Error(); anchor.href = url.href; anchor.hidden = false; } catch (_) { anchor.removeAttribute('href'); anchor.hidden = true; } }
  }
  function syncDefinitionPreview() {
    $('tool-definition-json').value = JSON.stringify({type:'function',function:{name:$('edit-name').value,description:$('edit-description').value,parameters:JSON.parse($('edit-schema').value),strict:$('edit-strict').checked}},null,2);
  }
  function buildLocalRequest(record) {
    const args = JSON.parse($('test-args').value);
    const schema = JSON.parse(record.tool.parameters);
    return lib.buildRequest({...record.tool, parameters:JSON.stringify({...schema, required:(schema.required || []).filter(key => Object.hasOwn(args,key))})}, args);
  }
  function formatHttpBody(body) {
    if (!body) return tr('(пустое тело)', '(empty body)');
    return lib.redact(body);
  }
  function syncHttpPreview() {
    $('copy-request-url').disabled = true;
    $('request-method').textContent = $('edit-method').value;
    $('request-url').textContent = '—'; $('request-preview').textContent = '—'; httpBodyViews['request-body'].update('—');
    try {
      const invalid = [...$('mappings').querySelectorAll('.local-test-value')].find(input => !input.validity.valid);
      if (invalid) throw new Error(invalid.validationMessage);
      const record = readDraft(), request = buildLocalRequest(record);
      if (!request) return;
      const headers = {...request.headers}, auth = record.tool.http.auth;
      const url = new URL(request.url);
      if (auth?.placement === 'header' && auth.name) headers[auth.name] = (auth.prefix || '') + '$API_KEY';
      if (auth?.placement === 'query' && auth.name) url.searchParams.set(auth.name,(auth.prefix || '') + '$API_KEY');
      $('request-url').textContent = lib.redact(url.href);
      $('copy-request-url').disabled = false;
      $('request-preview').textContent = lib.redact(Object.entries(headers).map(([name,value]) => name + ': ' + value).join('\n')) || tr('(нет заголовков)', '(no headers)');
      httpBodyViews['request-body'].update(formatHttpBody(request.body));
    } catch (error) {
      $('request-preview').textContent = lib.redact(String(error.message || error));
    }
  }
  function select(record, force = false) {
    $('test-error-details').hidden = true;
    if (!force && dirty) autoSave();
    if (!force && dirty) return;
    if (draft?.id) {
      try { testValuesByTool.set(draft.id, JSON.parse($('test-args').value)); } catch (_) {}
    }
    if (controller) { status(tr('Сначала остановите текущий запрос.', 'Stop the current request before switching tools.'), true); return; }
    clearTimeout(saveTimer); selecting = true;
    draft = clone(record); draft.tool.http ||= { url:'', method:'GET', mappings:[], body:'' }; draft.tool.http.auth ||= { placement:'none', name:'', prefix:'', secretId:lib.newId() };
    draft.tool.http.auth.secretId ||= lib.newId();
    Object.entries(fields).forEach(([key, id]) => { $(id).value = draft[key] || ''; });
    $('tool-title').textContent = draft.title || tr('Новый инструмент', 'New tool');
    $('tool-kind').textContent = draft.builtin ? tr('ПРЕДУСТАНОВКА', 'BUILT-IN') : tr('ВАШ ИНСТРУМЕНТ', 'CUSTOM TOOL');
    syncLinks();
    $('edit-name').value = draft.tool.name || ''; $('edit-description').value = [...new Set([draft.summary, draft.tool.description].filter(value => value?.trim()).map(value => value.trim()))].join('\n\n'); $('edit-schema').value = typeof draft.tool.parameters === 'string' ? draft.tool.parameters : JSON.stringify(draft.tool.parameters, null, 2);
    $('edit-strict').checked = !!draft.tool.strict; $('edit-url').value = draft.tool.http.url || ''; $('edit-method').value = draft.tool.http.method || 'GET'; $('edit-body').value = draft.tool.http.body || '';
    $('edit-alternative-url').value = draft.tool.http.alternativeUrl || ''; $('edit-use-alternative-url').checked = !!draft.tool.http.useAlternativeUrl;
    $('edit-auth').value = draft.tool.http.auth.placement || 'none'; $('edit-auth-name').value = draft.tool.http.auth.name || ''; $('edit-auth-prefix').value = draft.tool.http.auth.prefix || ''; $('edit-key').value = '';
    const keyHelp = $('api-key-help');
    keyHelp.hidden = !/^https:\/\//i.test(draft.apiKeyUrl || '');
    if (keyHelp.hidden) keyHelp.removeAttribute('href');
    else keyHelp.href = draft.apiKeyUrl;
    $('api-key-instructions')?.remove();
    if (draft.apiKeyInstructions) {
      const hint = document.createElement('p'); hint.id = 'api-key-instructions'; hint.className = 'hint'; hint.textContent = draft.apiKeyInstructions; keyHelp.after(hint);
    }
    $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
    $('mappings').replaceChildren(); (draft.tool.http.mappings || []).forEach(mappingRow);
    $('delete-tool').hidden = !!draft.builtin || !lib.get(draft.id);
    $('response-headers').textContent = '—'; httpBodyViews['response-output'].update('—'); $('test-status').textContent = tr('Ответ сервера появится здесь', 'The server response will appear here'); $('test-status').classList.remove('error');
    const savedTestValues = testValuesByTool.get(record.id);
    $('test-args').value = JSON.stringify(savedTestValues || (record.exampleRequest || {}));
    const initialArgs = JSON.parse($('test-args').value);
    (draft.tool.http.mappings || []).forEach(item => {
      const name = item.value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)?.[1];
      if (!name || item.testValue === undefined || savedTestValues) return;
      const spec = JSON.parse($('edit-schema').value).properties?.[name];
      try { initialArgs[name] = spec?.type === 'string' ? item.testValue : JSON.parse(item.testValue); } catch (_) { initialArgs[name] = item.testValue; }
    });
    $('test-args').value = JSON.stringify(initialArgs);
    document.getElementById('tool-examples')?.remove();
    if (record.exampleRequest || record.exampleResponse) {
      const details = document.createElement('details'); details.id = 'tool-examples';
      const caption = document.createElement('summary'); caption.textContent = tr('Пример запроса и JSON-ответа (иллюстрация)', 'Example request and JSON response (illustrative)');
      const content = document.createElement('pre'); content.textContent = JSON.stringify({request:record.exampleRequest,response:record.exampleResponse},null,2); details.append(caption,content); $('edit-description').closest('label').after(details);
    }
    $('llm-prompt').value = ''; generatedTestPrompt = '';
    renderArguments(); lockDefinition(); original = JSON.stringify(readDraft()); selecting = false; updateDirty(); renderPicker(); status('');
  }
  function storeKey(record) {
    if ($('edit-key').value) lib.setSecret(record.tool.http.auth.secretId, $('edit-key').value, new URL(lib.resolveHttpUrl(record.tool.http)).origin);
  }
  function save(draftOnly = false) {
    clearTimeout(saveTimer);
    const record = readDraft(); if (!draftOnly) storeKey(record);
    if (draft.builtin) return lib.get(draft.id);
    if (!draftOnly && !record.title) throw new Error(tr('Укажите название инструмента.', 'Enter a tool title.'));
    if (!draftOnly) lib.validateRecord({...record, schemaVersion:1});
    const duplicate = lib.list().find(item => item.id !== record.id && item.tool.name === record.tool.name);
    if (!draftOnly && duplicate) throw new Error(tr('Это имя функции уже используется: ', 'Function name already used: ') + record.tool.name);
    const saved = lib.save(record, draftOnly); draft = clone(saved); original = JSON.stringify(readDraft()); dirty = false;
    $('tool-title').textContent = saved.title; $('delete-tool').hidden = false;
    $('dirty-state').textContent = tr('Сохранено', 'Saved'); $('dirty-state').classList.remove('dirty');
    $('dirty-state').classList.add('saved-flash'); clearTimeout(savedTimer); savedTimer = setTimeout(() => $('dirty-state').classList.remove('saved-flash'), 2400);
    if (lastEditedField?.isConnected) { lastEditedField.querySelector('.field-saved')?.remove(); const badge = document.createElement('span'); badge.className = 'field-saved'; badge.textContent = tr('Сохранено', 'Saved'); lastEditedField.prepend(badge); setTimeout(() => badge.remove(), 2600); }
    status(''); renderPicker(); return saved;
  }
  function autoSave() { if (!dirty || selecting) return; try { save(true); } catch (error) { $('dirty-state').textContent = tr('Не сохранено: ', 'Not saved: ') + lib.redact(error.message); } }
  $('tool-form').addEventListener('input', event => { lastEditedField = event.target.closest('label'); updateDirty(); });
  $('tool-form').addEventListener('change', updateDirty);
  $('tool-form').addEventListener('focusout', () => { if (!selecting) autoSave(); });
  ['edit-docs','edit-provider'].forEach(id => { $(id).addEventListener('input',event => { lastEditedField = event.target.closest('label'); updateDirty(); }); $(id).addEventListener('blur',autoSave); });
  $('tool-form').addEventListener('submit', event => { event.preventDefault(); autoSave(); });
  $('add-mapping').onclick = () => { mappingRow(); updateDirty(); $('mappings').lastElementChild.querySelector('input').focus(); };
  $('create-tool').onclick = () => {
    if (controller) return;
    if (dirty) autoSave();
    if (dirty) return;
    const record = { id:lib.newId(), title:tr('Мой инструмент', 'My tool'), summary:'', docsUrl:'', providerUrl:'', builtin:false, tool:{ name:'my_tool', description:'', parameters:'{"type":"object","properties":{},"required":[]}', strict:false, http:{url:'',method:'GET',mappings:[],body:'',auth:{placement:'none',name:'',prefix:'',secretId:lib.newId()}} } };
    const base = record.tool.name; let n = 2;
    while (lib.list().some(item => item.tool.name === record.tool.name)) record.tool.name = base + '_' + n++;
    record.title = tr('Новый инструмент', 'New tool') + (n > 2 ? ' ' + (n - 1) : '');
    select(lib.save(record, true), true);
  };
  $('clear-key').onclick = () => { lib.clearSecret(draft.tool.http.auth.secretId); $('edit-key').value = ''; $('key-state').textContent = tr('Ключ удалён из сессии.', 'Session key removed.'); updateDirty(); };
  $('delete-tool').onclick = () => { if (confirm(tr('Удалить этот инструмент из библиотеки?', 'Delete this tool from the library?'))) { try { lib.remove(draft.id); lib.list().length ? select(lib.list()[0], true) : $('create-tool').click(); } catch (error) { status(String(error.message || error), true); } } };
  $('add-agent').onclick = () => {
    try {
      const saved = save(); if (!saved) return;
      if (typeof parent.addLibraryTool !== 'function') { status(tr('Откройте библиотеку внутри AI Agents Lab для подключения.', 'Open this library inside AI Agents Lab to connect a tool.'), true); return; }
      const added = parent.addLibraryTool(saved.id);
      status(added ? tr('Инструмент подключён. Настройки открыты в чате.', 'Tool connected. Settings are open in chat.') : tr('Инструмент не добавлен. Проверьте сообщение в настройках чата.', 'Tool was not added. Check the message in chat settings.'), !added);
    } catch (error) { status(lib.redact(String(error.message || error)), true); }
  };
  $('copy-tool').onclick = () => { const copy = readDraft(); copy.id = lib.newId(); copy.builtin = false; copy.title += tr(' · копия', ' · copy'); const base = copy.tool.name.replace(/_copy(?:_\d+)?$/, '').slice(0,55); let name = base + '_copy', n = 2; while (lib.list().some(item => item.tool.name === name)) name = base + '_copy_' + n++; copy.tool.name = name; copy.tool.http.auth.secretId = lib.newId(); select(copy); autoSave(); };
  $('test-llm').onclick = async () => {
    try {
      if (!$('llm-prompt').value.trim()) { $('llm-prompt').focus(); throw new Error(tr('Введите задачу для LLM модели.', 'Enter a task for the LLM model.')); }
      const saved = save(); if (!saved) return;
      if (typeof parent.testLibraryTool !== 'function') throw new Error(tr('Откройте библиотеку внутри приложения.', 'Open the library inside the application.'));
      $('test-llm').disabled = true; $('llm-status').textContent = tr('Выполняется вызов LLM…','Calling LLM…'); $('llm-response-box').hidden = true; $('llm-request-box').hidden = true;
      const result = await parent.testLibraryTool(saved.id, $('llm-prompt').value, request => { $('llm-request').textContent = lib.redact(JSON.stringify(request,null,2)); $('llm-request-box').hidden = false; });
      $('llm-response').textContent = lib.redact(JSON.stringify(result,null,2)); $('llm-response-box').hidden = false;
      const calls = [...(result.choices?.[0]?.message?.tool_calls || []).map(call => call.function), ...(result.output || []).filter(call => call.type === 'function_call')];
      const call = calls.find(call => call?.name === saved.tool.name);
      if (call) {
        const args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
        if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(tr('Аргументы должны быть JSON-объектом.', 'Arguments must be a JSON object.'));
        $('test-args').value = JSON.stringify(args);
        renderValues(JSON.parse($('edit-schema').value));
      }
      $('llm-status').textContent = tr('Ответ LLM модели получен. HTTP-запрос автоматически не выполняется.', 'Model response received. HTTP is not executed automatically.');
    } catch (error) { $('llm-status').textContent = lib.redact(error.message); }
    finally { $('test-llm').disabled = false; }
  };
  $('import-tool').onclick = () => $('tool-file').click();
  $('tool-file').onchange = async () => {
    try {
      const file = $('tool-file').files[0]; if (!file || controller) return;
      if (dirty) autoSave();
      if (dirty) return;
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
  $('edit-use-alternative-url').onchange = () => {
    if (draft.builtin) {
      try { lib.setPresetUrlSelection(draft.id,$('edit-use-alternative-url').checked); }
      catch (error) { $('edit-use-alternative-url').checked = !!lib.get(draft.id)?.tool.http.useAlternativeUrl; status(String(error.message || error),true); }
    }
    updateDirty();
  };
  $('copy-request-url').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('request-url').textContent);
      status(tr('URL скопирован.', 'URL copied.'));
    } catch (_) {
      status(tr('Не удалось скопировать URL. Выделите и скопируйте адрес вручную.', 'Could not copy the URL. Select and copy the address manually.'),true);
    }
  };
  $('run-test').onclick = async () => {
    if (controller) return;
    let fetchRequest = null, responseReceived = false;
    $('test-error-details').hidden = true;
    try {
      if (!Array.from($('mappings').querySelectorAll('.local-test-value')).every(input => input.reportValidity())) return;
      const record = readDraft();
      lib.resolveHttpUrl(record.tool.http);
      const args = JSON.parse($('test-args').value);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(tr('Аргументы должны быть JSON-объектом.', 'Arguments must be a JSON object.'));
      const request = buildLocalRequest(record);
      storeKey(record);
      syncHttpPreview();
      const authorized = lib.authorizeRequest(request, record.tool.http);
      controller = new AbortController(); const active = controller;
      $('run-test').disabled = true; $('abort-test').hidden = false;
      ['create-tool','copy-tool','import-tool','test-llm','add-agent','delete-tool'].forEach(id => { $(id).disabled = true; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
      $('test-status').textContent = tr('Выполняется запрос…', 'Request in progress…'); $('test-status').classList.remove('error'); httpBodyViews['response-output'].update('—'); $('response-headers').textContent = '—';
      const started = performance.now();
      if (record.tool.adapter === 'gdelt') {
        const result = await GdeltTool.execute(record.tool,args,{signal:active.signal,onProgress:progress => {
          $('test-status').textContent = progress.stage === 'request' ? tr('Ожидание GDELT, попытка ', 'Waiting for GDELT, attempt ') + progress.attempt + tr(' (до ', ' (up to ') + progress.timeout_ms / 1000 + tr(' с).', ' s).') : tr('Очередь / повтор GDELT', 'GDELT queue / retry') + (progress.wait_ms ? ' · ' + Math.ceil(progress.wait_ms / 1000) + tr(' с.', ' s.') : '…');
        }});
        httpBodyViews['response-output'].update(lib.redact(JSON.stringify(result,null,2)));
        $('test-status').textContent = result.status + ' · ' + (result.meta.external_http_status ? 'HTTP ' + result.meta.external_http_status : tr('HTTP-статус недоступен браузеру', 'HTTP status unavailable to browser')) + (result.error ? ' · ' + result.error.category + ' · ' + result.error.message : '') + ' · ' + result.meta.duration_ms + ' ms · ' + result.meta.request_id;
        $('test-status').classList.toggle('error',result.status === 'error');
        return;
      }
      fetchRequest = authorized;
      const response = await fetch(authorized.url, { method:authorized.method, headers:authorized.headers, body:authorized.body || undefined, signal:active.signal, credentials:'omit', redirect:'error' });
      responseReceived = true;
      $('response-headers').textContent = lib.redact([...response.headers].map(([name,value]) => name + ': ' + value).join('\n')) || tr('(нет доступных заголовков)', '(no exposed headers)');
      const body = await response.text();
      const display = body;
      httpBodyViews['response-output'].update(lib.redact(display || tr('(пустое тело ответа)', '(empty response body)')));
      $('test-status').textContent = 'HTTP ' + response.status + ' · ' + Math.round(performance.now() - started) + ' ms'; $('test-status').classList.toggle('error', !response.ok);
    } catch (error) {
      $('test-status').textContent = error.name === 'AbortError' ? tr('Запрос остановлен.', 'Request stopped.') : lib.redact(String(error.message || error)); $('test-status').classList.add('error');
      if (fetchRequest && !responseReceived && error.name !== 'AbortError') {
        $('test-status').textContent = tr('Браузер не смог получить ответ сервиса.', 'The browser could not receive the service response.');
        const target = new URL(fetchRequest.url), crossOrigin = target.origin !== location.origin;
        const lines = [tr('Страница открыта на ', 'Page origin is ') + location.origin + tr('. Запрос направлен на ', '. Request destination is ') + target.origin + '.'];
        if (crossOrigin) {
          lines.push(tr('Возможная причина — CORS. Сервер или прокси должен разрешать origin этой страницы заголовком Access-Control-Allow-Origin. Ответ OPTIONS с кодом 204 сам по себе этого не гарантирует — проверьте CORS-заголовки OPTIONS и основного ответа.', 'CORS is a possible cause. The server or proxy must allow this page origin through Access-Control-Allow-Origin. An OPTIONS 204 response alone does not confirm access — check the CORS headers of both OPTIONS and the actual response.'));
          if (Object.keys(fetchRequest.headers || {}).some(name => name.toLowerCase() === 'authorization')) lines.push(tr('Запрос содержит Authorization. Для предварительного запроса сервер должен разрешать этот заголовок через Access-Control-Allow-Headers.', 'The request includes Authorization. The server must allow this header in the preflight response through Access-Control-Allow-Headers.'));
        }
        lines.push(tr('Также возможны недоступность сервиса, ошибка DNS или TLS-сертификата, блокировка расширением, запрещённое перенаправление или HTTP-адрес при открытии страницы по HTTPS. Точную причину браузер показывает в DevTools → Network и Console. JavaScript страницы не получает эти подробности.', 'Other possible causes include an unreachable service, DNS or TLS certificate errors, extension blocking, a rejected redirect, or an HTTP endpoint on an HTTPS page. Check DevTools → Network and Console for the exact browser error. Page JavaScript cannot access these details.'));
        if ($('edit-alternative-url').value.trim() && !$('edit-use-alternative-url').checked) lines.push(tr('Попробуйте включить «Использовать альтернативный URL», если по этому адресу настроен прокси.', 'Try enabling Use alternative URL if a proxy is configured at that address.'));
        if ($('edit-use-alternative-url').checked && target.origin === location.origin) lines.push(tr('Выбран относительный адрес на текущем сайте. Проверьте, что маршрут /api/ обслуживается прокси именно здесь, включая запуск на localhost.', 'The selected relative address points to the current site. Check that its /api/ route is handled by a proxy here, including when running on localhost.'));
        lines.push(tr('Сообщение браузера — ', 'Browser message — ') + lib.redact(String(error.message || error)));
        $('test-error-explanation').textContent = lines.join('\n\n'); $('test-error-details').hidden = false;
        $('response-headers').textContent = tr('Заголовки ответа недоступны браузеру.', 'Response headers are unavailable to the browser.');
        httpBodyViews['response-output'].update(tr('Тело ответа недоступно браузеру. Причины и шаги проверки указаны выше.', 'The response body is unavailable to the browser. See the explanation and troubleshooting steps above.'));
      }
    } finally {
      controller = null; $('run-test').disabled = false; $('abort-test').hidden = true;
      ['create-tool','copy-tool','import-tool','test-llm','add-agent','delete-tool'].forEach(id => { $(id).disabled = false; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); lockDefinition();
    }
  };

  function lockDefinition() {
    const locked = !!draft.builtin;
    document.body.classList.toggle('tool-readonly', locked);
    $('tool-form').querySelectorAll('section:not(#http-test-section):not(#llm-test-section) input, section:not(#http-test-section):not(#llm-test-section) textarea, section:not(#http-test-section):not(#llm-test-section) select, section:not(#http-test-section):not(#llm-test-section) button').forEach(input => {
      if (input.id === 'edit-use-alternative-url') { input.disabled = false; return; }
      if (['edit-key','clear-key'].includes(input.id) || input.classList.contains('help-button') || input.classList.contains('local-test-value')) return;
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT' && input.type !== 'checkbox') input.readOnly = locked || ['edit-schema','tool-definition-json'].includes(input.id);
      else input.disabled = locked;
    });
    ['edit-docs','edit-provider'].forEach(id => { $(id).readOnly = locked; });
    $('tool-definition-json').readOnly = true;
    $('copy-tool').textContent = tr('Создать копию', 'Create a copy');
    $('add-argument').textContent = tr('+ Аргумент', '+ Argument');
  }
  let generatedTestPrompt = '';
  function syncTestPrompt() {
    const field = $('llm-prompt');
    const automatic = !field.value || field.value === generatedTestPrompt;
    const args = Object.entries(JSON.parse($('test-args').value)).map(([key,value]) => key + ' = ' + JSON.stringify(value));
    generatedTestPrompt = tr('Вызови инструмент ', 'Call the tool ') + $('edit-name').value + (args.length ? tr(' с аргументами ', ' with arguments ') + args.join(', ') : tr(' без аргументов', ' without arguments')) + '.';
    if (automatic) field.value = generatedTestPrompt;
  }
  function renderArguments() {
    const schema = JSON.parse($('edit-schema').value);
    const builder = $('schema-builder'); builder.replaceChildren();
    const sync = () => { $('edit-schema').value = JSON.stringify(schema, null, 2); renderValues(schema); refreshMappingSources(); updateDirty(); };
    Object.entries(schema.properties || {}).forEach(([key, spec]) => {
      const row = document.createElement('tr'); row.className = 'schema-row'; row.dataset.argument = key;
      const field = (caption, input, property, texts) => {
        const label = document.createElement('td'), span = document.createElement('span');
        span.textContent = caption;
        const button = document.createElement('span'); button.className = 'api-help'; button.tabIndex = 0; button.role = 'button'; button.textContent = '?';
        button.setAttribute('aria-label', tr('Справка: ', 'Help: ') + caption);
        button.dataset.helpPath = 'tools[].function.parameters.' + (property === 'required' ? 'required' : 'properties[' + JSON.stringify(key) + ']' + (property ? '.' + property : ''));
        button.dataset.helpText = tr(...texts);
        FieldHelp.attach(button); span.append(' ',button);
        input.setAttribute('aria-label',caption);
        const index = row.children.length;
        const header = $('schema-table').tHead.rows[0].cells[index];
        if (!header.querySelector('.api-help')) header.append(' ',button);
        label.append(input); row.append(label); return input;
      };
      const name = field(tr('Имя аргумента для LLM модели', 'Argument name for the LLM model'), document.createElement('input'), '', ['Поле «Имя аргумента для LLM модели» задаёт ключ в JSON Schema. Модель использует это имя при формировании аргументов вызова. Это же имя используется в шаблонах {{имя}} HTTP-запроса.', 'The argument name field defines a JSON Schema property key. The model uses this name in tool call arguments. HTTP request templates use the same name in {{name}}.']); name.value = key;
      const type = field(tr('Тип для LLM модели', 'Type for the LLM model'), document.createElement('select'), 'type', ['Поле «Тип для LLM модели» задаёт тип значения аргумента в JSON Schema. string — строка, number — число, integer — целое число, boolean — логическое значение, object — объект, array — массив.', 'The type field defines the JSON Schema value type. string is text, number is numeric, integer is a whole number, boolean is true or false, object contains properties, and array contains items.']);
      ['string','number','integer','boolean','object','array'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; type.append(option); });
      if (Array.isArray(spec.type) || !type.querySelector(`option[value="${spec.type}"]`)) { const option = document.createElement('option'); option.value = JSON.stringify(spec.type); option.textContent = option.value || 'schema'; type.append(option); type.value = option.value; } else type.value = spec.type;
      const description = field(tr('Описание для LLM модели', 'Description for the LLM model'), document.createElement('textarea'), 'description', ['Поле «Описание для LLM модели» объясняет смысл аргумента, формат и единицы измерения. Модель получает это описание вместе с JSON Schema и использует его для выбора значения.', 'The description field explains the meaning, format and units of the argument. The model receives this description with JSON Schema and uses it to choose a value.']); description.rows = 2; description.value = spec.description || '';
      const required = field(tr('Обязательный для LLM модели', 'Required for the LLM model'), document.createElement('input'), 'required', ['Флажок «Обязательный для LLM модели» добавляет имя аргумента в массив required JSON Schema. Модель должна включить этот аргумент в вызов инструмента. Проверка HTTP-запроса также требует его наличия.', 'The required checkbox adds this argument name to the JSON Schema required array. The model must include it in the tool call. HTTP request validation also requires it.']); required.type = 'checkbox'; required.checked = (schema.required || []).includes(key);
      name.onchange = () => { const next = name.value.trim(); if (!next || ['__proto__','constructor','prototype'].includes(next) || next !== key && Object.hasOwn(schema.properties,next)) { name.value = key; status(tr('Укажите уникальное имя аргумента.', 'Use a unique argument name.'), true); return; } schema.properties = Object.fromEntries(Object.entries(schema.properties).map(([k,v]) => [k === key ? next : k,v])); schema.required = (schema.required || []).map(k => k === key ? next : k); $('mappings').querySelectorAll('[data-value]').forEach(input => { input.value = input.value.replaceAll('{{' + key + '}}','{{' + next + '}}'); }); const args = JSON.parse($('test-args').value); if (Object.hasOwn(args,key)) { args[next] = args[key]; delete args[key]; $('test-args').value = JSON.stringify(args); } sync(); renderArguments(); lockDefinition(); };
      type.onchange = () => { spec.type = type.value; if (type.value === 'array') spec.items ||= {type:'string'}; if (type.value === 'object') spec.properties ||= {}; sync(); };
      description.oninput = () => { spec.description = description.value; sync(); };
      required.onchange = () => { schema.required = (schema.required || []).filter(k => k !== key); if (required.checked) schema.required.push(key); sync(); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = trashIcon; remove.setAttribute('aria-label', tr('Удалить аргумент ', 'Remove argument ') + key); remove.title = remove.getAttribute('aria-label'); remove.onclick = () => { if ([...$('mappings').querySelectorAll('[data-value]')].some(input => input.value.includes('{{' + key + '}}'))) { row.querySelector('.argument-delete-note')?.remove(); const note = document.createElement('div'); note.className = 'argument-delete-note error'; note.setAttribute('role','alert'); note.textContent = tr('Аргумент используется в параметрах запроса. Сначала снимите флажок «Заполняет модель» у связанного параметра или удалите этот параметр, затем удалите аргумент.', 'This argument is used by a request parameter. Uncheck Filled by model for that parameter or delete it before removing the argument.'); const cell = document.createElement('td'); cell.colSpan = 5; cell.append(note); row.append(cell); return; } delete schema.properties[key]; schema.required = (schema.required || []).filter(k => k !== key); sync(); renderArguments(); lockDefinition(); }; const actions = document.createElement('td'); actions.append(remove); row.append(actions); builder.append(row);
    });
    $('add-argument').onclick = () => { let key = 'argument'; let n = 2; while (Object.hasOwn(schema.properties,key)) key = 'argument_' + n++; schema.properties[key] = {type:'string',description:''}; sync(); renderArguments(); lockDefinition(); };
    renderValues(schema); refreshMappingSources();
  }
  function renderValues(schema) {
    let previous = {}; try { previous = JSON.parse($('test-args').value); } catch (_) {}
    const values = Object.create(null);
    Object.entries(schema.properties || {}).forEach(([key,spec]) => {
      const type = Array.isArray(spec.type) ? spec.type.find(t => t !== 'null') : spec.type;
      const mapping = [...$('mappings').querySelectorAll('.mapping')].find(row => row.querySelector('[data-value]').value === '{{' + key + '}}');
      const sample = mapping?.querySelector('.local-test-value').value;
      let savedValue;
      if (sample !== undefined && sample !== '') {
        try { savedValue = type === 'string' ? sample : JSON.parse(sample); } catch (_) { savedValue = sample; }
      }
      const fallback = draft.tool.adapter === 'gdelt' ? '' : type === 'boolean' ? false : ['number','integer'].includes(type) ? 0 : type === 'object' ? {} : type === 'array' ? [] : '';
      values[key] = Object.hasOwn(previous,key) ? previous[key] : savedValue !== undefined ? savedValue : Object.hasOwn(spec,'default') ? spec.default : spec.enum?.[0] ?? fallback;
    });
    $('mappings').querySelectorAll('.mapping').forEach(row => {
      const binding = row.querySelector('[data-value]'), input = row.querySelector('.local-test-value');
      const name = binding.value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)?.[1];
      input.setCustomValidity('');
      if (name) {
        const value = values[name] ?? '';
        input.value = typeof value === 'string' ? value : JSON.stringify(value);
      }
    });
    $('test-args').value = JSON.stringify(draft.tool.adapter === 'gdelt' ? Object.fromEntries(Object.entries(values).filter(([,v]) => v !== '')) : values,null,2);
    testValuesByTool.set(draft.id, JSON.parse($('test-args').value));
    refreshMappingSources(); syncTestPrompt(); syncHttpPreview();
  }
  const help = {
    'edit-name':['Техническое имя, по которому LLM модель вызывает функцию. Для подключения к агенту нужны 1–64 латинские буквы, цифры, _ или -. Для проверки HTTP имя не используется.','The model calls the function by this name: 1–64 Latin letters, digits, _ or -. HTTP testing does not use it.'],
    'edit-description':['Напишите, что делает инструмент, когда его вызывать, какие аргументы передать и что он вернёт. Этот текст получает LLM модель и по нему выбирает инструмент. Укажите, что делать, если данных нет или запрос завершился ошибкой.','This field helps the model understand what the function does, when to call it, which inputs to provide and what result to expect. The description is sent with the argument schema and helps the model choose the right tool. The model also uses it to describe its capabilities to the user.'],
    'tool-definition-json':['parameters — описание входных данных для LLM модели, а не сами значения. Например, name имеет тип string. LLM Модель заполнит эти поля при вызове; приложение подставит их в {{name}} в URL, параметрах или теле HTTP-запроса. Добавляйте поля конструктором. Если входные данные не нужны, оставьте список пустым. JSON ниже формируется автоматически.','parameters describes inputs for the model, not their values. For example name is a string. Model values replace {{name}} in the URL, parameters or HTTP body. Use the builder, or leave it empty if no inputs are needed. JSON is generated automatically.'],
    'edit-url':['Адрес API, куда браузер отправит запрос. Можно использовать {{аргумент}}. Сервер должен разрешать запросы из браузера (CORS).','API address called by the browser. Supports {{argument}} templates. The server must allow browser requests (CORS).'],
    'edit-method':['GET получает данные через параметры URL. POST отправляет данные в JSON-теле. Метод определяется документацией API.','GET sends URL parameters; POST sends a JSON body. Choose the method documented by the API.'],
    'edit-strict':['Включено: LLM модель должна формировать аргументы по поддерживаемой JSON Schema. Обычно нужны required для всех свойств и additionalProperties: false. Выключено: строгий режим не запрашивается. Strict не гарантирует истинность данных и успех HTTP-запроса. Поддержка зависит от провайдера.','Asks the model to follow the argument schema strictly. Sent in the tools definition; support depends on the model API.'],
    'edit-auth':['Способ передачи ключа серверу инструмента. Ключ нужен только для защищённых API и не передаётся LLM модели.','How the tool server receives its API key. Needed for protected APIs; never sent to the model.'],
    'edit-body':['JSON-шаблон тела POST-запроса: значения {{name}} заменяются аргументами. Если пусто, тело строится из списка HTTP-параметров.','POST JSON template: {{name}} is replaced with an argument. When empty, HTTP parameter mappings form the body.'],
    'edit-title':['Название для списка библиотеки. Помогает найти инструмент; LLM модель использует отдельное имя функции.','Display name in the library. Helps you find the tool; the model uses the function name.'],
    'add-mapping':['Данное поле связывает параметр HTTP API с источником значения. Выберите постоянное значение для первого теста или аргумент LLM модели из списка. «Создать аргумент» переносит введённое значение в тестовые данные и создаёт связь автоматически.','This field connects an HTTP parameter to its value source. Start with a constant, select an existing model argument, or create an argument to keep the current value as test data and bind it automatically.']
  };
  function attachHelp() {
    Object.entries(help).forEach(([id, texts]) => {
      const host = $(id).closest('label') || $(id).parentElement;
      const caption = host.querySelector(':scope > span:not(.field-saved)') || host.querySelector('strong');
      let button = caption.querySelector('.api-help');
      if (!button) {
        button = document.createElement('span'); button.className = 'api-help'; button.tabIndex = 0; button.role = 'button'; button.textContent = '?';
        FieldHelp.attach(button); caption.append(button);
      }
      button.dataset.helpText = tr(...texts).replace(/(?<!LLM )\bmodel(s)?\b/gi, 'LLM model$1');
      const paths = {
        'edit-name':'tools[].function.name', 'edit-description':'tools[].function.description',
        'tool-definition-json':'tools[]', 'edit-strict':'tools[].function.strict',
        'edit-url':'Настройка HTTP-инструмента · http.url (не передаётся LLM)',
        'edit-method':'Настройка HTTP-инструмента · http.method (не передаётся LLM)',
        'edit-auth':'Настройка HTTP-инструмента · http.auth (не передаётся LLM)',
        'edit-body':'Настройка HTTP-инструмента · http.body (не передаётся LLM)',
        'edit-title':'Настройка библиотеки · title (не передаётся LLM)',
        'add-mapping':'Настройка HTTP-инструмента · http.mappings[] (не передаётся LLM)'
      };
      button.dataset.helpPath = paths[id];
      button.setAttribute('aria-label', tr('Справка: ', 'Help: ') + caption.firstChild.textContent.trim());
    });
  }
  attachHelp();

  window.addEventListener('storage', event => {
    if (event.key === 'n8n_lang') {
      english = event.newValue === 'en'; applyLanguage(); updateDirty(); lockDefinition();
      FieldHelp.hide(); attachHelp();
      $('tool-kind').textContent = draft.builtin ? tr('ПРЕДУСТАНОВКА', 'BUILT-IN') : tr('ВАШ ИНСТРУМЕНТ', 'CUSTOM TOOL');
        $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
      syncLinks();
      $('mappings').querySelectorAll('[data-key]').forEach(input => input.setAttribute('aria-label', tr('Имя параметра', 'Parameter name')));
      $('mappings').querySelectorAll('[data-value]').forEach(input => input.setAttribute('aria-label', tr('Значение параметра', 'Parameter value')));
      $('mappings').querySelectorAll('button').forEach(button => button.setAttribute('aria-label', tr('Удалить параметр', 'Remove parameter')));
    }
    renderPicker();
  });
  window.addEventListener('tool-library:change', () => renderPicker());
  window.addEventListener('pagehide', autoSave);
  if (lib.list().length) select(lib.list()[0], true); else $('create-tool').click();
  if (lib.errors.length) status(lib.errors.join(' · '), true);
})();
