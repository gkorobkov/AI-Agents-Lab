(() => {
  const text = (ru,en) => lang === 'ru' ? ru : en;
  window.addMcpTools = (record, definitions) => {
    if(localStorage.getItem('n8n_consent')!=='1')return false;
    try {
      McpLibrary.validate(record);
      if(!definitions.length)throw new Error(text('Сервер не предоставил инструменты.','The server returned no tools.'));
      appWorkspace.openSettings('openai');if(isReadonlyOpenAIPreset())cloneOpenAIProfile();const tools=readOpenAIForm().tools;
      definitions.forEach(definition=>{
        const base=('mcp_'+record.name+'_'+definition.name).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,58);let name=base,suffix=2;
        while(tools.some(tool=>tool.name===name))name=base+'_'+suffix++;
        tools.push({name,description:definition.description||definition.name,parameters:JSON.stringify(definition.inputSchema,null,2),strict:false,http:{url:'',method:'GET',mappings:[],body:''},mcp:{server:McpLibrary.clean(record),toolName:definition.name}});
      });
      document.getElementById('openai-tools-enabled').checked=true;renderOpenAITools(tools);onOpenAIToolDraftChange();commitOpenAISettings();document.getElementById('openai-tool-builder').open=true;
      toast(text('MCP подключён: ','MCP connected: ')+record.title);return true;
    }catch(error){toast(McpLibrary.redact(error.message));return false;}
  };
  window.decorateMcpTool = (row,tool) => {
    if(!tool.mcp)return;
    row.querySelector('.tool-http').hidden=true;
    const note=document.createElement('p');note.className='api-note';note.textContent='MCP · '+tool.mcp.server.title+' · '+tool.mcp.toolName+' · '+(tool.mcp.server.mode==='workshop'?text('учебный стенд','browser workshop'):tool.mcp.server.url);
    row.querySelector('.tool-definition-body').prepend(note);
    // Keep the discovered schema tied to its actual MCP handler.
    row.querySelector('[data-tool-field="parameters"]').readOnly=true;
    row.querySelector('[data-tool-field="strict"]').disabled=true;
    if(tool.mcp.server.mode==='remote') {
      const label=document.createElement('label');label.className='api-field ym-hide-content';const span=document.createElement('span');span.textContent=text('MCP Bearer token · только в этой вкладке','MCP Bearer token · this tab only');
      const input=document.createElement('input');input.type='password';input.className='api-input';input.autocomplete='off';
      input.addEventListener('change',()=>{try{McpLibrary.setToken(tool.mcp.server,input.value);input.value='';input.placeholder=text('Токен задан','Token is set');}catch(error){toast(error.message);}});label.append(span,input);note.after(label);
    }
  };
  window.attachMcpRunner = (row,input,call,turn,tool) => {
    const box=document.createElement('div');box.className='tool-http-runner';
    const status=document.createElement('div');status.setAttribute('role','status');
    const run=document.createElement('button');run.type='button';run.className='cfg-btn';run.textContent=text('Выполнить MCP-вызов','Run MCP call');
    const description=document.createElement('p');description.textContent=tool.mcp.server.title+' · '+tool.mcp.toolName+' · '+(tool.mcp.server.mode==='workshop'?text('учебный стенд','browser workshop'):tool.mcp.server.url);
    run.onclick=async()=>{
      if(pendingOpenAIToolTurn!==turn||isThinking)return;
      const controller=new AbortController();turn.controllers.add(controller);run.disabled=true;input.disabled=true;input.value='';updateOpenAIRequestPreview();
      const client=new McpClient(tool.mcp.server);status.textContent=text('Выполняется…','Running…');
      try {
        const result=await client.call(tool.mcp.toolName,JSON.parse(call.function.arguments||'{}'),controller.signal);
        if(pendingOpenAIToolTurn!==turn)return;
        input.value=McpLibrary.redact(result);input.dispatchEvent(new Event('input',{bubbles:true}));
        status.textContent=result.isError?text('Инструмент вернул ошибку. Проверьте результат перед отправкой модели.','The tool returned an error. Review it before sending.'):text('Результат получен. Можно отправить модели.','Result received. Ready to send to the model.');
      }catch(error){if(pendingOpenAIToolTurn===turn)status.textContent=McpLibrary.redact(error.name==='AbortError'?text('Вызов отменён или истекло время ожидания.','Call cancelled or timed out.'):error.message);}
      finally{await client.close().catch(()=>{});turn.controllers.delete(controller);run.disabled=false;input.disabled=false;}
    };
    box.append(description,run,status);row.append(box);
  };
  const tools=readOpenAIForm().tools;document.querySelectorAll('.tool-definition').forEach((row,index)=>decorateMcpTool(row,tools[index]));
})();
