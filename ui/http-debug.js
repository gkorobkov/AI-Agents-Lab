// Shared HTTP request/response presentation for chat, logs and tools.
(() => {
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const clean=value=>{
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/authorization|cookie|api[-_]?key|token|secret|password/i.test(k)?'[REDACTED]':clean(v)]));
    return typeof value==='string'?value.replace(/([?&](?:api[-_]?key|token|secret|password)=)[^&#\s]*/gi,'$1[REDACTED]'):value;
  };
  const text=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
  function section({kind,title,source,request={},response={},data,language=()=> 'ru'}){
    const ru=language()==='ru',root=el('details',null,'debug-section http-debug-section');root.dataset.section=kind;root.open=true;
    const heading=el('summary'),caption=el('span',title,'debug-section-title'),badge=el('span',source,'debug-section-badge'),copy=el('button','⧉','dbg-copy');copy.type='button';copy.title=ru?'Копировать':'Copy';copy.setAttribute('aria-label',copy.title+' '+title);
    heading.append(caption,badge,copy);root.append(heading);
    const metadata=el('div',null,'http-debug-metadata');root.append(metadata);
    const pair=(host,key,value)=>{if(value==null||value==='')return;const row=el('div',null,'debug-summary-field');row.append(el('span',key+': ','debug-field-name'),el('span',String(value),'debug-field-value'));host.append(row);};
    const headers=clean(kind==='request'?request.headers||{}:response.headers||{});
    if(kind==='request'){pair(metadata,ru?'Метод':'Method',request.method);pair(metadata,'URL',clean(request.endpoint||request.url));}
    const headerToggle=el('button',ru?'HTTP-заголовки '+(kind==='request'?'запроса':'ответа'):'HTTP '+kind+' headers','debug-response-headers-toggle');headerToggle.type='button';headerToggle.setAttribute('aria-expanded','false');
    const headerBlock=el('div',null,'debug-response-headers');headerBlock.hidden=true;
    for(const [key,value] of Object.entries(headers))pair(headerBlock,key,value);
    if(!headerBlock.childElementCount)headerBlock.append(el('span',ru?'Нет доступных заголовков.':'No exposed headers.'));
    headerToggle.onclick=event=>{event.preventDefault();event.stopPropagation();headerBlock.hidden=!headerBlock.hidden;headerToggle.setAttribute('aria-expanded',String(!headerBlock.hidden));};heading.insertBefore(headerToggle,copy);root.append(headerBlock);
    let body=kind==='request'?(request.body??request.body_text):data;
    const hasBody=kind!=='request'||(!['GET','HEAD'].includes(String(request.method).toUpperCase())&&body!=null);
    const content=hasBody?text(clean(body??null)):'';
    if(hasBody){const pre=el('pre');root.append(pre);JsonViewer.create({pre,heading,before:copy,language}).update(content);}
    copy.onclick=event=>{event.preventDefault();event.stopPropagation();navigator.clipboard.writeText((kind==='request'?[request.method,clean(request.endpoint||request.url)].filter(Boolean).join(' ')+'\n':'')+text(headers)+(hasBody?'\n'+content:'')).catch(()=>{});};
    return root;
  }
  function record(entry,language=()=> 'ru'){
    const ru=language()==='ru',root=el('details',null,'http-debug-record');root.open=true;
    root.append(el('summary',(entry.request.method||'GET')+' · '+(entry.status??(ru?'Ожидание':'Pending'))+(entry.ms!=null?' · '+entry.ms+' ms':'')));
    root.append(section({kind:'request',title:ru?'Запрос':'Request',source:ru?'Отправлено с UI':'Sent by UI',request:entry.request,language}));
    if(entry.response)root.append(section({kind:'response',title:ru?'Полный ответ':'Full response',source:ru?'Ответ от сервиса':'Service response',response:entry.response,data:entry.response.body,language}));
    return root;
  }
  window.HttpDebug={section,record,clean};
})();
