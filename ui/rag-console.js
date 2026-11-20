// Cluster workspace. Embeddings are optional until a text vector operation is run.
(() => {
  if (!window.RagWorkbench) return;
  const api = RagWorkbench, $ = id => document.getElementById('rag-' + id);
  const el = (tag,text,cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  const trash='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  const button=(text,fn,remove=false)=>{const n=el('button',undefined,remove?'small danger':'small');n.type='button';if(remove)n.innerHTML=trash;n.append(document.createTextNode(text));n.onclick=fn;return n;};
  const field=(title,id,value='',tag='input')=>{const l=el('label',title),n=el(tag);n.id='rag-'+id;n.value=value;l.append(n);return l;};
  const json=(value)=>{const d=el('details',undefined,'debug-section rag-json-panel'),heading=el('summary','JSON'),pre=el('pre');d.append(heading,pre);JsonViewer.create({pre,heading}).update(JSON.stringify(value,null,2));return d;};
  function helpControl(host,title,text){
    const icon=el('span','?','api-help');icon.setAttribute('role','button');icon.tabIndex=0;icon.setAttribute('aria-label','Справка: '+title);icon.dataset.helpPath='RAG · '+title;icon.dataset.helpText=text;host.append(icon);icon.addEventListener('click',event=>{event.stopPropagation();event.preventDefault();});FieldHelp.attach(icon,null,host);return icon;
  }
  const columnHelp={
    'Коллекция':'Колонка Коллекция показывает имя набора точек Qdrant. Нажмите имя, чтобы открыть документы и поиск этой коллекции.',
    'Статус':'Колонка Статус показывает состояние коллекции Qdrant. green — готова, yellow — оптимизация, red — ошибка. Это не статус соединения с сервером.',
    'Точки':'Колонка Точки показывает число записей в коллекции. Один загруженный документ может создать несколько точек: по одной на фрагмент текста.',
    'Сегменты':'Колонка Сегменты показывает число внутренних блоков хранения и индексации Qdrant. Они создаются и объединяются автоматически.',
    'Шарды':'Колонка Шарды показывает число частей, на которые Qdrant делит коллекцию для хранения и распределения нагрузки.',
    'Векторы':'Колонка Векторы показывает размерность, метрику сравнения и имя векторного пространства. Для поиска нужна та же модель эмбеддингов, что при загрузке документов.'
  };
  const object=id=>{const v=JSON.parse($(id).value);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Нужен JSON-объект.');return v;};
  let cancelled = false;
  const confirmAction=message=>{const accepted=window.confirm(message);if(!accepted)cancelled=true;return accepted;};
  const typed=name=>{const accepted=prompt('Введите «'+name+'» для подтверждения. Действие изменяет данные коллекции.')===name;if(!accepted)cancelled=true;return accepted;};
  let epoch=0,collections=[],details=new Map(),connected=false,current='',tab='points',view='collections';
  let restored={};try{restored=JSON.parse(sessionStorage.getItem('ai_rag_workspace')||'{}');}catch(_){}
  const remember=()=>{if(!connected)return;try{sessionStorage.setItem('ai_rag_workspace',JSON.stringify({current,tab,view}));}catch(_){}};
  const main=document.querySelector('.rag-layout'),old=document.querySelector('.rag-columns'),aside=old.querySelector('aside'),workspace=old.querySelector('.rag-workspace');
  document.querySelector('.rag-intro').remove();
  const heading=document.querySelector('.rag-heading'),headingTitle=heading.querySelector('h1');
  headingTitle.innerHTML='RAG <span>· Управление базами знаний</span>';
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
  function setSettings(open){settings.hidden=!open;headingTitle.setAttribute('aria-expanded',String(open));settingsToggle.setAttribute('aria-expanded',String(open));try{sessionStorage.setItem('ai_rag_settings_open',String(open));}catch(_){}}
  headingTitle.tabIndex=0;
  headingTitle.setAttribute('role','button');
  headingTitle.setAttribute('aria-controls','rag-settings');
  headingTitle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSettings(settings.hidden);}});
  $('status').before(bar);
  const settings=el('section',undefined,'rag-settings-panel');
  settings.id='rag-settings';
  settings.setAttribute('aria-label','Настройки RAG');
  bar.after(settings);
  const provider=$('provider').closest('label');
  provider.classList.add('rag-provider-control');
  bar.append(headingTitle,provider,connection,settingsToggle,$('qdrant-cloud'));heading.remove();
  bar.addEventListener('click',event=>{if(!event.target.closest('button,a,label,input,select,.api-help')&&getSelection().isCollapsed)setSettings(settings.hidden);});
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
  checkConnection.textContent='Получить коллекции';
  const clusterCheck=button('Проверить кластер',()=>api.checkCluster());
  clusterCheck.id='rag-check-cluster';
  const clusterStatus=el('span',undefined,'hint');clusterStatus.id='rag-cluster-status';clusterStatus.setAttribute('role','status');
  const clusterActions=el('div',undefined,'rag-cluster-actions');clusterActions.append(clusterCheck,clusterStatus);qfields.append(clusterActions);
  helpControl(clusterActions,'Проверка кластера','Кнопка Проверить кластер запрашивает /readyz без получения коллекций. Готовность сервера не подтверждает права API-ключа на коллекции.');
  connections.append(qfields,efields);
  settings.append(connections,el('p','Ключ выбранного профиля берётся из настроек OpenAI API. В сессии этой вкладки ключ Qdrant привязан к имени сервера из поля «REST URL кластера Qdrant», а ключ Custom — к имени сервера из поля «Base URL» сервиса эмбеддингов. Порты этих API-серверов не учитываются.','hint'));
  const vectorization=$('vectorization');
  const tabs=el('nav',undefined,'rag-console-tabs');tabs.setAttribute('aria-label','Разделы кластера');$('workbench').before(tabs);
  const inventory=el('section'),aliases=el('section'),collection=el('details');inventory.id='rag-inventory';aliases.id='rag-aliases-panel';collection.id='rag-collection-panel';$('workbench').append(inventory,aliases,collection);
  const toolbar=el('div',undefined,'rag-section-head'),count=el('h2','Коллекции'),filter=el('input');filter.placeholder='Найти коллекцию';filter.setAttribute('aria-label','Поиск коллекции');filter.oninput=renderInventory;
  toolbar.classList.add('rag-inventory-toolbar');
  const collectionStatus=el('span',undefined,'hint');collectionStatus.id='rag-collections-status';collectionStatus.setAttribute('role','status');
  const createButton=button('+ Коллекция',()=>createForm.hidden=!createForm.hidden),createControl=el('span',undefined,'rag-create-control');createControl.append(createButton);
  toolbar.append(count,filter,checkConnection,collectionStatus,createControl);inventory.append(toolbar);
  const createForm=el('div',undefined,'rag-create-form');createForm.hidden=true;
  createForm.append(el('h3','Новая коллекция'),field('Имя коллекции','new-collection'));
  const distance=field('Метрика','distance','','select');['Cosine','Dot','Euclid','Manhattan'].forEach(v=>distance.lastChild.append(new Option(v,v)));createForm.append($('dimensions').closest('label'),distance,field('Имя вектора · необязательно','new-vector-name'));
  createForm.append(el('p','Задайте размерность и метрику для новой коллекции. Размерность существующего вектора изменить нельзя.','hint'),button('Создать',()=>{const name=$('new-collection').value.trim();if(!name)return api.status('Введите имя коллекции.',true);$('collection').value=name;$('vector-name').value=$('new-vector-name').value.trim();$('create-collection').click();}));inventory.append(createForm);$('distance').value=parent.ragDefaults.distance;
  const tableHost=el('div',undefined,'rag-table-scroll');tableHost.tabIndex=0;tableHost.setAttribute('aria-label','Список коллекций');inventory.append(tableHost);
  const empty=el('div',undefined,'rag-empty');empty.append(el('h3','Подключите базу знаний'),el('p','Укажите REST URL и API key Qdrant в настройках. Здесь появятся коллекции и доступные операции.'));inventory.append(empty);
  const crumb=el('summary',undefined,'rag-collection-head'),title=el('h2'),stats=el('div',undefined,'rag-stat-strip'),collectionBody=el('div',undefined,'rag-collection-body');crumb.append(title,stats);collection.append(crumb,collectionBody);crumb.addEventListener('click',event=>{if(!getSelection().isCollapsed||event.target.closest('.api-help,button,a'))event.preventDefault();});
  const ctabs=el('nav',undefined,'rag-console-tabs');ctabs.setAttribute('aria-label','Разделы коллекции');collectionBody.append(ctabs);
  const panels={};
  for(const [id,name]of [['points','Документы'],['add','Добавить'],['search','Поиск в коллекции'],['settings','Настройки'],['indexes','Индексы'],['snapshots','Снимки'],['config','Параметры']]){const panel=el('div');panel.id='rag-tab-'+id;panels[id]=panel;collectionBody.append(panel);const b=button(name,()=>setTab(id));b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);ctabs.append(b);}
  ctabs.setAttribute('role','tablist');
  const advanced=el('nav',undefined,'rag-console-tabs rag-settings-tabs');advanced.setAttribute('aria-label','Настройки коллекции');advanced.setAttribute('role','tablist');
  const vectorTab=button('Векторизация',()=>setTab('vectorization'));vectorTab.dataset.tab='vectorization';vectorTab.setAttribute('role','tab');advanced.append(vectorTab);
  for(const id of ['indexes','snapshots','config']){advanced.append(ctabs.querySelector('[data-tab="'+id+'"]'));panels.settings.append(panels[id]);}
  panels.settings.prepend(advanced,vectorization);vectorization.after($('model-prefixes'));let settingTab='vectorization';
  const existing=[...workspace.children],editorDetails=el('details'),importDetails=el('details');editorDetails.append(el('summary','Создать или изменить документ'),existing[0]);importDetails.append(el('summary','Импортировать файлы'),existing[1]);panels.points.append(existing[2]);panels.add.append(importDetails,editorDetails);importDetails.open=true;panels.search.append(existing[3]);
  const searchScope=el('p',undefined,'hint rag-search-scope');existing[3].querySelector('h2').after(searchScope);
  [...panels.points.querySelectorAll('h2'),...panels.add.querySelectorAll('h2'),...panels.search.querySelectorAll('h2')].forEach(n=>n.textContent=n.textContent.replace(/^\d+\s*·\s*/,''));
  const raw=el('details');raw.append(el('summary','Точка JSON / payload · без векторизации'),field('Полная точка: id, vector, payload','raw-point','{}','textarea'));
  raw.append(button('Прочитать точку с вектором',()=>act('Чтение точки…',async()=>{const result=await api.qdrant(api.context(),'/points','POST',{ids:[api.pointId()],with_payload:true,with_vector:true});if(!result[0])throw Error('Точка не найдена.');$('raw-point').value=JSON.stringify(result[0],null,2);})),button('Записать точку JSON',()=>act('Запись точки…',async()=>{const point=object('raw-point');if(point.id===undefined||!point.vector)throw Error('Укажите id и vector.');if(!confirmAction('Записать точку '+point.id+'? Существующая точка с этим ID будет заменена.'))return;await api.qdrant(api.context(),'/points?wait=true','PUT',{points:[point]});api.resetRecords();})),field('Payload · полная замена без изменения вектора','payload-only','{}','textarea'),button('Заменить payload по ID',()=>act('Запись payload…',async()=>{const id=api.pointId(),payload=object('payload-only');if(!confirmAction('Заменить весь payload точки '+id+'? Вектор останется прежним.'))return;await api.qdrant(api.context(),'/points/payload?wait=true','PUT',{points:[id],payload});api.resetRecords();})));
  panels.settings.append(raw);
  $('workbench').replaceChildren(inventory,aliases,collection);old.remove();
  // Existing handlers retain this field as the selected collection context.
  const hidden=el('div');hidden.hidden=true;hidden.append(aside.querySelector('section'));$('workbench').append(hidden);
  const aliasList=el('div');aliases.append(el('h2','Алиасы коллекций'),el('p','Стабильное имя для коллекции. Переключение алиаса на другую коллекцию выполняется атомарно.','hint'),field('Имя алиаса','alias-name'),field('Целевая коллекция','alias-target','','select'),button('Создать алиас',()=>aliasAction('create')),button('Обновить список',()=>act('Чтение алиасов…',loadAliases)),aliasList);
  const indexList=el('div');panels.indexes.append(el('h3','Индексы полей payload'),el('p','Индекс ускоряет фильтрацию. Его удаление не удаляет данные payload.','hint'),field('Имя поля','index-field'),field('Тип','index-type','','select'),button('Создать индекс',()=>act('Создание индекса…',async()=>{const name=$('index-field').value.trim();if(!name)throw Error('Введите имя поля.');await api.qdrant(api.context(),'/index?wait=true','PUT',{field_name:name,field_schema:$('index-type').value});await inspect();renderIndexes();})),indexList);
  ['keyword','integer','float','bool','geo','text','datetime','uuid'].forEach(v=>$('index-type').append(new Option(v,v)));
  const snapshotList=el('div');panels.snapshots.append(el('h3','Снимки коллекции'),button('Обновить',()=>loadSnapshots()),button('Создать снимок',()=>act('Создание снимка…',async()=>{await api.qdrant(api.context(),'/snapshots','POST');await loadSnapshots();})),snapshotList);
  const restore=el('details');panels.snapshots.append(restore);restore.append(el('summary','Восстановить из файла · заменяет данные'),field('Файл .snapshot','snapshot-file','','input'));$('snapshot-file').type='file';$('snapshot-file').accept='.snapshot';restore.append(button('Восстановить коллекцию',()=>act('Восстановление снимка…',async()=>{const file=$('snapshot-file').files[0];if(!file)throw Error('Выберите .snapshot файл.');if(!typed(current))return;const ctx=api.context(),body=new FormData();body.append('snapshot',file);const response=await binary(ctx,'/snapshots/upload?wait=true&priority=snapshot','POST',body);await response.json();await inspect();api.resetRecords();})));panels.snapshots.append(restore);
  const configData=el('div');panels.config.append(el('h3','Настройки коллекции'),configData,field('Изменить параметры · PATCH JSON','patch','{}','textarea'),el('p','Доступны параметры оптимизатора, HNSW, репликации и другие настройки, поддерживаемые вашей версией Qdrant. Имя коллекции и размерность вектора здесь не меняются.','hint'),button('Применить параметры',()=>act('Обновление параметров…',async()=>{const patch=object('patch');if(!Object.keys(patch).length)throw Error('Укажите параметры изменения.');if(!confirmAction('Применить параметры к коллекции «'+current+'»?'))return;await api.qdrant(api.context(),'','PATCH',patch);await inspect();})),button('Удалить коллекцию',()=>act('Удаление коллекции…',async()=>{if(!typed(current))return;await api.qdrant(api.context(),'','DELETE');current='';await refresh();setView('collections');}),true));
  const tabHelp={points:'Вкладка Документы показывает сохранённые точки выбранной коллекции. Текст раскрывается в строке документа.',add:'Вкладка Добавить загружает текстовые файлы или создаёт документ вручную в выбранной коллекции.',search:'Вкладка Поиск в коллекции ищет ближайшие векторы по всем документам выбранной коллекции.',settings:'Вкладка Настройки объединяет параметры векторизации и служебные операции выбранной коллекции.',vectorization:'Раздел Векторизация задаёт имя вектора и префиксы документа и запроса. Эти параметры используются клиентом при получении эмбеддингов.',indexes:'Вкладка Индексы управляет индексами полей payload для фильтрации. Это не индекс векторов.',snapshots:'Вкладка Снимки содержит резервные копии выбранной коллекции. Восстановление заменяет её данные.',config:'Вкладка Параметры показывает конфигурацию Qdrant и позволяет изменить поддерживаемые параметры коллекции.'};
  for(const b of [...ctabs.querySelectorAll('[data-tab]'),...advanced.querySelectorAll('[data-tab]')]){const group=el('span',undefined,'rag-tab-control');b.replaceWith(group);group.append(b);helpControl(group,b.textContent,tabHelp[b.dataset.tab]);}
  helpControl(raw.querySelector('summary'),'Точка JSON / payload','Раздел Точка JSON / payload работает с готовыми данными Qdrant без запроса к модели эмбеддингов. Полная точка содержит id, готовый vector и payload. Запись заменяет существующую точку с тем же ID. Замена payload сохраняет вектор, но заменяет все метаданные.');
  const summaries=[];
  for(const [host,kind]of [[existing[1],'upload'],[existing[0],'document'],[existing[3],'search']]){
    const summary=el('details',undefined,'rag-operation-settings');summary.open=false;summary.append(el('summary','Параметры '+(kind==='search'?'поиска':'векторизации')),el('div',undefined,'rag-effective-settings'));
    const action=host.querySelector('.actions,.rag-search-actions');if(action)action.before(summary);else host.prepend(summary);summaries.push({summary,kind});
  }
  function refreshSummaries(){
    const cfg=parent.ragDefaults,info=details.get(current),vectors=info?.config?.params?.vectors,name=$('vector-name').value.trim(),vector=Number.isInteger(vectors?.size)?vectors:vectors?.[name];
    for(const {summary,kind}of summaries){
      summary.firstChild.textContent=(kind==='search'?'Параметры поиска':'Параметры векторизации')+' · '+($('model').value||'Модель не выбрана')+' · '+(name||'Безымянный вектор');
      const rows=[['Коллекция',current||'Не выбрана'],['Провайдер',$('embedding-provider').selectedOptions[0]?.textContent||'Custom'],['Base URL',$('neuraldeep-url').value],['Модель',$('model').value||'Не выбрана'],['Вектор',name||'Без имени'],['Размерность / метрика',vector?vector.size+' / '+vector.distance:'Будут проверены перед операцией'],['Префикс '+(kind==='search'?'запроса':'документа'),JSON.stringify($(kind==='search'?'query-prefix':'document-prefix').value)]];
      if(kind==='upload')rows.push(['Разбиение',cfg.fileChunkChars+' символов · перекрытие '+cfg.fileChunkOverlap],['Пакет эмбеддингов',cfg.fileEmbeddingBatchSize+' фрагментов']);
      if(kind==='search')rows.push(['Top K',$('top-k').value],['Метод','Ближайшие векторы · без фильтра payload']);
      const host=summary.lastChild;host.replaceChildren();for(const [key,value]of rows){const item=el('span');item.append(el('span',key+': ','debug-field-name'),el('span',String(value),'debug-field-value'));host.append(item);}
    }
    const searchHeading=panels.search.querySelector('h2');if(searchHeading)searchHeading.textContent='Поиск в коллекции «'+(current||'не выбрана')+'»';
    searchScope.textContent='Поиск по всем документам коллекции «'+(current||'не выбрана')+'». Видимая страница списка и фильтр последней загрузки не ограничивают поиск.';
  }
  document.addEventListener('input',refreshSummaries);document.addEventListener('change',refreshSummaries);
  let sizingFrame;
  function sizeRecordPanels(){cancelAnimationFrame(sizingFrame);sizingFrame=requestAnimationFrame(()=>{for(const host of [$('records'),$('results')]){if(!host.getClientRects().length)continue;const top=host.getBoundingClientRect().top;host.style.maxHeight=Math.max(120,innerHeight-Math.max(0,top)-($('next').hidden?16:$('next').offsetHeight+24))+'px';}});}
  addEventListener('resize',sizeRecordPanels);addEventListener('scroll',sizeRecordPanels,{passive:true});
  new ResizeObserver(sizeRecordPanels).observe(main);
  document.addEventListener('toggle',sizeRecordPanels,true);
  function act(message,fn){if(!connected)return api.status('Сначала подключитесь к кластеру.',true);return api.run(message,async()=>{cancelled=false;await fn();api.status(cancelled?'Действие отменено.':'Операция выполнена.');});}
  async function binary(ctx,suffix,method='GET',body){const response=await LocalProxyTransport.fetch(ctx.base+ctx.path+suffix,{method,headers:{'api-key':ctx.key},body,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:api.signal || AbortSignal.timeout(parent.ragDefaults.timeoutMs)},ctx.useProxy);if(!response.ok)throw Error('HTTP '+response.status+': операция со снимком недоступна.');return response;}
  function setView(v){if(v!=='collection')snapshotController?.abort();view=v;vectorization.hidden=v!=='collection'||tab!=='settings'||settingTab!=='vectorization';inventory.hidden=v==='aliases';aliases.hidden=v!=='aliases';collection.hidden=v!=='collection';if(connected)renderInventory();[...tabs.querySelectorAll('[data-view]')].forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===(v==='collection'?'collections':v))));remember();}
  function setTab(id){const sub=['vectorization','indexes','snapshots','config'];if(sub.includes(id)){settingTab=id;tab='settings';}else tab=['points','add','search','settings'].includes(id)?id:'points';if(tab!=='settings'||settingTab!=='snapshots')snapshotController?.abort();for(const key of ['points','add','search','settings'])panels[key].hidden=key!==tab;vectorization.hidden=settingTab!=='vectorization';$('model-prefixes').hidden=settingTab!=='vectorization';for(const key of ['indexes','snapshots','config'])panels[key].hidden=settingTab!==key;for(const b of ctabs.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===tab));for(const b of advanced.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===settingTab));remember();if(connected&&current&&tab==='settings'){if(settingTab==='indexes')renderIndexes();if(settingTab==='snapshots')loadSnapshots();}}
  for(const [id,name]of [['collections','Коллекции'],['aliases','Алиасы']]){const b=button(name,()=>{setView(id);if(id==='aliases')act('Чтение алиасов…',loadAliases);});b.dataset.view=id;b.setAttribute('role','tab');helpControl(b,name,id==='collections'?'Коллекция Qdrant хранит документы, метаданные и векторы для поиска.':'Алиас — стабильное имя коллекции. Его можно перенаправить на другую коллекцию без изменения имени в приложении.');tabs.append(b);}tabs.setAttribute('role','tablist');
  async function inspect(){const info=await api.qdrant(api.context(),'');details.set(current,info);title.textContent=current;stats.replaceChildren();for(const [name,value]of [['Статус',info.status],['Точки',info.points_count],['Сегменты',info.segments_count],['Шарды',info.config?.params?.shard_number]]){const n=el('span');n.append(el('span',name+': ','debug-field-name'),el('span',String(value??'—'),'debug-field-value'));stats.append(n);}configData.replaceChildren(json(info));const vectors=info.config?.params?.vectors||{};let list=document.getElementById('rag-vector-options');if(!list){list=el('datalist');list.id='rag-vector-options';$('vector-name').after(list);$('vector-name').setAttribute('list',list.id);}const names=Number.isInteger(vectors.size)?['']:Object.keys(vectors);list.replaceChildren(...names.map(name=>new Option(name,name)));if(!names.includes($('vector-name').value))$('vector-name').value=names[0]||'';refreshSummaries();}
  async function openCollection(name){snapshotController?.abort();current=name;collection.open=true;title.textContent=name;stats.replaceChildren();configData.replaceChildren();indexList.replaceChildren();snapshotList.replaceChildren();$('raw-point').value='{}';$('payload-only').value='{}';$('snapshot-file').value='';$('collection').value=name;api.persist();api.clearEditor();api.resetRecords();setView('collection');renderInventory();await inspect();setTab(tab);await api.browse(api.context(),null);}
  const vectorText=info=>{const vectors=info?.config?.params?.vectors;if(!vectors)return '—';return Number.isInteger(vectors.size)?vectors.size+' · '+vectors.distance:Object.entries(vectors).map(([k,v])=>k+': '+v.size+' · '+v.distance).join(', ');};
  function renderInventory(){count.textContent='Коллекции ('+collections.length+')';createButton.disabled=!connected;createControl.title=connected?'':'Подключите кластер для добавления коллекции.';createButton.title=createControl.title;empty.hidden=connected||collections.length>0;tableHost.replaceChildren();if(!connected&&!collections.length)return;if(!collections.length){tableHost.append(el('p','Коллекций пока нет. Создайте первую коллекцию.','hint'));return;}const table=el('table');table.className='rag-collection-table';const head=el('tr');['Коллекция','Статус','Точки','Сегменты','Шарды','Векторы'].forEach(t=>{const cell=el('th',t);helpControl(cell,t,columnHelp[t]);head.append(cell);});const th=el('thead');th.append(head);table.append(th);const body=el('tbody');for(const name of collections.filter(n=>n.toLowerCase().includes(filter.value.toLowerCase()))){const info=details.get(name),row=el('tr'),cell=el('td');if(name===current&&view==='collection')row.setAttribute('aria-current','true');cell.append(button(name,()=>act('Открытие коллекции…',()=>openCollection(name))));row.append(cell);const statusCell=el('td'),badge=el('span',info?.status??'Недоступно','rag-collection-status');badge.dataset.status=info?.status||'unknown';statusCell.append(badge);row.append(statusCell);for(const value of [info?.points_count??'—',info?.segments_count??'—',info?.config?.params?.shard_number??'—',vectorText(info)])row.append(el('td',String(value)));body.append(row);}table.append(body);tableHost.append(table);}
  async function connectedTo(ctx,result){const generation=epoch;collections=result.collections.map(c=>c.name);details.clear();connected=true;setConnection('online','Подключено: '+new URL(ctx.base).host+'.');for(let i=0;i<collections.length;i+=parent.ragDefaults.collectionDetailsConcurrency){await Promise.all(collections.slice(i,i+parent.ragDefaults.collectionDetailsConcurrency).map(async name=>{try{details.set(name,await api.qdrant({...ctx,path:'/collections/'+encodeURIComponent(name)},''));}catch(_){}}));}if(generation!==epoch)return;renderInventory();$('alias-target').replaceChildren(...collections.map(name=>new Option(name,name)));const desiredView=restored.view;if(restored.current&&collections.includes(restored.current)){tab=restored.tab||'points';const name=restored.current;restored={};await openCollection(name);if(desiredView==='collections')setView('collections');}else setView('collections');if(desiredView==='aliases'){setView('aliases');await loadAliases();}}
  async function refresh(select){createForm.hidden=true;const ctx=api.context(false),result=await api.qdrant(ctx,'/collections');restored=select?{current:select,tab}:{};await connectedTo(ctx,result);}
  function renderIndexes(){indexList.replaceChildren();for(const [name,info]of Object.entries(details.get(current)?.payload_schema||{})){const row=el('div',undefined,'rag-entity-row');row.append(el('span',name+' · '+info.data_type),button('Удалить',()=>act('Удаление индекса…',async()=>{if(!confirmAction('Удалить индекс поля «'+name+'»?'))return;await api.qdrant(api.context(),'/index/'+encodeURIComponent(name)+'?wait=true','DELETE');await inspect();renderIndexes();}),true));indexList.append(row);}if(!indexList.children.length)indexList.append(el('p','Индексов payload пока нет.','hint'));}
  async function loadAliases(){const result=await api.qdrant(api.context(false),'/aliases');aliasList.replaceChildren();for(const a of result.aliases||[]){const row=el('div',undefined,'rag-entity-row');row.append(el('span',a.alias_name+' → '+a.collection_name),button('Переименовать',()=>aliasAction('rename',a)),button('Перенаправить',()=>aliasAction('retarget',a)),button('Удалить',()=>aliasAction('delete',a),true));aliasList.append(row);}if(!aliasList.children.length)aliasList.append(el('p','Алиасов пока нет.','hint'));}
  function aliasAction(kind,a){act('Обновление алиасов…',async()=>{const target=$('alias-target').value,name=$('alias-name').value.trim();let actions;if(kind==='create'){if(!name||!target)throw Error('Укажите имя и целевую коллекцию.');actions=[{create_alias:{alias_name:name,collection_name:target}}];}if(kind==='delete'){if(!confirmAction('Удалить алиас «'+a.alias_name+'»? Коллекция останется.'))return;actions=[{delete_alias:{alias_name:a.alias_name}}];}if(kind==='rename'){const value=prompt('Новое имя алиаса',a.alias_name);if(!value?.trim())return;actions=[{rename_alias:{old_alias_name:a.alias_name,new_alias_name:value.trim()}}];}if(kind==='retarget'){if(!target||!confirm('Перенаправить «'+a.alias_name+'» на «'+target+'»?'))return;actions=[{delete_alias:{alias_name:a.alias_name}},{create_alias:{alias_name:a.alias_name,collection_name:target}}];}await api.qdrant(api.context(false),'/collections/aliases','POST',{actions});await loadAliases();});}
  let snapshotController=null;
  async function loadSnapshots(){
    snapshotController?.abort();const controller=new AbortController();snapshotController=controller;
    const name=current,ctx=api.context(),timeout=setTimeout(()=>controller.abort(),parent.ragDefaults.timeoutMs);
    snapshotList.setAttribute('aria-busy','true');snapshotList.replaceChildren(el('p','Загрузка снимков… Можно перейти в другой раздел.','hint'));
    try{
      const list=await api.qdrant(ctx,'/snapshots','GET',undefined,controller.signal);
      if(snapshotController!==controller||current!==name||tab!=='settings'||settingTab!=='snapshots')return;
      if(!Array.isArray(list))throw Error('Qdrant вернул неожиданный список снимков.');
      snapshotList.replaceChildren();
      for(const snapshot of list){
        const row=el('div',undefined,'rag-entity-row');
        row.append(el('span',snapshot.name+' · '+Math.ceil(snapshot.size/1024)+' КБ'),button('Скачать',()=>act('Загрузка снимка…',async()=>{const response=await binary(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)),blob=await response.blob(),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=snapshot.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})),button('Удалить',()=>act('Удаление снимка…',async()=>{if(!confirmAction('Удалить снимок «'+snapshot.name+'»?'))return;await api.qdrant(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)+'?wait=true','DELETE');await loadSnapshots();}),true));snapshotList.append(row);
      }
      if(!list.length)snapshotList.append(el('p','Снимков пока нет. Снимок — резервная копия коллекции; для первого поиска он не нужен.','hint'));
    }catch(error){
      if(snapshotController!==controller||current!==name||tab!=='settings'||settingTab!=='snapshots')return;
      snapshotList.replaceChildren(el('p',controller.signal.aborted?'Время ожидания снимков истекло. Проверьте подключение и повторите.':error.message,'rag-field-error'),button('Повторить загрузку',loadSnapshots));
    }finally{clearTimeout(timeout);if(snapshotController===controller){snapshotController=null;snapshotList.removeAttribute('aria-busy');}}
  }
  function invalidate(){snapshotController?.abort();epoch++;api.cancel();connected=false;collections=[];collectionStatus.textContent='';clusterStatus.textContent='';details.clear();aliasList.replaceChildren();snapshotList.replaceChildren();indexList.replaceChildren();stats.replaceChildren();configData.replaceChildren();api.clearEditor();$('raw-point').value='{}';$('payload-only').value='{}';$('snapshot-file').value='';setConnection('offline','Настройки подключения изменены. Проверьте подключение к кластеру.');api.resetRecords();setView('collections');renderInventory();}
  function transportChanged(){snapshotController?.abort();epoch++;api.cancel();connected=false;createForm.hidden=true;clusterStatus.textContent='';collectionStatus.textContent='Маршрут изменён. Обновите коллекции для проверки доступа.';setConnection('offline','Маршрут изменён. Доступ к кластеру по новому маршруту ещё не проверен.');renderInventory();}
  function secretSlot(id){try{return 'ai_rag_secret:'+id+':'+new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value).hostname;}catch(_){return null;}}
  function legacySecretSlots(id){
    const prefix='ai_rag_secret:'+id+':',server=new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value);
    return Object.keys(sessionStorage).filter(key=>{if(!key.startsWith(prefix))return false;try{return new URL(key.slice(prefix.length)).hostname===server.hostname;}catch(_){return false;}});
  }
  function readSecret(id){
    const slot=secretSlot(id);if(!slot)return '';
    try{
      if(sessionStorage.getItem(slot)!==null)return sessionStorage.getItem(slot);
      const old=legacySecretSlots(id),exact='ai_rag_secret:'+id+':'+new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value).origin;
      const values=[...new Set(old.map(key=>sessionStorage.getItem(key)).filter(Boolean))];
      const value=sessionStorage.getItem(exact)||(values.length===1?values[0]:'');
      if(value){sessionStorage.setItem(slot,value);old.forEach(key=>sessionStorage.removeItem(key));}
      return value;
    }catch(_){return '';}
  }
  for(const id of ['qdrant-key','neuraldeep-key']) {
    const input=$(id), label=input.closest('label');
    const host=el('div',undefined,'rag-credential-slot');
    label.before(host);
    const clear=button('',()=>{
      try{const slot=secretSlot(id);if(slot){sessionStorage.removeItem(slot);legacySecretSlots(id).forEach(key=>sessionStorage.removeItem(key));}}catch(_){}
      input.value='';
      if(id==='qdrant-key')invalidate();
      else input.dispatchEvent(new Event('change', {bubbles:true}));
      api.status('Ключ удалён из сессии.');
    },true);
    clear.title=id==='qdrant-key'?'Удалить ключ Qdrant':'Удалить ключ векторизации';
    clear.setAttribute('aria-label',clear.title);
    host.append(label,clear);
    const slot=secretSlot(id);
    try{if(slot&&!input.disabled)input.value=readSecret(id);}catch(_){}
    input.addEventListener('input',()=>{
      const key=secretSlot(id);
      try{if(key&&!input.disabled)sessionStorage.setItem(key,input.value);}catch(_){}
      if(id==='qdrant-key')invalidate();
    });
  }
  for(const id of ['qdrant-url','neuraldeep-url'])$(id).addEventListener('input',()=>{const keyId=id==='qdrant-url'?'qdrant-key':'neuraldeep-key',input=$(keyId);if(!input.disabled)input.value=readSecret(keyId);if(id==='qdrant-url')invalidate();});
  $('neuraldeep-url').addEventListener('change', () => {
    const input = $('neuraldeep-key'), slot = secretSlot('neuraldeep-key');
    try { if (!input.disabled && !input.value && slot) input.value = readSecret('neuraldeep-key'); } catch (_) {}
  });
  const selectSlot='ai_rag_selects:'+location.hostname;
  let selectedValues={};try{selectedValues=JSON.parse(sessionStorage.getItem(selectSlot)||'{}');}catch(_){}
  for(const input of document.querySelectorAll('select[id]')){
    if(['rag-provider','rag-embedding-provider'].includes(input.id))continue;
    const value=selectedValues[input.id];if(typeof value==='string'&&[...input.options].some(option=>option.value===value))input.value=value;
    input.addEventListener('change',()=>{selectedValues[input.id]=input.value;try{sessionStorage.setItem(selectSlot,JSON.stringify(selectedValues));}catch(_){}});
  }
  for(const id of ['delete','clear-files']){const b=$(id);if(!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',trash);}
  window.RagConsole={
    connected:connectedTo,refresh,invalidate,refreshSummaries,transportChanged,
    clusterReady:ctx=>{setConnection('ready','Qdrant: '+new URL(ctx.base).host+' /readyz: 200');},
    afterMutation:async()=>{await inspect();renderInventory();refreshSummaries();},
    revealDocuments:()=>{setView('collection');collection.open=true;setTab('points');$('records').scrollIntoView({block:'start',behavior:'smooth'});sizeRecordPanels();},
    revealField:field=>{if(settings.contains(field))setSettings(true);if(collection.contains(field)){collection.open=true;if(vectorization.contains(field)||$('model-prefixes').contains(field))setTab('vectorization');else if(panels.add.contains(field))setTab('add');else if(panels.search.contains(field))setTab('search');else if(panels.settings.contains(field))setTab(['indexes','snapshots','config'].find(id=>panels[id].contains(field))||'settings');}},
    revealEditor:()=>{collection.open=true;setTab('add');editorDetails.open=true;},
    connecting:()=>setConnection('connecting','Проверка подключения к кластеру…'),
    connectionFailed:()=>{
      connected=false;createForm.hidden=true;renderInventory();
      if(connection.dataset.state==='connecting') setConnection('error','Ошибка подключения. Подробности доступны в строке состояния RAG.');
    }
  };
  let savedSettings;try{savedSettings=sessionStorage.getItem('ai_rag_settings_open');}catch(_){}
  setSettings(savedSettings===null||savedSettings===undefined?!($('qdrant-url').value&&$('qdrant-key').value):savedSettings==='true');setView('collections');setTab('points');renderInventory();
  refreshSummaries();
})();
