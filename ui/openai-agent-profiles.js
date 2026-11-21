// Agent behavior is independent of the selected OpenAI connection.
(() => {
  const $=id=>document.getElementById(id),copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  if(!openAIFormInitialized)populateOpenAIForm();
  const fields={systemPrompt:'openai-system-prompt',temperature:'openai-temperature',topP:'openai-top-p',maxCompletionTokens:'openai-max-completion-tokens',n:'openai-n',includeContext:'openai-context',toolsEnabled:'openai-tools-enabled',toolChoice:'openai-tool-choice',forcedTool:'openai-forced-tool',parallelToolCalls:'openai-parallel-tools'};
  const keys=[...Object.keys(fields),'tools'];
  const pick=config=>({...Object.fromEntries(keys.map(key=>[key,copy(config[key])])),parameterDefaults:Object.fromEntries(Object.keys(fields).filter(key=>config.parameterDefaults?.[key]!==undefined).map(key=>[key,copy(config.parameterDefaults[key])])),parameterOverrides:Object.fromEntries(Object.keys(fields).filter(key=>config.parameterOverrides?.[key]!==undefined).map(key=>[key,copy(config.parameterOverrides[key])]))});
  let agents=[];
  try{const saved=JSON.parse(localStorage.getItem('ai_openai_agents')||'null');if(Array.isArray(saved))agents=saved.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&item.config); }catch(_){}
  // Preserve every legacy provider's behavior on the first migration.
  if(!agents.length){agents=allOpenAIProfiles().map(profile=>({id:'agent_'+profile.id,name:profile.name,config:pick(normalizeOpenAIConfig(profile))}));}
  if(!agents.length)agents=[{id:'agent_'+crypto.randomUUID(),name:CFG_OPENAI_AGENT_NAME,config:pick(openAIConfig)}];
  let active=localStorage.getItem('ai_openai_active_agent');
  if(!agents.some(item=>item.id===active)){
    active=agents.find(item=>item.id==='agent_'+localStorage.getItem('ai_openai_active_profile'))?.id||agents[0].id;
    agents.find(item=>item.id===active).config=pick(readOpenAIForm());
  }
  const connection=$('openai-settings').querySelector('.openai-credentials');connection.classList.add('connection-panel');
  const grid=connection.querySelector('.openai-credential-row');grid.classList.add('connection-fields');
  grid.querySelector('.openai-provider-field').classList.add('connection-provider');
  $('openai-model').closest('label').classList.add('connection-list');
  const providerCaption=$('openai-profile-heading');providerCaption.classList.add('connection-caption');
  const providerCaptionName=document.createElement('span');providerCaptionName.dataset.i18n='openaiProvider';providerCaptionName.textContent=t('openaiProvider');providerCaption.removeAttribute('data-i18n');providerCaption.replaceChildren(providerCaptionName);
  document.querySelectorAll('#openai-settings .openai-inline-title .api-docs-link').forEach(link=>providerCaption.append(link));
  const modelField=$('openai-model').closest('label'),modelRow=document.createElement('div');modelRow.className='connection-resource';
  const connect=document.createElement('button');connect.type='button';connect.className='cfg-btn connection-connect';connect.dataset.i18n='openaiConnect';connect.textContent=t('openaiConnect');connect.onclick=()=>ModelPicker.open($('openai-model'));
  const modelHost=$('openai-model').closest('.model-picker');modelHost.before(modelRow);modelRow.append(connect,modelHost);
  $('openai-profile-add').hidden=true;
  const copyIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
  $('openai-profile-clone').innerHTML=copyIcon;$('openai-profile-clone').setAttribute('aria-label',lang==='ru'?'Клонировать провайдера':'Clone provider');
  const panel=document.createElement('section');panel.id='openai-agent-panel';panel.className='connection-panel agent-panel';
  const title=document.createElement('h3');title.className='connection-title';title.textContent='AI Agent';panel.append(title);
  const row=document.createElement('div');row.className='agent-profile-row';
  const select=document.createElement('select');select.id='openai-agent-select';select.setAttribute('aria-label','AI Agent');row.append(select);panel.append(row);
  let node=$('openai-settings').querySelector('.openai-prompt');
  while(node&&!node.classList.contains('api-note')){const next=node.nextElementSibling;panel.append(node);node=next;}
  connection.after(panel);
  for(const card of [connection,panel]){const shell=document.createElement('div');shell.className='connection-card-shell';card.before(shell);shell.append(card);}
  function store(){localStorage.setItem('ai_openai_agents',JSON.stringify(agents));localStorage.setItem('ai_openai_active_agent',active);}
  function capture(){const agent=agents.find(item=>item.id===active);if(agent)agent.config=pick(readOpenAIForm());store();}
  let agentControl,providerControl;
  function render(){select.replaceChildren(...agents.map(item=>new Option(item.name,item.id)));select.value=active;remove.disabled=agents.length<=1;agentControl?.sync();store();}
  function apply(){
    const config=copy(agents.find(item=>item.id===active).config);
    const defaults={...openAIConfig.parameterDefaults},overrides={...openAIConfig.parameterOverrides};
    for(const key of Object.keys(fields)){delete defaults[key];delete overrides[key];}
    openAIConfig={...openAIConfig,...config,parameterDefaults:{...defaults,...config.parameterDefaults},parameterOverrides:{...overrides,...config.parameterOverrides}};
    for(const [key,id]of Object.entries(fields)){const field=$(id);if(field.type==='checkbox')field.checked=!!config[key];else field.value=config[key]??'';}
    renderOpenAITools(config.tools||[]);syncOpenAIParameterToggles();updateOpenAIRequestPreview();
  }
  const originalCommit=commitOpenAISettings,originalLoad=loadOpenAIProfile;
  commitOpenAISettings=function(){const result=originalCommit();capture();return result;};
  loadOpenAIProfile=function(id){capture();originalLoad(id);apply();originalCommit();providerControl?.sync();};
  function activate(id,saveCurrent=true){
    if(!agents.some(agent=>agent.id===id))return;
    stopToolChain('',true);resetOpenAIToolTurn();clearTimeout(openAIAutosaveTimer);
    if(saveCurrent)capture();
    active=id;apply();originalCommit();render();
    openAIConversationId=active;sessionStorage.setItem('ai_openai_conversation',active);
  }
  select.addEventListener('change',()=>activate(select.value));
  panel.addEventListener('change',()=>queueMicrotask(capture));
  function action(text,label,fn){const button=document.createElement('button');button.type='button';button.className='agent-action';const icon=text==='✎'?document.querySelector('#openai-profile-combo .profile-pencil svg'):text==='+'?$('openai-profile-add').querySelector('svg'):text==='×'?$('openai-profile-delete').querySelector('svg'):null;if(icon)button.append(icon.cloneNode(true));else button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.onclick=fn;row.append(button);return button;}
  function unique(name){let result=name,n=1;while(agents.some(item=>item.name===result))result=name+' '+(++n);return result;}
  const nameInput=document.createElement('input');nameInput.className='api-input agent-name-edit';nameInput.hidden=true;nameInput.maxLength=64;nameInput.setAttribute('aria-label','Имя агента');
  const nameStatus=document.createElement('span');nameStatus.className='connection-inline-status';nameStatus.setAttribute('role','status');
  row.append(nameInput);row.after(nameStatus);
  function finishName(cancel=false){if(nameInput.hidden)return;const value=nameInput.value.trim();if(!cancel&&(!value||agents.some(item=>item.id!==active&&item.name.toLocaleLowerCase()===value.toLocaleLowerCase()))){nameStatus.textContent=lang==='ru'?'Введите уникальное имя агента.':'Enter a unique agent name.';return;}if(!cancel)agents.find(item=>item.id===active).name=value;nameInput.hidden=true;row.classList.remove('editing-name');nameStatus.textContent='';render();}
  nameInput.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();finishName(event.key==='Escape');}});nameInput.addEventListener('blur',()=>finishName());
  action('✎','Переименовать агента',()=>{nameInput.value=agents.find(item=>item.id===active).name;nameInput.hidden=false;row.classList.add('editing-name');nameInput.focus();nameInput.select();});
  function create(clone){capture();const source=clone?agents.find(item=>item.id===active).config:pick(normalizeOpenAIConfig(CFG_OPENAI_PROVIDERS[0]));const agent={id:'agent_'+crypto.randomUUID(),name:unique(clone?agents.find(item=>item.id===active).name+' Копия':CFG_OPENAI_AGENT_NAME),config:copy(source)};agents.push(agent);activate(agent.id,false);}
  const clone=action('Clone','Клонировать агента',()=>create(true));clone.innerHTML=copyIcon;action('+','Добавить агента',()=>create(false)).hidden=true;
  const remove=action('×','Удалить агента',()=>{if(agents.length<=1)return;const agent=agents.find(item=>item.id===active);if(!confirm('Удалить агента «'+agent.name+'»?'))return;agents=agents.filter(item=>item.id!==active);activate(agents[0].id,false);});
  render();apply();originalCommit();
  providerControl=CompactSelect.attach($('openai-profile-select'),{label:t('openaiProvider')});
  agentControl=CompactSelect.attach(select,{label:'AI Agent'});
  window.OpenAIAgents={capture,apply,get active(){return active;},get profiles(){return copy(agents);}};
})();
