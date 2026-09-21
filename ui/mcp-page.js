(() => {
  'use strict';
  const lib = McpLibrary, $ = id => document.getElementById(id), clone = value => JSON.parse(JSON.stringify(value));
  const el = (tag,text) => { const item=document.createElement(tag); if(text!==undefined)item.textContent=text; return item; };
  let draft, original = '', client = null, controller = null, trace = [];
  const status = (text,error=false) => { $('mcp-status').textContent=text; $('mcp-status').classList.toggle('error',error); };
  function download(name,text,type='application/json') {
    const url=URL.createObjectURL(new Blob([text],{type})), a=el('a'); a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function input(label,value,tag='input',className='') {
    const host=el('label',label), control=el(tag);control.value=value;control.className=className;host.append(control);return {host,control};
  }
  function action(text,fn) { const button=el('button',text);button.type='button';button.onclick=fn;return button; }
  function invalidate() {
    if(client)client.close().catch(()=>{});client=null;
    $('call-mcp').disabled=true;$('mcp-test-tool').disabled=true;
    $('connection-status').textContent='Настройки изменены. Проверьте MCP заново.';
  }
  function read() {
    const record={...clone(draft),title:$('mcp-edit-title').value.trim(),name:$('mcp-edit-name').value.trim(),description:$('mcp-description').value.trim(),url:$('mcp-url').value.trim()};
    record.tools=[...$('mcp-tools').children].map(row=>{
      if(row.schemaError)throw new Error(row.schemaError);
      return {name:row.querySelector('[data-name]').value.trim(),description:row.querySelector('[data-description]').value.trim(),inputSchema:JSON.parse(row.querySelector('[data-schema]').value),execution:row.execution.type==='template'?{type:'template',template:row.querySelector('[data-template]').value}:clone(row.execution)};
    });return record;
  }
  function dirty() {
    let changed=true;try{changed=JSON.stringify(read())!==original;}catch(_){}
    $('mcp-dirty').textContent=changed?'Есть несохранённые изменения':'Сохранено';$('mcp-dirty').classList.toggle('dirty',changed);
  }
  function renderPicker() {
    $('mcp-list').replaceChildren();
    lib.list().forEach(record=>{
      const button=action(record.title,()=>select(record));button.dataset.id=record.id;
      button.setAttribute('aria-current',String(record.id===draft.id));button.append(el('small',record.mode==='workshop'?'Конструктор · '+record.tools.length+' инструмент(а)':'Streamable HTTP'));$('mcp-list').append(button);
    });
    const previous=$('mcp-tool-source').value;$('mcp-tool-source').replaceChildren();
    ToolLibrary.list().forEach(record=>{const option=el('option',record.title);option.value=record.id;$('mcp-tool-source').append(option);});
    if(ToolLibrary.get(previous))$('mcp-tool-source').value=previous;
  }
  function toolEditor(tool) {
    const row=el('details');row.className='mcp-tool';row.open=true;row.execution=clone(tool.execution);
    const summary=el('summary',tool.name);row.append(summary);
    const name=input('Имя инструмента',tool.name);name.control.dataset.name='';name.control.required=true;name.control.pattern='[a-zA-Z0-9_-]{1,64}';
    const description=input('Что делает инструмент',tool.description,'textarea');description.control.dataset.description='';description.control.required=true;description.control.rows=2;
    row.append(name.host,description.host);
    const args=el('div');args.className='mcp-arguments';row.append(el('strong','Аргументы'),args);
    const advanced=el('details');advanced.append(el('summary','JSON Schema · расширенное редактирование'));
    const schema=input('Схема аргументов',JSON.stringify(tool.inputSchema,null,2),'textarea','code');schema.control.dataset.schema='';schema.control.rows=8;advanced.append(schema.host);
    function syncSchema() {
      try {
        const properties={}, required=[];
        for(const arg of args.children) {
          const key=arg.querySelector('[data-arg-name]').value.trim();
          if(!/^[a-zA-Z0-9_-]+$/.test(key)||['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(properties,key))throw new Error('Имена аргументов должны быть заполнены и уникальны.');
          const rawType=arg.querySelector('select').value;const type=rawType.startsWith('[')?JSON.parse(rawType):rawType;
          properties[key]={...arg.spec,type};
          if(type==='array'&&!properties[key].items)properties[key].items={type:'string'};
          if(type==='object'&&!properties[key].properties)properties[key].properties={};
          if(arg.querySelector('[type="checkbox"]').checked)required.push(key);
        }
        const previous=JSON.parse(schema.control.value);schema.control.value=JSON.stringify({...previous,type:'object',properties,required},null,2);row.schemaError='';
      }catch(error){row.schemaError=error.message;}invalidate();dirty();
    }
    function argument(key,spec,required) {
      const arg=el('div');arg.className='mcp-argument';arg.spec=clone(spec);
      const keyInput=el('input');keyInput.dataset.argName='';keyInput.value=key;keyInput.setAttribute('aria-label','Имя аргумента');
      const type=el('select');type.setAttribute('aria-label','Тип аргумента');
      const types=['string','number','integer','boolean','object','array'];
      // Nullable and custom schemas remain editable in the JSON editor.
      if(Array.isArray(spec.type))types.push(JSON.stringify(spec.type));
      types.forEach(value=>{const option=el('option',value);option.value=value;type.append(option);});type.value=Array.isArray(spec.type)?JSON.stringify(spec.type):spec.type;
      const check=el('label');check.className='check';const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=required;check.append(checkbox,el('span','Обязат.'));
      arg.append(keyInput,type,check,action('×',()=>{arg.remove();syncSchema();}));arg.lastChild.setAttribute('aria-label','Удалить аргумент');
      arg.addEventListener('change',syncSchema);args.append(arg);
    }
    function renderArguments() {
      try {const value=JSON.parse(schema.control.value);args.replaceChildren();Object.entries(value.properties||{}).forEach(([key,spec])=>argument(key,spec,(value.required||[]).includes(key)));row.schemaError='';}catch(error){row.schemaError='Неверный JSON Schema: '+error.message;}
    }
    renderArguments();
    row.append(action('+ Аргумент',()=>{argument('argument'+(args.children.length+1),{type:'string'},true);syncSchema();}),advanced);
    schema.control.addEventListener('change',renderArguments);
    if(tool.execution.type==='template') {
      const template=input('Ответ инструмента · шаблон JSON',tool.execution.template,'textarea','code');template.control.dataset.template='';template.control.rows=5;row.append(template.host);
    } else {
      row.append(el('p','HTTP: '+tool.execution.http.method+' '+tool.execution.http.url));
      if(tool.execution.http.auth?.placement!=='none' && tool.execution.http.auth?.placement) {
        const key=input('Ключ HTTP-инструмента · только в этой вкладке','');key.control.type='password';key.control.autocomplete='off';key.host.classList.add('ym-hide-content');
        key.control.addEventListener('change',()=>{try{ToolLibrary.setSecret(row.execution.http.auth.secretId,key.control.value,new URL(row.execution.http.url).origin);key.control.value='';key.control.placeholder='Ключ задан';}catch(error){status(error.message,true);}});row.append(key.host);
      }
      row.append(el('p','Копия HTTP-настроек из библиотеки Tools. Для изменения запроса отредактируйте инструмент в Tools и добавьте его заново.'));
    }
    row.append(action('Удалить инструмент',()=>{row.remove();invalidate();dirty();}));
    name.control.addEventListener('input',()=>{summary.textContent=name.control.value||'Инструмент';});$('mcp-tools').append(row);
  }
  function select(record,force=false) {
    if(!force&&$('mcp-dirty').classList.contains('dirty')&&!confirm('Перейти к другому MCP и отменить несохранённые изменения?'))return;
    invalidate();draft=clone(record);$('mcp-tools').replaceChildren();
    $('mcp-title').textContent=draft.title;$('mcp-kind').textContent=draft.builtin?'УЧЕБНЫЙ ПРИМЕР':draft.mode==='remote'?'ПОДКЛЮЧЕНИЕ':'СВОЙ MCP';
    $('mcp-edit-title').value=draft.title;$('mcp-edit-name').value=draft.name;$('mcp-description').value=draft.description;$('mcp-url').value=draft.url||'';$('mcp-token').value='';
    $('remote-fields').hidden=draft.mode!=='remote';$('mcp-url').required=draft.mode==='remote';
    $('builder-section').hidden=draft.mode!=='workshop';$('server-export').hidden=draft.mode!=='workshop';
    $('mcp-mode-note').textContent=draft.mode==='workshop'?'Учебный стенд в браузере: обмен MCP и обработчики выполняются локально. Это не опубликованный сервер. Шаблон возвращает ваш текст; HTTP-инструменты делают реальные запросы.':'Настоящий MCP-сервер: браузер отправляет initialize, tools/list и tools/call по указанному адресу.';
    (draft.tools||[]).forEach(toolEditor);$('delete-mcp').hidden=draft.builtin;$('save-mcp').textContent=draft.builtin?'Сохранить копию':'Сохранить MCP';
    $('mcp-trace').textContent='—';$('mcp-result').textContent='—';$('mcp-test-tool').replaceChildren();trace=[];
    original=JSON.stringify(read());dirty();renderPicker();status('');
  }
  function save() {
    if(!$('mcp-form').reportValidity())return null;
    const record=read();lib.validate(record);const saved=lib.save(record);
    if(record.mode==='remote'&&$('mcp-token').value)lib.setToken(saved,$('mcp-token').value);
    select(saved,true);status('MCP сохранён в этом браузере.');return saved;
  }
  function busy(value) {
    $('mcp-editor').disabled=value;
    ['create-mcp','create-remote','save-mcp','delete-mcp','import-mcp','export-mcp','download-server','mcp-add-agent','connect-mcp'].forEach(id=>$(id).disabled=value);
    $('mcp-list').querySelectorAll('button').forEach(button=>button.disabled=value);
    $('stop-mcp').hidden=!value;$('call-mcp').disabled=value||!client?.tools?.length;
  }
  async function connect() {
    const record=read();lib.validate(record);
    if(record.mode==='remote'&&$('mcp-token').value){lib.setToken(record,$('mcp-token').value);$('mcp-token').value='';$('mcp-token').placeholder='Токен задан';}
    if(client)await client.close();trace=[];
    client=new McpClient(record,(direction,message)=>{trace.push({direction,message});if(trace.length>40)trace.shift();$('mcp-trace').textContent=lib.redact(trace);});
    const result=await client.connect(controller.signal);
    $('mcp-test-tool').replaceChildren();result.tools.forEach(tool=>{const option=el('option',tool.name);option.value=tool.name;$('mcp-test-tool').append(option);});
    $('mcp-test-tool').disabled=!result.tools.length;
    $('connection-status').textContent=(record.mode==='workshop'?'Учебный стенд готов':'Подключено')+' · '+(result.serverInfo?.name||record.name)+' · инструментов: '+result.tools.length;
    testArgs();return result;
  }
  function testArgs() {
    const schema=client?.tools?.find(tool=>tool.name===$('mcp-test-tool').value)?.inputSchema;if(!schema)return;
    const sample=spec=>spec.default??spec.enum?.[0]??(spec.type==='number'||spec.type==='integer'?Math.max(0,spec.minimum??0):spec.type==='boolean'?false:spec.type==='array'?[]:spec.type==='object'?{}:'Студент');
    $('mcp-test-args').value=JSON.stringify(Object.fromEntries(Object.entries(schema.properties||{}).map(([key,spec])=>[key,sample(spec)])),null,2);
  }
  async function operation(fn) {
    if(controller)return;controller=new AbortController();busy(true);
    try{await fn();}catch(error){status(lib.redact(error.name==='AbortError'?'Вызов остановлен или превышено время ожидания.':error.message),true);if(client&&!client.initialized){await client.close().catch(()=>{});client=null;}}
    finally{controller=null;busy(false);}
  }
  $('mcp-editor').addEventListener('input',()=>{invalidate();dirty();});$('mcp-editor').addEventListener('change',dirty);
  $('mcp-form').onsubmit=event=>{event.preventDefault();try{save();}catch(error){status(lib.redact(error.message),true);}};
  $('create-mcp').onclick=()=>select({...lib.builtin(),id:lib.newId(),builtin:false,title:'Мой MCP',name:'my-mcp',description:'Мой учебный MCP-сервер.'});
  $('create-remote').onclick=()=>select({schemaVersion:1,id:lib.newId(),builtin:false,title:'Мой сервер',name:'remote-server',description:'',mode:'remote',url:'http://127.0.0.1:3100/mcp',tools:[]});
  $('add-mcp-tool').onclick=()=>{toolEditor({name:'my_tool_'+($('mcp-tools').children.length+1),description:'Опишите, когда агенту нужен этот инструмент.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},execution:{type:'template',template:'{"message":"Привет, {{name}}!"}'}});invalidate();dirty();};
  $('add-http-tool').onclick=()=>{try{const tool=ToolLibrary.snapshot($('mcp-tool-source').value);const schema=JSON.parse(tool.parameters);lib.runtime.schemaCheck(schema);toolEditor({name:tool.name,description:tool.description,inputSchema:schema,execution:{type:'http',http:tool.http}});invalidate();dirty();}catch(error){status(error.message,true);}};
  $('clear-mcp-token').onclick=()=>{lib.clearToken(draft.id);$('mcp-token').value='';$('mcp-token').placeholder='';invalidate();status('Токен удалён из сессии.');};
  $('delete-mcp').onclick=()=>{if(confirm('Удалить этот MCP из библиотеки?'))try{lib.remove(draft.id);select(lib.builtin(),true);}catch(error){status(error.message,true);}};
  $('connect-mcp').onclick=()=>operation(async()=>{if(!$('mcp-form').reportValidity())return;await connect();status('Получен список инструментов. Теперь выполните вызов.');});
  $('mcp-test-tool').onchange=testArgs;
  $('call-mcp').onclick=()=>operation(async()=>{if(!client)throw new Error('Сначала проверьте MCP.');const result=await client.call($('mcp-test-tool').value,JSON.parse($('mcp-test-args').value),controller.signal);$('mcp-result').textContent=lib.redact(result);status(result.isError?'Инструмент вернул ошибку. Проверьте аргументы и обработчик.':'Вызов выполнен.',Boolean(result.isError));});
  $('stop-mcp').onclick=()=>controller?.abort();
  $('mcp-add-agent').onclick=async()=>{try{if(typeof parent.addMcpTools!=='function')throw new Error('Откройте библиотеку внутри AI Agents Lab для подключения к агенту.');const saved=save();if(!saved)return;await operation(async()=>{const result=await connect();const added=parent.addMcpTools(saved,result.tools);status(added?'Инструменты MCP подключены. Настройки агента открыты.':'Не удалось подключить инструменты.',!added);});}catch(error){status(lib.redact(error.message),true);}};
  $('export-mcp').onclick=()=>{try{const record=read();lib.validate(record);download(record.name+'.json',JSON.stringify(lib.clean(record),null,2));status('Определение MCP скачано. Токен в файл не включён.');}catch(error){status(error.message,true);}};
  $('download-server').onclick=()=>operation(async()=>{const record=read();lib.validate(record);download('server.mjs',await McpExport.server(record),'text/javascript');status('Сервер скачан. Команды запуска — ниже.');});
  $('import-mcp').onclick=()=>$('mcp-file').click();
  $('mcp-file').onchange=async()=>{try{const file=$('mcp-file').files[0];if(!file)return;if(file.size>2000000)throw new Error('Максимальный размер JSON — 2 МБ.');const record=JSON.parse(await file.text());record.id=lib.newId();record.builtin=false;lib.validate(record);select(record);}catch(error){status(error.message,true);}finally{$('mcp-file').value='';}};
  window.addEventListener('storage',event=>{if(['ai_tool_library_v1','ai_mcp_library_v1'].includes(event.key))try{renderPicker();}catch(error){status(error.message,true);}});
  try{select(lib.builtin(),true);}catch(error){status(error.message,true);}
})();
