(() => {
  'use strict';
  const CFG_MCP_STORAGE = 'ai_mcp_library_v1';
  const CFG_MCP_SECRET = 'ai_mcp_secret:';
  const clone = value => JSON.parse(JSON.stringify(value));
  const builtin = { schemaVersion:1, id:'mcp_student_example', builtin:true, title:'Учебный помощник', name:'student-helper', description:'Первый MCP: инструмент приветствует студента. Измените аргументы и ответ, затем добавьте свои инструменты.', mode:'workshop', url:'', tools:[{ name:'greet_student', description:'Поприветствовать студента по имени и подсказать первый шаг в лаборатории.', inputSchema:{type:'object',properties:{name:{type:'string',description:'Имя студента',minLength:1}},required:['name'],additionalProperties:false}, execution:{type:'template',template:JSON.stringify({message:'Привет, {{name}}!',next_step:'Откройте Лабы и начните первый эксперимент.'},null,2)} }] };
  const runtime = createMcpRuntime((request,http) => window.ToolLibrary.authorizeRequest(request,http));
  const newId = () => 'mcp_' + crypto.randomUUID();
  function endpoint(value) {
    const url = new URL(value);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Укажите HTTP(S) адрес MCP без пароля и фрагмента.');
    return url.href;
  }
  function validate(record) {
    if (!record || record.schemaVersion !== 1 || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id || '') || typeof record.title !== 'string' || !record.title.trim() || record.title.length > 120 || !/^[a-zA-Z0-9_-]{1,64}$/.test(record.name || '') || typeof record.description !== 'string' || record.description.length > 5000) throw new Error('Укажите название, имя сервера и описание.');
    if (!['workshop','remote'].includes(record.mode)) throw new Error('Неизвестный режим MCP.');
    if (record.mode === 'remote') { endpoint(record.url); return record; }
    if (!Array.isArray(record.tools) || !record.tools.length || record.tools.length > 30) throw new Error('Добавьте от 1 до 30 инструментов.');
    const names = new Set();
    record.tools.forEach(tool => {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name || '') || names.has(tool.name)) throw new Error('Имена инструментов должны быть уникальными: 1–64 буквы, цифры, _ или -.');
      names.add(tool.name);
      if (typeof tool.description !== 'string' || !tool.description.trim() || tool.description.length > 5000 || tool.inputSchema?.type !== 'object') throw new Error('Нужны описание и схема аргументов-объекта.');
      runtime.schemaCheck(tool.inputSchema);
      if (tool.execution?.type === 'template') {
        if (typeof tool.execution.template !== 'string' || tool.execution.template.length > 100000) throw new Error('Слишком большой шаблон ответа.');
        JSON.parse(tool.execution.template);
      } else if (tool.execution?.type === 'http') {
        window.ToolLibrary.validate({name:tool.name,description:tool.description,parameters:JSON.stringify(tool.inputSchema),http:tool.execution.http});
      } else throw new Error('Выберите шаблон ответа или HTTP-инструмент.');
    });
    return record;
  }
  function list() {
    const raw = JSON.parse(localStorage.getItem(CFG_MCP_STORAGE) || '[]');
    if (!Array.isArray(raw)) throw new Error('Не удалось прочитать библиотеку MCP.');
    return [clone(builtin), ...raw.filter(item => item.id !== builtin.id).map(item => ({...item,builtin:false}))];
  }
  function clean(record) {
    const value = clone(record);
    return { schemaVersion:1, id:value.id, builtin:false, title:value.title, name:value.name, description:value.description, mode:value.mode, url:value.mode === 'remote' ? endpoint(value.url) : '', tools:value.mode === 'workshop' ? value.tools : [] };
  }
  function save(record) {
    validate(record); const value = clean(record);
    if (record.builtin || record.id === builtin.id) value.id = newId();
    const saved = list().filter(item => !item.builtin && item.id !== value.id);
    if (saved.length >= 100) throw new Error('В библиотеке уже 100 MCP.');
    saved.push(value); localStorage.setItem(CFG_MCP_STORAGE,JSON.stringify(saved)); window.dispatchEvent(new Event('mcp-library:change')); return clone(value);
  }
  function remove(id) {
    if (id === builtin.id) throw new Error('Учебный пример удалить нельзя.');
    localStorage.setItem(CFG_MCP_STORAGE,JSON.stringify(list().filter(item => !item.builtin && item.id !== id))); clearToken(id);
  }
  function setToken(record, token) {
    if (!token) return clearToken(record.id);
    sessionStorage.setItem(CFG_MCP_SECRET + record.id,JSON.stringify({origin:new URL(endpoint(record.url)).origin,token}));
  }
  function clearToken(id) { sessionStorage.removeItem(CFG_MCP_SECRET + id); }
  function getToken(record) {
    const value = JSON.parse(sessionStorage.getItem(CFG_MCP_SECRET + record.id) || 'null');
    if (value && value.origin !== new URL(endpoint(record.url)).origin) throw new Error('Адрес сервера изменился. Введите токен для нового сервера.');
    return value?.token || '';
  }
  function redact(value) {
    let text = typeof value === 'string' ? value : JSON.stringify(value,null,2);
    for (let i=0;i<sessionStorage.length;i++) {
      const key = sessionStorage.key(i); if (!key.startsWith(CFG_MCP_SECRET)) continue;
      try { const token=JSON.parse(sessionStorage.getItem(key)).token; if(token) text=text.split(token).join('[REDACTED]'); } catch (_) {}
    }
    return window.ToolLibrary.redact(text);
  }
  window.McpLibrary = { builtin:()=>clone(builtin), list, save, remove, validate, clean, newId, endpoint, setToken, clearToken, getToken, redact, runtime };
})();
