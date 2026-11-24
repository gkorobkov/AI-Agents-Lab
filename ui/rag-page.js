(() => {
  'use strict';
  if (window === window.parent) return;
  const cfg = parent.ragDefaults;
  Object.entries(parent.settingsFontSizes || {}).forEach(([role, size]) =>
    document.documentElement.style.setProperty('--settings-font-' + role, size + 'px'));
  if (!cfg) return;
  const $ = id => document.getElementById('rag-' + id);
  const node = (tag, text) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item; };
  const fields = { provider:'provider', qdrantUrl:'qdrant-url', neuraldeepUrl:'neuraldeep-url', model:'model', dimensions:'dimensions', collection:'collection', vectorName:'vector-name', topK:'top-k', queryPrefix:'query-prefix', documentPrefix:'document-prefix' };
  let saved = {}, busy = false, nextOffset = null, controller = null, recordsFilter = null, activeReceipt = null;
  const settingsSlot = 'ai_rag_settings:' + location.hostname;
  try { saved = JSON.parse(sessionStorage.getItem(settingsSlot) || localStorage.getItem('ai_rag_settings') || '{}'); } catch (_) {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  Object.entries(fields).forEach(([name, id]) => { $(id).value = typeof saved[name] === typeof cfg[name] ? saved[name] : cfg[name]; });
  const qdrantProxy = ProxyControls.mount($('qdrant-url'), {onChange:() => { persist(); window.RagConsole?.transportChanged(); }});
  const embeddingProxy = ProxyControls.mount($('neuraldeep-url'), {onChange:() => persist()});
  qdrantProxy.set(saved.qdrantUseProxy);
  embeddingProxy.set(saved.embeddingUseProxy);
  const proxyAddressChanged = () => { if (qdrantProxy.read()) window.RagConsole?.transportChanged(); };
  window.addEventListener('ai-proxy:url-change', proxyAddressChanged);
  window.addEventListener('storage', event => { if (event.key === LocalProxyTransport.storageKey) proxyAddressChanged(); });
  const providerSelect = $('embedding-provider');
  const embeddingUrl = $('neuraldeep-url');
  const embeddingKeyField = $('neuraldeep-key');
  const embeddingStatus = $('embedding-status');
  let customEmbeddingUrl = embeddingUrl.value;
  const profileFields = ['model','document-prefix','query-prefix'];
  let profileValues = saved.embeddingProfiles && typeof saved.embeddingProfiles === 'object' ? saved.embeddingProfiles : {};
  let activeProfile = saved.embeddingProfileId || '';
  function rememberProfile() {
    profileValues[activeProfile || 'custom'] = Object.fromEntries(profileFields.map(id => [id,$(id).value]));
  }
  function restoreProfile() {
    const values = profileValues[providerSelect.value || 'custom'];
    for (const id of profileFields) $(id).value = typeof values?.[id] === 'string' ? values[id] : cfg[id === 'model' ? 'model' : id === 'document-prefix' ? 'documentPrefix' : 'queryPrefix'];
    activeProfile = providerSelect.value;
  }
  function embeddingBaseUrl() {
    return urlValue('neuraldeep-url').replace(/\/(?:chat\/completions|embeddings|models)$/, '');
  }
  let modelRequest;
  function embeddingConnectionStatus(state = '', message = '', models = []) {
    if (!state) modelRequest?.abort();
    embeddingStatus.dataset.state = state;
    embeddingStatus.textContent = state === 'loading' ? 'загрузка...' : message;
    embeddingStatus.title = message;
    document.dispatchEvent(new CustomEvent('rag:models', {detail:{state, models}}));
  }
  function embeddingKey() {
    if (!providerSelect.value) return embeddingKeyField.value.trim();
    const profile = parent.allOpenAIProfiles().find(item => item.id === providerSelect.value);
    return profile ? parent.openAIRequestHeaders(profile).Authorization?.slice('Bearer '.length).trim() || '' : '';
  }
  function syncEmbeddingKeyDisplay() {
    embeddingKeyField.placeholder = providerSelect.value && embeddingKey() ? '••••••••' : '';
  }
  function updateEmbeddingProvider() {
    const selected = providerSelect.selectedOptions[0];
    const url = selected.dataset.baseUrl || customEmbeddingUrl;
    const managed = Boolean(selected.value);
    const changed = embeddingUrl.value !== url || embeddingUrl.disabled !== managed;
    embeddingUrl.disabled = embeddingKeyField.disabled = managed;
    if (managed) embeddingKeyField.value = '';
    syncEmbeddingKeyDisplay();
    if (changed) {
      embeddingUrl.value = url;
      embeddingUrl.dispatchEvent(new Event('input', {bubbles:true}));
      embeddingUrl.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }
  function refreshEmbeddingProviders(selected) {
    const profiles = parent.allOpenAIProfiles().filter(profile => typeof profile.baseUrl === 'string' && profile.baseUrl.trim());
    providerSelect.replaceChildren(new Option('Custom', ''), ...profiles.map(profile => {
      const option = new Option(profile.name, profile.id);
      option.dataset.baseUrl = profile.baseUrl;
      return option;
    }));
    providerSelect.value = profiles.some(profile => profile.id === selected) ? selected : '';
    updateEmbeddingProvider();
  }
  providerSelect.addEventListener('change', () => { rememberProfile(); updateEmbeddingProvider(); restoreProfile(); persist(); });
  embeddingUrl.addEventListener('input', () => { if (!providerSelect.value) customEmbeddingUrl = embeddingUrl.value; });
  for (const id of profileFields) $(id).addEventListener('input', () => persist());
  const embeddingSources = [providerSelect, embeddingUrl, embeddingKeyField, embeddingProxy.input];
  for (const source of embeddingSources) {
    source.addEventListener('input', () => embeddingConnectionStatus());
    source.addEventListener('change', () => embeddingConnectionStatus());
  }
  window.addEventListener('ai-proxy:url-change', () => { if (embeddingProxy.read()) embeddingConnectionStatus(); });
  window.addEventListener('storage', event => {
    if (event.key === 'ai_openai_profiles') { refreshEmbeddingProviders(providerSelect.value); persist(); }
    if (event.key === 'ai_openai_key' && providerSelect.value) {
      syncEmbeddingKeyDisplay();
      embeddingKeyField.dispatchEvent(new Event('change'));
    }
    if (event.key === LocalProxyTransport.storageKey && embeddingProxy.read()) embeddingConnectionStatus();
  });
  async function loadModels() {
    modelRequest?.abort();
    const pending = modelRequest = new AbortController();
    const timer = setTimeout(() => pending.abort(), cfg.timeoutMs);
    embeddingConnectionStatus('loading', 'Загрузка моделей…');
    try {
      const key = embeddingKey();
      if (providerSelect.value && !key) throw fieldError('neuraldeep-key', 'Укажите API-ключ в настройках OpenAI API.');
      const data = await request(embeddingBaseUrl(), '/models', 'GET', undefined, key ? {Authorization:'Bearer ' + key} : {}, embeddingProxy.read(), pending.signal, 'models');
      if (modelRequest !== pending || pending.signal.aborted) return;
      const rows = Array.isArray(data) ? data : data?.data ?? data?.models;
      if (!Array.isArray(rows)) throw new Error('API вернул некорректный список моделей.');
      const byId = new Map();
      for (const row of rows) {
        const model = typeof row === 'string' ? {id:row} : row;
        if (typeof model?.id === 'string' && model.id.trim()) byId.set(model.id, model);
      }
      const models = [...byId.values()].sort((a,b) => a.id.localeCompare(b.id));
      embeddingConnectionStatus('ready', '', models);
    } catch (error) {
      if (modelRequest === pending && embeddingStatus.dataset.state === 'loading') embeddingConnectionStatus('error', error.message);
    } finally {
      clearTimeout(timer);
      if (modelRequest === pending) modelRequest = null;
    }
  }
  $('metadata').value = cfg.metadata;
  $('text-field-note').textContent = `Поле «${cfg.textField}» хранит текст документа и не должно повторяться в метаданных. Остальные поля payload сохраняются при загрузке в редактор.`;
  const status = (message, error = false) => {
    if (!activeReceipt?.matches('#rag-collections-status, #rag-cluster-status')) {
      $('status').textContent = message; $('status').title = message; $('status').classList.toggle('error', error);
    }
    if (activeReceipt) { activeReceipt.textContent = message; activeReceipt.title = message; activeReceipt.dataset.state = error ? 'error' : busy ? 'loading' : 'done'; }
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:error ? 'error' : busy ? 'progress' : 'done', message}}));
  };
  function recordsNotice(message) {
    let notice = $('records-notice');
    if (!notice) { notice = node('p'); notice.id = 'rag-records-notice'; notice.className = 'hint'; notice.setAttribute('role', 'status'); $('records').before(notice); }
    notice.textContent = message;
  }
  async function refreshAfterMutation(ctx, message, filter) {
    const warnings = [];
    try { await browse(ctx, null, filter); } catch (error) { warnings.push('Список документов не обновлён: ' + error.message); }
    try { await window.RagConsole?.afterMutation(); } catch (error) { warnings.push('Статистика не обновлена: ' + error.message); }
    const result = message + (warnings.length ? ' Данные уже сохранены. ' + warnings.join(' ') + ' Нажмите «Все документы / обновить»; повторно загружать файл не нужно.' : ' Список документов и статистика обновлены.');
    recordsNotice(result + (filter ? ' Ниже — документы этой записи. Для всей коллекции нажмите «Все документы / обновить».' : ''));
    status(result, false);
    window.RagConsole?.revealDocuments();
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:'saved', message:result, collection:ctx.collection}}));
  }
  const persist = () => {
    const settings = {qdrantUseProxy:qdrantProxy.read(), embeddingUseProxy:embeddingProxy.read()};
    Object.entries(fields).forEach(([name, id]) => { settings[name] = typeof cfg[name] === 'number' ? Number($(id).value) : $(id).value; });
    settings.embeddingProfileId = providerSelect.value;
    settings.neuraldeepUrl = customEmbeddingUrl;
    rememberProfile(); settings.embeddingProfiles = profileValues;
    try { sessionStorage.setItem(settingsSlot, JSON.stringify(settings)); localStorage.removeItem('ai_rag_settings'); } catch (_) {}
  };
  const fieldError = (id, message) => Object.assign(new Error(message), { fieldId:id });
  function clearFieldError(field) {
    if (!field?.hasAttribute('data-rag-invalid')) return;
    field._helpAnimation?.cancel();
    document.getElementById(field.id + '-error')?.remove();
    field.removeAttribute('data-rag-invalid');
    field.removeAttribute('aria-invalid');
    const described = (field.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== field.id + '-error');
    if (described.length) field.setAttribute('aria-describedby', described.join(' '));
    else field.removeAttribute('aria-describedby');
  }
  function showFieldError(error, fallback) {
    const field = error.fieldId ? $(error.fieldId) : fallback;
    if (!field || field === document.body) return status(error.message, true);
    clearFieldError(field);
    document.documentElement.style.setProperty('--error', parent.getComputedStyle(parent.document.documentElement).getPropertyValue('--error'));
    window.RagConsole?.revealField(field);
    for (let ancestor = field.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    const message = node('span', error.message); message.id = field.id + '-error';
    message.className = 'rag-field-error'; message.setAttribute('role', 'alert');
    (field.closest('label') || field.parentElement).append(message);
    field.setAttribute('data-rag-invalid', '');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
    status('');
    field.scrollIntoView({block:'center', behavior:'smooth'});
    parent.appWorkspace?.highlightField(field, { error:true, scroll:false });
  }
  document.addEventListener('input', event => clearFieldError(event.target));
  document.addEventListener('change', event => clearFieldError(event.target));
  function resetRecords() {
    nextOffset = null; recordsFilter = null; $('next').hidden = true;
    if ($('records-notice')) $('records-notice').textContent = '';
    $('records').replaceChildren(node('p', 'Документы ещё не загружены.'));
    $('results').replaceChildren(node('p', 'Результаты поиска появятся здесь.'));
  }
  function clearEditor() { $('id').value = ''; $('text').value = ''; $('metadata').value = cfg.metadata; }
  Object.values(fields).forEach(id => $(id).addEventListener('change', () => {
    persist();
    if (['qdrant-url', 'collection', 'vector-name', 'model', 'neuraldeep-url'].includes(id)) {
      resetRecords();
      if (id === 'qdrant-url' || id === 'collection') clearEditor();
      if (id === 'qdrant-url') $('collections').replaceChildren();
      status('Настройки изменены. Повторите запрос к выбранной коллекции.');
    }
  }));
  refreshEmbeddingProviders(saved.embeddingProfileId);
  if (profileValues[providerSelect.value || 'custom']) restoreProfile();
  activeProfile = providerSelect.value;
  function urlValue(id) {
    let url;
    try { url = new URL($(id).value.trim()); } catch (_) { throw fieldError(id, 'Укажите корректный URL в поле «' + (id === 'qdrant-url' ? 'REST URL кластера Qdrant' : 'Base URL OpenAI API') + '».'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw fieldError(id, 'URL должен использовать HTTP(S) и не содержать логин, пароль, параметры или якорь.');
    if (url.hostname === 'cloud.qdrant.io') throw fieldError(id, 'Укажите REST URL вашего кластера из Qdrant Cloud, а не адрес панели cloud.qdrant.io.');
    return url.href.replace(/\/+$/, '');
  }
  function context(needsCollection = true) {
    const collection = $('collection').value.trim();
    if (needsCollection && !collection) throw new Error('Укажите имя коллекции.');
    const key = $('qdrant-key').value.trim();
    return { base:urlValue('qdrant-url'), useProxy:qdrantProxy.read(), key, collection, path:'/collections/' + encodeURIComponent(collection) };
  }
  function integer(id, name, max = Number.MAX_SAFE_INTEGER) {
    const n = Number($(id).value);
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw fieldError(id, name + ': введите целое число от 1 до ' + max + '.');
    return n;
  }
  function pointId(generate = false) {
    let value = $('id').value.trim();
    if (!value && generate) { value = crypto.randomUUID(); $('id').value = value; }
    if (/^\d+$/.test(value)) {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id < 0) throw new Error('Числовой ID должен быть безопасным целым числом JavaScript. Для больших ID используйте UUID.');
      return id;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
    throw fieldError('id', 'Укажите ID: UUID или неотрицательное целое число.');
  }
  async function request(base, path, method, body, headers, useProxy, signal = controller?.signal, channel) {
    const secrets=[$('qdrant-key').value.trim(),embeddingKey()].filter(Boolean);
    const redact=value=>{let text=JSON.stringify(value);for(const key of secrets)text=text.split(JSON.stringify(key).slice(1,-1)).join('[ключ скрыт]');return JSON.parse(text);};
    const requestHeaders = Object.fromEntries(Object.entries(headers).filter(([name, value]) => name !== 'api-key' || value));
    requestHeaders.Accept='application/json';
    if(body!==undefined)requestHeaders['Content-Type']='application/json';
    const record={method,channel,url:base+path,request:redact({headers:HttpDebug.clean(requestHeaders),...(body===undefined?{}:{body}),proxy:useProxy})};
    const started=performance.now();document.dispatchEvent(new CustomEvent('rag:http',{detail:record}));
    let response;
    try {
      response = await LocalProxyTransport.fetch(base + path, { method, headers:{ ...requestHeaders, ...(body === undefined ? {} : {'Content-Type':'application/json'}) }, body:body === undefined ? undefined : JSON.stringify(body), signal, credentials:'omit', redirect:'error', referrerPolicy:'no-referrer' }, useProxy);
    } catch (error) {
      record.complete?.({status:'Ошибка сети',ms:Math.round(performance.now()-started),response:redact({error:error.message})});
      if (signal?.aborted) throw new Error('Превышено время ожидания запроса. Проверьте доступность сервисов и повторите операцию.');
      if (useProxy) throw error;
      const proxy = Object.prototype.hasOwnProperty.call(headers, 'api-key') ? qdrantProxy : embeddingProxy;
      throw Object.assign(new Error('Не удалось связаться с сервисом. Возможна блокировка CORS. Включите «use Proxy» в настройках соответствующего сервиса и повторите запрос. Также проверьте URL и сеть.'), {proxyInput:proxy.input});
    }
    try {
      const text=await response.clone().text();let value;try{value=JSON.parse(text);}catch(_){value={text};}
      record.complete?.({status:response.status,ms:Math.round(performance.now()-started),headers:HttpDebug.clean(Object.fromEntries(response.headers.entries())),response:redact(value)});
    } catch(error) { record.complete?.({status:response.status,ms:Math.round(performance.now()-started),response:{error:'Не удалось прочитать ответ.'}}); }
    if (path === '/readyz') {
      if (!response.ok) throw new Error('Кластер не готов. HTTP ' + response.status + '.');
      await response.text();
      return true;
    }
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Сервис вернул не JSON (HTTP ' + response.status + '). Проверьте REST URL.'); }
    if (!response.ok || data.status?.error) {
      const detail = data.status?.error || data.error?.message || (typeof data.error === 'string' ? data.error : 'Проверьте ключ, права и параметры.');
      // A server error can echo a key. Redact keys before showing any response text.
      let message = String(detail);
      [$('qdrant-key').value.trim(), embeddingKey()].filter(Boolean).forEach(key => { message = message.split(key).join('[ключ скрыт]'); });
      throw new Error('HTTP ' + response.status + ': ' + message);
    }
    return data.result === undefined ? data : data.result;
  }
  const qdrant = (ctx, suffix, method = 'GET', body, signal = controller?.signal) => request(ctx.base, suffix.startsWith('/collections') || suffix === '/aliases' || suffix === '/cluster' ? suffix : ctx.path + suffix, method, body, {'api-key':ctx.key}, ctx.useProxy, signal);
  async function collectionVector(ctx) {
    const info = await qdrant(ctx, '');
    const vectors = info.config?.params?.vectors;
    const name = $('vector-name').value.trim();
    const unnamed = Number.isInteger(vectors?.size);
    const names = unnamed ? [] : Object.keys(vectors || {}).filter(key => Number.isInteger(vectors[key]?.size));
    const definition = name ? (unnamed ? null : vectors?.[name]) : (unnamed ? vectors : null);
    if (!definition || !Number.isInteger(definition.size)) {
      const message = unnamed
        ? 'В этой коллекции плотный вектор без имени. Очистите поле «Имя вектора».'
        : names.length
          ? (name ? 'Вектор «' + name + '» не найден.' : 'В этой коллекции используются именованные векторы.') + ' Укажите в поле «Имя вектора»: ' + names.join(', ') + '.'
          : 'В коллекции нет плотного вектора для семантического поиска. Создайте коллекцию с плотным вектором или выберите другую коллекцию.';
      throw fieldError('vector-name', message);
    }
    if (definition.multivector_config) throw fieldError('vector-name', 'Для multivector используйте редактор точки JSON.');
    return { name, size:definition.size };
  }
  async function embedTexts(texts, vector, isQuery = false) {
    const key = embeddingKey(), model = $('model').value.trim();
    if (providerSelect.value && !key) throw fieldError('neuraldeep-key', 'Укажите API-ключ в настройках OpenAI API.');
    if (!key) throw fieldError('neuraldeep-key', 'Укажите API Key.');
    if (!model) throw fieldError('model', 'Укажите модель эмбеддингов.');
    const prefix = $(isQuery ? 'query-prefix' : 'document-prefix').value;
    const data = await request(embeddingBaseUrl(), '/embeddings', 'POST', {model, input:texts.map(text => prefix + text)}, {Authorization:'Bearer ' + key}, embeddingProxy.read());
    if (!Array.isArray(data.data) || data.data.length !== texts.length) throw new Error('NeuralDeep вернул неполный набор эмбеддингов.');
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    return ordered.map((item, index) => {
      if (texts.length > 1 && item.index !== index) throw new Error('NeuralDeep вернул некорректный порядок эмбеддингов.');
      const embedding = item.embedding;
      if (!Array.isArray(embedding) || !embedding.length || !embedding.every(Number.isFinite)) throw new Error('NeuralDeep вернул некорректный эмбеддинг.');
      if (embedding.length !== vector.size) throw fieldError('model', 'Размерность эмбеддинга ' + embedding.length + ' не совпадает с размерностью коллекции ' + vector.size + '. Выберите совместимую модель.');
      return embedding;
    });
  }

  async function embed(text, vector, isQuery = false) {
    return (await embedTexts([text], vector, isQuery))[0];
  }
  $('files').accept = cfg.fileExtensions.map(ext => '.' + ext).join(',');
  $('files-hint').textContent = cfg.fileExtensions.map(ext => ext.toUpperCase()).join(', ') + ' · UTF-8 · до ' + cfg.fileMaxCount + ' файлов, ' + (cfg.fileMaxBytes / 1024) + ' КБ на файл и ' + (cfg.fileTotalMaxBytes / 1024) + ' КБ суммарно. Фрагмент: ' + cfg.fileChunkChars + ' символов, перекрытие: ' + cfg.fileChunkOverlap + '.';
  const showFiles = () => {
    $('file-list').textContent = Array.from($('files').files).map(file => file.name + ' · ' + Math.ceil(file.size / 1024) + ' КБ').join('\n') || 'Файлы не выбраны.';
  };
  $('files').addEventListener('change', showFiles);
  $('clear-files').addEventListener('click', () => { $('files').value = ''; showFiles(); });
  function splitFileText(text) {
    const chars = Array.from(text), chunks = [], step = cfg.fileChunkChars - cfg.fileChunkOverlap;
    if (!Number.isInteger(step) || step < 1 || cfg.fileChunkOverlap < 0) throw new Error('Проверьте настройки длины и перекрытия фрагментов.');
    for (let start = 0; start < chars.length; start += step) {
      const chunk = chars.slice(start, start + cfg.fileChunkChars).join('').trim();
      if (chunk) chunks.push(chunk);
      if (start + cfg.fileChunkChars >= chars.length) break;
    }
    return chunks;
  }
  async function uploadFiles() {
    const files = Array.from($('files').files);
    if (!files.length) throw new Error('Выберите файлы для загрузки.');
    if (files.length > cfg.fileMaxCount) throw new Error('За одну загрузку можно выбрать до ' + cfg.fileMaxCount + ' файлов.');
    if (files.reduce((sum, file) => sum + file.size, 0) > cfg.fileTotalMaxBytes) throw new Error('Суммарный размер файлов превышает ' + cfg.fileTotalMaxBytes / 1024 + ' КБ.');
    const prepared = [];
    for (const file of files) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!cfg.fileExtensions.includes(extension)) throw new Error('Файл «' + file.name + '»: неподдерживаемый формат. Выберите текстовый файл из списка.');
      if (file.size > cfg.fileMaxBytes) throw new Error('Файл «' + file.name + '» превышает ' + cfg.fileMaxBytes / 1024 + ' КБ.');
      let text;
      try { text = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer()); }
      catch (_) { throw new Error('Файл «' + file.name + '» не удалось прочитать как UTF-8. Сохраните его в кодировке UTF-8.'); }
      if (text.includes('\u0000')) throw new Error('Файл «' + file.name + '» содержит двоичные данные. Выберите текстовый файл UTF-8.');
      const chunks = splitFileText(text);
      if (!chunks.length) throw new Error('Файл «' + file.name + '» пуст или содержит только пробелы.');
      prepared.push({file, chunks});
    }
    const ctx = context(), vector = await collectionVector(ctx), importId = crypto.randomUUID(), points = [];
    const total = prepared.reduce((sum, entry) => sum + entry.chunks.length, 0);
    try {
      for (const {file, chunks} of prepared) {
        for (let start = 0; start < chunks.length; start += cfg.fileEmbeddingBatchSize) {
          if (controller.signal.aborted) throw new Error('Время загрузки истекло.');
          status('Векторизация файлов: ' + points.length + ' / ' + total + ' фрагментов. Файл: ' + file.name + '.');
          const batch = chunks.slice(start, start + cfg.fileEmbeddingBatchSize), embeddings = await embedTexts(batch, vector);
          batch.forEach((text, index) => points.push({
            id:crypto.randomUUID(), vector:vector.name ? {[vector.name]:embeddings[index]} : embeddings[index],
            payload:{source_name:file.name, source_type:file.type || file.name.split('.').pop().toLowerCase(), chunk_index:start + index + 1, chunk_count:chunks.length, import_id:importId, [cfg.textField]:text}
          }));
        }
      }
    } catch (error) { error.message += ' Фрагменты не записаны в Qdrant.'; throw error; }
    if (controller.signal.aborted) throw new Error('Время загрузки истекло. Фрагменты не записаны в Qdrant.');
    status('Сохранение в коллекцию «' + ctx.collection + '»: ' + total + ' фрагментов.');
    try { await qdrant(ctx, '/points?wait=true', 'PUT', {points}); }
    catch (error) { throw new Error(error.message + ' Проверьте коллекцию перед повторной загрузкой. ID импорта: ' + importId + '.'); }
    $('files').value = ''; showFiles();
    await refreshAfterMutation(ctx, 'Загружено в «' + ctx.collection + '»: файлов ' + files.length + ', фрагментов ' + total + '. ID импорта: ' + importId + '.', {must:[{key:'import_id',match:{value:importId}}]});
  }
  $('upload').addEventListener('click', () => run('Чтение файлов…', uploadFiles, cfg.fileUploadTimeoutMs, $('upload')));

  async function read(ctx, id) {
    const points = await qdrant(ctx, '/points', 'POST', {ids:[id], with_payload:true, with_vector:false});
    if (!Array.isArray(points)) throw new Error('Qdrant вернул неожиданный ответ при чтении документа.');
    return points[0];
  }
  function loadPoint(point) {
    const editor = $('id').closest('details'); if (editor) editor.open = true;
    $('id').value = point.id;
    const payload = point.payload || {};
    $('text').value = typeof payload[cfg.textField] === 'string' ? payload[cfg.textField] : '';
    const metadata = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== cfg.textField));
    $('metadata').value = JSON.stringify(metadata, null, 2);
  }
  function renderPoints(host, points, empty) {
    host.replaceChildren();host.tabIndex=0;host.setAttribute('role','region');host.setAttribute('aria-label',host===$('records')?'Документы коллекции':'Результаты поиска');
    if (!points.length) { host.append(node('p', empty)); return; }
    points.forEach(point => {
      const article=node('article');article.className='rag-record';
      const head=node('div');head.className='rag-section-head';
      const payload=point.payload||{},text=typeof payload[cfg.textField]==='string'?payload[cfg.textField]:'Текстовое поле отсутствует.';
      const caption=node('span',(payload.source_name||'Документ')+(payload.chunk_index?' · фрагмент '+payload.chunk_index+'/'+payload.chunk_count:'')+(typeof point.score==='number'?' · score '+point.score.toFixed(4):''));
      const load=node('button','В редактор');load.type='button';load.className='small';
      load.addEventListener('click',()=>{
        if(busy)return;
        loadPoint(point);window.RagConsole?.revealEditor();const editor=document.getElementById('rag-editor-details');if(editor)editor.open=true;
        $('id').scrollIntoView({behavior:'smooth',block:'center'});$('text').focus({preventScroll:true});status('Документ '+point.id+' загружен в редактор.');
      });
      head.append(caption,load);
      const full=node('details');full.className='rag-record-text';
      full.append(node('summary',text.replace(/\s+/g,' ')),node('p',text));
      const identity=node('div');identity.className='debug-summary-text';const key=node('span','ID: '),value=node('span',String(point.id));key.className='debug-field-name';value.className='debug-field-value';identity.append(key,value);article.append(identity);
      const metadata=node('details'),heading=node('summary','Payload JSON'),pre=node('pre');metadata.className='debug-section rag-json-panel';
      metadata.append(heading,pre);JsonViewer.create({pre,heading}).update(JSON.stringify(payload,null,2));
      article.append(head,full,metadata);host.append(article);
    });
  }
  async function browse(ctx, offset, filter = offset === null ? null : recordsFilter) {
    const result = await qdrant(ctx, '/points/scroll', 'POST', {limit:cfg.pageSize, with_payload:true, with_vector:false, ...(filter ? {filter} : {}), ...(offset === null ? {} : {offset})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный список документов.');
    renderPoints($('records'), result.points, 'Документов нет. Загрузите текстовый файл или создайте документ.');
    recordsFilter = filter;
    nextOffset = result.next_page_offset ?? null; $('next').hidden = nextOffset === null;
    recordsNotice((filter ? 'Показаны документы последней записи. Для всей коллекции нажмите «Все документы / обновить». ' : 'Документы коллекции. ') + 'На странице: ' + result.points.length + (nextOffset === null ? '.' : '. Есть следующая страница.'));
    return result.points.length;
  }
  async function run(message, action, timeoutMs = cfg.timeoutMs, trigger = document.activeElement) {
    if (busy) return;
    document.querySelectorAll('[data-rag-invalid]').forEach(clearFieldError);
    activeReceipt = null;
    if (trigger?.id === 'rag-connect' || trigger?.id === 'rag-check-cluster') {
      activeReceipt = $(trigger.id === 'rag-connect' ? 'collections-status' : 'cluster-status');
      $('status').textContent = '';
      $('status').title = '';
    }
    if (!activeReceipt && trigger && trigger !== document.body && trigger.closest('#rag-workbench')) {
      const group = trigger.closest('.actions, .rag-search-actions') || trigger.parentElement;
      activeReceipt = group.nextElementSibling?.matches('.rag-operation-result') ? group.nextElementSibling : node('p');
      activeReceipt.className = 'rag-operation-result hint';
      activeReceipt.setAttribute('role', 'status'); activeReceipt.setAttribute('aria-live', 'polite');
      if (!activeReceipt.isConnected) group.after(activeReceipt);
    }
    busy = true; $('workbench').disabled = true; $('workbench').setAttribute('aria-busy', 'true');
    controller = new AbortController();
    const generation=window.RagConsole?.epoch;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let failure;
    status(message);
    try { await action(); } catch (error) { failure = error; }
    finally { clearTimeout(timeout); busy = false; $('workbench').disabled = false; $('workbench').removeAttribute('aria-busy'); controller = null; }
    if(generation!==window.RagConsole?.epoch){activeReceipt=null;return false;}
    if (failure) {
      if (activeReceipt) { activeReceipt.textContent = failure.message; activeReceipt.dataset.state = 'error'; }
      if (activeReceipt?.matches('#rag-collections-status, #rag-cluster-status')) {
        if (failure.fieldId) showFieldError(failure, trigger);
        status(failure.message, true);
      } else showFieldError(failure, trigger);
      if (failure.proxyInput && !failure.proxyInput.checked) {
        window.RagConsole?.revealField(failure.proxyInput);
        parent.appWorkspace?.highlightField(failure.proxyInput.closest('label'), {focus:false});
      }
    } else if (activeReceipt) activeReceipt.dataset.state = 'done';
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:failure ? 'error' : 'done', message:failure?.message || activeReceipt?.textContent || $('status').textContent}}));
    activeReceipt = null;
    return !failure;
  }
  const on = (id, message, action) => $(id).addEventListener('click', () => run(message, action, cfg.timeoutMs, $(id)));
  $('new').addEventListener('click', () => { clearEditor(); status('Новый документ. При создании пустой ID будет заменён UUID.'); $('text').focus(); });
  const fetchCollections = (trigger=$('connect')) => run('Получение коллекций…', async () => {
    const generation=window.RagConsole?.epoch,signal=controller.signal;
    window.RagConsole?.connecting();
    try {
      const ctx = context(false), result = await qdrant(ctx, '/collections','GET',undefined,signal);
      if(generation!==window.RagConsole?.epoch)return;
      if (!Array.isArray(result.collections)) throw new Error('Qdrant вернул неожиданный список коллекций.');
      $('collections').replaceChildren(...result.collections.map(item => { const option = node('option'); option.value = item.name; return option; }));
      await window.RagConsole?.connected(ctx, result);
      if(generation!==window.RagConsole?.epoch)return;
      status('Найдено Коллекций: ' + result.collections.length + '.');
    } catch (error) {
      if(generation!==window.RagConsole?.epoch)return;
      window.RagConsole?.connectionFailed();
      throw error;
    }
  }, cfg.timeoutMs, trigger);
  $('connect').addEventListener('click',()=>fetchCollections());
  on('create-collection', 'Создание коллекции…', async () => {
    const ctx = context(), size = integer('dimensions', 'Размерность'), name = $('vector-name').value.trim();
    const distance = document.getElementById('rag-distance')?.value || cfg.distance;
    await qdrant(ctx, '', 'PUT', {vectors:name ? {[name]:{size, distance}} : {size, distance}});
    await window.RagConsole?.refresh(ctx.collection);
    if (![...$('collections').options].some(option => option.value === ctx.collection)) {
      const option = node('option'); option.value = ctx.collection; $('collections').append(option);
    }
    resetRecords(); status('Коллекция «' + ctx.collection + '» создана. Размерность: ' + size + '.');
  });
  on('read', 'Чтение документа…', async () => {
    const point = await read(context(), pointId());
    if (!point) throw new Error('Документ с этим ID не найден.');
    loadPoint(point); status('Документ ' + point.id + ' прочитан.');
  });
  async function write(update) {
    const ctx = context(), id = pointId(!update), text = $('text').value;
    if (!text.trim()) throw fieldError('text', 'Введите текст документа.');
    let metadata;
    try { metadata = JSON.parse($('metadata').value); } catch (_) { throw fieldError('metadata', 'Метаданные должны содержать корректный JSON-объект.'); }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw fieldError('metadata', 'Метаданные должны быть JSON-объектом.');
    if (Object.hasOwn(metadata, cfg.textField)) throw new Error('Поле «' + cfg.textField + '» зарезервировано для текста документа.');
    const existing = await read(ctx, id);
    if (update && !existing) throw new Error('Документ не найден. Для нового ID нажмите «Создать документ».');
    if (!update && existing) throw new Error('ID уже существует. Прочитайте документ и используйте кнопку «Обновить по ID».');
    const vector = await collectionVector(ctx), embedding = await embed(text, vector);
    if (update && vector.name) {
      await qdrant(ctx, '/points/vectors?wait=true', 'PUT', {points:[{id,vector:{[vector.name]:embedding}}]});
      await qdrant(ctx, '/points/payload?wait=true', 'PUT', {points:[id],payload:{...metadata,[cfg.textField]:text}});
    } else await qdrant(ctx, '/points?wait=true', 'PUT', {points:[{id, vector:vector.name ? {[vector.name]:embedding} : embedding, payload:{...metadata, [cfg.textField]:text}}]});
    await refreshAfterMutation(ctx, 'Документ ' + id + (update ? ' обновлён.' : ' создан.'), {must:[{has_id:[id]}]});
  }
  on('create', 'Векторизация и создание документа…', () => write(false));
  on('update', 'Векторизация и обновление документа…', () => write(true));
  on('delete', 'Проверка документа…', async () => {
    const ctx = context(), id = pointId();
    if (!await read(ctx, id)) throw new Error('Документ с этим ID не найден.');
    if (!confirm('Удалить документ ' + id + ' из коллекции «' + ctx.collection + '»? Действие нельзя отменить.')) { status('Удаление отменено.'); return; }
    await qdrant(ctx, '/points/delete?wait=true', 'POST', {points:[id]});
    clearEditor(); await refreshAfterMutation(ctx, 'Документ ' + id + ' удалён из коллекции «' + ctx.collection + '».', null);
  });
  on('browse', 'Загрузка документов…', async () => { const count = await browse(context(), null); status('Загружено документов: ' + count + '.'); });
  on('next', 'Загрузка следующей страницы…', async () => { const count = await browse(context(), nextOffset); status('Загружена следующая страница. Документов: ' + count + '.'); });
  on('search', 'Векторизация запроса и поиск…', async () => {
    const ctx = context(), query = $('query').value.trim(), limit = integer('top-k', 'Top K', 100);
    if (!query) throw fieldError('query', 'Введите поисковый запрос.');
    const vector = await collectionVector(ctx), embedding = await embed(query, vector, true);
    const result = await qdrant(ctx, '/points/query', 'POST', {query:embedding, limit, with_payload:true, with_vector:false, ...(vector.name ? {using:vector.name} : {})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный результат поиска.');
    renderPoints($('results'), result.points, 'По этому запросу документов не найдено.');
    status('Поиск по всей коллекции «' + ctx.collection + '» завершён. Найдено: ' + result.points.length + '.');
  });
  const checkCluster = () => run('Проверка готовности кластера…', async () => {
    const generation=window.RagConsole?.epoch,signal=controller.signal;
    window.RagConsole?.connecting();
    try {
      const ctx=context(false);
      await request(ctx.base, '/readyz', 'GET', undefined, {'api-key':ctx.key}, ctx.useProxy,signal);
      if(generation!==window.RagConsole?.epoch)return;
      window.RagConsole?.clusterReady(ctx);
      status('Сервер готов к запросам.');
    } catch(error) { if(generation!==window.RagConsole?.epoch)return;window.RagConsole?.connectionFailed(); throw error; }
  }, cfg.timeoutMs, $('check-cluster'));
  window.RagWorkbench = {loadModels,get signal() { return controller?.signal; }, cancel: () => controller?.abort(), run, context, qdrant, loadPoint, browse, resetRecords, clearEditor, persist, status, pointId, checkCluster, fetchCollections, qdrantProxy};
})();
