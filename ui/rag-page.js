(() => {
  'use strict';
  if (window === window.parent) return;
  const cfg = parent.ragDefaults;
  if (!cfg) return;
  const $ = id => document.getElementById('rag-' + id);
  const node = (tag, text) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item; };
  const fields = { provider:'provider', qdrantUrl:'qdrant-url', neuraldeepUrl:'neuraldeep-url', model:'model', dimensions:'dimensions', collection:'collection', vectorName:'vector-name', topK:'top-k', queryPrefix:'query-prefix', documentPrefix:'document-prefix' };
  let saved = {}, busy = false, nextOffset = null, controller = null;
  try { saved = JSON.parse(localStorage.getItem('ai_rag_settings') || '{}'); } catch (_) {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  Object.entries(fields).forEach(([name, id]) => { $(id).value = typeof saved[name] === typeof cfg[name] ? saved[name] : cfg[name]; });
  $('metadata').value = cfg.metadata;
  $('text-field-note').textContent = `Поле «${cfg.textField}» хранит текст документа и не должно повторяться в метаданных. Остальные поля payload сохраняются при загрузке в редактор.`;
  const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
  const persist = () => {
    const settings = {};
    Object.entries(fields).forEach(([name, id]) => { settings[name] = typeof cfg[name] === 'number' ? Number($(id).value) : $(id).value; });
    try { localStorage.setItem('ai_rag_settings', JSON.stringify(settings)); } catch (_) {}
  };
  function resetRecords() {
    nextOffset = null; $('next').hidden = true;
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
  function urlValue(id) {
    let url;
    try { url = new URL($(id).value.trim()); } catch (_) { throw new Error('Укажите корректный URL в поле «' + (id === 'qdrant-url' ? 'REST URL кластера Qdrant' : 'Base URL NeuralDeep') + '».'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('URL должен использовать HTTP(S) и не содержать логин, пароль, параметры или якорь.');
    if (url.hostname === 'cloud.qdrant.io') throw new Error('Укажите REST URL вашего кластера из Qdrant Cloud, а не адрес панели cloud.qdrant.io.');
    return url.href.replace(/\/+$/, '');
  }
  function context(needsCollection = true) {
    const collection = $('collection').value.trim();
    if (needsCollection && !collection) throw new Error('Укажите имя коллекции.');
    const key = $('qdrant-key').value.trim();
    if (!key) throw new Error('Укажите API key Qdrant.');
    return { base:urlValue('qdrant-url'), key, collection, path:'/collections/' + encodeURIComponent(collection) };
  }
  function integer(id, name, max = Number.MAX_SAFE_INTEGER) {
    const n = Number($(id).value);
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(name + ': введите целое число от 1 до ' + max + '.');
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
    throw new Error('Укажите ID: UUID или неотрицательное целое число.');
  }
  async function request(base, path, method, body, headers) {
    let response;
    try {
      response = await fetch(base + path, { method, headers:{ ...headers, ...(body === undefined ? {} : {'Content-Type':'application/json'}) }, body:body === undefined ? undefined : JSON.stringify(body), signal:controller.signal, credentials:'omit', redirect:'error', referrerPolicy:'no-referrer' });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Превышено время ожидания запроса. Проверьте доступность сервисов и повторите операцию.');
      throw new Error('Не удалось связаться с сервисом. Проверьте URL, сеть и CORS: сервер должен разрешать origin ' + location.origin + ', методы запроса и заголовки api-key / Authorization / Content-Type.');
    }
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Сервис вернул не JSON (HTTP ' + response.status + '). Проверьте REST URL.'); }
    if (!response.ok || data.status?.error) {
      const detail = data.status?.error || data.error?.message || (typeof data.error === 'string' ? data.error : 'Проверьте ключ, права и параметры.');
      // A server error can echo a key. Redact keys before showing any response text.
      let message = String(detail);
      [$('qdrant-key').value.trim(), $('neuraldeep-key').value.trim()].filter(Boolean).forEach(key => { message = message.split(key).join('[ключ скрыт]'); });
      throw new Error('HTTP ' + response.status + ': ' + message);
    }
    return data.result === undefined ? data : data.result;
  }
  const qdrant = (ctx, suffix, method = 'GET', body) => request(ctx.base, suffix.startsWith('/collections') ? suffix : ctx.path + suffix, method, body, {'api-key':ctx.key});
  async function collectionVector(ctx) {
    const info = await qdrant(ctx, '');
    const vectors = info.config?.params?.vectors;
    const name = $('vector-name').value.trim();
    const definition = name ? vectors?.[name] : vectors;
    if (!definition || !Number.isInteger(definition.size)) throw new Error('Не найден плотный вектор. Для именованного вектора заполните поле «Имя вектора».');
    if ((name && Object.keys(vectors).length !== 1) || Object.keys(info.config?.params?.sparse_vectors || {}).length) throw new Error('Эта страница работает с одним плотным вектором. Коллекции с несколькими векторами или sparse-векторами пока не поддерживаются.');
    return { name, size:definition.size };
  }
  async function embedTexts(texts, vector, isQuery = false) {
    const key = $('neuraldeep-key').value.trim(), model = $('model').value.trim();
    if (!key || !model) throw new Error('Укажите API key NeuralDeep и модель эмбеддингов.');
    const prefix = $(isQuery ? 'query-prefix' : 'document-prefix').value;
    const data = await request(urlValue('neuraldeep-url'), '/embeddings', 'POST', {model, input:texts.map(text => prefix + text)}, {Authorization:'Bearer ' + key});
    if (!Array.isArray(data.data) || data.data.length !== texts.length) throw new Error('NeuralDeep вернул неполный набор эмбеддингов.');
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    return ordered.map((item, index) => {
      if (texts.length > 1 && item.index !== index) throw new Error('NeuralDeep вернул некорректный порядок эмбеддингов.');
      const embedding = item.embedding;
      if (!Array.isArray(embedding) || !embedding.length || !embedding.every(Number.isFinite)) throw new Error('NeuralDeep вернул некорректный эмбеддинг.');
      if (embedding.length !== vector.size) throw new Error('Размерность эмбеддинга ' + embedding.length + ' не совпадает с размерностью коллекции ' + vector.size + '. Выберите совместимую модель.');
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
    } catch (error) { throw new Error(error.message + ' Фрагменты не записаны в Qdrant.'); }
    if (controller.signal.aborted) throw new Error('Время загрузки истекло. Фрагменты не записаны в Qdrant.');
    status('Сохранение в коллекцию «' + ctx.collection + '»: ' + total + ' фрагментов.');
    try { await qdrant(ctx, '/points?wait=true', 'PUT', {points}); }
    catch (error) { throw new Error(error.message + ' Проверьте коллекцию перед повторной загрузкой. ID импорта: ' + importId + '.'); }
    resetRecords(); $('files').value = ''; showFiles();
    status('Загружено файлов: ' + files.length + '. Фрагментов: ' + total + '. ID импорта: ' + importId + '. Обновите список документов.');
  }
  $('upload').addEventListener('click', () => run('Чтение файлов…', uploadFiles, cfg.fileUploadTimeoutMs));

  async function read(ctx, id) {
    const points = await qdrant(ctx, '/points', 'POST', {ids:[id], with_payload:true, with_vector:false});
    if (!Array.isArray(points)) throw new Error('Qdrant вернул неожиданный ответ при чтении документа.');
    return points[0];
  }
  function loadPoint(point) {
    $('id').value = point.id;
    const payload = point.payload || {};
    $('text').value = typeof payload[cfg.textField] === 'string' ? payload[cfg.textField] : '';
    const metadata = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== cfg.textField));
    $('metadata').value = JSON.stringify(metadata, null, 2);
  }
  function renderPoints(host, points, empty) {
    host.replaceChildren();
    if (!points.length) { host.append(node('p', empty)); return; }
    points.forEach(point => {
      const article = node('article'); article.className = 'rag-record';
      const head = node('div'); head.className = 'rag-section-head';
      const caption = node('span', 'ID ' + point.id + (typeof point.score === 'number' ? ' · score ' + point.score.toFixed(4) : ''));
      const load = node('button', 'В редактор'); load.type = 'button'; load.className = 'small';
      load.addEventListener('click', () => {
        if (busy) return;
        loadPoint(point); $('id').scrollIntoView({behavior:'smooth', block:'center'}); $('text').focus({preventScroll:true});
        status('Документ ' + point.id + ' загружен в редактор.');
      });
      head.append(caption, load);
      const payload = point.payload || {}, details = node('details');
      details.append(node('summary', 'Payload · JSON'), node('pre', JSON.stringify(payload, null, 2)));
      article.append(head, node('p', typeof payload[cfg.textField] === 'string' ? payload[cfg.textField] : 'Текстовое поле отсутствует. Полный payload доступен ниже.'), details);
      host.append(article);
    });
  }
  async function browse(ctx, offset) {
    const result = await qdrant(ctx, '/points/scroll', 'POST', {limit:cfg.pageSize, with_payload:true, with_vector:false, ...(offset === null ? {} : {offset})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный список документов.');
    renderPoints($('records'), result.points, 'Коллекция пуста. Создайте первый документ.');
    nextOffset = result.next_page_offset ?? null; $('next').hidden = nextOffset === null;
    return result.points.length;
  }
  async function run(message, action, timeoutMs = cfg.timeoutMs) {
    if (busy) return;
    busy = true; $('workbench').disabled = true; $('workbench').setAttribute('aria-busy', 'true');
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    status(message);
    try { await action(); } catch (error) { status(error.message || 'Не удалось выполнить операцию.', true); }
    finally { clearTimeout(timeout); busy = false; $('workbench').disabled = false; $('workbench').removeAttribute('aria-busy'); controller = null; }
  }
  const on = (id, message, action) => $(id).addEventListener('click', () => run(message, action));
  $('new').addEventListener('click', () => { clearEditor(); status('Новый документ. При создании пустой ID будет заменён UUID.'); $('text').focus(); });
  $('clear-keys').addEventListener('click', () => { $('qdrant-key').value = ''; $('neuraldeep-key').value = ''; status('Ключи удалены из памяти страницы.'); });
  on('connect', 'Получение коллекций…', async () => {
    const ctx = context(false), result = await qdrant(ctx, '/collections');
    if (!Array.isArray(result.collections)) throw new Error('Qdrant вернул неожиданный список коллекций.');
    $('collections').replaceChildren(...result.collections.map(item => { const option = node('option'); option.value = item.name; return option; }));
    status('Подключено. Коллекций: ' + result.collections.length + '. Выберите имя в поле «Имя коллекции».');
  });
  on('create-collection', 'Создание коллекции…', async () => {
    const ctx = context(), size = integer('dimensions', 'Размерность'), name = $('vector-name').value.trim();
    await qdrant(ctx, '', 'PUT', {vectors:name ? {[name]:{size, distance:'Cosine'}} : {size, distance:'Cosine'}});
    const option = node('option'); option.value = ctx.collection; $('collections').append(option);
    resetRecords(); status('Коллекция «' + ctx.collection + '» создана. Размерность: ' + size + '.');
  });
  on('read', 'Чтение документа…', async () => {
    const point = await read(context(), pointId());
    if (!point) throw new Error('Документ с этим ID не найден.');
    loadPoint(point); status('Документ ' + point.id + ' прочитан.');
  });
  async function write(update) {
    const ctx = context(), id = pointId(!update), text = $('text').value;
    if (!text.trim()) throw new Error('Введите текст документа.');
    let metadata;
    try { metadata = JSON.parse($('metadata').value); } catch (_) { throw new Error('Метаданные должны содержать корректный JSON-объект.'); }
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Метаданные должны быть JSON-объектом.');
    if (Object.hasOwn(metadata, cfg.textField)) throw new Error('Поле «' + cfg.textField + '» зарезервировано для текста документа.');
    const existing = await read(ctx, id);
    if (update && !existing) throw new Error('Документ не найден. Для нового ID нажмите «Создать документ».');
    if (!update && existing) throw new Error('ID уже существует. Прочитайте документ и используйте кнопку «Обновить по ID».');
    const vector = await collectionVector(ctx), embedding = await embed(text, vector);
    await qdrant(ctx, '/points?wait=true', 'PUT', {points:[{id, vector:vector.name ? {[vector.name]:embedding} : embedding, payload:{...metadata, [cfg.textField]:text}}]});
    resetRecords(); status('Документ ' + id + (update ? ' обновлён.' : ' создан.') + ' Обновите список документов.');
  }
  on('create', 'Векторизация и создание документа…', () => write(false));
  on('update', 'Векторизация и обновление документа…', () => write(true));
  on('delete', 'Проверка документа…', async () => {
    const ctx = context(), id = pointId();
    if (!await read(ctx, id)) throw new Error('Документ с этим ID не найден.');
    if (!confirm('Удалить документ ' + id + ' из коллекции «' + ctx.collection + '»? Действие нельзя отменить.')) { status('Удаление отменено.'); return; }
    await qdrant(ctx, '/points/delete?wait=true', 'POST', {points:[id]});
    clearEditor(); resetRecords(); status('Документ ' + id + ' удалён из коллекции «' + ctx.collection + '».');
  });
  on('browse', 'Загрузка документов…', async () => { const count = await browse(context(), null); status('Загружено документов: ' + count + '.'); });
  on('next', 'Загрузка следующей страницы…', async () => { const count = await browse(context(), nextOffset); status('Загружена следующая страница. Документов: ' + count + '.'); });
  on('search', 'Векторизация запроса и поиск…', async () => {
    const ctx = context(), query = $('query').value.trim(), limit = integer('top-k', 'Top K', 100);
    if (!query) throw new Error('Введите поисковый запрос.');
    const vector = await collectionVector(ctx), embedding = await embed(query, vector, true);
    const result = await qdrant(ctx, '/points/query', 'POST', {query:embedding, limit, with_payload:true, with_vector:false, ...(vector.name ? {using:vector.name} : {})});
    if (!Array.isArray(result.points)) throw new Error('Qdrant вернул неожиданный результат поиска.');
    renderPoints($('results'), result.points, 'По этому запросу документов не найдено.');
    status('Поиск завершён. Найдено: ' + result.points.length + '.');
  });
})();
