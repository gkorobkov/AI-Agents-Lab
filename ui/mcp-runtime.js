// Shared by the browser workshop and the exported Node.js server.
function createMcpRuntime(authorizeHttp = request => request) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };
  function schemaCheck(schema, depth = 0) {
    if (!object(schema) || depth > 8) fail('Некорректная или слишком вложенная схема.');
    const allowed = ['$schema','type','properties','required','additionalProperties','items','description','title','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','default'];
    for (const key of Object.keys(schema)) if (!allowed.includes(key)) fail('Конструктор пока не поддерживает JSON Schema: ' + key);
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.length || !types.every(type => ['object','array','string','number','integer','boolean','null'].includes(type))) fail('Укажите поддерживаемый type в схеме.');
    if (schema.properties !== undefined) {
      if (!object(schema.properties)) fail('properties должен быть объектом.');
      Object.values(schema.properties).forEach(item => schemaCheck(item, depth + 1));
    }
    if (schema.required !== undefined && (!Array.isArray(schema.required) || !schema.required.every(key => typeof key === 'string' && Object.hasOwn(schema.properties || {}, key)))) fail('required должен перечислять существующие свойства.');
    if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') fail('additionalProperties: используйте true или false.');
    if (schema.items !== undefined) schemaCheck(schema.items, depth + 1);
    if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length)) fail('enum должен быть непустым массивом.');
    for (const key of ['minimum','maximum','minLength','maxLength','minItems','maxItems']) if (schema[key] !== undefined && (!Number.isFinite(schema[key]) || (key !== 'minimum' && key !== 'maximum' && (!Number.isInteger(schema[key]) || schema[key] < 0)))) fail('Некорректное ограничение: ' + key);
  }
  function validate(schema, value, path = 'arguments') {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = type => type === 'null' ? value === null : type === 'array' ? Array.isArray(value) : type === 'object' ? object(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === type;
    if (!types.some(matches)) fail(path + ': неверный тип.');
    if (schema.enum && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) fail(path + ': значение отсутствует в enum.');
    if (object(value)) {
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(path + ': отсутствует ' + key);
      for (const [key, item] of Object.entries(value)) {
        if (Object.hasOwn(schema.properties || {}, key)) validate(schema.properties[key], item, path + '.' + key);
        else if (schema.additionalProperties === false) fail(path + ': лишнее поле ' + key);
      }
    }
    if (Array.isArray(value)) {
      if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail(path + ': неверная длина массива.');
      if (schema.items) value.forEach((item, index) => validate(schema.items, item, path + '[' + index + ']'));
    }
    if (typeof value === 'string' && ([...value].length < (schema.minLength ?? 0) || [...value].length > (schema.maxLength ?? Infinity))) fail(path + ': неверная длина строки.');
    if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail(path + ': число вне диапазона.');
  }
  function at(args, path) {
    let value = args;
    for (const key of path.trim().split('.')) {
      if (['__proto__','prototype','constructor'].includes(key) || value == null || !Object.hasOwn(value, key)) fail('Нет аргумента: ' + path);
      value = value[key];
    }
    return value;
  }
  function replace(value, args, encode = false) {
    const source = String(value);
    const exact = source.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exact && !encode) return at(args, exact[1]);
    return source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
      const item = at(args, path); const text = typeof item === 'object' ? JSON.stringify(item) : String(item);
      return encode ? encodeURIComponent(text) : text;
    });
  }
  function substitute(value, args) {
    if (typeof value === 'string') return replace(value, args);
    if (Array.isArray(value)) return value.map(item => substitute(item, args));
    if (object(value)) return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,substitute(item,args)]));
    return value;
  }
  function buildRequest(http, args) {
    const mapped = Object.create(null);
    for (const mapping of http.mappings || []) {
      if (!mapping.key || ['__proto__','prototype','constructor'].includes(mapping.key) || Object.hasOwn(mapped, mapping.key)) fail('Неверное имя HTTP-параметра.');
      mapped[mapping.key] = replace(mapping.value, args);
    }
    const values = { ...args, ...mapped }; const url = new URL(replace(http.url, values, true));
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) fail('Нужен HTTP(S) URL без встроенного пароля.');
    if (http.method === 'GET') {
      Object.entries(mapped).forEach(([key,value]) => url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)));
      return { url: url.href, method:'GET', headers:{} };
    }
    if (http.method !== 'POST') fail('Поддерживаются GET и POST.');
    return { url:url.href, method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(http.body?.trim() ? substitute(JSON.parse(http.body),values) : mapped) };
  }
  async function invoke(tool, args, signal) {
    try {
      validate(tool.inputSchema, args);
      let value;
      if (tool.execution.type === 'template') value = substitute(JSON.parse(tool.execution.template), args);
      else if (tool.execution.type === 'http') {
        const request = await authorizeHttp(buildRequest(tool.execution.http, args), tool.execution.http, tool);
        const response = await fetch(request.url, { method:request.method, headers:request.headers, body:request.body, signal, credentials:'omit', redirect:'error' });
        const body = await response.text(); if (body.length > 2000000) fail('Ответ инструмента слишком большой.');
        if (!response.ok) fail('HTTP ' + response.status);
        try { value = JSON.parse(body); } catch (_) { value = body; }
      } else fail('Неизвестный обработчик инструмента.');
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return { content:[{type:'text',text}], ...(object(value) ? { structuredContent:value } : {}) };
    } catch (error) {
      if (signal?.aborted) throw error;
      return { isError:true, content:[{type:'text',text:error.message}] };
    }
  }
  return { schemaCheck, validate, invoke, buildRequest };
}
