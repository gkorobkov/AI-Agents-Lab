// Shared HTTP request/response presentation for chat, logs and tools.
(() => {
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const credentialName=name=>/^(?:authorization|proxyauthorization|cookie|setcookie|(?:x|openai|qdrant)?apikey|(?:x)?(?:access|refresh|id|auth|bearer|session|csrf|xsrf|authenticity)?token|(?:client|apikey)?secret|password|passwd|privatekey|sessionid|xproxytargeturl)$/i.test(name.replace(/[-_]/g,''));
  const clean=value=>{
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,credentialName(k)?'[REDACTED]':clean(v)]));
    return typeof value==='string'?value.replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g,(part,separator,key)=>{
      let name=key;
      try{name=decodeURIComponent(name);}catch(_){}
      return credentialName(name)?separator+key+'=[REDACTED]':part;
    }):value;
  };
  const text=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
  function section({kind,request={},response={},data,language=()=> 'ru'}){
    const ru=language()==='ru',root=el('details',null,'http-debug-section');root.dataset.section=kind;root.open=true;
    const heading=el('summary',null,'http-debug-heading'),caption=el('span',kind==='request'?'Request':'Response','http-debug-caption'),copy=el('button','⧉','http-debug-copy');
    copy.type='button';copy.title=ru?'Копировать':'Copy';copy.setAttribute('aria-label',copy.title+' '+(kind==='request'?(ru?'запрос':'request'):'Response'));
    heading.append(caption,copy);root.append(heading);
    const pair=(host,key,value)=>{if(value==null||value==='')return;const row=el('div',null,'debug-summary-field');row.append(el('span',key+': ','debug-field-name'),el('span',String(value),'debug-field-value'));host.append(row);};
    const headers=clean(kind==='request'?request.headers||{}:response.headers||{});
    const headerToggle=el('button',ru?'HTTP-заголовки '+(kind==='request'?'запроса':'ответа'):'HTTP '+kind+' headers','debug-response-headers-toggle');headerToggle.type='button';headerToggle.setAttribute('aria-expanded','false');
    const headerBlock=el('div',null,'debug-response-headers');headerBlock.hidden=true;
    for(const [key,value] of Object.entries(headers))pair(headerBlock,key,value);
    if(!headerBlock.childElementCount)headerBlock.append(el('span',ru?'Нет доступных заголовков.':'No exposed headers.'));
    headerToggle.onclick=event=>{event.preventDefault();event.stopPropagation();headerBlock.hidden=!headerBlock.hidden;headerToggle.setAttribute('aria-expanded',String(!headerBlock.hidden));};heading.insertBefore(headerToggle,copy);root.append(headerBlock);
    let body=kind==='request'?(request.body??request.body_text):data;
    if(typeof body==='string'&&/^\s*[{\[]/.test(body)){
      try{body=JSON.parse(body);}catch(_){}
    }
    const hasBody=kind==='response'?body!==undefined:!['GET','HEAD'].includes(String(request.method).toUpperCase())&&body!=null;
    const content=hasBody?text(clean(body??null)):'';
    if(hasBody){const pre=el('pre');root.append(pre);JsonViewer.create({pre,heading,before:copy,language}).update(content);}
    copy.onclick=event=>{event.preventDefault();event.stopPropagation();navigator.clipboard.writeText((kind==='request'?[request.method,clean(request.endpoint||request.url)].filter(Boolean).join(' ')+'\n':'')+text(headers)+(hasBody?'\n'+content:'')).catch(()=>{});};
    return root;
  }
  function record(entry,language=()=> 'ru',{open=true}={}){
    const ru=language()==='ru',root=el('details',null,'http-debug-record');
    const summary=el('summary',null,'http-debug-record-heading');
    const status=el('span',entry.status??(ru?'Ожидание':'Pending'),'http-debug-record-status');
    if(entry.clientIssue){
      const warning=el('span','⚠','http-debug-record-warning');
      warning.title=entry.clientIssue;warning.setAttribute('aria-label',entry.clientIssue);
      status.append(' ',warning);
    }
    const url=clean(entry.request.url||entry.request.endpoint)||'—';
    const address=el('span',url,'http-debug-record-url');
    address.title=url;
    try {
      const absolute=new URL(url);
      if (['http:','https:'].includes(absolute.protocol) && !absolute.username && !absolute.password) {
        const link=el('a',url);
        link.href=absolute.href;link.target='_blank';link.rel='noopener noreferrer';
        address.replaceChildren(link);
      }
    } catch (_) {}
    if(entry.action){
      const characters=Array.from(entry.action.short||entry.action.label||'');
      const action=el('span',characters.length>8?characters.slice(0,7).join('')+'…':characters.join(''),'http-debug-record-action');
      action.title=entry.action.label;
      summary.append(action);
    }
    summary.append(el('strong',entry.request.method?.toUpperCase()||'—'),address,status);
    if(entry.ms!=null)summary.append(el('span',entry.ms+' ms','http-debug-record-duration'));
    const started=new Date(entry.startedAt??NaN);
    if (!Number.isNaN(started.valueOf())) {
      const locale=ru?'ru-RU':'en-GB';
      const stamp=el('time',null,'http-debug-record-time');
      stamp.append(el('span',started.toLocaleDateString(locale)+' ','http-debug-record-date'),started.toLocaleTimeString(locale));
      stamp.dateTime=started.toISOString();stamp.title=started.toLocaleString(locale);
      summary.append(stamp);
    }
    root.append(summary);
    function mountDetails() {
      if (root.children.length>1) return;
      const exchange=el('div',null,'http-debug-exchange');
      exchange.append(section({kind:'request',request:entry.request,language}));
      if(entry.response)exchange.append(section({kind:'response',response:entry.response,data:entry.response.body,language}));
      if(entry.clientIssue)exchange.append(el('p',(ru?'Проверка приложения · ':'Application validation · ')+entry.clientIssue,'http-debug-client-issue'));
      root.append(exchange);
    }
    root.open=open;
    if (open) mountDetails();
    else root.addEventListener('toggle',()=>{if(root.open)mountDetails();});
    return root;
  }
  window.HttpDebug={record,clean};
})();
