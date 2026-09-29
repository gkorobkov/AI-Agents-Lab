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
    llmTest:'Test tool with LLM',llmHint:'Change the argument values to generate the task automatically. Argument names and the task text are read-only. Click Call LLM and compare the returned arguments with the values you supplied to check how the model fills the tool call. The model receives the task and only this tool definition, without a system prompt or chat history. A tool call is forced; run the HTTP request separately using the button in section 3.',llmPrompt:'Task for the model',llmRun:'Call LLM',library:'LIBRARY',importTool:'Load JSON',exportTool:'Download JSON',create:'+ Custom tool',navNote:'Configure once. Connect to your agent and override only what you need.',modelNote:'The model sees the function name, description and argument schema. It decides when to request a call. The application performs the HTTP request; adding a tool does not guarantee a call.',definition:'Description',title:'Library title',name:'Function name for the model',description:'Description for the model',schema:'Model arguments · JSON Schema',strict:'Strict schema matching (strict)',http:'Request parameters',method:'Method',query:'URL parameters',addParameter:'+ Parameter',mappingHint:'Test with a constant first. Then select a model argument or create one directly from the parameter.',advanced:'Authentication and request body',body:'Request body (POST, JSON template)',auth:'Authentication',authNone:'Not required',authQuery:'API key in URL parameter',authHeader:'API key in header',authName:'Parameter / header name',authPrefix:'Prefix (optional)',clearKey:'Remove session key',keyHint:'The key is kept only in this browser session and bound to the server. It is never included in the model function definition.',summary:'Library explanation',docs:'Official documentation',provider:'Provider website',test:'Test HTTP request',arguments:'Function arguments · JSON',run:'Run HTTP request to Tool',abort:'Stop',cors:'The request runs in your browser. The tool server must allow CORS.',request:'Request · without secrets',response:'The server response will appear here',saveCopy:'Save a copy',addAgent:'Connect to agent →',delete:'Delete'
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
  let draft, original = '', dirty = false, controller = null, saveTimer, savedTimer, lastEditedField, selecting = false;
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
    dirty = !draft.builtin && (!lib.get(draft.id) || JSON.stringify(readDraft()) !== original);
    $('dirty-state').textContent = dirty ? tr('Есть изменения', 'Unsaved changes') : (draft.builtin ? tr('Только чтение · создайте копию для изменений', 'Read-only · create a copy to edit') : tr('Сохранено', 'Saved'));
    $('dirty-state').classList.toggle('dirty', dirty);
    syncLinks(); syncDefinitionPreview(); syncTestPrompt();
    $('auth-fields').hidden = $('edit-auth').value === 'none';
    $('edit-body').closest('label').hidden = $('edit-method').value !== 'POST';
    clearTimeout(saveTimer); if (dirty && !selecting) saveTimer = setTimeout(autoSave, 3000);
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
    const row = document.createElement('div'); row.className = 'mapping';
    const key = document.createElement('input'); key.dataset.key = ''; key.value = item.key; key.placeholder = 'name'; key.setAttribute('aria-label', tr('Имя HTTP-параметра', 'HTTP parameter name'));
    const editor = document.createElement('div'); editor.className = 'mapping-value';
    const switches = document.createElement('div'); switches.className = 'source-switches'; switches.setAttribute('role','group'); switches.setAttribute('aria-label',tr('Источник значения','Value source'));
    const value = document.createElement('input'); value.dataset.value = ''; value.value = item.value; value.setAttribute('aria-label',tr('Задано вручную','Manual value'));
    const argumentsList = document.createElement('select'); argumentsList.className = 'source-native'; const chooser = document.createElement('details'); chooser.className = 'argument-chooser'; const heading = document.createElement('summary'); const menu = document.createElement('div'); menu.className = 'argument-menu'; chooser.append(heading,menu); argumentsList.setAttribute('aria-label',tr('Аргумент модели','Model argument'));
    const note = document.createElement('div'); note.className = 'mapping-note error'; note.setAttribute('role','status'); note.hidden = true;
    const button = (symbol,label,fn) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = symbol; el.title = label; el.setAttribute('aria-label',label); el.onclick = fn; switches.append(el); return el; };
    let constantValue = item.value.includes('{{') ? '' : item.value;
    const literal = button('txt',tr('Задано вручную','Manual value'),()=>{
      const match = value.value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
      if (match) { const sample = JSON.parse($('test-args').value)[match[1]]; if (sample !== undefined) constantValue = typeof sample === 'object' ? JSON.stringify(sample) : String(sample); }
      value.value = constantValue; row.refreshSource(); renderValues(JSON.parse($('edit-schema').value)); updateDirty();
    });
    const argument = button('↗',tr('Выбрать аргумент модели','Select model argument'),()=>{
      const names = Object.keys(JSON.parse($('edit-schema').value).properties || {});
      if (!names.length) { note.textContent = tr('Аргументов пока нет. Нажмите +, чтобы создать аргумент из этого параметра.', 'No arguments yet. Use + to create one from this parameter.'); note.hidden = false; return; }
      if (!value.value.includes('{{')) constantValue = value.value;
      value.value = '{{' + names[0] + '}}'; row.refreshSource(); renderValues(JSON.parse($('edit-schema').value)); updateDirty(); heading.focus();
    });
    argument.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v3M9 3h6M3 11H1m22 0h-2"/><rect x="3" y="6" width="18" height="15" rx="4"/><path d="M7 11v3m10-3v3m-9 3h8"/></svg>';
    button('+',tr('Создать аргумент модели','Create model argument'),()=>{
      const name = key.value.trim(), schema = JSON.parse($('edit-schema').value);
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || ['__proto__','prototype','constructor'].includes(name)) { note.textContent = tr('Сначала укажите имя параметра: латинские буквы, цифры и _.','Enter a parameter name using letters, digits and _.'); note.hidden = false; return; }
      const args = JSON.parse($('test-args').value);
      if (!Object.hasOwn(schema.properties,name)) {
        schema.properties[name] = {type:'string',description:tr('Значение параметра ','Value for parameter ') + name};
        args[name] = value.value.includes('{{') ? constantValue : value.value;
      }
      schema.required = [...new Set([...(schema.required || []),name])];
      $('test-args').value = JSON.stringify(args); $('edit-schema').value = JSON.stringify(schema,null,2);
      value.value = '{{' + name + '}}'; renderArguments(); lockDefinition(); updateDirty();
    });
    row.refreshSource = () => {
      const names = Object.keys(JSON.parse($('edit-schema').value).properties || {});
      const match = value.value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/), bound = value.value.includes('{{');
      argumentsList.replaceChildren(); names.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; argumentsList.append(option); });
      if (match && names.includes(match[1])) argumentsList.value = match[1];
      else if (bound) { const option = document.createElement('option'); option.value = ''; option.textContent = value.value; argumentsList.append(option); argumentsList.value = ''; }
      value.hidden = bound; chooser.hidden = !bound; const args = JSON.parse($('test-args').value); const argumentName = match?.[1]; heading.textContent = (argumentsList.selectedOptions[0]?.textContent || tr('Выберите аргумент','Select argument')) + (argumentName && Object.hasOwn(args,argumentName) ? ' = ' + JSON.stringify(args[argumentName]) : ''); menu.replaceChildren(); [...argumentsList.options].forEach(option => { const choice = document.createElement('button'); choice.type = 'button'; choice.textContent = option.textContent; choice.disabled = !!draft?.builtin; choice.onclick = () => { argumentsList.value = option.value; argumentsList.onchange(); chooser.open = false; heading.focus(); }; menu.append(choice); });
      literal.setAttribute('aria-pressed',String(!bound)); argument.setAttribute('aria-pressed',String(bound)); note.hidden = true;
    };
    argumentsList.onchange = () => { value.value = '{{' + argumentsList.value + '}}'; row.refreshSource(); renderValues(JSON.parse($('edit-schema').value)); updateDirty(); };
    value.addEventListener('input',()=>{ constantValue = value.value; });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mapping-delete'; remove.innerHTML = trashIcon; remove.title = tr('Удалить параметр','Remove parameter'); remove.setAttribute('aria-label',remove.title); remove.onclick = () => { row.remove(); updateDirty(); };
    editor.append(switches,value,argumentsList,chooser); row.append(key,editor,remove,note); $('mappings').append(row); row.refreshSource();
  }
  document.addEventListener('pointerdown', event => { document.querySelectorAll('.argument-chooser[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.argument-chooser[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); }); });
  function syncLinks() {
    for (const key of ['docs','provider']) { const anchor = $('open-' + key); try { const url = new URL($('edit-' + key).value); if (!['https:','http:'].includes(url.protocol)) throw new Error(); anchor.href = url.href; anchor.hidden = false; } catch (_) { anchor.removeAttribute('href'); anchor.hidden = true; } }
  }
  function syncDefinitionPreview() {
    $('tool-definition-json').value = JSON.stringify({type:'function',function:{name:$('edit-name').value,description:$('edit-description').value,parameters:JSON.parse($('edit-schema').value),strict:$('edit-strict').checked}},null,2);
  }
  function syncTestPrompt() {
    const words = value => value === null ? tr('не задано', 'not specified') : typeof value === 'boolean' ? (value ? tr('да', 'yes') : tr('нет', 'no')) : Array.isArray(value) ? (value.length ? value.map(words).join(', ') : tr('пустой список', 'empty list')) : typeof value === 'object' ? (Object.entries(value).map(([key,item]) => key + ' — ' + words(item)).join('; ') || tr('пустой объект', 'empty object')) : value === '' ? tr('пустая строка', 'empty string') : String(value);
    const values = Object.entries(JSON.parse($('test-args').value)).map(([key,value]) => key + ' — ' + words(value));
    $('llm-prompt').value = tr('Вызови только инструмент ', 'Call only the tool ') + $('edit-name').value + (values.length ? tr(' с параметрами: ', ' with arguments: ') + values.join('; ') : tr(' без параметров', ' without arguments')) + '.';
  }
  function select(record, force = false) {
    if (!force && dirty) autoSave();
    if (!force && dirty && !confirm(tr('Перейти к другому инструменту и потерять несохранённые изменения?', 'Switch tools and discard unsaved changes?'))) return;
    if (controller) { status(tr('Сначала остановите текущий запрос.', 'Stop the current request before switching tools.'), true); return; }
    clearTimeout(saveTimer); selecting = true;
    draft = clone(record); draft.tool.http ||= { url:'', method:'GET', mappings:[], body:'' }; draft.tool.http.auth ||= { placement:'none', name:'', prefix:'', secretId:lib.newId() };
    draft.tool.http.auth.secretId ||= lib.newId();
    Object.entries(fields).forEach(([key, id]) => { $(id).value = draft[key] || ''; });
    $('tool-title').textContent = draft.title || tr('Новый инструмент', 'New tool');
    $('tool-kind').textContent = draft.builtin ? tr('ПРЕДУСТАНОВКА', 'BUILT-IN') : tr('ВАШ ИНСТРУМЕНТ', 'CUSTOM TOOL');
    syncLinks();
    $('edit-name').value = draft.tool.name || ''; $('edit-description').value = draft.tool.description || ''; $('edit-schema').value = typeof draft.tool.parameters === 'string' ? draft.tool.parameters : JSON.stringify(draft.tool.parameters, null, 2);
    $('edit-strict').checked = !!draft.tool.strict; $('edit-url').value = draft.tool.http.url || ''; $('edit-method').value = draft.tool.http.method || 'GET'; $('edit-body').value = draft.tool.http.body || '';
    $('edit-auth').value = draft.tool.http.auth.placement || 'none'; $('edit-auth-name').value = draft.tool.http.auth.name || ''; $('edit-auth-prefix').value = draft.tool.http.auth.prefix || ''; $('edit-key').value = '';
    $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
    $('mappings').replaceChildren(); (draft.tool.http.mappings || []).forEach(mappingRow);
    $('delete-tool').hidden = !!draft.builtin || !lib.get(draft.id);
    $('request-preview').textContent = '—'; $('response-output').textContent = '—'; $('test-status').textContent = tr('Ответ сервера появится здесь', 'The server response will appear here'); $('test-status').classList.remove('error');
    renderArguments(); lockDefinition(); original = JSON.stringify(readDraft()); selecting = false; updateDirty(); renderPicker(); status('');
  }
  function storeKey(record) {
    if ($('edit-key').value) lib.setSecret(record.tool.http.auth.secretId, $('edit-key').value, new URL(record.tool.http.url).origin);
  }
  function save() {
    clearTimeout(saveTimer);
    const record = readDraft(); storeKey(record);
    if (draft.builtin) return lib.get(draft.id);
    if (!record.title) throw new Error(tr('Укажите название инструмента.', 'Enter a tool title.'));
    lib.validateRecord({...record, schemaVersion:1});
    const duplicate = lib.list().find(item => item.id !== record.id && item.tool.name === record.tool.name);
    if (duplicate) throw new Error(tr('Это имя функции уже используется: ', 'Function name already used: ') + record.tool.name);
    const saved = lib.save(record); draft = clone(saved); original = JSON.stringify(readDraft()); dirty = false;
    $('tool-title').textContent = saved.title; $('delete-tool').hidden = false;
    $('dirty-state').textContent = tr('Сохранено', 'Saved'); $('dirty-state').classList.remove('dirty');
    $('dirty-state').classList.add('saved-flash'); clearTimeout(savedTimer); savedTimer = setTimeout(() => $('dirty-state').classList.remove('saved-flash'), 2400);
    if (lastEditedField?.isConnected) { lastEditedField.querySelector('.field-saved')?.remove(); const badge = document.createElement('span'); badge.className = 'field-saved'; badge.textContent = tr('Сохранено', 'Saved'); lastEditedField.prepend(badge); setTimeout(() => badge.remove(), 2600); }
    status(''); renderPicker(); return saved;
  }
  function autoSave() { if (!dirty || selecting) return; try { save(); } catch (error) { $('dirty-state').textContent = tr('Не сохранено: ', 'Not saved: ') + lib.redact(error.message); } }
  $('tool-form').addEventListener('input', event => { lastEditedField = event.target.closest('label'); updateDirty(); });
  $('tool-form').addEventListener('change', updateDirty);
  $('tool-form').addEventListener('focusout', () => { if (!selecting) autoSave(); });
  ['edit-docs','edit-provider'].forEach(id => { $(id).addEventListener('input',event => { lastEditedField = event.target.closest('label'); updateDirty(); }); $(id).addEventListener('blur',autoSave); });
  $('tool-form').addEventListener('submit', event => { event.preventDefault(); autoSave(); });
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
  $('copy-tool').onclick = () => { const copy = readDraft(); copy.id = lib.newId(); copy.builtin = false; copy.title += tr(' · копия', ' · copy'); const base = copy.tool.name.replace(/_copy(?:_\d+)?$/, '').slice(0,55); let name = base + '_copy', n = 2; while (lib.list().some(item => item.tool.name === name)) name = base + '_copy_' + n++; copy.tool.name = name; copy.tool.http.auth.secretId = lib.newId(); select(copy); autoSave(); };
  $('test-llm').onclick = async () => {
    try {
      if (![...$('llm-values').querySelectorAll('input')].every(input => input.reportValidity())) return;
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
      $('llm-status').textContent = tr('Ответ модели получен. HTTP-запрос автоматически не выполняется.', 'Model response received. HTTP is not executed automatically.');
    } catch (error) { $('llm-status').textContent = lib.redact(error.message); }
    finally { $('test-llm').disabled = false; }
  };
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
      if (!Array.from($('llm-values').querySelectorAll('input')).every(input => input.reportValidity())) return;
      const record = readDraft();
      if (!record.tool.http.url) throw new Error(tr('Укажите URL инструмента.', 'Enter the tool URL.'));
      const args = JSON.parse($('test-args').value);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(tr('Аргументы должны быть JSON-объектом.', 'Arguments must be a JSON object.'));
      const schema = JSON.parse(record.tool.parameters);
      const request = lib.buildRequest({...record.tool, parameters:JSON.stringify({...schema, required:(schema.required || []).filter(key => Object.hasOwn(args,key))})}, args);
      storeKey(record);
      $('request-preview').textContent = lib.redact(JSON.stringify(request, null, 2));
      const authorized = lib.authorizeRequest(request, record.tool.http);
      controller = new AbortController(); const active = controller;
      $('run-test').disabled = true; $('abort-test').hidden = false;
      ['create-tool','copy-tool','import-tool','test-llm','add-agent','delete-tool'].forEach(id => { $(id).disabled = true; });
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
      ['create-tool','copy-tool','import-tool','test-llm','add-agent','delete-tool'].forEach(id => { $(id).disabled = false; });
      $('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); lockDefinition();
    }
  };

  function lockDefinition() {
    const locked = !!draft.builtin;
    document.body.classList.toggle('tool-readonly', locked);
    $('tool-form').querySelectorAll('section:not(#http-test-section):not(#llm-test-section) input, section:not(#http-test-section):not(#llm-test-section) textarea, section:not(#http-test-section):not(#llm-test-section) select, section:not(#http-test-section):not(#llm-test-section) button').forEach(input => {
      if (['edit-key','clear-key'].includes(input.id) || input.classList.contains('help-button')) return;
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT' && input.type !== 'checkbox') input.readOnly = locked || ['edit-schema','tool-definition-json'].includes(input.id);
      else input.disabled = locked;
    });
    ['edit-docs','edit-provider'].forEach(id => { $(id).readOnly = locked; });
    $('tool-definition-json').readOnly = true;
    $('copy-tool').textContent = tr('Создать копию', 'Create a copy');
    $('add-argument').textContent = tr('+ Аргумент', '+ Argument');
  }
  function renderArguments() {
    const schema = JSON.parse($('edit-schema').value);
    const builder = $('schema-builder'); builder.replaceChildren();
    const sync = () => { $('edit-schema').value = JSON.stringify(schema, null, 2); renderValues(schema); refreshMappingSources(); updateDirty(); };
    Object.entries(schema.properties || {}).forEach(([key, spec]) => {
      const row = document.createElement('div'); row.className = 'schema-row';
      const field = (caption, input) => { const label = document.createElement('label'); const span = document.createElement('span'); span.textContent = caption; label.append(span,input); row.append(label); return input; };
      const name = field(tr('Имя аргумента', 'Argument name'), document.createElement('input')); name.value = key;
      const type = field(tr('Тип', 'Type'), document.createElement('select'));
      ['string','number','integer','boolean','object','array'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; type.append(option); });
      if (Array.isArray(spec.type) || !type.querySelector(`option[value="${spec.type}"]`)) { const option = document.createElement('option'); option.value = JSON.stringify(spec.type); option.textContent = option.value || 'schema'; type.append(option); type.value = option.value; } else type.value = spec.type;
      const description = field(tr('Описание', 'Description'), document.createElement('textarea')); description.rows = 2; description.value = spec.description || '';
      const required = field(tr('Обязательный', 'Required'), document.createElement('input')); required.type = 'checkbox'; required.checked = (schema.required || []).includes(key);
      name.onchange = () => { const next = name.value.trim(); if (!next || ['__proto__','constructor','prototype'].includes(next) || next !== key && Object.hasOwn(schema.properties,next)) { name.value = key; status(tr('Укажите уникальное имя аргумента.', 'Use a unique argument name.'), true); return; } schema.properties = Object.fromEntries(Object.entries(schema.properties).map(([k,v]) => [k === key ? next : k,v])); schema.required = (schema.required || []).map(k => k === key ? next : k); $('mappings').querySelectorAll('[data-value]').forEach(input => { input.value = input.value.replaceAll('{{' + key + '}}','{{' + next + '}}'); }); sync(); renderArguments(); lockDefinition(); };
      type.onchange = () => { spec.type = type.value; if (type.value === 'array') spec.items ||= {type:'string'}; if (type.value === 'object') spec.properties ||= {}; sync(); };
      description.oninput = () => { spec.description = description.value; sync(); };
      required.onchange = () => { schema.required = (schema.required || []).filter(k => k !== key); if (required.checked) schema.required.push(key); sync(); };
      const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = trashIcon; remove.setAttribute('aria-label', tr('Удалить аргумент ', 'Remove argument ') + key); remove.title = remove.getAttribute('aria-label'); remove.onclick = () => { if ([...$('mappings').querySelectorAll('[data-value]')].some(input => input.value.includes('{{' + key + '}}'))) { row.querySelector('.argument-delete-note')?.remove(); const note = document.createElement('div'); note.className = 'argument-delete-note error'; note.setAttribute('role','alert'); note.textContent = tr('Аргумент используется в параметрах запроса. Сначала нажмите ＝ у связанного параметра или удалите этот параметр, затем удалите аргумент.', 'This argument is used by a request parameter. Switch that parameter to ＝ (constant) or delete it before removing the argument.'); row.append(note); return; } delete schema.properties[key]; schema.required = (schema.required || []).filter(k => k !== key); sync(); renderArguments(); lockDefinition(); }; row.append(remove); builder.append(row);
    });
    $('add-argument').onclick = () => { let key = 'argument'; let n = 2; while (Object.hasOwn(schema.properties,key)) key = 'argument_' + n++; schema.properties[key] = {type:'string',description:''}; sync(); renderArguments(); lockDefinition(); };
    renderValues(schema); refreshMappingSources();
  }
  function renderValues(schema) {
    let previous = {}; try { previous = JSON.parse($('test-args').value); } catch (_) {}
    const container = $('llm-values'); container.replaceChildren();
    const values = Object.create(null);
    const templates = [...$('mappings').querySelectorAll('[data-value]')].map(input => input.value).join(' ') + ' ' + $('edit-url').value + ' ' + ($('edit-method').value === 'POST' ? $('edit-body').value : '');
    Object.entries(schema.properties || {}).filter(([key]) => [...templates.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].some(match => match[1].split('.')[0] === key)).forEach(([key,spec]) => {
      const row = document.createElement('div'); row.className = 'llm-argument-row';
      const nameLabel = document.createElement('label'), nameCaption = document.createElement('span'), name = document.createElement('input');
      nameCaption.textContent = tr('Имя аргумента', 'Argument name'); name.value = key; name.readOnly = true; nameLabel.append(nameCaption,name);
      const label = document.createElement('label'), caption = document.createElement('span'); caption.textContent = tr('Значение аргумента', 'Argument value');
      const input = document.createElement('input'); input.dataset.argument = key;
      const type = Array.isArray(spec.type) ? spec.type.find(t => t !== 'null') : spec.type;
      const fallback = type === 'boolean' ? false : ['number','integer'].includes(type) ? 0 : type === 'object' ? {} : type === 'array' ? [] : '';
      values[key] = Object.hasOwn(previous,key) ? previous[key] : Object.hasOwn(spec,'default') ? spec.default : spec.enum?.[0] ?? fallback;
      input.value = typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key]);
      const sync = () => { input.setCustomValidity(''); try { values[key] = type === 'string' ? input.value : JSON.parse(input.value); } catch (_) { input.setCustomValidity(tr('Введите значение JSON нужного типа.', 'Enter a JSON value of the expected type.')); } $('test-args').value = JSON.stringify(values,null,2); };
      input.oninput = sync;
      label.append(caption,input); row.append(nameLabel,label); container.append(row);
    });
    if (!container.children.length) container.textContent = tr('Аргументы не нужны: запрос использует постоянные значения.', 'No arguments needed: the request uses constant values.');
    $('test-args').value = JSON.stringify(values,null,2);
    container.querySelectorAll('input').forEach(input => input.addEventListener('input',()=>{ refreshMappingSources(); syncTestPrompt(); }));
    refreshMappingSources();
    syncTestPrompt();
  }
  const help = {
    'edit-name':['Техническое имя, по которому модель вызывает функцию. Для подключения к агенту нужны 1–64 латинские буквы, цифры, _ или -. Для проверки HTTP имя не используется.','The model calls the function by this name: 1–64 Latin letters, digits, _ or -. HTTP testing does not use it.'],
    'edit-description':['Данное поле нужно, чтобы модель понимала, что делает функция, когда её вызывать, какие данные передавать и какой результат ожидать. Описание отправляется модели вместе со схемой аргументов и помогает ей выбрать нужный инструмент. По этому описанию модель также рассказывает пользователю о своих возможностях.','This field helps the model understand what the function does, when to call it, which inputs to provide and what result to expect. The description is sent with the argument schema and helps the model choose the right tool. The model also uses it to describe its capabilities to the user.'],
    'tool-definition-json':['parameters — описание входных данных для модели, а не сами значения. Например, name имеет тип string. Модель заполнит эти поля при вызове; приложение подставит их в {{name}} в URL, параметрах или теле HTTP-запроса. Добавляйте поля конструктором. Если входные данные не нужны, оставьте список пустым. JSON ниже формируется автоматически.','parameters describes inputs for the model, not their values. For example name is a string. Model values replace {{name}} in the URL, parameters or HTTP body. Use the builder, or leave it empty if no inputs are needed. JSON is generated automatically.'],
    'edit-url':['Адрес API, куда браузер отправит запрос. Можно использовать {{аргумент}}. Сервер должен разрешать запросы из браузера (CORS).','API address called by the browser. Supports {{argument}} templates. The server must allow browser requests (CORS).'],
    'edit-method':['GET получает данные через параметры URL. POST отправляет данные в JSON-теле. Метод определяется документацией API.','GET sends URL parameters; POST sends a JSON body. Choose the method documented by the API.'],
    'edit-strict':['Просит модель точно соблюдать схему аргументов при вызове функции. Используется в определении tools, отправляемом модели; поддержка зависит от API модели.','Asks the model to follow the argument schema strictly. Sent in the tools definition; support depends on the model API.'],
    'edit-auth':['Способ передачи ключа серверу инструмента. Ключ нужен только для защищённых API и не передаётся модели.','How the tool server receives its API key. Needed for protected APIs; never sent to the model.'],
    'edit-body':['JSON-шаблон тела POST-запроса: значения {{name}} заменяются аргументами. Если пусто, тело строится из списка HTTP-параметров.','POST JSON template: {{name}} is replaced with an argument. When empty, HTTP parameter mappings form the body.'],
    'edit-title':['Название для списка библиотеки. Помогает найти инструмент; модель использует отдельное имя функции.','Display name in the library. Helps you find the tool; the model uses the function name.'],
    'add-mapping':['Данное поле связывает параметр HTTP API с источником значения. Выберите постоянное значение для первого теста или аргумент модели из списка. «Создать аргумент» переносит введённое значение в тестовые данные и создаёт связь автоматически.','This field connects an HTTP parameter to its value source. Start with a constant, select an existing model argument, or create an argument to keep the current value as test data and bind it automatically.']
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
        $('key-state').textContent = lib.getSecret(draft.tool.http.auth.secretId) ? tr('Ключ уже задан в сессии.', 'A session key is configured.') : tr('Ключ не задан.', 'No key configured.');
      syncLinks();
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
