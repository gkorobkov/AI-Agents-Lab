// Shared presets and HTTP execution configuration. Credentials stay in this tab.
(() => {
  const storageKey = 'ai_tool_library_v1';
  const secretPrefix = 'ai_tool_secret:';
  const clone = value => JSON.parse(JSON.stringify(value));
  let presets = [];
  const errors = [];
  function list() {
    let saved = [];
    try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(value)) saved = value.filter(item => item?.id && item.tool && !presets.some(preset => preset.id === item.id)).slice(0, 100); } catch (_) {}
    return [...clone(presets), ...saved.map(item => ({ ...item, builtin:false }))];
  }
  const get = id => list().find(item => item.id === id);
  const newId = () => 'tool_' + crypto.randomUUID();
  function validate(tool, httpOnly = false) {
    if (!httpOnly && !/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name || '')) throw new Error('Function name: 1–64 letters, digits, _ or -.');
    if (!httpOnly && !tool.description?.trim()) throw new Error('Describe what the function does for the model.');
    const schema = JSON.parse(tool.parameters);
    if (!schema || schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) throw new Error('Parameters must be an object JSON Schema with properties.');
    const url = new URL(tool.http?.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without embedded credentials.');
    if (!['GET', 'POST'].includes(tool.http.method)) throw new Error('Choose GET or POST.');
    const keys = new Set();
    for (const mapping of tool.http.mappings || []) {
      if (!mapping.key || ['__proto__','prototype','constructor'].includes(mapping.key) || keys.has(mapping.key)) throw new Error('Invalid or duplicate parameter: ' + mapping.key);
      keys.add(mapping.key);
    }
    if (tool.http.method === 'POST' && tool.http.body?.trim()) JSON.parse(tool.http.body);
    const auth = tool.http.auth;
    if (auth && !['none','query','header'].includes(auth.placement)) throw new Error('Invalid authentication placement.');
    if (auth && auth.placement !== 'none' && (!auth.name?.trim() || !auth.secretId)) throw new Error('Set the API-key field name and credential slot.');
    return schema;
  }
  function save(record) {
    validate(record.tool);
    const item = clone(record);
    if (!item.id || item.builtin || presets.some(preset => preset.id === item.id)) item.id = newId();
    item.builtin = false; item.schemaVersion = 1;
    item.title = String(item.title || item.tool.name).slice(0, 120);
    const saved = list().filter(entry => !entry.builtin && entry.id !== item.id);
    if (saved.length >= 100) throw new Error('Library limit: 100 tools.');
    saved.push(item); localStorage.setItem(storageKey, JSON.stringify(saved));
    window.dispatchEvent(new Event('tool-library:change'));
    return clone(item);
  }
  function remove(id) {
    if (presets.some(preset => preset.id === id)) throw new Error('Built-in presets cannot be deleted.');
    localStorage.setItem(storageKey, JSON.stringify(list().filter(item => !item.builtin && item.id !== id)));
    window.dispatchEvent(new Event('tool-library:change'));
  }
  function snapshot(id) {
    const record = get(id); if (!record) throw new Error('Tool not found.');
    return { ...clone(record.tool), libraryId:record.id, libraryTitle:record.title };
  }
  function argumentAt(args, path) {
    let value = args;
    for (const part of path.trim().split('.')) {
      if (!part || ['__proto__','prototype','constructor'].includes(part) || value == null || !Object.prototype.hasOwnProperty.call(value, part)) throw new Error('Missing argument: ' + path);
      value = value[part];
    }
    return value;
  }
  function template(value, args, encode = false) {
    const source = String(value ?? '');
    const exact = source.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exact && !encode) return argumentAt(args, exact[1]);
    return source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
      const item = argumentAt(args, path), text = typeof item === 'object' ? JSON.stringify(item) : String(item);
      return encode ? encodeURIComponent(text) : text;
    });
  }
  function buildRequest(tool, args) {
    if (!tool?.http?.url) return null;
    const schema = validate(tool, true);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be a JSON object.');
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(args,key)) throw new Error('Missing argument: ' + key);
    for (const [key, spec] of Object.entries(schema.properties)) {
      if (!(key in args)) continue;
      const value = args[key], types = Array.isArray(spec.type) ? spec.type : [spec.type];
      const valid = type => !type || type === 'null' && value === null || type === 'array' && Array.isArray(value) || type === 'integer' && Number.isInteger(value) || type === 'object' && value && typeof value === 'object' && !Array.isArray(value) || !['null','array','integer','object'].includes(type) && typeof value === type;
      if (!types.some(valid)) throw new Error('Invalid argument type: ' + key);
      if (spec.enum && !spec.enum.includes(value)) throw new Error('Invalid argument value: ' + key);
      if (typeof value === 'number' && (value < (spec.minimum ?? -Infinity) || value > (spec.maximum ?? Infinity))) throw new Error('Argument out of range: ' + key);
    }
    const mapped = Object.create(null);
    for (const mapping of tool.http.mappings || []) mapped[mapping.key] = template(mapping.value, args);
    const context = { ...args, ...mapped };
    const url = new URL(template(tool.http.url, context, true));
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid HTTP URL.');
    const method = tool.http.method || 'GET';
    if (method === 'GET') {
      Object.entries(mapped).forEach(([key,value]) => { if (value !== '' || (tool.http.mappings || []).some(mapping => mapping.key === key && mapping.value.includes('{{'))) url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)); });
      return {url:url.href,method};
    }
    const substitute = value => typeof value === 'string' ? template(value,context) : Array.isArray(value) ? value.map(substitute) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,substitute(item)])) : value;
    return {url:url.href,method,headers:{'Content-Type':'application/json'},body:JSON.stringify(tool.http.body?.trim() ? substitute(JSON.parse(tool.http.body)) : mapped)};
  }
  function setSecret(id, value, origin) {
    if (!id) throw new Error('Missing credential slot.');
    if (!value) return clearSecret(id);
    sessionStorage.setItem(secretPrefix + id, JSON.stringify({value:String(value),origin:new URL(origin).origin}));
  }
  function secret(id) { try { return JSON.parse(sessionStorage.getItem(secretPrefix + id) || 'null'); } catch (_) { return null; } }
  const getSecret = id => secret(id)?.value || '';
  const clearSecret = id => sessionStorage.removeItem(secretPrefix + id);
  function authorizeRequest(request, http) {
    const auth = http.auth;
    if (!auth || auth.placement === 'none') return clone(request);
    const credential = secret(auth.secretId);
    if (!credential?.value) throw new Error('Enter the tool API key for this tab.');
    const url = new URL(request.url);
    if (url.origin !== credential.origin) throw new Error('The endpoint changed. Re-enter the key for this server.');
    const result = clone(request), value = (auth.prefix || '') + credential.value;
    if (auth.placement === 'query') { url.searchParams.set(auth.name,value); result.url = url.href; }
    else if (auth.placement === 'header') result.headers = {...result.headers,[auth.name]:value};
    else throw new Error('Invalid authentication placement.');
    return result;
  }
  function redact(value) {
    let text = typeof value === 'string' ? value : JSON.stringify(value,null,2);
    for (let i=0;i<sessionStorage.length;i++) {
      const key = sessionStorage.key(i); if (!key.startsWith(secretPrefix)) continue;
      const credential = secret(key.slice(secretPrefix.length))?.value;
      if (credential) for (const form of [credential,encodeURIComponent(credential)]) text = text.split(form).join('[REDACTED]');
    }
    return text;
  }
  function validateRecord(record) {
    if (record?.schemaVersion !== 1 || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id || '') || typeof record.title !== 'string' || !record.title.trim() || record.title.length > 120) throw new Error('Нужны schemaVersion: 1, уникальный id и название инструмента.');
    const schema = validate(record.tool);
    if (typeof record.tool.parameters !== 'string' || Object.values(schema.properties).some(spec => !spec || typeof spec !== 'object' || Array.isArray(spec))) throw new Error('parameters: свойства должны содержать объекты JSON Schema.');
    if (schema.required !== undefined && (!Array.isArray(schema.required) || !schema.required.every(key => typeof key === 'string' && Object.hasOwn(schema.properties, key)))) throw new Error('parameters.required: нужны имена существующих аргументов.');
    if (!Array.isArray(record.tool.http.mappings || []) || (record.tool.http.mappings || []).some(item => typeof item.key !== 'string' || typeof item.value !== 'string')) throw new Error('HTTP mappings: нужны строковые key и value.');
    return clone(record);
  }
  function importRecord(value) {
    const record = validateRecord(value);
    if (get(record.id)) throw new Error('Инструмент с таким id уже подключён. Используйте новый id для другого материала.');
    record.builtin = false;
    return save(record);
  }
  const ready = MaterialCatalog.load('tools-manifest.json', 'tools', validateRecord).then(result => {
    presets = result.records.map(record => ({...record, builtin:true})); errors.push(...result.errors);
    window.dispatchEvent(new Event('tool-library:change'));
  });
  window.ToolLibrary = {ready,errors,validateRecord,importRecord,list,get,newId,validate,save,remove,snapshot,buildRequest,authorizeRequest,setSecret,getSecret,clearSecret,redact};
})();
