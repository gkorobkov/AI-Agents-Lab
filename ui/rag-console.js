// Cluster workspace. Embeddings are optional until a text vector operation is run.
(() => {
  if (!window.RagWorkbench) return;
  const api = RagWorkbench, $ = id => document.getElementById('rag-' + id);
  const el = (tag,text,cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  const trash='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  const pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  const snapshotIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 8h4l2-3h4l2 3h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="14" r="3"/></svg>';
  const button=(text,fn,remove=false)=>{const n=el('button',undefined,remove?'small danger':'small');n.type='button';if(remove)n.innerHTML=trash;n.append(document.createTextNode(text));n.onclick=fn;return n;};
  function iconButton(title,icon,action,danger=false){
    const control=button('',action,danger);
    control.title=title;control.setAttribute('aria-label',title);control.innerHTML=icon;
    return control;
  }
  const field=(title,id,value='',tag='input')=>{const l=el('label',title),n=el(tag);n.id='rag-'+id;n.value=value;l.append(n);return l;};
  const json=(value,caption='JSON')=>{const d=el('details',undefined,'debug-section rag-json-panel'),heading=el('summary',caption),pre=el('pre');d.append(heading,pre);JsonViewer.create({pre,heading}).update(JSON.stringify(value,null,2));return d;};
  function helpControl(host,title,text,anchor=host){
    const icon=el('span','?','api-help');icon.setAttribute('role','button');icon.tabIndex=0;icon.setAttribute('aria-label','Справка: '+title);icon.dataset.helpPath='RAG · '+title;icon.dataset.helpText=text;host.append(icon);icon.addEventListener('click',event=>{event.stopPropagation();event.preventDefault();});FieldHelp.attach(icon,null,anchor);return icon;
  }
  const columnHelp={
    'Коллекция':'Нажмите имя коллекции, чтобы открыть её документы, поиск и настройки. Поле «Найти коллекцию» фильтрует полученный список по части имени без учёта регистра и дополнительных запросов к кластеру.',
    'Статус':'Колонка Статус показывает состояние коллекции Qdrant. green — готова, yellow — оптимизация, red — ошибка. Это не статус соединения с сервером.',
    'Точки':'Колонка Точки показывает число записей в коллекции. Один загруженный документ может создать несколько точек: по одной на фрагмент текста.',
    'Сегменты':'Колонка Сегменты показывает число внутренних блоков хранения и индексации Qdrant. Они создаются и объединяются автоматически.',
    'Шарды':'Колонка Шарды показывает число частей, на которые Qdrant делит коллекцию для хранения и распределения нагрузки.',
    'Векторы · Размерность и метрика':'Размерность — число координат вектора. Метрика — способ сравнения векторов при поиске. Например, «test10 (2048 · Dot)» — вектор test10 размерности 2048 со скалярным произведением.'
  };
  const object=id=>{const v=JSON.parse($(id).value);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Нужен JSON-объект.');return v;};
  let cancelled = false;
  const confirmAction=message=>{const accepted=window.confirm(message);if(!accepted)cancelled=true;return accepted;};
  const typed=name=>{const accepted=prompt('Введите «'+name+'» для подтверждения. Действие изменяет данные коллекции.')===name;if(!accepted)cancelled=true;return accepted;};
  let epoch=0,collections=[],details=new Map(),connected=false,current='',tab='points',view='collections';
  let collectionsLoaded=false;
  const connectHint='Подключите базу знаний и обновите список';
  let restored={};try{restored=JSON.parse(sessionStorage.getItem('ai_rag_workspace')||'{}');}catch(_){}
  let addSource=restored.addSource==='file'||restored.tab==='import'?'file':'text';
  let lookupMode=restored.lookupMode==='json'||restored.tab==='raw'?'json':'text';
  const remember=()=>{if(!connected)return;try{sessionStorage.setItem('ai_rag_workspace',JSON.stringify({current,tab,view,addSource,lookupMode}));}catch(_){}};
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
    qdrantState=state;
    qdrantMessage=message;
    renderConnection();
  }
  let qdrantState='offline',qdrantMessage='',embeddingReady=false,qdrantVersion;
  function renderConnection() {
    const qdrantReady=['ready','online'].includes(qdrantState);
    connection.dataset.state=qdrantReady&&embeddingReady?'online':qdrantReady||embeddingReady?'connecting':qdrantState;
    const message='Qdrant: '+qdrantMessage+'\nOpenAI API: '+(embeddingReady?'Список моделей получен.':'Список моделей не подтверждён.')+'\nСерый — ни одно подключение не подтверждено. Жёлтый — подтверждено одно подключение или идёт проверка Qdrant. Красный — ошибка Qdrant без подтверждённого подключения OpenAI API. Зелёный — Qdrant готов и OpenAI API вернул список моделей. Для этого нажмите «Проверить подключение» и «Получить список».';
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
  const settingsGroup=el('div',undefined,'rag-settings-group');bar.before(settingsGroup);settingsGroup.append(bar,settings);
  const provider=$('provider').closest('label');
  for (const child of [...provider.childNodes]) if (child.nodeType===Node.TEXT_NODE) child.remove();
  provider.classList.add('rag-provider-control');
  bar.append(headingTitle,$('status'),connection,settingsToggle);heading.remove();
  bar.addEventListener('click',event=>{if(!event.target.closest('button,a,label,input,select,.api-help')&&getSelection().isCollapsed)setSettings(settings.hidden);});
  const connections=el('div',undefined,'rag-connections');
  const providerSelect=$('embedding-provider');
  const sharedProfiles=parent.OpenAIProviderProfiles;
  const providerControl=el('div',undefined,'rag-embedding-provider-control connection-provider connection-profile-row');
  const embeddingProviderLabel=providerSelect.closest('label');
  embeddingProviderLabel.querySelector('span').classList.add('sr-only');
  const providerActions=el('span',undefined,'connection-profile-actions');
  const providerNotice=el('p','Этот профиль используется в Chat.','hint rag-provider-usage');
  const providerProfile=el('div',undefined,'rag-shared-profile');
  providerProfile.append(providerControl,providerNotice);
  function changeProfile(action, values) {
    try {
      const id=sharedProfiles.change(providerSelect.value,action,values);
      api.refreshEmbeddingProviders(id);
      providerSelect.dispatchEvent(new Event('change',{bubbles:true}));
    } catch (error) { api.status(error.message,true); }
  }
  function profileAction(title, icon, action) {
    const control=iconButton(title,icon,action);
    providerActions.append(control);
    return control;
  }
  const renameProfile=profileAction('Переименовать профиль OpenAI API',pencil,()=>{
    const name=el('input');
    name.value=providerSelect.selectedOptions[0].textContent;
    name.setAttribute('aria-label','Имя профиля OpenAI API');
    embeddingProviderLabel.hidden=true;
    providerControl.prepend(name);
    function finish(save) {
      if (!name.isConnected) return;
      name.remove();
      embeddingProviderLabel.hidden=false;
      if (save && name.value.trim() !== providerSelect.selectedOptions[0].textContent) changeProfile('update',{name:name.value.trim()});
    }
    name.addEventListener('blur',()=>finish(true));
    name.addEventListener('keydown',event=>{
      if (event.key!=='Enter' && event.key!=='Escape') return;
      event.preventDefault();
      finish(event.key==='Enter');
      renameProfile.focus();
    });
    name.focus();name.select();
  });
  const cloneProfile=profileAction('Клонировать профиль OpenAI API','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',()=>changeProfile('clone'));
  const deleteProfile=profileAction('Удалить профиль OpenAI API',trash,()=>{
    const id=providerSelect.value;
    const dialog=el('dialog',undefined,'rag-confirm-dialog');
    const message=el('p','Удалить общий профиль «'+providerSelect.selectedOptions[0].textContent+'»?');
    const actions=el('div',undefined,'actions');
    const cancel=button('Отмена',()=>dialog.close());
    cancel.autofocus=true;
    actions.append(cancel,button('Удалить',()=>{
      dialog.close();
      if (providerSelect.value===id) changeProfile('delete');
    },true));
    dialog.setAttribute('aria-label','Удаление профиля OpenAI API');
    dialog.append(message,actions);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);
    dialog.showModal();
  });
  function syncProviderActions() {
    const id=providerSelect.value;
    renameProfile.disabled=cloneProfile.disabled=!id;
    deleteProfile.disabled=!id || !sharedProfiles.canDelete(id);
    providerNotice.classList.toggle('is-inactive',!id || id!==sharedProfiles.active());
  }
  providerControl.append(embeddingProviderLabel,providerActions);
  providerSelect.addEventListener('change',syncProviderActions);
  new MutationObserver(syncProviderActions).observe(providerSelect,{childList:true});
  window.addEventListener('storage',event=>{if(event.key==='ai_openai_active_profile') syncProviderActions();});
  syncProviderActions();
  const embeddingDocs=el('a','Описание →');
  embeddingDocs.href='docs.html#embeddings';
  embeddingDocs.target='_blank';
  embeddingDocs.rel='noopener';
  const embeddingModels=el('div',undefined,'rag-embedding-models');
  const collectionChoice=$('collection').closest('label');
  collectionChoice.classList.add('rag-collection-choice');
  const checkConnection = $('connect');
  checkConnection.textContent='Получить коллекции';
  const clusterCheck=button('Проверить подключение',()=>api.checkCluster());
  clusterCheck.id='rag-check-cluster';
  const clusterStatus=el('span',undefined,'hint');clusterStatus.id='rag-cluster-status';clusterStatus.setAttribute('role','status');
  settings.append(connections);
  const ragProfileSelect=el('select');ragProfileSelect.id='rag-connection-profile';provider.append(ragProfileSelect);$('provider').hidden=true;
  CompactSelect.attach(ragProfileSelect, {label:'RAG-система'});
  CompactSelect.attach(providerSelect, {label:'Профиль векторизации OpenAI API'});
  const qdrantList=el('div',undefined,'connection-list');
  const qdrantResource=el('div',undefined,'connection-resource');collectionChoice.hidden=true;$('collection').removeAttribute('list');
  function createLogs(anchor, channel, {retainAll = false, collection} = {}) {
    const entries=[];
    let logHost, logList, filter, primaryUrl='', expanded=new Set(), displayedCollection;
    const render=()=>{
      const query=filter.value.trim().toLowerCase();
      const scoped=collection?entries.filter(entry=>entry.collection===collection()):entries;
      const visible=scoped.filter(entry=>HttpDebug.clean(entry.request.url).toLowerCase().includes(query));
      logList.replaceChildren(...visible.map(entry=>{
        const row=HttpDebug.record(entry,()=> 'ru',{open:expanded.has(entry)});
        row.addEventListener('toggle',()=>{if(row.open)expanded.add(entry);else expanded.delete(entry);});
        return row;
      }));
      if (!visible.length) logList.append(el('p',scoped.length?'Запросы с таким URL не найдены.':'Запросов пока нет.','hint'));
    };
    const logs=button('view logs',null);
    logs.classList.add('http-debug-log-link');
    FieldHelp.attach(logs,()=>{
      logHost=el('div',undefined,'http-debug-log');
      const label=el('label','View logs','http-debug-filter help-parameter-path');
      filter=el('input');
      filter.type='search';filter.placeholder='Фильтр по URL';filter.setAttribute('aria-label','Фильтр по URL');
      displayedCollection=collection?.();
      filter.value=collection?'':HttpDebug.clean(primaryUrl || entries[0]?.request.url || '');
      filter.addEventListener('input',render);
      const clearFilter=button('Сбросить',()=>{filter.value='';render();filter.focus();});
      clearFilter.title='Очистить фильтр URL';clearFilter.setAttribute('aria-label',clearFilter.title);
      clearFilter.classList.add('http-debug-log-clear');
      label.append(filter);
      logList=el('div',undefined,'http-debug-log-list');
      const heading=el('div',undefined,'http-debug-log-heading');
      const close=button('×',()=>{FieldHelp.hide();logs.focus({preventScroll:true});});
      close.classList.add('http-debug-log-close');
      close.title='Закрыть журнал';close.setAttribute('aria-label',close.title);
      heading.append(label,clearFilter,close);logHost.append(heading,logList);
      expanded=new Set();
      render();
      return logHost;
    },anchor,{openOnHover:false,persistOnScroll:true});
    if(collection) document.addEventListener('rag:collection-selected',()=>{
      const name=collection();
      if(!logHost?.isConnected||name===displayedCollection)return;
      if(!name){FieldHelp.hide();return;}
      displayedCollection=name;filter.value='';expanded.clear();render();
    });
    document.addEventListener('rag:logs-reset',event=>{
      if (event.detail!==channel) return;
      entries.length=0;
      primaryUrl='';
      expanded.clear();
      if (logHost?.isConnected) render();
    });
    document.addEventListener('rag:http',event=>{
      const record=event.detail;
      if(collection?!record.collection:record.channel!==channel||(!channel&&record.collection)) return;
      const entry={collection:record.collection,action:record.action,startedAt:record.startedAt,request:{method:record.method,url:record.url,...record.request},status:'Ожидание'};
      if (retainAll && !primaryUrl) primaryUrl=entry.request.url;
      entries.unshift(entry);
      if (!retainAll) entries.splice(parent.ragDefaults.connectionLogMax);
      if (logHost?.isConnected) render();
      const complete=record.complete;
      record.complete=result=>{
        complete?.(result);
        entry.status=result.status;entry.ms=result.ms;entry.clientIssue=result.clientIssue;entry.response={headers:result.headers||{},body:result.response};
        if (logHost?.isConnected && entries.includes(entry)) render();
      };
    });
    return logs;
  }
  const logs=createLogs(qdrantResource);
  qdrantResource.append(clusterCheck);
  helpControl(qdrantResource,'Подключение к кластеру','Кнопка проверяет готовность сервера через GET /readyz и читает версию Qdrant через GET /. Оба запроса видны в журнале. Если указан API-ключ, он передаётся в заголовке api-key. Флажок use Proxy определяет маршрут запросов.');
  qdrantResource.append(logs,clusterStatus);qdrantList.append(qdrantResource,collectionChoice);
  const embeddingResource=el('div',undefined,'connection-resource rag-model-inventory');
  const embeddingConnect=button('Получить список',()=>api.loadModels());
  embeddingConnect.id='rag-embedding-connect';
  const modelCaption=el('span',undefined,'rag-field-caption'),modelCount=el('span','Список моделей (…)');
  modelCaption.append(modelCount);
  helpControl(modelCaption,'Список моделей','Модели провайдера по текущему URL OpenAI API. Модель эмбеддингов выбирается в настройках конкретного действия внутри коллекции.');
  const modelList=el('ul',undefined,'rag-model-list'),modelBox=el('div',undefined,'rag-model-box');
  modelList.setAttribute('aria-label','Доступные модели');modelList.tabIndex=0;
  const onlyEmbeddings=el('input');onlyEmbeddings.type='checkbox';onlyEmbeddings.checked=true;
  const filterModels=el('label',undefined,'rag-model-filter');filterModels.append(onlyEmbeddings,'only Embeddings');
  const modelDetailsEnabled=parent.ragDefaults.modelDetailsEnabled;
  embeddingResource.classList.toggle('rag-model-expanded',modelDetailsEnabled);
  if (!modelDetailsEnabled) modelBox.classList.add('rag-model-box-compact');
  const modelActions=el('div',undefined,'rag-model-actions'),modelLogRow=el('div',undefined,'rag-model-log-row');
  modelLogRow.append(createLogs(embeddingResource,'models'),$('embedding-status'));
  const embeddingPurpose=el('div','Векторизация','connection-caption');
  helpControl(embeddingPurpose,'Векторизация','Провайдер создаёт эмбеддинги для загрузки документов и семантического поиска через POST /embeddings. Модель выбирается в настройках коллекции.');
  modelActions.append(embeddingPurpose,modelCaption);
  modelActions.append(filterModels);
  modelActions.append(modelLogRow);
  modelLogRow.prepend(embeddingConnect);
  if (modelDetailsEnabled) modelLogRow.before(embeddingConnect);
  const modelDetails=el('div',undefined,'rag-model-details');modelDetails.hidden=true;
  modelBox.append(modelList);
  embeddingResource.append(modelActions,modelBox,modelDetails);
  embeddingModels.append(embeddingResource);embeddingModels.classList.add('connection-list');
  const attachEmbeddingPicker=input=>ModelPicker.attach(input, {language:()=> 'ru',getIds:async()=>{
    if (modelState!=='ready') await api.loadModels(current);
    if (modelState==='error') throw new Error($('embedding-status').textContent);
    return availableModels.filter(model=>model.type==='embedding'||!model.type).map(model=>model.id);
  }});
  let availableModels=[],modelState='',selectedModel=null;
  function renderModelDetails() {
    modelDetails.hidden=!selectedModel;
    modelDetails.replaceChildren();
    if (selectedModel) {
      const viewer=json(HttpDebug.clean(selectedModel));
      viewer.open=true;
      modelDetails.append(viewer);
    }
    modelList.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.model===selectedModel?.id)));
  }
  function renderModelList() {
    const visible=onlyEmbeddings.checked?availableModels.filter(model=>model.type==='embedding'):availableModels;
    if (!visible.includes(selectedModel)) selectedModel=null;
    modelList.replaceChildren(...visible.map(model=>{
      const row=el('li');
      if (!modelDetailsEnabled) {
        const name=el('span',model.id);name.title=model.id;row.append(name);return row;
      }
      const item=button(model.id,()=>{
        selectedModel=model;
        renderModelDetails();
      });
      item.className='rag-model-item';item.dataset.model=model.id;item.title=model.id;
      row.append(item);return row;
    }));
    if (!visible.length) {
      const placeholder=modelState==='ready'?(availableModels.length?'Нет моделей с типом embedding.':'Список пуст.'):'Здесь появятся модели';
      modelList.append(el('li',placeholder,'rag-model-placeholder'));
    }
    modelList.dataset.empty=String(!visible.length);
    renderModelDetails();
  }
  onlyEmbeddings.addEventListener('change',renderModelList);
  renderModelList();
  document.addEventListener('rag:models',({detail:{state,models}})=>{
    modelState=state;
    availableModels=models;
    embeddingConnect.disabled=state==='loading';
    modelCount.textContent='Список моделей ('+(state==='ready'?models.length:'…')+')';
    renderModelList();
    embeddingReady=state==='ready';renderConnection();
  });
  for (const card of [
    {title:'RAG-система', help:'Профиль Qdrant хранит адрес, API-ключ и маршрут подключения к векторной базе. Кнопки рядом со списком управляют локальным профилем.', links:[$('qdrant-cloud')], profile:provider, url:$('qdrant-url'), key:$('qdrant-key'), connection:qdrantList},
    {title:'OpenAI API', help:'Изменения сохранённого профиля применяются везде, где он выбран. API-ключ общий для сохранённых профилей OpenAI API.', links:[embeddingDocs], profile:providerProfile, url:$('neuraldeep-url'), key:$('neuraldeep-key'), connection:embeddingModels}
  ]) connections.append(ProviderPanel.create({...card, helpControl, className:'rag-settings-fields'}));
  const tabs=el('nav',undefined,'rag-console-tabs');tabs.setAttribute('aria-label','Разделы кластера');$('workbench').before(tabs);
  const inventory=el('section'),aliases=el('section'),collection=el('div');inventory.id='rag-inventory';aliases.id='rag-aliases-panel';collection.id='rag-collection-panel';$('workbench').append(inventory,aliases,collection);
  const count=el('span','Коллекции (...)'),filter=el('input');filter.placeholder='Найти коллекцию';filter.setAttribute('aria-label','Поиск коллекции');filter.oninput=renderInventory;
  const clearFilter=button('×',()=>{filter.value='';renderInventory();filter.focus();});
  clearFilter.classList.add('rag-clear-filter');
  clearFilter.title='Очистить поиск коллекций';clearFilter.setAttribute('aria-label',clearFilter.title);
  const collectionStatus=el('span',undefined,'hint');collectionStatus.id='rag-collections-status';collectionStatus.setAttribute('role','status');
  const createButton=button('Добавить коллекцию',()=>setView('create'));
  createButton.dataset.view='create';createButton.setAttribute('role','tab');createButton.setAttribute('aria-controls','rag-create-form');
  bar.insertBefore(collectionStatus,connection);
  const createForm=el('fieldset',undefined,'rag-create-form rag-form-panel');createForm.id='rag-create-form';createForm.hidden=true;
  createForm.append(el('h3','Новая коллекция'),field('Имя коллекции','new-collection'));
  const vectorMetrics=['Cosine','Dot','Euclid','Manhattan'];
  const distance=field('Метрика','distance','','select');vectorMetrics.forEach(v=>distance.lastChild.append(new Option(v,v)));createForm.append($('dimensions').closest('label'),distance,field('Имя вектора · необязательно','new-vector-name'));
  createForm.append(el('p','Задайте размерность и метрику для новой коллекции. Размерность существующего вектора изменить нельзя.','hint'),button('Создать',()=>{const name=$('new-collection').value.trim();if(!name)return api.status('Введите имя коллекции.',true);$('collection').value=name;$('create-collection').click();}));inventory.append(createForm);$('distance').value=parent.ragDefaults.distance;
  const tableHost=el('div',undefined,'rag-table-scroll');tableHost.tabIndex=0;tableHost.setAttribute('aria-label','Список коллекций');inventory.append(tableHost);
  const inventoryTable=el('table',undefined,'rag-collection-table'),inventoryHead=el('thead'),inventoryHeadRow=el('tr'),inventoryBody=el('tbody');inventoryHead.append(inventoryHeadRow);inventoryTable.append(inventoryHead,inventoryBody);tableHost.append(inventoryTable);
  for(const name of ['Коллекция','Статус','Точки','Сегменты','Шарды','Векторы · Размерность и метрика','Действия']){
    const cell=el('th'),[heading,subtitle]=name.split(' · ');
    cell.scope='col';
    const header=name==='Коллекция'?el('div',undefined,'rag-collection-column'):cell;
    header.append(el('span',subtitle?heading+': ':heading));
    if(name==='Действия') cell.classList.add('rag-collection-actions-cell');
    if(columnHelp[name]) helpControl(header,name,columnHelp[name]);
    if(subtitle) header.append(el('br'),document.createTextNode(subtitle));
    if(name==='Коллекция'){header.append(filter,clearFilter);cell.append(header);}
    inventoryHeadRow.append(cell);
  }
  const crumb=el('header',undefined,'rag-collection-head'),title=el('h2'),stats=el('div',undefined,'rag-stat-strip'),collectionBody=el('div',undefined,'rag-collection-body');crumb.append(title,stats);collection.append(crumb,collectionBody);
  const collectionHint=el('span','Выберите коллекцию. Нажмите кнопку обновления рядом с вкладкой «Коллекции».','hint');
  title.after(collectionHint);
  const tabLayout=el('div',undefined,'rag-collection-layout'), tabBar=el('div',undefined,'rag-collection-tab-bar'), tabContent=el('div',undefined,'rag-collection-tab-content');
  const ctabs=el('nav',undefined,'rag-console-tabs');ctabs.setAttribute('aria-label','Разделы коллекции');
  const layoutToggle=iconButton('Вертикальные вкладки','<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',()=>setTabLayout(ctabs.getAttribute('aria-orientation')!=='vertical'));
  function setTabLayout(vertical){
    tabLayout.classList.toggle('is-vertical',vertical);
    ctabs.setAttribute('aria-orientation',vertical?'vertical':'horizontal');
    layoutToggle.setAttribute('aria-pressed',String(vertical));
    try{localStorage.setItem('ai_rag_vertical_tabs',String(vertical));}catch(_){}
  }
  let verticalTabs=false;
  try{verticalTabs=localStorage.getItem('ai_rag_vertical_tabs')==='true';}catch(_){}
  setTabLayout(verticalTabs);
  tabBar.append(layoutToggle,ctabs);tabLayout.append(tabBar,tabContent);collectionBody.append(tabLayout);
  function tabGroup(tabButton){
    const group=el('span',undefined,'rag-tab-control');
    group.addEventListener('click',event=>{if(event.target===group&&getSelection().isCollapsed) tabButton.click();});
    const activate=tabButton.onclick;
    tabButton.onclick=event=>{
      const selection=getSelection();
      if(event.detail&&selection&&!selection.isCollapsed&&selection.containsNode(tabButton,true)) return;
      activate(event);
    };
    group.append(tabButton);
    return group;
  }
  const panels={};
  const tabsByTask=[['points','Документы'],['add','Добавить'],['edit','По ID'],['search','Поиск по смыслу'],['config','Параметры'],['indexes','Индексы'],['snapshots','Снимки']];
  for(const [id,name]of tabsByTask){
    const panel=el('div'), b=button(name,()=>setTab(id));
    panel.id='rag-tab-'+id;b.id='rag-collection-tab-'+id;panels[id]=panel;
    panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);tabContent.append(panel);
    b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);ctabs.append(b);
  }
  ctabs.setAttribute('role','tablist');
  const existing=[...workspace.children];
  const addText=$('create-document'),addFiles=existing[1],editor=existing[0];
  const editText=el('div'),raw=el('div');
  editText.id='rag-id-text';raw.id='rag-id-json';
  editText.append($('edit-document'));
  function modeSwitch(label,options,initial,onChange){
    const controls=el('div',undefined,'rag-mode-switch');
    controls.setAttribute('role','group');controls.setAttribute('aria-label',label);
    const choices=options.map(([key,caption,section])=>{
      const control=button(caption,()=>select(key));
      control.setAttribute('aria-controls',section.id);controls.append(control);
      return {key,section,control};
    });
    function select(key){
      for(const choice of choices){
        const active=choice.key===key;
        choice.section.hidden=!active;
        choice.control.setAttribute('aria-pressed',String(active));
      }
      onChange(key);
    }
    select(initial);
    return {controls,select};
  }
  const addModes=modeSwitch('Источник документа',[['text','Из текста',addText],['file','Из файла',addFiles]],addSource,key=>{addSource=key;remember();});
  const lookupModes=modeSwitch('Вид точки',[['text','Документ',editText],['json','Точка · JSON',raw]],lookupMode,key=>{lookupMode=key;remember();});
  panels.add.append(addModes.controls,addText,addFiles);
  editor.append(lookupModes.controls,editText,raw);
  panels.edit.append(editor);panels.points.append(existing[2]);panels.search.append(existing[3]);
  raw.append(field('Полная точка: id, vector, payload','raw-point','{}','textarea'),button('Записать точку JSON',()=>act('Запись точки…',async()=>{
    const point=object('raw-point');
    if(point.id===undefined||!point.vector)throw Error('Укажите id и vector.');
    if(!confirmAction('Записать точку '+point.id+'? Существующая точка с этим ID будет заменена.'))return;
    await api.qdrant(api.context(),'/points?wait=true','PUT',{points:[point]});
    api.loadPoint(point,true);api.resetRecords();
  })),field('Payload · полная замена без изменения вектора','payload-only','{}','textarea'),button('Заменить payload по ID',()=>act('Запись payload…',async()=>{
    const id=api.pointId(),payload=object('payload-only'),ctx=api.context();
    if(!confirmAction('Заменить весь payload точки '+id+'? Вектор останется прежним.'))return;
    await api.qdrant(ctx,'/points/payload?wait=true','PUT',{points:[id],payload});
    api.resetRecords();
    try{
      const point=await api.readPoint(ctx,id,true);
      if(point)api.loadPoint(point,true);
    }catch(error){throw Error('Payload сохранён. Не удалось обновить точку. '+error.message);}
  })));
  $('workbench').replaceChildren(inventory,aliases,createForm,collection);old.remove();
  // Existing handlers retain this field as the selected collection context.
  const hidden=el('div');hidden.hidden=true;hidden.append(aside.querySelector('section'));$('workbench').append(hidden);
  const aliasList=el('div'),aliasFields=el('fieldset',undefined,'rag-alias-fields rag-form-panel');
  aliasFields.append(field('Имя алиаса','alias-name'),field('Целевая коллекция','alias-target','','select'),button('Создать алиас',()=>aliasAction('create')),button('Обновить список',()=>act('Чтение алиасов…',loadAliases)),aliasList);
  aliasFields.prepend(el('h3','Алиасы коллекций'),el('p','Алиас сохраняет одно имя при переключении на другую коллекцию.','hint'));
  aliases.append(aliasFields);
  const indexList=el('div');panels.indexes.append(el('p','Индекс ускоряет фильтрацию. Его удаление не удаляет данные payload.','hint'),field('Имя поля','index-field'),field('Тип','index-type','','select'),button('Создать индекс',()=>act('Создание индекса…',async()=>{const name=$('index-field').value.trim();if(!name)throw Error('Введите имя поля.');await api.qdrant(api.context(),'/index?wait=true','PUT',{field_name:name,field_schema:$('index-type').value});await inspect();renderIndexes();})),indexList);
  ['keyword','integer','float','bool','geo','text','datetime','uuid'].forEach(v=>$('index-type').append(new Option(v,v)));
  const snapshotList=el('div');panels.snapshots.append(button('Обновить',()=>loadSnapshots()),button('Создать снимок',()=>act('Создание снимка…',async()=>{await api.qdrant(api.context(),'/snapshots','POST');await loadSnapshots();})),snapshotList);
  const restore=el('div'),snapshotFileField=field('Файл .snapshot','snapshot-file','','input');
  const snapshotFileInput=snapshotFileField.lastElementChild;
  snapshotFileInput.type='file';snapshotFileInput.accept='.snapshot';
  restore.append(el('h4','Восстановить из файла · заменяет данные'),snapshotFileField,button('Восстановить коллекцию',()=>act('Восстановление снимка…',async()=>{const file=snapshotFileInput.files[0];if(!file)throw Error('Выберите .snapshot файл.');if(!typed(current))return;const ctx=api.context(),body=new FormData();body.append('snapshot',file);const response=await binary(ctx,'/snapshots/upload?wait=true&priority=snapshot','POST',body);await response.json();await inspect();api.resetRecords();})));
  panels.snapshots.append(restore);
  const configData=el('div'),patchField=field('JSON изменений','patch','{}','textarea');
  const patchInput=patchField.lastElementChild;
  patchInput.className='code';patchInput.spellcheck=false;
  const vectorField=field('Поле вектора','config-vector','','select');
  const configVector=vectorField.lastElementChild,vectorDescription=el('span',undefined,'hint rag-config-vector-info');
  const vectorFields=el('div',undefined,'settings-field-grid');
  const collectionFields=el('div',undefined,'settings-field-grid');
  vectorFields.append(vectorField);
  const ownValue=(value,key)=>value&&Object.hasOwn(value,key)?value[key]:undefined;
  const atPath=(value,path)=>path.reduce(ownValue,value);
  const storageLabels={cold:'На диске',cached:'С кешированием',true:'На диске',false:'В памяти'};
  const currentConfig=()=>details.get(current)?.config;
  function denseVectors(){
    const vectors=currentConfig()?.params?.vectors??{};
    return Number.isInteger(vectors.size)?{'':vectors}:vectors;
  }
  const selectedVector=()=>ownValue(denseVectors(),configVector.value);
  const documentVectorField=field('Вектор записи','new-document-vector','','select');
  const documentVector=documentVectorField.lastElementChild;
  const editVectorField=field('Вектор записи','edit-vector','','select');
  const searchVectorField=field('Вектор поиска','search-vector','','select');
  const operationVectors=[documentVector,editVectorField.lastElementChild,searchVectorField.lastElementChild];
  for(const input of operationVectors){input.disabled=true;input.dataset.ragOperationSetting='';}
  const vectorCreator=el('fieldset',undefined,'rag-operation-settings rag-vector-creator');
  const vectorCreateFields=el('div',undefined,'settings-field-grid');
  const vectorNameField=field('Имя вектора','add-vector-name');
  const vectorSizeField=field('Размерность','add-vector-size');
  const vectorMetricField=field('Метрика','add-vector-metric','','select');
  const vectorNameInput=vectorNameField.lastElementChild,vectorSizeInput=vectorSizeField.lastElementChild,vectorMetric=vectorMetricField.lastElementChild;
  vectorNameInput.autocomplete='off';vectorNameInput.spellcheck=false;
  vectorSizeInput.type='number';vectorSizeInput.min='1';vectorSizeInput.step='1';
  vectorMetric.append(...vectorMetrics.map(value=>new Option(value,value)));
  vectorMetric.value=parent.ragDefaults.distance;
  const vectorCreateHint=el('p',undefined,'hint rag-vector-create-hint');
  vectorCreateHint.id='rag-vector-create-hint';
  let returnToNewDocument=false;
  const createVectorButton=button('Создать вектор',async()=>{
    const blocked=vectorCreationBlock();
    if(blocked)return api.status(blocked,true);
    const saved=await api.run('Создание вектора…',async()=>{
      const name=vectorNameInput.value.trim(),size=vectorSizeInput.valueAsNumber;
      if(!name||name==='.'||name==='..')throw Object.assign(Error('Введите имя вектора.'),{fieldId:'add-vector-name'});
      if(Object.hasOwn(denseVectors(),name)||Object.hasOwn(currentConfig()?.params?.sparse_vectors??{},name)){
        throw Object.assign(Error('Вектор с таким именем уже существует.'),{fieldId:'add-vector-name'});
      }
      if(!Number.isSafeInteger(size)||size<1)throw Object.assign(Error('Укажите положительную целую размерность.'),{fieldId:'add-vector-size'});
      const result=await api.qdrant(api.context(),'/vectors/'+encodeURIComponent(name)+'?wait=true','PUT',{dense:{size,distance:vectorMetric.value}});
      if(result===false)throw Error('Qdrant не создал вектор.');
      try{await inspect();renderInventory();}
      catch(error){throw Error('Qdrant принял запрос. Не удалось обновить параметры коллекции. '+error.message);}
      if(!Object.hasOwn(denseVectors(),name))throw Error('Qdrant принял запрос. Вектор ещё не появился в схеме коллекции. Обновите список коллекций.');
      configVector.value=name;syncConfigInputs();
      documentVector.value=name;
      api.persist();
      vectorNameInput.value='';vectorSizeInput.value='';
      api.status('Создан вектор «'+name+'».');
    },undefined,createVectorButton);
    if(saved&&returnToNewDocument){returnToNewDocument=false;setTab('add');documentVector.focus({preventScroll:true});}
  });
  vectorCreator.append(el('legend','Новый именованный вектор'),vectorCreateFields,vectorCreateHint,createVectorButton);
  vectorCreateFields.append(vectorNameField,vectorSizeField,vectorMetricField);
  const vectorShortcut=button('Создать вектор…',()=>{
    const size=measuredModels.get(api.embeddingIdentity('new-model'));
    if(vectorCreationBlock()){
      if(size&&!$('new-collection').value.trim())$('dimensions').value=size;
      setView('create');$('new-collection').focus();
      return;
    }
    if(size&&!vectorSizeInput.value)vectorSizeInput.value=size;
    returnToNewDocument=true;setTab('config');vectorNameInput.focus();
  });
  vectorShortcut.classList.add('rag-vector-shortcut');
  function vectorCreationBlock(){
    if(Object.hasOwn(denseVectors(),''))return 'В коллекции безымянный вектор. Создайте новую коллекцию с именованным вектором.';
    const version=qdrantVersion?.match(/^v?(\d+)\.(\d+)/i);
    if(version&&(Number(version[1])<1||(Number(version[1])===1&&Number(version[2])<18))){
      return 'Добавление вектора требует Qdrant 1.18+. В текущей версии можно создать новую коллекцию.';
    }
    return '';
  }
  function syncVectorCreation(){
    const reason=vectorCreationBlock();
    vectorCreator.disabled=Boolean(reason);
    vectorCreateHint.textContent=vectorCreateHint.title=reason||'Qdrant 1.18+ · Размерность должна совпадать с выходом модели.';
    vectorShortcut.textContent=reason?'Новая коллекция…':'Создать вектор…';
    vectorShortcut.title=reason||'Задать размерность и метрику нового вектора в параметрах коллекции.';
  }
  function syncOperationVectors(){
    const values=Object.entries(denseVectors()).filter(([,vector])=>Number.isInteger(vector?.size)&&!vector.multivector_config);
    for(const input of operationVectors){
      const previous=input.disabled?undefined:input.selectedOptions[0]?.value;
      input.replaceChildren(...values.map(([name,vector])=>new Option((name||'Без имени')+' · '+vector.size+' · '+vector.distance,name)));
      const preferred=previous??api.operationValue(input.id.slice(4),api.defaultVectorName);
      if(values.some(([name])=>name===preferred))input.value=preferred;
      if(!values.length)input.append(new Option('Нет подходящего вектора',''));
      input.disabled=!values.length;
    }
  }
  function storageKey(patch){
    const pending=atPath(patch,['vectors',configVector.value]);
    if(ownValue(pending,'memory')!==undefined) return 'memory';
    if(ownValue(pending,'on_disk')!==undefined) return 'on_disk';
    return selectedVector()?.memory!=null?'memory':'on_disk';
  }
  const descriptors=[
    {id:'vector-storage',title:'Хранение векторов',vector:true,storage:true,help:'Режим хранения выбранного вектора. Хранение на диске снижает расход оперативной памяти, но чтение может занять больше времени.'},
    {id:'hnsw-m',title:'Связей HNSW (m)',vector:true,path:['hnsw_config','m'],min:0,help:'Число связей узла в графе HNSW. Значение 0 отключает создание графа для этого вектора.'},
    {id:'hnsw-ef',title:'HNSW ef_construct',vector:true,path:['hnsw_config','ef_construct'],min:1,help:'Размер списка кандидатов при построении индекса. Большие значения обычно увеличивают время построения.'},
    {id:'index-threshold',title:'Порог индексации, КБ',path:['optimizers_config','indexing_threshold'],current:['optimizer_config','indexing_threshold'],min:0,help:'Порог, после которого сегмент индексируется. Значение 0 отключает индексацию векторов.'},
    {id:'replicas',title:'Число реплик',path:['params','replication_factor'],min:1,help:'Число копий каждого шарда коллекции.'},
    {id:'write-consistency',title:'Подтверждений записи',path:['params','write_consistency_factor'],min:1,help:'Минимальное число реплик, которые должны подтвердить запись.'}
  ];
  function pathFor(descriptor,patch){
    const path=descriptor.storage?[storageKey(patch)]:descriptor.path;
    return descriptor.vector?['vectors',configVector.value,...path]:path;
  }
  function updatePath(value,[key,...rest],next){
    if(rest.length){
      const existing=ownValue(value,key);
      const child=existing&&typeof existing==='object'&&!Array.isArray(existing)?{...existing}:{};
      updatePath(child,rest,next);
      next=Object.keys(child).length?child:undefined;
    }
    if(next===undefined) delete value[key];
    else Object.defineProperty(value,key,{value:next,writable:true,configurable:true,enumerable:true});
  }
  for(const descriptor of descriptors){
    const {title,id,storage,min,help,vector}=descriptor;
    const label=field('',id,'',storage?'select':'input'),input=label.lastElementChild;
    const caption=el('span',title,'rag-field-caption');
    label.prepend(caption);helpControl(caption,title,help,label);
    if(!storage){input.type='number';input.min=min;input.step='1';}
    descriptor.input=input;
    input.addEventListener(storage?'change':'input',()=>{
      if(!input.validity.valid)return;
      const patch=object('patch'),path=pathFor(descriptor,patch);
      const value=input.value===''?undefined:storage?(path.at(-1)==='memory'?input.value:input.value==='true'):input.valueAsNumber;
      updatePath(patch,path,value);
      patchInput.value=JSON.stringify(patch,null,2);
    });
    (vector?vectorFields:collectionFields).append(label);
  }
  function syncConfigInputs(refreshVectors=false){
    const vectors=denseVectors(), names=Object.keys(vectors);
    if(refreshVectors){
      const previous=configVector.value;
      configVector.replaceChildren(...names.map(name=>new Option(name||'Без имени',name)));
      if(names.includes(previous)) configVector.value=previous;
    }
    configVector.disabled=!names.length;
    const vector=selectedVector();
    vectorDescription.textContent=vector?'Размерность '+vector.size+' · '+vector.distance:'Плотные векторы не настроены.';
    let patch;
    try{patch=object('patch');}catch(_){}
    patchInput.setCustomValidity(patch?'':'Введите корректный JSON-объект.');
    for(const descriptor of descriptors){
      const {input,storage}=descriptor;
      input.disabled=!patch||(descriptor.vector&&!vector);
      if(!patch)continue;
      const path=pathFor(descriptor,patch), pending=atPath(patch,path);
      if(storage){
        const key=path.at(-1), saved=vector?.[key];
        const choices=key==='memory'?['cached','cold']:['false','true'];
        input.replaceChildren(new Option(saved==null?'Без изменений':'Текущее · '+(storageLabels[saved]??saved),''),
          ...choices.map(value=>new Option(storageLabels[value],value)));
      }else{
        const saved=descriptor.vector?atPath(vector,descriptor.path)??atPath(currentConfig(),descriptor.path):atPath(currentConfig(),descriptor.current??descriptor.path);
        input.placeholder=saved==null?'Без изменений':String(saved);
      }
      input.value=pending??'';
    }
  }
  patchInput.addEventListener('input',()=>syncConfigInputs());
  configVector.addEventListener('change',()=>syncConfigInputs());
  const configActions=el('div',undefined,'actions');
  configActions.append(button('Применить параметры',()=>{
    if(!patchInput.reportValidity()||descriptors.some(({input})=>!input.reportValidity()))return;
    return act('Обновление параметров…',async()=>{
      const patch=object('patch');
      if(!Object.keys(patch).length)throw Error('Укажите параметры изменения.');
      if(!confirmAction('Применить параметры к коллекции «'+current+'»?'))return;
      if(await api.qdrant(api.context(),'','PATCH',patch)===false)throw Error('Qdrant не применил параметры.');
      patchInput.value='{}';
      syncConfigInputs();
      try{await inspect();renderInventory();}
      catch(error){throw Error('Параметры сохранены. Не удалось обновить данные коллекции. '+error.message);}
    });
  }),button('Удалить коллекцию',()=>confirmCollectionDeletion(current),true));
  panels.config.append(el('h3','Векторы'),vectorFields,vectorDescription,vectorCreator,el('h3','Индексация и репликация'),collectionFields,patchField,configActions,configData);
  const tabHelp={
    points:'Список документов. Нажмите строку с текстом, чтобы прочитать её полностью.',
    add:'Добавление документа из текста или файла. Оба источника используют выбранную модель, вектор записи и параметры разбиения.',
    edit:'Поиск точки по ID. Режим «Документ» редактирует текст и метаданные. Режим «Точка · JSON» показывает вектор и payload и позволяет менять их вручную.',
    search:'Семантический поиск ближайших векторов по всей коллекции.',
    config:'Конфигурация коллекции и изменение поддерживаемых параметров Qdrant.',
    indexes:'Управление индексами полей payload.',
    snapshots:'Создание, скачивание, удаление и восстановление снимков.'
  };
  let tabDrag;
  function saveTabOrder(){
    try{localStorage.setItem('ai_rag_collection_tab_order',JSON.stringify([...ctabs.querySelectorAll('[data-tab]')].map(b=>b.dataset.tab)));}catch(_){}
  }
  for(const b of ctabs.querySelectorAll('[data-tab]')){
    const group=tabGroup(b);ctabs.append(group);
    helpControl(group,b.textContent,tabHelp[b.dataset.tab]);
    const handle=el('span','⠿','rag-tab-handle');
    handle.title='Перетащить вкладку';handle.setAttribute('aria-hidden','true');group.append(handle);
    handle.addEventListener('pointerdown',event=>{
      if(!event.isPrimary||event.button!==0||tabDrag)return;
      event.preventDefault();
      tabDrag={group,id:event.pointerId,x:event.clientX,y:event.clientY,original:[...ctabs.children]};
      ctabs.setPointerCapture(event.pointerId);
    });
  }
  ctabs.addEventListener('pointermove',event=>{
    if(tabDrag?.id!==event.pointerId)return;
    if(!tabDrag.active){
      if(Math.hypot(event.clientX-tabDrag.x,event.clientY-tabDrag.y)<5)return;
      tabDrag.active=true;tabDrag.group.classList.add('is-dragging');
    }
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.rag-tab-control');
    if(target?.parentElement!==ctabs||target===tabDrag.group)return;
    const groups=[...ctabs.children],rect=target.getBoundingClientRect();
    const after=groups.indexOf(target)>groups.indexOf(tabDrag.group);
    const vertical=ctabs.getAttribute('aria-orientation')==='vertical';
    const pastMiddle=vertical?event.clientY>rect.top+rect.height/2:event.clientX>rect.left+rect.width/2;
    if(after!==pastMiddle)return;
    const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const before=animate?groups.map(group=>group.getBoundingClientRect()):[];
    ctabs.insertBefore(tabDrag.group,after?target.nextSibling:target);
    if(animate) groups.forEach((group,index)=>{
      if(group===tabDrag.group)return;
      group.getAnimations().forEach(animation=>animation.cancel());
      const rect=group.getBoundingClientRect(),x=before[index].left-rect.left,y=before[index].top-rect.top;
      if(x||y) group.animate([{transform:'translate('+x+'px,'+y+'px)'},{transform:'none'}],{duration:150,easing:'ease-out'});
    });
  });
  function finishTabDrag(cancel){
    if(!tabDrag)return;
    const {group,id,original,active}=tabDrag;
    tabDrag=null;
    group.classList.remove('is-dragging');
    if(active){if(cancel)ctabs.append(...original);else saveTabOrder();}
    if(ctabs.hasPointerCapture(id)) ctabs.releasePointerCapture(id);
  }
  ctabs.addEventListener('pointerup',event=>{if(tabDrag?.id===event.pointerId)finishTabDrag(false);});
  ctabs.addEventListener('lostpointercapture',()=>finishTabDrag(true));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tabDrag)finishTabDrag(true);});
  try{
    const order=JSON.parse(localStorage.getItem('ai_rag_collection_tab_order')||'[]');
    const groups=new Map([...ctabs.querySelectorAll('[data-tab]')].map(b=>[b.dataset.tab,b.parentElement]));
    if(Array.isArray(order)) ctabs.prepend(...[...new Set(order.map(id=>id==='import'?'add':id==='raw'?'edit':id))].map(id=>groups.get(id)).filter(Boolean));
  }catch(_){}
  ctabs.addEventListener('keydown',event=>{
    const buttons=[...ctabs.querySelectorAll('[role=tab]')],index=buttons.indexOf(event.target);
    if(index<0) return;
    const vertical=ctabs.getAttribute('aria-orientation')==='vertical';
    const step=event.key===(vertical?'ArrowDown':'ArrowRight')?1:event.key===(vertical?'ArrowUp':'ArrowLeft')?-1:0;
    const next=step?buttons[(index+step+buttons.length)%buttons.length]:event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):null;
    if(next&&event.altKey&&step){
      event.preventDefault();
      const group=next.parentElement;
      ctabs.insertBefore(event.target.parentElement,step>0?group.nextSibling:group);
      event.target.focus();saveTabOrder();return;
    }
    if(next){event.preventDefault();next.focus();next.click();}
  });
  const documentCount=el('span','Документы (…)');
  const documentTab=ctabs.querySelector('[data-tab="points"]');
  documentTab.replaceChildren(documentCount);
  const refreshDocuments=$('browse');
  refreshDocuments.title='Обновить документы';
  refreshDocuments.classList.add('rag-documents-refresh');
  const documentTabGroup=documentTab.parentElement;
  const collectionJournal=createLogs(crumb,'collection-journal',{retainAll:true,collection:()=>current});
  collectionJournal.setAttribute('aria-label','view logs: запросы коллекции');
  crumb.append(collectionJournal);documentTabGroup.insertBefore(refreshDocuments,documentTabGroup.querySelector('.rag-tab-handle'));
  const measuredModels=new Map();
  const dimensionDisplays=new Map();
  function dimensionControls(modelField){
    const actions=el('div',undefined,'actions rag-dimension-actions');
    const value=el('span',undefined,'rag-dimension-status');
    const statusId='dimension-'+modelField;
    value.id='rag-'+statusId;
    value.setAttribute('role','status');
    const control=button('Проверить размерность',()=>api.run('Проверка размерности…',async()=>{
      await api.measureEmbedding(modelField);
      api.status(value.textContent);
    },undefined,control));
    control.dataset.ragStatus=statusId;
    actions.append(value,control);
    dimensionDisplays.set(modelField,value);
    return actions;
  }
  const cfg=parent.ragDefaults;
  for(const [operation,host,action] of [
    ['new',panels.add,true],
    ['edit',editText,true],
    ['search',panels.search]
  ]){
    const modelField=operation+'-model', modelLabel=field('Модель эмбеддингов',modelField,api.operationValue(modelField,api.embeddingDefault('model')));
    const model=modelLabel.lastElementChild;
    model.autocomplete='off';model.spellcheck=false;model.dataset.ragOperationSetting='';
    attachEmbeddingPicker(model);
    const bar=el('div',undefined,'rag-operation-embedding');
    bar.append(modelLabel,dimensionControls(modelField));
    const settingsPanel=el('fieldset',undefined,'rag-operation-settings');
    settingsPanel.append(el('legend','Настройки векторизации'),bar);
    const prefixId=operation+'-prefix',search=operation==='search';
    const prefixField=field(search?'Префикс запроса':'Префикс документа',prefixId,
      api.operationValue(prefixId,api.embeddingDefault(search?'queryPrefix':'documentPrefix')));
    const prefix=prefixField.lastElementChild;
    prefix.autocomplete='off';prefix.spellcheck=false;prefix.dataset.ragOperationSetting='';
    const vectorRow=el('div',undefined,'rag-new-vector-row');
    vectorRow.append(search?searchVectorField:operation==='edit'?editVectorField:documentVectorField,prefixField);
    if(operation==='new')vectorRow.append(vectorShortcut);
    settingsPanel.append(vectorRow);
    if(action){
      const group=el('div',undefined,'rag-import-fields');
      for(const [key,title,initial,min,description] of [
        ['chunk','Длина фрагмента, символов',cfg.fileChunkChars,1,'Максимальное число символов в одном фрагменте.'],
        ['overlap','Перекрытие, символов',cfg.fileChunkOverlap,0,'Число символов, общих для соседних фрагментов. Перекрытие должно быть меньше длины фрагмента.'],
        ['batch','Фрагментов за запрос',cfg.fileEmbeddingBatchSize,1,'Число фрагментов, отправляемых в одном запросе к модели.']
      ]){
        const id=operation+'-'+key,label=field('',id,api.operationValue(id,initial)),input=label.lastElementChild;
        const caption=el('span',title,'rag-field-caption');label.prepend(caption);helpControl(caption,title,description,label);
        input.type='number';input.min=min;input.step=1;input.dataset.ragOperationSetting='';
        group.append(label);
      }
      settingsPanel.append(group);
    }
    host.prepend(settingsPanel);
  }
  document.addEventListener('rag:embedding-dimension',event=>{measuredModels.set(event.detail.identity,event.detail.size);refreshSummaries();});
  refreshDocuments.addEventListener('click',()=>setTab('points'));
  document.addEventListener('rag:document-count',({detail:{collection:name,count}})=>{
    if (name===current) documentCount.textContent='Документы ('+count+')';
  });
  function refreshSummaries(){
    documentCount.textContent='Документы ('+(details.get(current)?.points_count??'…')+')';
    for(const [modelField,value] of dimensionDisplays){
      const identity=api.embeddingIdentity(modelField);
      if(value.dataset.identity===identity&&value.dataset.state==='loading'&&!measuredModels.has(identity))continue;
      if(value.dataset.identity!==identity) delete value.dataset.state;
      value.dataset.identity=identity;
      value.textContent=value.title='Размерность: '+(measuredModels.get(identity)??'не проверена');
    }
  }
  document.addEventListener('input',refreshSummaries);document.addEventListener('change',refreshSummaries);
  document.addEventListener('input',event=>{if(event.target.hasAttribute('data-rag-operation-setting'))api.persist();});
  let sizingFrame;
  function sizeRecordPanels(){cancelAnimationFrame(sizingFrame);sizingFrame=requestAnimationFrame(()=>{for(const host of [$('records'),$('results')]){if(!host.getClientRects().length)continue;const top=host.getBoundingClientRect().top;host.style.maxHeight=Math.max(120,innerHeight-Math.max(0,top)-($('next').hidden?16:$('next').offsetHeight+24))+'px';}});}
  addEventListener('resize',sizeRecordPanels);addEventListener('scroll',sizeRecordPanels,{passive:true});
  new ResizeObserver(sizeRecordPanels).observe(main);
  document.addEventListener('toggle',sizeRecordPanels,true);
  function act(message,fn){if(!connected)return api.status('Сначала подключитесь к кластеру.',true);return api.run(message,async()=>{cancelled=false;await fn();api.status(cancelled?'Действие отменено.':'');});}
  const binary=(ctx,suffix,method='GET',body)=>api.qdrant(ctx,suffix,method,body,api.signal||AbortSignal.timeout(parent.ragDefaults.timeoutMs),undefined,true);
  function setView(v){if(v!=='collection')snapshotController?.abort();view=v;inventory.hidden=!['collections','collection'].includes(v);aliases.hidden=v!=='aliases';createForm.hidden=v!=='create';collection.hidden=!['collections','collection'].includes(v);collectionBody.hidden=!current;collectionHint.hidden=!!current;collectionJournal.hidden=!current;document.dispatchEvent(new Event('rag:collection-selected'));title.replaceChildren('Коллекция');if(current)title.append(' · ',el('span',current,'rag-selected-collection-name'));renderInventory();[...tabs.querySelectorAll('[data-view]')].forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===(v==='collection'?'collections':v))));remember();}
  function setTab(id){
    if(id==='import'){id='add';addModes.select('file');}
    if(id==='raw'){id='edit';lookupModes.select('json');}
    tab=id==='settings'||id==='vector'?'add':Object.hasOwn(panels,id)?id:'points';
    if(tab!=='config')returnToNewDocument=false;
    if(tab!=='snapshots') snapshotController?.abort();
    for(const [key,panel] of Object.entries(panels)) panel.hidden=key!==tab;
    for(const b of ctabs.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected',String(b.dataset.tab===tab));
    remember();
    if(connected&&current&&tab==='indexes') renderIndexes();
    if(connected&&current&&tab==='snapshots'&&(!snapshotController||snapshotController.signal.aborted)) loadSnapshots();
  }
  for(const [id,name]of [['collections','Коллекции'],['aliases','Алиасы']]){
    const b=button('',()=>{setView(id);if(id==='aliases'&&connected)act('Чтение алиасов…',loadAliases);});
    b.append(id==='collections'?count:document.createTextNode(name));b.dataset.view=id;b.setAttribute('role','tab');
    const group=tabGroup(b);
    helpControl(group,name,id==='collections'?'Коллекция Qdrant хранит документы, метаданные и векторы для поиска. Число во вкладке показывает общее количество полученных коллекций.':'Алиас — стабильное имя коллекции. Его можно перенаправить на другую коллекцию без изменения имени в приложении.');
    if(id==='collections'){
      checkConnection.title='Обновить коллекции';checkConnection.setAttribute('aria-label','Обновить коллекции');
      checkConnection.className='rag-collections-refresh';
      checkConnection.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>';
      const collectionLogs=createLogs(group,'collections-refresh',{retainAll:true});
      collectionLogs.setAttribute('aria-label','view logs: обновление коллекций');
      group.append(checkConnection,collectionLogs);
    }
    tabs.append(group);
  }
  tabs.append(tabGroup(createButton));tabs.setAttribute('role','tablist');
  refreshDocuments.innerHTML=checkConnection.innerHTML;
  async function inspect(channel,cachedInfo){
    const info=cachedInfo??await api.qdrant(api.context(),'','GET',undefined,api.signal,channel);
    details.set(current,info);
    title.textContent='Коллекция · '+current;
    stats.replaceChildren();
    for(const [name,value]of [['Статус',info.status],['Точки',info.points_count],['Сегменты',info.segments_count],['Шарды',info.config?.params?.shard_number],['Векторы (размерность и метрика)',vectorText(info)]]){
      const item=el('span');
      item.append(el('span',name+': ','debug-field-name'),el('span',String(value??'—'),'debug-field-value'));
      stats.append(item);
    }
    const configViewer=json(info,'Данные с сервера · JSON');
    configViewer.open=configData.firstElementChild?.open??false;
    configData.replaceChildren(configViewer);
    syncConfigInputs(true);
    syncOperationVectors();syncVectorCreation();
    refreshSummaries();
  }
  async function openCollection(name,channel,nextTab=tab){snapshotController?.abort();if(current!==name){$('patch').value='{}';api.clearCreateDocument();for(const input of operationVectors)input.selectedIndex=-1;vectorNameInput.value='';vectorSizeInput.value='';returnToNewDocument=false;}current=name;title.textContent='Коллекция · '+name;stats.replaceChildren();configData.replaceChildren();indexList.replaceChildren();snapshotList.replaceChildren();$('snapshot-file').value='';$('collection').value=name;api.persist();api.clearEditor();api.resetRecords();setView('collection');renderInventory();await inspect(channel,channel?details.get(name):undefined);setTab(nextTab);await api.browse(api.context(),null,null,0,true,channel);}
  async function openCollectionSettings(name,sectionId){
    const opened=await act('Открытие настроек коллекции…',async()=>{
      if(name!==current) await openCollection(name,undefined,sectionId);
      else setTab(sectionId);
    });
    if(opened){
      const target=sectionId==='config'?(configVector.disabled?$('index-threshold'):configVector):ctabs.querySelector('[data-tab="snapshots"]');
      target.focus();
      target.scrollIntoView({block:'nearest'});
    }
  }
  function confirmCollectionDeletion(name){
    if(!connected||!collections.includes(name)) return;
    const generation=epoch, phrase='удалить '+name;
    const dialog=el('dialog',undefined,'rag-confirm-dialog');
    const heading=el('h3','Удалить коллекцию «'+name+'»?');
    const instructions=el('p','Будут удалены все точки коллекции. Для подтверждения введите ');
    heading.id='rag-delete-collection-title';
    instructions.id='rag-delete-collection-hint';
    instructions.append(el('code',phrase),'.');
    dialog.setAttribute('aria-labelledby',heading.id);
    dialog.setAttribute('aria-describedby',instructions.id);
    const form=el('form'),label=el('label','Фраза подтверждения'),input=el('input'),actions=el('div',undefined,'actions');
    input.autofocus=true;input.autocomplete='off';input.spellcheck=false;
    label.append(input);
    const submit=button('Удалить',null,true);
    submit.type='submit';submit.disabled=true;
    input.oninput=()=>{submit.disabled=input.value!==phrase;};
    actions.append(button('Отмена',()=>dialog.close()),submit);
    form.append(label,actions);
    form.onsubmit=event=>{
      event.preventDefault();
      if(input.value!==phrase) return;
      dialog.close();
      if(generation!==epoch||!collections.includes(name)) return;
      act('Удаление коллекции…',async()=>{
        const ctx=api.context(false);
        await api.qdrant({...ctx,path:'/collections/'+encodeURIComponent(name)},'','DELETE');
        if(generation!==epoch) return;
        const wasSelected=current===name;
        collections=collections.filter(item=>item!==name);
        details.delete(name);
        const aliasTarget=$('alias-target');
        [...aliasTarget.options].find(option=>option.value===name)?.remove();
        if(wasSelected){
          reconcileCollectionSelection();
          $('patch').value='{}';
          setView('collections');
        }else{
          renderInventory();
        }
        remember();
        count.closest('button').focus();
      });
    };
    dialog.append(heading,instructions,form);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);
    dialog.showModal();
  }
  function vectorText(info){
    const vectors=info?.config?.params?.vectors;
    if(!vectors)return '—';
    if(Number.isInteger(vectors.size))return vectors.size+' · '+vectors.distance;
    return Object.entries(vectors).map(([name,vector])=>name+' ('+vector.size+' · '+vector.distance+')').join(', ')||'—';
  }
  function renderInventory(){
    count.textContent='Коллекции ('+(collectionsLoaded?collections.length:'...')+')';
    count.closest('button').title=collectionsLoaded?'':connectHint;
    createForm.disabled=aliasFields.disabled=filter.disabled=!connected;
    clearFilter.disabled=!connected||!filter.value;
    refreshDocuments.disabled=!connected||!current;
    documentCount.textContent='Документы ('+(details.get(current)?.points_count??'…')+')';
    for(const panel of Object.values(panels)) panel.inert=!connected;
    inventoryBody.replaceChildren();
    if (!collectionsLoaded) {
      const row=el('tr'),cell=el('td','Список ещё не загружен.');
      cell.colSpan=inventoryHeadRow.cells.length;
      row.append(cell);inventoryBody.append(row);
      return;
    }
    const matches=collections.filter(n=>n.toLowerCase().includes(filter.value.toLowerCase()));
    if(!matches.length){const row=el('tr'),cell=el('td',collections.length?'Коллекции по фильтру не найдены.':'Коллекций пока нет. Откройте вкладку Добавить коллекцию.');cell.colSpan=inventoryHeadRow.cells.length;row.append(cell);inventoryBody.append(row);return;}
    for(const name of matches){const info=details.get(name),row=el('tr'),cell=el('td');if(name===current)row.setAttribute('aria-current','true');cell.append(button(name,()=>act('Открытие коллекции…',()=>openCollection(name))));const selectButton=cell.firstElementChild;
      selectButton.disabled=!connected;
      if (connected) {
        row.classList.add('rag-collection-selectable');
        row.addEventListener('click',event=>{
          if (event.target.closest('button,a,input,select,textarea') || !getSelection().isCollapsed) return;
          selectButton.focus({preventScroll:true});
          selectButton.click();
        });
      }
      const actionCell=el('td',undefined,'rag-collection-actions-cell'),actions=el('div',undefined,'rag-collection-actions');
      actions.append(
        iconButton('Редактировать параметры «'+name+'»',pencil,()=>openCollectionSettings(name,'config')),
        iconButton('Снимки коллекции «'+name+'»',snapshotIcon,()=>openCollectionSettings(name,'snapshots')),
        iconButton('Удалить коллекцию «'+name+'»',trash,()=>confirmCollectionDeletion(name),true)
      );
      for(const action of actions.children) action.disabled=!connected;
      actionCell.append(actions);
      row.append(cell);
      const statusCell=el('td'),badge=el('span',info?.status??'Недоступно','rag-collection-status');
      badge.dataset.status=info?.status||'unknown';statusCell.append(badge);row.append(statusCell);
      for(const value of [info?.points_count??'—',info?.segments_count??'—',info?.config?.params?.shard_number??'—',vectorText(info)])row.append(el('td',String(value)));
      row.append(actionCell);
      inventoryBody.append(row);
    }
  }
  function reconcileCollectionSelection(){
    const input=$('collection'),validCurrent=collections.includes(current);
    if(restored.current&&!collections.includes(restored.current))delete restored.current;
    if(input.value&&!collections.includes(input.value))input.value=validCurrent?current:'';
    if(!validCurrent){
      snapshotController?.abort();current='';stats.replaceChildren();configData.replaceChildren();indexList.replaceChildren();snapshotList.replaceChildren();
      api.clearEditor();api.resetRecords();$('snapshot-file').value='';
    }
    api.persist();
  }
  async function connectedTo(ctx,result,channel){const generation=epoch;collections=result.collections.map(c=>c.name);collectionsLoaded=true;reconcileCollectionSelection();details.clear();connected=true;setConnection('online','Подключено: '+new URL(ctx.base).host+'.');for(let i=0;i<collections.length;i+=parent.ragDefaults.collectionDetailsConcurrency){await Promise.all(collections.slice(i,i+parent.ragDefaults.collectionDetailsConcurrency).map(async name=>{try{const info=await api.qdrant({...ctx,path:'/collections/'+encodeURIComponent(name)},'','GET',undefined,api.signal,channel);if(generation===epoch)details.set(name,info);}catch(_){}}));}if(generation!==epoch)return;renderInventory();$('alias-target').replaceChildren(...collections.map(name=>new Option(name,name)));const desiredView=restored.view;if(restored.current&&collections.includes(restored.current)){tab=restored.tab||'points';const name=restored.current;restored={};await openCollection(name,channel);if(desiredView==='collections')setView('collections');}else setView('collections');if(desiredView==='aliases'){setView('aliases');await loadAliases(channel);}if(desiredView==='create')setView('create');}
  async function refresh(select){const ctx=api.context(false),result=await api.qdrant(ctx,'/collections');restored=select?{current:select,tab}:{};await connectedTo(ctx,result);}
  function renderIndexes(){indexList.replaceChildren();for(const [name,info]of Object.entries(details.get(current)?.payload_schema||{})){const row=el('div',undefined,'rag-entity-row');row.append(el('span',name+' · '+info.data_type),button('Удалить',()=>act('Удаление индекса…',async()=>{if(!confirmAction('Удалить индекс поля «'+name+'»?'))return;await api.qdrant(api.context(),'/index/'+encodeURIComponent(name)+'?wait=true','DELETE');await inspect();renderIndexes();}),true));indexList.append(row);}if(!indexList.children.length)indexList.append(el('p','Индексов payload пока нет.','hint'));}
  async function loadAliases(channel){const result=await api.qdrant(api.context(false),'/aliases','GET',undefined,api.signal,channel);aliasList.replaceChildren();for(const a of result.aliases||[]){const row=el('div',undefined,'rag-entity-row');row.append(el('span',a.alias_name+' → '+a.collection_name),button('Переименовать',()=>aliasAction('rename',a)),button('Перенаправить',()=>aliasAction('retarget',a)),button('Удалить',()=>aliasAction('delete',a),true));aliasList.append(row);}if(!aliasList.children.length)aliasList.append(el('p','Алиасов пока нет.','hint'));}
  function aliasAction(kind,a){act('Обновление алиасов…',async()=>{const target=$('alias-target').value,name=$('alias-name').value.trim();let actions;if(kind==='create'){if(!name||!target)throw Error('Укажите имя и целевую коллекцию.');actions=[{create_alias:{alias_name:name,collection_name:target}}];}if(kind==='delete'){if(!confirmAction('Удалить алиас «'+a.alias_name+'»? Коллекция останется.'))return;actions=[{delete_alias:{alias_name:a.alias_name}}];}if(kind==='rename'){const value=prompt('Новое имя алиаса',a.alias_name);if(!value?.trim())return;actions=[{rename_alias:{old_alias_name:a.alias_name,new_alias_name:value.trim()}}];}if(kind==='retarget'){if(!target||!confirm('Перенаправить «'+a.alias_name+'» на «'+target+'»?'))return;actions=[{delete_alias:{alias_name:a.alias_name}},{create_alias:{alias_name:a.alias_name,collection_name:target}}];}await api.qdrant(api.context(false),'/collections/aliases','POST',{actions});await loadAliases();});}
  let snapshotController=null;
  async function loadSnapshots(){
    snapshotController?.abort();const controller=new AbortController();snapshotController=controller;
    const name=current,ctx=api.context(),timeout=setTimeout(()=>controller.abort(),parent.ragDefaults.timeoutMs);
    snapshotList.setAttribute('aria-busy','true');snapshotList.replaceChildren(el('p','Загрузка снимков… Можно перейти в другой раздел.','hint'));
    try{
      const list=await api.qdrant(ctx,'/snapshots','GET',undefined,controller.signal);
      if(snapshotController!==controller||current!==name||tab!=='snapshots')return;
      if(!Array.isArray(list))throw Error('Qdrant вернул неожиданный список снимков.');
      snapshotList.replaceChildren();
      for(const snapshot of list){
        const row=el('div',undefined,'rag-entity-row');
        row.append(el('span',snapshot.name+' · '+Math.ceil(snapshot.size/1024)+' КБ'),button('Скачать',()=>act('Загрузка снимка…',async()=>{const response=await binary(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)),blob=await response.blob(),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=snapshot.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})),button('Удалить',()=>act('Удаление снимка…',async()=>{if(!confirmAction('Удалить снимок «'+snapshot.name+'»?'))return;await api.qdrant(api.context(),'/snapshots/'+encodeURIComponent(snapshot.name)+'?wait=true','DELETE');await loadSnapshots();}),true));snapshotList.append(row);
      }
      if(!list.length)snapshotList.append(el('p','Снимков пока нет. Снимок — резервная копия коллекции; для первого поиска он не нужен.','hint'));
    }catch(error){
      if(snapshotController!==controller||current!==name||tab!=='snapshots')return;
      snapshotList.replaceChildren(el('p',controller.signal.aborted?'Время ожидания снимков истекло. Проверьте подключение и повторите.':error.message,'rag-field-error'),button('Повторить загрузку',loadSnapshots));
    }finally{clearTimeout(timeout);if(snapshotController===controller){snapshotController=null;snapshotList.removeAttribute('aria-busy');}}
  }
  function invalidate(){qdrantVersion=undefined;document.dispatchEvent(new CustomEvent('rag:logs-reset',{detail:'collection-journal'}));snapshotController?.abort();epoch++;api.cancel();connected=false;current='';collections=[];collectionsLoaded=false;collectionStatus.textContent='';clusterStatus.textContent='';details.clear();aliasList.replaceChildren();snapshotList.replaceChildren();indexList.replaceChildren();stats.replaceChildren();configData.replaceChildren();api.clearEditor();$('snapshot-file').value='';setConnection('offline','Настройки подключения изменены. Проверьте подключение к кластеру.');api.resetRecords();setView('collections');renderInventory();}
  function transportChanged(){qdrantVersion=undefined;syncVectorCreation();snapshotController?.abort();epoch++;api.cancel();connected=false;clusterStatus.textContent='';collectionStatus.textContent='Маршрут изменён. Обновите коллекции для проверки доступа.';setConnection('offline','Маршрут изменён. Доступ к кластеру по новому маршруту ещё не проверен.');renderInventory();}
  function secretSlot(id){try{return 'ai_rag_secret:'+id+':'+new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value).hostname;}catch(_){return null;}}
  function legacySecretSlots(id){
    const prefix='ai_rag_secret:'+id+':',server=new URL($(id==='qdrant-key'?'qdrant-url':'neuraldeep-url').value);
    return Object.keys(sessionStorage).filter(key=>{if(!key.startsWith(prefix))return false;try{return new URL(key.slice(prefix.length)).hostname===server.hostname;}catch(_){return false;}});
  }
  function readSecret(id){
    if(id==='qdrant-key'&&window.RagProfiles)return RagProfiles.keyForUrl();
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
      const sharedKey=id==='neuraldeep-key' && providerSelect.value;
      if (!sharedKey) {
        try{const slot=secretSlot(id);if(slot){sessionStorage.removeItem(slot);legacySecretSlots(id).forEach(key=>sessionStorage.removeItem(key));}}catch(_){}
      }
      input.value='';
      if(id==='qdrant-key')invalidate();
      else input.dispatchEvent(new Event('change', {bubbles:true}));
      api.status(sharedKey?'Общий ключ OpenAI API удалён.':'Ключ удалён из сессии.');
    },true);
    clear.title=id==='qdrant-key'?'Удалить ключ Qdrant':'Удалить ключ векторизации';
    clear.setAttribute('aria-label',clear.title);
    host.append(label,clear);
    const slot=secretSlot(id);
    try{if(slot&&!input.disabled&&(id!=='neuraldeep-key'||!providerSelect.value))input.value=readSecret(id);}catch(_){}
    input.addEventListener('input',()=>{
      const key=secretSlot(id);
      try{if(key&&!input.disabled&&(id!=='neuraldeep-key'||!providerSelect.value))sessionStorage.setItem(key,input.value);}catch(_){}
      if(id==='qdrant-key')invalidate();
    });
  }
  for(const id of ['qdrant-url','neuraldeep-url'])$(id).addEventListener('input',()=>{const keyId=id==='qdrant-url'?'qdrant-key':'neuraldeep-key',input=$(keyId);if(!input.disabled&&(id!=='neuraldeep-url'||!providerSelect.value))input.value=readSecret(keyId);if(id==='qdrant-url')invalidate();});
  $('neuraldeep-url').addEventListener('change', () => {
    const input = $('neuraldeep-key'), slot = secretSlot('neuraldeep-key');
    try { if (!providerSelect.value && !input.disabled && !input.value && slot) input.value = readSecret('neuraldeep-key'); } catch (_) {}
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
    get epoch(){return epoch;},
    connected:connectedTo,refresh,invalidate,refreshSummaries,transportChanged,
    selectCollection:name=>act('Открытие коллекции…',()=>{if(!collections.includes(name))throw Error('Выберите коллекцию из полученного списка.');return openCollection(name);}),
    clusterReady:(ctx,version)=>{qdrantVersion=version;syncVectorCreation();setConnection('ready',new URL(ctx.base).host+' · /readyz 200 · '+(version?'версия '+version:'версия недоступна'));},
    afterMutation:async()=>{await inspect();renderInventory();refreshSummaries();},
    revealDocuments:()=>{setView('collection');setTab('points');$('records').scrollIntoView({block:'start',behavior:'smooth'});sizeRecordPanels();},
    revealField:field=>{
      if(settings.contains(field)) setSettings(true);
      if(!collection.contains(field)) return;
      const match=Object.entries(panels).find(([,panel])=>panel.contains(field));
      if(match){
        if(editText.contains(field))lookupModes.select('text');
        if(raw.contains(field))lookupModes.select('json');
        if(addText.contains(field))addModes.select('text');
        setTab(match[0]);
      }
    },
    revealEditor:()=>{lookupModes.select('text');setTab('edit');},
    connecting:()=>setConnection('connecting','Проверка подключения к кластеру…'),
    connectionFailed:()=>{
      connected=false;renderInventory();
      if(qdrantState==='connecting') setConnection('error','Ошибка подключения. Подробности доступны в строке состояния RAG.');
    }
  };
  let savedSettings;try{savedSettings=sessionStorage.getItem('ai_rag_settings_open');}catch(_){}
  setSettings(savedSettings===null||savedSettings===undefined?!($('qdrant-url').value&&$('qdrant-key').value):savedSettings==='true');setView('collections');setTab('points');renderInventory();
  refreshSummaries();
})();
