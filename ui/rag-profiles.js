// Qdrant connection profiles are independent from embedding-provider profiles.
(() => {
  if(!window.RagConsole)return;
  const api=RagWorkbench,$=id=>document.getElementById('rag-'+id),cfg=parent.ragDefaults;
  const slot='ai_rag_connections:'+location.hostname,select=$('connection-profile');
  let state;try{state=JSON.parse(sessionStorage.getItem(slot));}catch(_){}
  const read=()=>({qdrantUrl:$('qdrant-url').value,key:$('qdrant-key').value,useProxy:api.qdrantProxy.read(),collection:$('collection').value});
  if(!Array.isArray(state?.profiles)||!state.profiles.length){const id=crypto.randomUUID();state={active:id,profiles:[{id,name:cfg.profileName,...read()}]};}
  state.active=state.profiles.some(p=>p.id===state.active)?state.active:state.profiles[0].id;
  const current=()=>state.profiles.find(p=>p.id===state.active);
  window.RagProfiles={keyForUrl:()=>{try{return new URL(current().qdrantUrl).hostname===new URL($('qdrant-url').value).hostname?current().key||'':'';}catch(_){return '';}}};
  let switching=false;
  function store(){if(switching)return;Object.assign(current(),read());sessionStorage.setItem(slot,JSON.stringify(state));}
  function render(){select.replaceChildren(...state.profiles.map(p=>new Option(p.name,p.id)));select.value=state.active;select.dispatchEvent(new Event('change',{bubbles:true}));remove.disabled=state.profiles.length===1;}
  function load(){
    switching=true;RagConsole.invalidate();
    const p=current();$('qdrant-url').value=p.qdrantUrl;$('qdrant-url').dispatchEvent(new Event('input',{bubbles:true}));
    api.qdrantProxy.set(p.useProxy);$('qdrant-key').value=p.key||'';$('collection').value=p.collection||'';
    $('collections').replaceChildren();switching=false;api.persist();store();
  }
  const row=document.createElement('div');row.className='connection-profile-row';
  const label=select.closest('label'),control=label.querySelector('.compact-select');control.before(row);row.append(control);
  const actions=document.createElement('span');actions.className='connection-profile-actions profile-actions';row.append(actions);
  function action(text,title,fn){const b=document.createElement('button');b.type='button';b.className='small';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',fn);actions.append(b);return b;}
  const edit=document.createElement('input');edit.id='rag-profile-name';edit.hidden=true;edit.maxLength=32;edit.autocomplete='off';edit.setAttribute('aria-label','Имя RAG-профиля');row.prepend(edit);
  function endEdit(save){if(edit.hidden)return;const name=edit.value.trim();if(save&&!name){edit.setAttribute('aria-invalid','true');edit.title='Укажите имя профиля.';return;}if(save){current().name=name;store();render();}edit.hidden=true;control.hidden=false;edit.removeAttribute('aria-invalid');}
  edit.addEventListener('blur',()=>endEdit(true));edit.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();endEdit(true);}if(event.key==='Escape'){event.preventDefault();endEdit(false);control.querySelector('button').focus();}});
  const rename=action('','Переименовать RAG-профиль',()=>{control.hidden=true;edit.hidden=false;edit.value=current().name;edit.focus();edit.select();});
  rename.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  function add(clone){store();const p={id:crypto.randomUUID(),name:clone?current().name+' · копия':cfg.profileName,qdrantUrl:cfg.qdrantUrl,key:'',useProxy:false,collection:cfg.collection};if(clone)Object.assign(p,read());state.profiles.push(p);state.active=p.id;load();render();}
  const clone=action('','Клонировать RAG-профиль',()=>add(true));clone.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
  action('+','Добавить RAG-профиль',()=>add(false)).hidden=true;
  const remove=action('×','Удалить RAG-профиль',()=>{if(state.profiles.length===1)return;if(!confirm('Удалить профиль «'+current().name+'»? Коллекции на сервере останутся.'))return;state.profiles=state.profiles.filter(p=>p.id!==state.active);state.active=state.profiles[0].id;load();render();});
  remove.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  select.addEventListener('change',()=>{if(select.value===state.active)return;store();state.active=select.value;load();});
  for(const id of ['qdrant-url','qdrant-key','collection'])for(const event of ['input','change'])$(id).addEventListener(event,store);
  api.qdrantProxy.input.addEventListener('change',store);
  document.addEventListener('rag:operation',store);
  $('qdrant-key').closest('.rag-credential-slot').addEventListener('click',()=>queueMicrotask(store));
  render();load();

  // Editable collection picker with the same control and popup classes as models.
  const input=$('collection'),host=document.createElement('span');host.className='model-picker';input.removeAttribute('list');input.before(host);host.append(input);
  const button=document.createElement('button');button.type='button';button.className='model-picker-trigger';button.title='Получить список коллекций';button.setAttribute('aria-label',button.title);button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';host.append(button);
  const popup=document.createElement('div');popup.className='model-picker-popup';popup.hidden=true;popup.id='rag-collection-picker';popup.role='listbox';document.body.append(popup);input.setAttribute('role','combobox');input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','false');input.setAttribute('aria-autocomplete','list');
  let generation=0,active=-1,names=[];
  function close(){generation++;popup.hidden=true;input.setAttribute('aria-expanded','false');button.setAttribute('aria-expanded','false');}
  function position(){const r=host.getBoundingClientRect();popup.style.width=Math.min(r.width,innerWidth-16)+'px';popup.style.left=Math.max(8,Math.min(r.left,innerWidth-r.width-8))+'px';popup.style.maxHeight=Math.max(40,Math.max(innerHeight-r.bottom-8,r.top-8))+'px';popup.style.top=(innerHeight-r.bottom>Math.min(160,r.top)?r.bottom+3:Math.max(8,r.top-popup.offsetHeight-3))+'px';}
  function message(text){popup.replaceChildren();const n=document.createElement('div');n.className='model-picker-status';n.textContent=text;popup.append(n);position();}
  function choose(name){input.value=name;close();input.dispatchEvent(new Event('change',{bubbles:true}));RagConsole.selectCollection(name);}
  function renderNames(filter=''){popup.replaceChildren();active=-1;const filtered=names.filter(n=>n.toLowerCase().includes(filter.toLowerCase()));for(const name of filtered){const n=document.createElement('div');n.className='model-picker-option';n.role='option';n.tabIndex=-1;n.textContent=name;n.setAttribute('aria-selected',String(name===input.value));n.addEventListener('pointerdown',e=>e.preventDefault());n.addEventListener('click',()=>choose(name));popup.append(n);}if(!filtered.length)message('Коллекции не найдены.');position();}
  async function open(){if(!popup.hidden)return close();const token=++generation;popup.hidden=false;input.setAttribute('aria-expanded','true');button.setAttribute('aria-expanded','true');message('Получение коллекций…');const ok=await api.fetchCollections();if(token!==generation)return;if(!ok){message($('collections-status').textContent||'Не удалось получить коллекции.');return;}names=[...$('collections').options].map(o=>o.value);renderNames();}
  button.addEventListener('click',open);input.addEventListener('input',()=>{if(!popup.hidden)renderNames(input.value);});
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){close();return;}if(event.key==='ArrowDown'&&popup.hidden){event.preventDefault();open();return;}if(popup.hidden)return;const options=[...popup.querySelectorAll('[role=option]')];if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((n,i)=>n.setAttribute('aria-selected',String(i===active)));}else if(event.key==='Enter'&&options[active]){event.preventDefault();choose(options[active].textContent);}});
  document.addEventListener('pointerdown',event=>{if(!host.contains(event.target)&&!popup.contains(event.target))close();});addEventListener('resize',close);select.addEventListener('change',close);
})();
