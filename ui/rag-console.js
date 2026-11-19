// Cluster workspace. Embeddings are optional until a text vector operation is run.
(() => {
  if (!window.RagWorkbench) return;
  const api = RagWorkbench, $ = id => document.getElementById('rag-' + id);
  const el = (tag,text,cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  const trash='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  const button=(text,fn,remove=false)=>{const n=el('button',undefined,remove?'small danger':'small');n.type='button';if(remove)n.innerHTML=trash;n.append(document.createTextNode(text));n.onclick=fn;return n;};
  const field=(title,id,value='',tag='input')=>{const l=el('label',title),n=el(tag);n.id='rag-'+id;n.value=value;l.append(n);return l;};
  const json=(value)=>{const d=el('details');d.append(el('summary','JSON'),el('pre',JSON.stringify(value,null,2)));return d;};
  const object=id=>{const v=JSON.parse($(id).value);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Нужен JSON-объект.');return v;};
  let cancelled = false;
  const confirmAction=message=>{const accepted=window.confirm(message);if(!accepted)cancelled=true;return accepted;};
  const typed=name=>{const accepted=prompt('Введите «'+name+'» для подтверждения. Действие изменяет данные коллекции.')===name;if(!accepted)cancelled=true;return accepted;};
  let epoch=0,collections=[],details=new Map(),connected=false,current='',tab='points',view='collections';
  let restored={};try{restored=JSON.parse(sessionStorage.getItem('ai_rag_workspace')||'{}');}catch(_){}
  const remember=()=>{if(!connected)return;try{sessionStorage.setItem('ai_rag_workspace',JSON.stringify({current,tab,view}));}catch(_){}};
  const main=document.querySelector('.rag-layout'),old=document.querySelector('.rag-columns'),aside=old.querySelector('aside'),workspace=old.querySelector('.rag-workspace');
  document.querySelector('.rag-intro').remove();document.querySelector('.rag-badge').textContent='QDRANT / REST';
  document.querySelector('.rag-heading h1').innerHTML='RAG <span>/ управление базами знаний</span>';
  const bar=el('div',undefined,'rag-console-bar');
  const connection=el('button',undefined,'rag-connection-state api-help');
  connection.type='button';
  connection.dataset.helpPath='Qdrant · Подключение';
  FieldHelp.attach(connection);
  function setConnection(state, message) {
    connection.dataset.state=state;
    connection.dataset.helpText=message;
    connection.setAttribute('aria-label', 'Qdrant. '+message);
    if(connection.hasAttribute('aria-describedby')) FieldHelp.show(connection);
  }
  setConnection('offline','Нет подключения. Откройте настройки RAG и проверьте подключение к кластеру.');
  const settingsToggle=button('',()=>setSettings(settings.hidden));
  settingsToggle.id='rag-settings-toggle';
  settingsToggle.title='Настройки RAG';
  settingsToggle.setAttribute('aria-label','Настройки RAG');
  settingsToggle.setAttribute('aria-controls','rag-settings');
  settingsToggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2h5l.5 3 2 1.2 2.8-1 2.5 4.3L20 11.4v2.2l2.3 1.9-2.5 4.3-2.8-1-2 1.2-.5 3h-5L9 20l-2-1.2-2.8 1-2.5-4.3L4 13.6v-2.2L1.7 9.5l2.5-4.3 2.8 1L9 5Z" transform="translate(0 -.5)"/><circle cx="12" cy="12" r="3.5"/></svg>';
  function setSettings(open){settings.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));try{sessionStorage.setItem('ai_rag_settings_open',String(open));}catch(_){}}
  $('status').before(bar);
  const settings=el('section',undefined,'rag-settings-panel');
  settings.id='rag-settings';
  settings.setAttribute('aria-label','Настройки RAG');
  bar.after(settings);
  const provider=$('provider').closest('label');
  provider.classList.add('rag-provider-control');
  bar.append(provider,connection,settingsToggle,$('qdrant-cloud'));
  const connections=el('div',undefined,'rag-connections');
  const qfields=el('section',undefined,'rag-settings-fields');
  const efields=el('section',undefined,'rag-settings-fields');
  const qdrantRow=el('div',undefined,'settings-field-grid rag-endpoint-row');
  const embeddingRow=el('div',undefined,'settings-field-grid rag-endpoint-row');
  const qdrantHeader=el('div',undefined,'rag-connection-header');
  qdrantHeader.append(el('h3','Кластер Qdrant'));
  qfields.append(qdrantHeader,qdrantRow);
  const providerSelect=$('embedding-provider');
  const providerSettings=button('',()=>parent.appWorkspace?.openSettings('openai', {profile:providerSelect.value, sourceWindow:window}));
  providerSettings.className='rag-provider-settings';
  providerSettings.title='Открыть настройки OpenAI API';
  providerSettings.setAttribute('aria-label',providerSettings.title);
  providerSettings.innerHTML=settingsToggle.innerHTML;
  const providerControl=el('div',undefined,'rag-embedding-provider-control');
  providerControl.append(providerSelect.closest('label'),providerSettings);
  const embeddingHeader=el('div',undefined,'rag-connection-header');
  embeddingHeader.append(el('h3','Векторизация · OpenAI API'),providerControl);
  const embeddingModels=el('div',undefined,'rag-embedding-models');
  embeddingModels.append($('model').closest('label'),$('embedding-status'));
  efields.append(embeddingHeader,embeddingRow,embeddingModels);
  for (const [row, url, key] of [
    [qdrantRow, 'qdrant-url', 'qdrant-key'],
    [embeddingRow, 'neuraldeep-url', 'neuraldeep-key']
  ]) {
    const urlField = $(url).closest('.proxy-field');
    urlField.classList.add('rag-url-setting');
    row.append(urlField, $(key).closest('label'));
  }
  const checkConnection = $('connect');
  checkConnection.textContent='Проверить подключение';
  qfields.append(checkConnection);
  connections.append(qfields,efields);
  settings.append(connections,el('p','Ключ выбранного провайдера берётся из настроек OpenAI API. Ключи Qdrant и Custom сохраняются в сессии вкладки с привязкой к серверу.','hint'));
  const vectorization=$('vectorization');
  const tabs=el('nav',undefined,'rag-console-tabs');tabs.setAttribute('aria-label','Разделы кластера');$('workbench').before(tabs);
  const inventory=el('section'),aliases=el('section'),collection=el('section');inventory.id='rag-inventory';aliases.id='rag-aliases-panel';collection.id='rag-collection-panel';$('workbench').append(inventory,aliases,collection);
  const toolbar=el('div',undefined,'rag-section-head'),count=el('h2','Коллекции'),filter=el('input');filter.placeholder='Найти коллекцию';filter.setAttribute('aria-label','Поиск коллекции');filter.oninput=renderInventory;
  toolbar.append(count,button('+ Коллекция',()=>createForm.hidden=!createForm.hidden));inventory.append(toolbar,filter);
  const createForm=el('div',undefined,'rag-create-form');createForm.hidden=true;
  createForm.append(el('h3','Новая коллекция'),field('Имя коллекции','new-collection'));
  const distance=field('Метрика','distance','','select');['Cosine','Dot','Euclid','Manhattan'].forEach(v=>distance.lastChild.append(new Option(v,v)));createForm.append($('dimensions').closest('label'),distance,field('Имя вектора · необязательно','new-vector-name'));
  createForm.append(el('p','Задайте размерность и метрику для новой коллекции. Размерность существующего вектора изменить нельзя.','hint'),button('Создать',()=>{const name=$('new-collection').value.trim();if(!name)return api.status('Введите имя коллекции.',true);$('collection').value=name;$('vector-name').value=$('new-vector-name').value.trim();$('create-collection').click();}));inventory.append(createForm);$('distance').value=parent.ragDefaults.distance;
  const tableHost=el('div',undefined,'rag-table-scroll');tableHost.tabIndex=0;tableHost.setAttribute('aria-label','Список коллекций');inventory.append(tableHost);
  const empty=el('div',undefined,'rag-empty');empty.append(el('h3','Подключите базу знаний'),el('p','Укажите REST URL и API key Qdrant в настройках. Здесь появятся коллекции и доступные операции.'),button('Открыть настройки',()=>setSettings(true)));inventory.append(empty);
  const crumb=el('div',undefined,'rag-section-head rag-collection-head'),title=el('h2'),stats=el('div',undefined,'rag-stat-strip');crumb.append(button('← Коллекции',()=>setView('collections')),title);collection.append(crumb,stats);
  const ctabs=el('nav',undefined,'rag-console-tabs');ctabs.setAttribute('aria-label','Разделы коллекции');collection.append(ctabs);
  const panels={};
  for(const [id,name]of [['points','Точки / документы'],['search','Поиск'],['indexes','Индексы'],['snapshots','Снимки'],['config','Параметры']]){const panel=el('div');panel.id='rag-tab-'+id;panels[id]=panel;collection.append(panel);const b=button(name,()=>setTab(id));b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);ctabs.append(b);}
  ctabs.setAttribute('role','tablist');
  const existing=[...workspace.children],editorDetails=el('details'),importDetails=el('details');editorDetails.append(el('summary','Создать или изменить документ'),existing[0]);importDetails.append(el('summary','Импортировать файлы'),existing[1]);panels.points.append(existing[2],editorDetails,importDetails);panels.search.append(existing[3]);
  [...panels.points.querySelectorAll('h2'),...panels.search.querySelectorAll('h2')].forEach(n=>n.textContent=n.textContent.replace(/^\d+\s*·\s*/,''));
  const raw=el('details');raw.append(el('summary','Точка JSON / payload · без векторизации'),field('Полная точка: id, vector, payload','raw-point','{}','textarea'));
  raw.append(button('Прочитать точку с вектором',()=>act('Чтение точки…',async()=>{const result=await api.qdrant(api.context(),'/points','POST',{ids:[api.pointId()],with_payload:true,with_vector:true});if(!result[0])throw Error('Точка не найдена.');$('raw-point').value=JSON.stringify(result[0],null,2);})),button('Записать точку JSON',()=>act('Запись точки…',async()=>{const point=object('raw-point');if(point.id===undefined||!point.vector)throw Error('Укажите id и vector.');if(!confirmAction('Записать точку '+point.id+'? Существующая точка с этим ID будет заменена.'))return;await api.qdrant(api.context(),'/points?wait=true','PUT',{points:[point]});api.resetRecords();})),field('Payload · полная замена без изменения вектора','payload-only','{}','textarea'),button('Заменить payload по ID',()=>act('Запись payload…',async()=>{const id=api.pointId(),payload=object('payload-only');if(!confirmAction('Заменить весь payload точки '+id+'? Вектор останется прежним.'))return;await api.qdrant(api.context(),'/points/payload?wait=true','PUT',{points:[id],payload});api.resetRecords();})));
  panels.points.append(raw);
  $('workbench').replaceChildren(vectorization,inventory,aliases,collection);old.remove();
  // Existing handlers retain this field as the selected collection context.
  const hidden=el('div');hidden.hidden=true;hidden.append(aside.querySelector('section'));$('workbench').append(hidden);
  const aliasList=el('div');aliases.append(el('h2','Алиасы коллекций'),el('p','Стабильное имя для коллекции. Переключение алиаса на другую коллекцию выполняется атомарно.','hint'),field('Имя алиаса','alias-name'),field('Целевая коллекция','alias-target','','select'),button('Создать алиас',()=>aliasAction('create')),button('Обновить список',()=>act('Чтение алиасов…',loadAliases)),aliasList);
  const indexList=el('div');panels.indexes.append(el('h3','Индексы полей payload'),el('p','Индекс ускоряет фильтрацию. Его удаление не удаляет данные payload.','hint'),field('Имя поля','index-field'),field('Тип','index-type','','select'),button('Создать индекс',()=>act('Создание индекса…',async()=>{const name=$('index-field').value.trim();if(!name)throw Error('Введите имя поля.');await api.qdrant(api.context(),'/index?wait=true','PUT',{field_name:name,field_schema:$('index-type').value});await inspect();renderIndexes();})),indexList);
  ['keyword','integer','float','bool','geo','text','datetime','uuid'].forEach(v=>$('index-type').append(new Option(v,v)));
  const snapshotList=el('div');panels.snapshots.append(el('h3','Снимки коллекции'),button('Обновить',()=>act('Чтение снимков…',loadSnapshots)),button('Создать снимок',()=>act('Создание снимка…',async()=>{await api.qdrant(api.context(),'/snapshots','POST');await loadSnapshots();})),snapshotList);
  const restore=el('details');panels.snapshots.append(restore);restore.append(el('summary','Восстановить из файла · заменяет данные'),field('Файл .snapshot','snapshot-file','','input'));$('snapshot-file').type='file';$('snapshot-file').accept='.snapshot';restore.append(button('Восстановить коллекцию',()=>act('Восстановление снимка…',async()=>{const file=$('snapshot-file').files[0];if(!file)throw Error('Выберите .snapshot файл.');if(!typed(current))return;const ctx=api.context(),body=new FormData();body.append('snapshot',file);const response=await binary(ctx,'/snapshots/upload?wait=true&priority=snapshot','POST',body);await response.json();await inspect();api.resetRecords();})));panels.snapshots.append(restore);
  const configData=el('div');panels.config.append(el('h3','Настройки коллекции'),configData,field('Изменить параметры · PATCH JSON','patch','{}','textarea'),el('p','Доступны параметры оптимизатора, HNSW, репликации и другие настройки, поддерживаемые вашей версией Qdrant. Имя коллекции и размерность вектора здесь не меняются.','hint'),button('Применить параметры',()=>act('Обновление параметров…',async()=>{const patch=object('patch');if(!Object.keys(patch).length)throw Error('Укажите параметры изменения.');if(!confirmAction('Применить параметры к коллекции «'+current+'»?'))return;await api.qdrant(api.context(),'','PATCH',patch);await inspect();})),button('Удалить коллекцию',()=>act('Удаление коллекции…',async()=>{if(!typed(current))return;await api.qdrant(api.context(),'','DELETE');current='';await refresh();setView('collections');}),true));
  function act(message,fn){if(!connected)return api.status('Сначала подключитесь к кластеру.',true);return api.run(message,async()=>{cancelled=false;await fn();api.status(cancelled?'Действие отменено.':'Операция выполнена.');});}
  async function binary(ctx,suffix,method='GET',body){const response=await LocalProxyTransport.fetch(ctx.base+ctx.path+suffix,{method,headers:{'api-key':ctx.key},body,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:api.signal || AbortSignal.timeout(parent.ragDefaults.timeoutMs)},ctx.useProxy);if(!response.ok)throw Error('HTTP '+response.status+': операция со снимком недоступна.');return response;}
  function setView(v){view=v;vectorization.hidden=v==='aliases';inventory.hidden=v!=='collections';aliases.hidden=v!=='aliases';collection.hidden=v!=='collection';[...tabs.children].forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));remember();}
  function setTab(id){tab=Object.hasOwn(panels,id)?id:'points';Object.entries(panels).forEach(([k,p])=>p.hidden=k!==tab);[...ctabs.children].forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));remember();if(connected&&current){if(tab==='indexes')renderIndexes();if(tab==='snapshots')act('Чтение снимков…',loadSnapshots);}}
  for(const [id,name]of [['collections','Коллекции'],['aliases','Алиасы']]){const b=button(name,()=>{setView(id);if(id==='aliases')act('Чтение алиасов…',loadAliases);});b.dataset.view=id;b.setAttribute('role','tab');tabs.append(b);}tabs.setAttribute('role','tablist');
  async function inspect(){const info=await api.qdrant(api.context(),'');details.set(current,info);title.textContent=current;stats.replaceChildren();for(const [name,value]of [['Статус',info.status],['Точки',info.points_count],['Сегменты',info.segments_count],['Шарды',info.config?.params?.shard_number]]){const n=el('span');n.append(el('small',name),document.createTextNode(String(value??'—')));stats.append(n);}configData.replaceChildren(json(info));const vectors=info.config?.params?.vectors||{};let list=document.getElementById('rag-vector-options');if(!list){list=el('datalist');list.id='rag-vector-options';$('vector-name').after(list);$('vector-name').setAttribute('list',list.id);}const names=Number.isInteger(vectors.size)?['']:Object.keys(vectors);list.replaceChildren(...names.map(name=>new Option(name,name)));if(!names.includes($('vector-name').value))$('vector-name').value=names[0]||'';}
  async function openCollection(name){current=name;title.textContent=name;stats.replaceChildren();configData.replaceChildren();indexList.replaceChildren();snapshotList.replaceChildren();$('raw-point').value='{}';$('payload-only').value='{}';$('snapshot-file').value='';$('collection').value=name;api.persist();api.clearEditor();api.resetRecords();setView('collection');await inspect();setTab(tab);if(tab==='points')await api.browse(api.context(),null);if(tab==='snapshots')await loadSnapshots();}
  const vectorText=info=>{const vectors=info?.config?.params?.vectors;if(!vectors)return '—';return Number.isInteger(vectors.size)?vectors.size+' · '+vectors.distance:Object.entries(vectors).map(([k,v])=>k+': '+v.size+' · '+v.distance).join(', ');};
  function renderInventory(){count.textContent='Коллекции ('+collections.length+')';empty.hidden=connected;tableHost.replaceChildren();if(!connected)return;if(!collections.length){tableHost.append(el('p','Коллекций пока нет. Создайте первую коллекцию.','hint'));return;}const table=el('table');table.className='rag-collection-table';const head=el('tr');['Коллекция','Статус','Точки','Сегменты','Шарды','Векторы'].forEach(t=>head.append(el('th',t)));const th=el('thead');th.append(head);table.append(th);const body=el('tbody');for(const name of collections.filter(n=>n.toLowerCase().includes(filter.value.toLowerCase()))){const info=details.get(name),row=el('tr'),cell=el('td');cell.append(button(name,()=>act('Открытие коллекции…',()=>openCollection(name))));row.append(cell);const statusCell=el('td'),badge=el('span',info?.status??'Недоступно','rag-collection-status');badge.dataset.status=info?.status||'unknown';statusCell.append(badge);row.append(statusCell);for(const value of [info?.points_count??'—',info?.segments_count??'—',info?.config?.params?.shard_number??'—',vectorText(info)])row.append(el('td',String(value)));body.append(row);}table.append(body);tableHost.append(table);}
  async function connectedTo(ctx,result){const generation=epoch;collections=result.collections.map(c=>c.name);details.clear();connected=true;setConnection('online','Подключено: '+new URL(ctx.base).host+'.');for(let i=0;i<collections.length;i+=parent.ragDefaults.collectionDetailsConcurrency){await Promise.all(collections.slice(i,i+parent.ragDefaults.collectionDetailsConcurrency).map(async name=>{try{details.set(name,await api.qdrant({...ctx,path:'/collections/'+encodeURIComponent(name)},''));}catch(_){}}));}if(generation!==epoch)return;renderInventory();$('alias-target').replaceChildren(...collections.map(name=>new Option(name,name)));const desiredView=restored.view;if(restored.current&&collections.includes(restored.current)){tab=restored.tab||'points';const name=restored.current;restored={};await openCollection(name);if(desiredView==='collections')setView('collections');}else setView('collections');if(desiredView==='aliases'){setView('aliases');await loadAliases();}}
  async function refresh(select){createForm.hidden=true;const ctx=api.context(false),result=await api.qdrant(ctx,'/collections');restored=select?{current:select,tab}:{};await connectedTo(ctx,result);}
  function renderIndexes(){indexList.replaceChildren();for(const [name,info]of Object.entries(details.get(current)?.payload_schema||{})){const row=el('div',undefined,'rag-entity-row');row.append(el('span',name+' · '+info.data_type),button('Удалить',()=>act('Удаление индекса…',async()=>{if(!confirmAction('Удалить индекс поля «'+name+'»?'))return;await api.qdrant(api.context(),'/index/'+encodeURIComponent(name)+'?wait=true','DELETE');await inspect();renderIndexes();}),true));indexList.append(row);}if(!indexList.children.length)indexList.append(el('p','Индексов payload пока нет.','hint'));}
  async function loadAliases(){const result=await api.qdrant(api.context(false),'/aliases');aliasList.replaceChildren();for(const a of result.aliases||[]){const row=el('div',undefined,'rag-entity-row');row.append(el('span',a.alias_name+' → '+a.collection_name),button('Переименовать',()=>aliasAction('rename',a)),button('Перенаправить',()=>aliasAction('retarget',a)),button('Удалить',()=>aliasAction('delete',a),true));aliasList.append(row);}if(!aliasList.children.length)aliasList.append(el('p','Алиасов пока нет.','hint'));}
  function aliasAction(kind,a){act('Обновление алиасов…',async()=>{const target=$('alias-target').value,name=$('alias-name').value.trim();let actions;if(kind==='create'){if(!name||!target)throw Error('Укажите имя и целевую коллекцию.');actions=[{create_alias:{alias_name:name,collection_name:target}}];}if(kind==='delete'){if(!confirmAction('Удалить алиас «'+a.alias_name+'»? Коллекция останется.'))return;actions=[{delete_alias:{alias_name:a.alias_name}}];}if(kind==='rename'){const value=prompt('Новое имя алиаса',a.alias_name);if(!value?.trim())return;actions=[{rename_alias:{old_alias_name:a.alias_name,new_alias_name:value.trim()}}];}if(kind==='retarget'){if(!target||!confirm('Перенаправить «'+a.alias_name+'» на «'+target+'»?'))return;actions=[{delete_alias:{alias_name:a.alias_name}},{create_alias:{alias_name:a.alias_name,collection_name:target}}];}await api.qdrant(api.context(false),'/collections/aliases','POST',{actions});await loadAliases();});}
  async function loadSnapshots(){const list=await api.qdrant(api.context(),'/snapshots');snapshotList.replaceChildren();for(const snapshot of list){const row=el('div',undefined,'rag-entity-row');row.append(el('span',snapshot.name+' · '+Math.ceil(snapshot.size/1024)+' КБ'),button('Скачать',()=>act('Загрузка снимка…',async()=>{const response=await binary(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)),blob=await response.blob(),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=snapshot.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})),button('Удалить',()=>act('Удаление снимка…',async()=>{if(!confirmAction('Удалить снимок «'+snapshot.name+'»?'))return;await api.qdrant(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)+'?wait=true','DELETE');await loadSnapshots();}),true));snapshotList.append(row);}if(!snapshotList.children.length)snapshotList.append(el('p','Снимков пока нет.','hint'));}
  function invalidate(){epoch++;api.cancel();connected=false;collections=[];details.clear();aliasList.replaceChildren();snapshotList.replaceChildren();indexList.replaceChildren();stats.replaceChildren();configData.replaceChildren();api.clearEditor();$('raw-point').value='{}';$('payload-only').value='{}';$('snapshot-file').value='';setConnection('offline','Настройки подключения изменены. Проверьте подключение к кластеру.');api.resetRecords();setView('collections');renderInventory();}
  function secretSlot(id){try{return 'ai_rag_secret:'+id+':'+new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value).origin;}catch(_){return null;}}
  for(const id of ['qdrant-key','neuraldeep-key']) {
    const input=$(id), label=input.closest('label');
    const host=el('div',undefined,'rag-credential-slot');
    label.before(host);
    const clear=button('',()=>{
      try{const slot=secretSlot(id);if(slot)sessionStorage.removeItem(slot);}catch(_){}
      input.value='';
      if(id==='qdrant-key')invalidate();
      else input.dispatchEvent(new Event('change', {bubbles:true}));
      api.status('Ключ удалён из сессии.');
    },true);
    clear.title=id==='qdrant-key'?'Удалить ключ Qdrant':'Удалить ключ векторизации';
    clear.setAttribute('aria-label',clear.title);
    host.append(label,clear);
    const slot=secretSlot(id);
    try{if(slot&&!input.disabled)input.value=sessionStorage.getItem(slot)||'';}catch(_){}
    input.addEventListener('input',()=>{
      const key=secretSlot(id);
      try{if(key&&input.value)sessionStorage.setItem(key,input.value);}catch(_){}
      if(id==='qdrant-key')invalidate();
    });
  }
  for(const id of ['qdrant-url','neuraldeep-url'])$(id).addEventListener('input',()=>{$(id==='qdrant-url'?'qdrant-key':'neuraldeep-key').value='';if(id==='qdrant-url')invalidate();});
  $('neuraldeep-url').addEventListener('change', () => {
    const input = $('neuraldeep-key'), slot = secretSlot('neuraldeep-key');
    try { if (!input.disabled && !input.value && slot) input.value = sessionStorage.getItem(slot) || ''; } catch (_) {}
  });
  for(const id of ['delete','clear-files']){const b=$(id);if(!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',trash);}
  window.RagConsole={
    connected:connectedTo,refresh,invalidate,
    connecting:()=>setConnection('connecting','Проверка подключения к кластеру…'),
    connectionFailed:()=>{
      if(connection.dataset.state==='connecting') setConnection('error','Ошибка подключения. Подробности доступны в строке состояния RAG.');
    }
  };
  let savedSettings;try{savedSettings=sessionStorage.getItem('ai_rag_settings_open');}catch(_){}
  setSettings(savedSettings===null||savedSettings===undefined?!($('qdrant-url').value&&$('qdrant-key').value):savedSettings==='true');setView('collections');setTab('points');renderInventory();
  if($('qdrant-url').value&&$('qdrant-key').value)$('connect').click();
})();
