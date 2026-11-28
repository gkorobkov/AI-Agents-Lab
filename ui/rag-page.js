(() => {
  'use strict';
  if (window === window.parent) return;
  const cfg = parent.ragDefaults;
  Object.entries(parent.settingsFontSizes || {}).forEach(([role, size]) =>
    document.documentElement.style.setProperty('--settings-font-' + role, size + 'px'));
  if (!cfg) return;
  const $ = id => document.getElementById('rag-' + id);
  const node = (tag, text) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item; };
  const fields = { provider:'provider', qdrantUrl:'qdrant-url', neuraldeepUrl:'neuraldeep-url', dimensions:'dimensions', collection:'collection', topK:'top-k' };
  let saved = {}, busy = false, nextOffset = null, controller = null, recordsFilter = null, activeReceipt = null;
  let documentPage = 0, documentOffsets = [null], documentTotal = null;
  const settingsSlot = 'ai_rag_settings:' + location.hostname;
  try { saved = JSON.parse(sessionStorage.getItem(settingsSlot) || localStorage.getItem('ai_rag_settings') || '{}'); } catch (_) {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const operationSettings={...saved.operations};
  Object.entries(fields).forEach(([name, id]) => { $(id).value = typeof saved[name] === typeof cfg[name] ? saved[name] : cfg[name]; });
  const qdrantProxy = ProxyControls.mount($('qdrant-url'), {onChange:() => { persist(); window.RagConsole?.transportChanged(); }});
  const embeddingProxy = ProxyControls.mount($('neuraldeep-url'), {onChange:() => {
    if (providerSelect.value) parent.OpenAIProviderProfiles.change(providerSelect.value, 'update', {useProxy:embeddingProxy.read()});
    persist();
  }});
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
  const profileValues = saved.embeddingProfiles && typeof saved.embeddingProfiles === 'object' ? saved.embeddingProfiles : {};
  let activeProfile = saved.embeddingProfileId || '';
  function embeddingDefault(key){
    const legacyKey={model:'model',documentPrefix:'document-prefix',queryPrefix:'query-prefix'}[key];
    const value=profileValues[providerSelect.value||'custom']?.[legacyKey];
    return typeof value==='string'?value:typeof saved[key]==='string'?saved[key]:cfg[key];
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
    return parent.OpenAIProviderProfiles.key();
  }
  function syncEmbeddingKeyDisplay() {
    embeddingKeyField.placeholder = providerSelect.value && embeddingKey() ? '••••••••' : '';
  }
  function updateEmbeddingProvider() {
    const selected = providerSelect.selectedOptions[0];
    const url = selected.value ? selected.dataset.baseUrl : customEmbeddingUrl;
    const managed = Boolean(selected.value);
    const changed = embeddingUrl.value !== url || activeProfile !== selected.value;
    activeProfile=selected.value;
    if (managed) {
      embeddingKeyField.value = embeddingKey();
      embeddingProxy.set(selected.dataset.useProxy === 'true');
    }
    syncEmbeddingKeyDisplay();
    if (changed) {
      embeddingUrl.value = url;
      embeddingUrl.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }
  function refreshEmbeddingProviders(selected) {
    const profiles = parent.allOpenAIProfiles();
    providerSelect.replaceChildren(...profiles.map(profile => {
      const option = new Option(profile.name, profile.id);
      option.dataset.baseUrl = profile.baseUrl;
      option.dataset.useProxy = String(!!profile.useProxy);
      return option;
    }));
    const fallback = parent.OpenAIProviderProfiles.active();
    providerSelect.value = [selected, fallback].find(id => profiles.some(profile => profile.id === id)) ?? profiles[0]?.id ?? '';
    updateEmbeddingProvider();
  }
  providerSelect.addEventListener('change', () => { updateEmbeddingProvider(); persist(); });
  embeddingUrl.addEventListener('input', () => { if (!providerSelect.value) customEmbeddingUrl = embeddingUrl.value; });
  embeddingUrl.addEventListener('change', () => {
    if (providerSelect.value) parent.OpenAIProviderProfiles.change(providerSelect.value, 'update', {baseUrl:embeddingUrl.value.trim().replace(/\/+$/, '')});
  });
  embeddingKeyField.addEventListener('change', () => {
    if (providerSelect.value) parent.OpenAIProviderProfiles.setKey(embeddingKeyField.value);
  });
  const embeddingSources = [providerSelect, embeddingUrl, embeddingKeyField, embeddingProxy.input];
  for (const source of embeddingSources) {
    source.addEventListener('input', () => embeddingConnectionStatus());
    source.addEventListener('change', () => embeddingConnectionStatus());
  }
  window.addEventListener('ai-proxy:url-change', () => { if (embeddingProxy.read()) embeddingConnectionStatus(); });
  window.addEventListener('storage', event => {
    if (event.key === 'ai_openai_profiles') { refreshEmbeddingProviders(providerSelect.value); persist(); }
    if (event.key === 'ai_openai_key' && providerSelect.value) {
      embeddingKeyField.value = embeddingKey();
      syncEmbeddingKeyDisplay();
      embeddingConnectionStatus();
    }
    if (event.key === LocalProxyTransport.storageKey && embeddingProxy.read()) embeddingConnectionStatus();
  });
  async function loadModels(collection) {
    modelRequest?.abort();
    const pending = modelRequest = new AbortController();
    const timer = setTimeout(() => pending.abort(), cfg.timeoutMs);
    embeddingConnectionStatus('loading', 'Загрузка моделей…');
    try {
      const key = embeddingKey();
      if (providerSelect.value && !key) throw fieldError('neuraldeep-key', 'Укажите API-ключ в настройках OpenAI API.');
      const data = await request(embeddingBaseUrl(), '/models', 'GET', undefined, key ? {Authorization:'Bearer ' + key} : {}, embeddingProxy.read(), pending.signal, 'models',{collection});
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
  const status = (message, error = false) => {
    if (!activeReceipt?.matches('#rag-collections-status, #rag-cluster-status')) {
      $('status').textContent = message; $('status').title = message; $('status').classList.toggle('error', error);
    }
    if (activeReceipt) { activeReceipt.textContent = message; activeReceipt.title = message; activeReceipt.dataset.state = error ? 'error' : busy ? 'loading' : 'done'; }
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:error ? 'error' : busy ? 'progress' : 'done', message}}));
  };
  function recordsNotice(message) {
    $('records-notice').textContent = $('records-notice').title = message;
  }
  async function refreshAfterMutation(ctx, message, filter) {
    const warnings = [];
    try { await browse(ctx, null, filter); } catch (error) { warnings.push('Список документов не обновлён: ' + error.message); }
    try { await window.RagConsole?.afterMutation(); } catch (error) { warnings.push('Статистика не обновлена: ' + error.message); }
    const result = message + (warnings.length ? ' Данные уже сохранены. ' + warnings.join(' ') + ' Нажмите «Обновить документы»; повторно загружать файл не нужно.' : ' Список документов и статистика обновлены.');
    if (!$('records-notice').textContent||warnings.length) recordsNotice(result);
    status(result, false);
    window.RagConsole?.revealDocuments();
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:'saved', message:result, collection:ctx.collection}}));
  }
  const persist = () => {
    const settings = {qdrantUseProxy:qdrantProxy.read(), embeddingUseProxy:embeddingProxy.read()};
    Object.entries(fields).forEach(([name, id]) => { settings[name] = typeof cfg[name] === 'number' ? Number($(id).value) : $(id).value; });
    settings.embeddingProfileId = providerSelect.value;
    settings.neuraldeepUrl = customEmbeddingUrl;
    settings.embeddingProfiles = profileValues;
    for(const input of document.querySelectorAll('[data-rag-operation-setting]')){
      if(input.tagName==='SELECT'&&(input.disabled||input.selectedIndex<0))continue;
      operationSettings[input.id]=input.value;
    }
    settings.operations=operationSettings;
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
    message.className = 'sr-only';
    document.body.append(message);
    field.setAttribute('data-rag-invalid', '');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
    status(error.message, true);
    field.scrollIntoView({block:'nearest', behavior:'smooth'});
    parent.appWorkspace?.highlightField(field, { error:true, scroll:false });
  }
  document.addEventListener('input', event => clearFieldError(event.target));
  document.addEventListener('change', event => clearFieldError(event.target));
  function resetRecords() {
    nextOffset = null; recordsFilter = null; documentPage = 0; documentOffsets = [null]; documentTotal = null;
    $('prev').hidden = $('next').hidden = true;
    recordsNotice('');
    $('records').replaceChildren(node('p', 'Документы ещё не загружены.'));
    clearSearchResults();
  }
  function clearSearchResults() {
    $('results').hidden=true;
    $('results').replaceChildren();
  }
  function clearLookupResult() {
    $('text').value='';
    $('metadata').value=cfg.metadata;
    $('edit-document').hidden=true;
    $('raw-point').value='{}';
    $('payload-only').value='{}';
  }
  function clearEditor() { $('id').value=''; clearLookupResult(); }
  let newDocumentId;
  function clearCreateDocument() { newDocumentId=undefined; $('new-text').value = ''; $('new-metadata').value = cfg.metadata; }
  Object.values(fields).forEach(id => $(id).addEventListener('change', () => {
    persist();
    if (['qdrant-url', 'collection', 'neuraldeep-url'].includes(id)) {
      resetRecords();
      if (id === 'qdrant-url' || id === 'collection') clearEditor();
      if (id === 'qdrant-url') $('collections').replaceChildren();
      status('Настройки изменены. Повторите запрос к выбранной коллекции.');
    }
  }));
  refreshEmbeddingProviders(saved.embeddingProfileId);
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
  function pointId(field = 'id') {
    const value = $(field).value.trim();
    if (/^\d+$/.test(value)) {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id < 0) throw fieldError(field, 'Числовой ID должен быть безопасным целым числом JavaScript. Для больших ID используйте UUID.');
      return id;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
    throw fieldError(field, 'Укажите UUID или неотрицательное целое число.');
  }
  let activeOperation;
  function describeRequest(path,method,signal){
    const endpoint=path.split('?')[0];
    const step=endpoint.endsWith('/embeddings')?['Эмбед.','Получение эмбеддинга']:
      endpoint.endsWith('/models')?['Модели','Получение списка моделей']:
      endpoint.endsWith('/points')&&method==='POST'?['Проверка','Чтение точки по ID']:
      endpoint.endsWith('/points/scroll')?['Список','Загрузка списка документов']:
      endpoint.endsWith('/points/count')?['Подсчёт','Подсчёт документов']:
      method==='PUT'&&/^\/collections\/[^/]+\/vectors\/[^/]+$/.test(endpoint)?['Вектор','Создание именованного вектора']:
      /\/snapshots(?:\/|$)/.test(endpoint)?['Снимки','Операция со снимками']:
      endpoint==='/collections'?['Список','Загрузка списка коллекций']:
      method==='GET'&&/^\/collections\/[^/]+$/.test(endpoint)?['Схема','Чтение конфигурации коллекции']:
      endpoint==='/readyz'?['Проверка','Проверка готовности кластера']:
      endpoint==='/'?['Версия','Чтение версии Qdrant']:
      method==='DELETE'?['Удалить','Удаление']:method==='GET'?['Чтение','Чтение данных']:['Запрос','Операция с данными'];
    const origin=signal&&signal===controller?.signal?activeOperation:null;
    return {short:origin?.short||step[0],label:origin&&origin.label!==step[1]?origin.label+' · '+step[1]:step[1]};
  }
  async function request(base, path, method, body, headers, useProxy, signal = controller?.signal, channel, {collection, raw=false, verify}={}) {
    const secrets=[$('qdrant-key').value.trim(),embeddingKey()].filter(Boolean);
    const redact=value=>{let text=JSON.stringify(value);for(const key of secrets)text=text.split(JSON.stringify(key).slice(1,-1)).join('[ключ скрыт]');return JSON.parse(text);};
    const requestHeaders = Object.fromEntries(Object.entries(headers).filter(([name, value]) => name !== 'api-key' || value));
    requestHeaders.Accept='application/json';
    const multipart=body instanceof FormData;
    const loggedBody=multipart?Object.fromEntries([...body].map(([name,value])=>[name,value instanceof File?{name:value.name,size:value.size,type:value.type}:value])):body;
    if(body!==undefined&&!multipart)requestHeaders['Content-Type']='application/json';
    const record={method,channel,collection,action:describeRequest(path,method,signal),startedAt:new Date().toISOString(),url:base+path,request:redact({headers:HttpDebug.clean(requestHeaders),...(loggedBody===undefined?{}:{body:loggedBody}),proxy:useProxy})};
    document.dispatchEvent(new CustomEvent('rag:http',{detail:record}));
    const started=performance.now();
    let response;
    try {
      response = await LocalProxyTransport.fetch(base + path, { method, headers:requestHeaders, body:multipart?body:JSON.stringify(body), signal, credentials:'omit', redirect:'error', referrerPolicy:'no-referrer' }, useProxy);
    } catch (error) {
      record.complete?.({status:'Ошибка сети',ms:Math.round(performance.now()-started),response:redact({error:error.message})});
      if (signal?.aborted) throw new Error('Превышено время ожидания запроса. Проверьте доступность сервисов и повторите операцию.');
      if (useProxy) throw error;
      const proxy = Object.prototype.hasOwnProperty.call(headers, 'api-key') ? qdrantProxy : embeddingProxy;
      throw Object.assign(new Error('Не удалось связаться с сервисом. Возможна блокировка CORS. Включите «use Proxy» в настройках соответствующего сервиса и повторите запрос. Также проверьте URL и сеть.'), {proxyInput:proxy.input});
    }
    const exchange={status:response.status,headers:HttpDebug.clean(Object.fromEntries(response.headers.entries()))};
    try {
      let value;
      if(!raw||!response.ok||multipart){
        const text=await response.clone().text();
        if(text){try{value=JSON.parse(text);}catch(_){value={text};}}
      }
      if(value!==undefined)exchange.response=redact(value);
    } catch(_) { exchange.response={error:'Не удалось прочитать ответ.'}; }
    exchange.ms=Math.round(performance.now()-started);
    try{
      if(raw){
        if(!response.ok) throw new Error('HTTP '+response.status+': операция со снимком недоступна.');
        return response;
      }
      if (path === '/readyz') {
        if (!response.ok) throw new Error('Кластер не готов. HTTP ' + response.status + '.');
        await response.text();
        return true;
      }
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('Сервис вернул не JSON (HTTP ' + response.status + '). Проверьте REST URL.'); }
      if (!response.ok || data.status?.error) {
        const detail = data.status?.error || data.error?.message || (typeof data.error === 'string' ? data.error : 'Проверьте ключ, права и параметры.');
        throw new Error('HTTP ' + response.status + ': ' + redact(String(detail)));
      }
      const result=data.result===undefined?data:data.result;
      if(!verify)return result;
      try{return verify(result);}
      catch(error){exchange.clientIssue=redact(String(error.message||error));throw error;}
    }finally{record.complete?.(exchange);}
  }
  const qdrant = (ctx, suffix, method = 'GET', body, signal = controller?.signal, channel, raw=false) => {
    const path=suffix.startsWith('/collections')||suffix==='/aliases'||suffix==='/cluster'?suffix:ctx.path+suffix;
    const name=path.match(/^\/collections\/([^/?]+)(?:[/?]|$)/)?.[1];
    const collection=name&&suffix!=='/collections/aliases'?decodeURIComponent(name):undefined;
    return request(ctx.base,path,method,body,{'api-key':ctx.key},ctx.useProxy,signal,channel,{collection,raw});
  };
  async function collectionVector(ctx,field) {
    const info = await qdrant(ctx, '');
    const vectors = info.config?.params?.vectors;
    const name = $(field).value.trim();
    const unnamed = Number.isInteger(vectors?.size);
    const definition = name ? (!unnamed&&vectors&&Object.hasOwn(vectors,name)?vectors[name]:null) : (unnamed ? vectors : null);
    if (!definition || !Number.isInteger(definition.size)) {
      throw fieldError(field,'Выберите существующий плотный вектор. Если схема коллекции изменилась, обновите список коллекций.');
    }
    if (definition.multivector_config) throw fieldError(field, 'Для multivector используйте редактор точки JSON.');
    return { name, size:definition.size };
  }
  function operationValue(id,fallback){
    const savedValue=operationSettings['rag-'+id];
    if(typeof savedValue==='string')return savedValue;
    const imported=id.startsWith('new-')?operationSettings['rag-file-'+id.slice(4)]:undefined;
    return typeof imported==='string'?imported:fallback;
  }
  const embeddingIdentity = modelField => JSON.stringify([providerSelect.value, $('neuraldeep-url').value, $(modelField).value.trim(),embeddingProxy.read()]);
  async function embedTexts(texts, vector, {modelField}) {
    const key = embeddingKey(), model = $(modelField).value.trim();
    const identity = embeddingIdentity(modelField);
    if (providerSelect.value && !key) throw fieldError('neuraldeep-key', 'Укажите API-ключ в настройках OpenAI API.');
    if (!key) throw fieldError('neuraldeep-key', 'Укажите API Key.');
    if (!model) throw fieldError(modelField, 'Укажите модель эмбеддингов.');
    const prefix = $(modelField.replace(/-model$/,'-prefix')).value;
    const verify=data=>{
      if (!Array.isArray(data?.data) || data.data.length !== texts.length) throw new Error('Сервис вернул неполный набор эмбеддингов.');
      const ordered=[...data.data].sort((a,b)=>a?.index-b?.index);
      return ordered.map((item,index)=>{
        if (texts.length>1 && item?.index!==index) throw new Error('Сервис вернул некорректный порядок эмбеддингов.');
        const embedding=item?.embedding;
        if (!Array.isArray(embedding) || !embedding.length || !embedding.every(Number.isFinite)) throw new Error('Сервис вернул некорректный эмбеддинг.');
        if (index===0 && identity===embeddingIdentity(modelField)) document.dispatchEvent(new CustomEvent('rag:embedding-dimension',{detail:{identity,size:embedding.length}}));
        if (vector && embedding.length!==vector.size) throw fieldError(modelField,'Размерность эмбеддинга '+embedding.length+' не совпадает с размерностью коллекции '+vector.size+'. Выберите совместимую модель.');
        return embedding;
      });
    };
    return request(embeddingBaseUrl(), '/embeddings', 'POST', {model, input:texts.map(text => prefix + text)}, {Authorization:'Bearer ' + key}, embeddingProxy.read(),controller?.signal,undefined,{collection:$('collection').value.trim(),verify});
  }

  $('files').accept = cfg.fileExtensions.map(ext => '.' + ext).join(',');
  $('files-hint').textContent = cfg.fileExtensions.map(ext => ext.toUpperCase()).join(', ') + ' · UTF-8 · до ' + cfg.fileMaxCount + ' файлов, ' + (cfg.fileMaxBytes / 1024) + ' КБ на файл и ' + (cfg.fileTotalMaxBytes / 1024) + ' КБ суммарно.';
  const showFiles = () => {
    const labels=Array.from($('files').files,file=>node('span',file.name+' · '+Math.ceil(file.size/1024)+' КБ'));
    $('file-list').replaceChildren(...(labels.length?labels:[node('span','Файлы не выбраны.')]));
  };
  $('pick-files').addEventListener('click', () => $('files').click());
  $('files').addEventListener('change', showFiles);
  $('clear-files').addEventListener('click', () => { $('files').value = ''; showFiles(); });
  function splitDocumentText(text, length, overlap) {
    const chars = Array.from(text), chunks = [], step = length - overlap;
    for (let start = 0; start < chars.length; start += step) {
      const chunk = chars.slice(start, start + length).join('').trim();
      if (chunk) chunks.push(chunk);
      if (start + length >= chars.length) break;
    }
    return chunks;
  }
  function chunkSettings(operation){
    const length=integer(operation+'-chunk','Длина фрагмента'), batchSize=integer(operation+'-batch','Фрагментов за запрос');
    const overlapField=operation+'-overlap', overlap=$(overlapField).valueAsNumber;
    if (!Number.isSafeInteger(overlap) || overlap < 0 || overlap >= length) throw fieldError(overlapField,'Укажите целое перекрытие от нуля до длины фрагмента, не включая её.');
    return {length,overlap,batchSize};
  }
  async function embedBatches(chunks,vector,batchSize,modelField,onBatch){
    const result=[];
    for(let start=0;start<chunks.length;start+=batchSize){
      controller.signal.throwIfAborted();
      onBatch?.(start);
      for(const embedding of await embedTexts(chunks.slice(start,start+batchSize),vector,{modelField})) result.push(embedding);
    }
    return result;
  }
  async function uploadFiles() {
    const {length,overlap,batchSize}=chunkSettings('new');
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
      const chunks = splitDocumentText(text,length,overlap);
      if (!chunks.length) throw new Error('Файл «' + file.name + '» пуст или содержит только пробелы.');
      prepared.push({file, chunks});
    }
    const ctx = context(), vector = await collectionVector(ctx,'new-document-vector'), importId = crypto.randomUUID(), points = [];
    const total = prepared.reduce((sum, entry) => sum + entry.chunks.length, 0);
    try {
      for (const {file, chunks} of prepared) {
        const embeddings=await embedBatches(chunks,vector,batchSize,'new-model',start=>{
          status('Векторизация файлов: ' + (points.length+start) + ' / ' + total + ' фрагментов. Файл: ' + file.name + '.');
        });
        chunks.forEach((text, index) => points.push({
          id:crypto.randomUUID(), vector:vector.name ? {[vector.name]:embeddings[index]} : embeddings[index],
          payload:{source_name:file.name, source_type:file.type || file.name.split('.').pop().toLowerCase(), chunk_index:index + 1, chunk_count:chunks.length, import_id:importId, [cfg.textField]:text}
        }));
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

  async function read(ctx, id, withVector=false) {
    const points = await qdrant(ctx, '/points', 'POST', {ids:[id], with_payload:true, with_vector:withVector});
    if (!Array.isArray(points)) throw new Error('Qdrant вернул неожиданный ответ при чтении документа.');
    return points[0];
  }
  function loadPoint(point, full=false) {
    clearLookupResult();
    $('edit-document').hidden = false;
    $('id').value = point.id;
    const payload = point.payload || {};
    $('text').value = typeof payload[cfg.textField] === 'string' ? payload[cfg.textField] : '';
    const metadata = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== cfg.textField));
    $('metadata').value = JSON.stringify(metadata, null, 2);
    if(full){
      $('raw-point').value=JSON.stringify(point,null,2);
      $('payload-only').value=JSON.stringify(payload,null,2);
    }
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
        loadPoint(point);window.RagConsole?.revealEditor();
        $('id').scrollIntoView({behavior:'smooth',block:'center'});$('text').focus({preventScroll:true});status('Документ '+point.id+' загружен в редактор.');
      });
      head.append(caption,load);
      const full=node('details');full.className='rag-record-text';
      full.append(node('summary',text));
      const identity=node('span');identity.className='debug-summary-text';const key=node('span','ID: '),value=node('span',String(point.id));key.className='debug-field-name';value.className='debug-field-value';identity.append(key,value);head.prepend(identity);
      const metadata=node('details'),heading=node('summary','Payload JSON'),pre=node('pre');metadata.className='debug-section rag-json-panel';
      metadata.append(heading,pre);JsonViewer.create({pre,heading}).update(JSON.stringify(payload,null,2));
      article.append(head,full,metadata);host.append(article);
    });
  }
  async function browse(ctx, offset, filter = offset === null ? null : recordsFilter, page = 0, restart = true, channel) {
    const requestPage = (path,body) => qdrant(ctx,path,'POST',body,controller?.signal,channel);
    const result = await requestPage('/points/scroll', {limit:cfg.pageSize, with_payload:true, with_vector:false, ...(filter ? {filter} : {}), ...(offset === null ? {} : {offset})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный список документов.');
    renderPoints($('records'), result.points, 'Документов нет. Загрузите текстовый файл или создайте документ.');
    recordsFilter = filter;
    if (restart) {
      documentOffsets = [null];
      documentTotal = null;
      try {
        const result = await requestPage('/points/count', {exact:true, ...(filter ? {filter} : {})});
        if (Number.isSafeInteger(result.count)) {
          documentTotal = result.count;
          if (!filter) document.dispatchEvent(new CustomEvent('rag:document-count',{detail:{collection:ctx.collection,count:documentTotal}}));
        }
      } catch (_) { /* Cursor navigation still works if the total is unavailable. */ }
    }
    documentPage = page;
    nextOffset = result.next_page_offset ?? null;
    if (nextOffset !== null) documentOffsets[page + 1] = nextOffset;
    $('prev').hidden = page === 0;
    $('next').hidden = nextOffset === null;
    const first = page * cfg.pageSize + 1;
    const totalPages = documentTotal === null ? '' : ' из ' + Math.max(page+1,Math.ceil(documentTotal/cfg.pageSize),1);
    const scope = filter ? 'Документы последней записи.' : 'Документы коллекции.';
    recordsNotice(scope + ' Страница ' + (page+1) + totalPages + '. ' +
      (result.points.length ? 'На странице: с ' + first + ' по ' + (first+result.points.length-1) + '.' : 'На странице нет документов.'));
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
    if (!activeReceipt && trigger?.dataset.ragStatus) activeReceipt=$(trigger.dataset.ragStatus);
    busy = true; $('workbench').disabled = true; $('workbench').setAttribute('aria-busy', 'true');
    const label=trigger?.getAttribute('aria-label')||trigger?.title||trigger?.textContent.trim()||message.replace(/…$/,'');
    const short={ 'rag-create':'Создать', 'rag-read':'По ID', 'rag-update':'Сохран.', 'rag-upload':'Импорт', 'rag-search':'Поиск', 'rag-connect':'Список', 'rag-browse':'Обновить' }[trigger?.id];
    activeOperation={label,short:short||label};
    controller = new AbortController();
    const generation=window.RagConsole?.epoch;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let failure;
    status(message);
    try { await action(); } catch (error) { failure = error; }
    finally { clearTimeout(timeout); busy = false; $('workbench').disabled = false; $('workbench').removeAttribute('aria-busy'); controller = null; activeOperation=undefined; }
    if(generation!==window.RagConsole?.epoch){activeReceipt=null;return false;}
    if (failure) {
      if (activeReceipt) { activeReceipt.textContent = failure.message; activeReceipt.dataset.state = 'error'; }
      if (activeReceipt?.matches('#rag-collections-status, #rag-cluster-status')) {
        if (failure.fieldId) showFieldError(failure, trigger);
        status(failure.message, true);
      } else showFieldError(failure, null);
      if (failure.proxyInput && !failure.proxyInput.checked) {
        window.RagConsole?.revealField(failure.proxyInput);
        parent.appWorkspace?.highlightField(failure.proxyInput.closest('label'), {focus:false});
      }
    } else if (activeReceipt) activeReceipt.dataset.state = 'done';
    document.dispatchEvent(new CustomEvent('rag:operation', {detail:{phase:failure ? 'error' : 'done', message:failure?.message || activeReceipt?.textContent || $('status').textContent}}));
    activeReceipt = null;
    return !failure;
  }
  const on = (id, message, action, timeout=cfg.timeoutMs) => $(id).addEventListener('click', () => run(message, action, timeout, $(id)));
  clearCreateDocument();
  $('id').addEventListener('input',clearLookupResult);
  $('clear-id').addEventListener('click',()=>{
    clearEditor();clearFieldError($('id'));status('');$('id').focus();
  });
  $('clear-search').addEventListener('click',()=>{
    $('query').value='';clearSearchResults();clearFieldError($('query'));status('');$('query').focus();
  });
  const fetchCollections = (trigger=$('connect')) => run('Получение коллекций…', async () => {
    const generation=window.RagConsole?.epoch,signal=controller.signal;
    const channel='collections-refresh';
    document.dispatchEvent(new CustomEvent('rag:logs-reset',{detail:channel}));
    window.RagConsole?.connecting();
    try {
      const ctx = context(false), result = await qdrant(ctx, '/collections','GET',undefined,signal,channel);
      if(generation!==window.RagConsole?.epoch)return;
      if (!Array.isArray(result.collections)) throw new Error('Qdrant вернул неожиданный список коллекций.');
      $('collections').replaceChildren(...result.collections.map(item => { const option = node('option'); option.value = item.name; return option; }));
      await window.RagConsole?.connected(ctx, result, channel);
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
    const ctx = context(), size = integer('dimensions', 'Размерность'), name = $('new-vector-name').value.trim();
    const distance = document.getElementById('rag-distance')?.value || cfg.distance;
    await qdrant(ctx, '', 'PUT', {vectors:name ? {[name]:{size, distance}} : {size, distance}});
    await window.RagConsole?.refresh(ctx.collection);
    if (![...$('collections').options].some(option => option.value === ctx.collection)) {
      const option = node('option'); option.value = ctx.collection; $('collections').append(option);
    }
    resetRecords(); status('Коллекция «' + ctx.collection + '» создана. Размерность: ' + size + '.');
  });
  on('read', 'Чтение документа…', async () => {
    clearLookupResult();
    const point = await read(context(), pointId(),true);
    if (!point) throw new Error('Документ с этим ID не найден.');
    loadPoint(point,true); status('Документ ' + point.id + ' прочитан.');
  });
  $('id').addEventListener('keydown', event => { if(event.key==='Enter'){event.preventDefault();$('read').click();} });
  async function write(update) {
    const prefix=update?'':'new-', textField=prefix+'text', metadataField=prefix+'metadata';
    const ctx = context(), text = $(textField).value;
    if (!text.trim()) throw fieldError(textField, 'Введите текст документа.');
    const operation=update?'edit':'new';
    const {length,overlap,batchSize}=chunkSettings(operation);
    const chunks=splitDocumentText(text,length,overlap);
    let metadata;
    try { metadata = JSON.parse($(metadataField).value); } catch (_) { throw fieldError(metadataField, 'Метаданные должны содержать корректный JSON-объект.'); }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw fieldError(metadataField, 'Метаданные должны быть JSON-объектом.');
    if (Object.hasOwn(metadata, cfg.textField)) throw new Error('Поле «' + cfg.textField + '» зарезервировано для текста документа.');
    const id=update?pointId():(newDocumentId??=crypto.randomUUID());
    const existing = await read(ctx, id, update);
    if (update && !existing) throw new Error('Документ не найден. Для создания откройте вкладку «Добавить».');
    if (!update && existing) throw new Error('Документ с этим ID уже есть в коллекции. Откройте «Документы», чтобы проверить результат предыдущей попытки.');
    if(update&&chunks.length>1&&!confirm('Сохранить первый фрагмент под прежним ID и добавить отдельных точек: '+(chunks.length-1)+'?')){
      status('Редактирование отменено.');
      return;
    }
    const vector = await collectionVector(ctx,update?'edit-vector':'new-document-vector');
    if(vector.name&&existing?.vector&&Array.isArray(existing.vector)) throw Error('Qdrant вернул векторы точки без имён. Проверьте конфигурацию коллекции.');
    const embeddings=await embedBatches(chunks,vector,batchSize,operation+'-model');
    const points=chunks.map((fragment,index)=>({
      id:index===0?id:crypto.randomUUID(),
      vector:vector.name?{...(index===0?existing?.vector:{}),[vector.name]:embeddings[index]}:embeddings[index],
      payload:{...metadata,...(chunks.length>1?{document_id:id,chunk_index:index+1,chunk_count:chunks.length}:{}),[cfg.textField]:chunks.length===1?text:fragment}
    }));
    await qdrant(ctx, '/points?wait=true', 'PUT', {points});
    if (!update) clearCreateDocument();
    else loadPoint(points[0],true);
    await refreshAfterMutation(ctx, 'Документ ' + id + (update ? ' обновлён.' : ' создан.') + (points.length>1?' Фрагментов: '+points.length+'.':''), {must:[{has_id:points.map(point=>point.id)}]});
  }
  on('create', 'Векторизация и создание документа…', () => write(false), cfg.fileUploadTimeoutMs);
  on('update', 'Векторизация и обновление документа…', () => write(true), cfg.fileUploadTimeoutMs);
  on('delete', 'Проверка документа…', async () => {
    const ctx = context(), id = pointId();
    if (!await read(ctx, id)) throw new Error('Документ с этим ID не найден.');
    if (!confirm('Удалить документ ' + id + ' из коллекции «' + ctx.collection + '»? Действие нельзя отменить.')) { status('Удаление отменено.'); return; }
    await qdrant(ctx, '/points/delete?wait=true', 'POST', {points:[id]});
    clearEditor(); await refreshAfterMutation(ctx, 'Документ ' + id + ' удалён из коллекции «' + ctx.collection + '».', null);
  });
  on('browse', 'Загрузка документов…', async () => { const count = await browse(context(), null); status('Загружено документов: ' + count + '.'); });
  async function navigateDocuments(page) {
    await browse(context(), documentOffsets[page], recordsFilter, page, false);
    status('Загружена страница ' + (page+1) + '.');
  }
  on('next', 'Загрузка следующей страницы…', () => navigateDocuments(documentPage+1));
  on('prev', 'Загрузка предыдущей страницы…', () => navigateDocuments(documentPage-1));
  on('search', 'Векторизация запроса и поиск…', async () => {
    const ctx = context(), query = $('query').value.trim(), limit = integer('top-k', 'Top K', 100);
    if (!query) throw fieldError('query', 'Введите поисковый запрос.');
    const vector = await collectionVector(ctx,'search-vector'), [embedding] = await embedTexts([query],vector,{modelField:'search-model'});
    const result = await qdrant(ctx, '/points/query', 'POST', {query:embedding, limit, with_payload:true, with_vector:false, ...(vector.name ? {using:vector.name} : {})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный результат поиска.');
    renderPoints($('results'), result.points, 'По этому запросу документов не найдено.');
    $('results').hidden=false;
    status('Поиск по всей коллекции «' + ctx.collection + '» завершён. Найдено: ' + result.points.length + '.');
  });
  const checkCluster = () => run('Проверка готовности кластера…', async () => {
    const generation=window.RagConsole?.epoch,signal=controller.signal;
    window.RagConsole?.connecting();
    try {
      const ctx=context(false);
      await request(ctx.base, '/readyz', 'GET', undefined, {'api-key':ctx.key}, ctx.useProxy,signal);
      if(generation!==window.RagConsole?.epoch)return;
      let version;
      try{
        version=await request(ctx.base,'/','GET',undefined,{'api-key':ctx.key},ctx.useProxy,signal,undefined,{
          verify:data=>{
            const value=typeof data?.version==='string'?data.version.trim():'';
            if(!value)throw Error('В ответе Qdrant отсутствует версия.');
            return value;
          }
        });
      }catch(_){ /* The readiness check has already succeeded. */ }
      if(generation!==window.RagConsole?.epoch)return;
      window.RagConsole?.clusterReady(ctx,version);
      status(version?'Готов · Qdrant '+version:'Готов · версия недоступна');
    } catch(error) { if(generation!==window.RagConsole?.epoch)return;window.RagConsole?.connectionFailed(); throw error; }
  }, cfg.timeoutMs, $('check-cluster'));
  const measureEmbedding = modelField => embedTexts(['test'],null,{modelField});
  window.RagWorkbench = {loadModels,refreshEmbeddingProviders,get signal() { return controller?.signal; }, cancel: () => controller?.abort(), run, context, qdrant, readPoint:read, loadPoint, browse, resetRecords, clearEditor, clearCreateDocument, persist, status, pointId, checkCluster, fetchCollections, qdrantProxy, operationValue, embeddingDefault, defaultVectorName:saved.vectorName, embeddingIdentity, measureEmbedding};
})();
