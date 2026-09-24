(() => {
  const text = (ru,en) => lang === 'ru' ? ru : en;
  const clone = value => JSON.parse(JSON.stringify(value));
  function refreshPicker() {
    const select = document.getElementById('tool-library-select'), previous = select.value;
    select.replaceChildren();
    ToolLibrary.list().forEach(record => { const option = document.createElement('option'); option.value=record.id; option.textContent=record.title; select.append(option); });
    if ([...select.options].some(option => option.value === previous)) select.value=previous;
    select.setAttribute('aria-label',text('Инструмент из библиотеки','Tool from library'));
  }
  window.addLibraryTool = id => {
    if (localStorage.getItem('n8n_consent') !== '1') return false;
    try {
      appWorkspace.openSettings('openai');
      if (isReadonlyOpenAIPreset()) cloneOpenAIProfile();
      const tool = ToolLibrary.snapshot(id), tools = readOpenAIForm().tools;
      // Keep existing definitions intact; a second copy gets a unique model name.
      const originalName = tool.name;
      let suffix=2;
      while (tools.some(item => item.name === tool.name)) tool.name=originalName.slice(0,58)+'_'+suffix++;
      tool.libraryBase=clone(tool);
      tool.libraryOverrides=[];
      tools.push(tool); document.getElementById('openai-tools-enabled').checked=true;
      renderOpenAITools(tools); onOpenAIToolDraftChange(); commitOpenAISettings();
      document.getElementById('openai-tool-builder').open=true;
      const row=document.querySelector('.tool-definition:last-child'); row.open=true;
      row.scrollIntoView({block:'nearest'});
      refreshPicker();
      toast(text('Инструмент подключён: ','Tool connected: ')+tool.name);
      return true;
    } catch(error) { toast(ToolLibrary.redact(error.message)); return false; }
  };
  window.syncLibraryOverrides = () => {
    const enabled=document.getElementById('openai-tools-enabled').checked;
    document.querySelectorAll('.library-override').forEach(toggle => {
      toggle.disabled=!enabled;
      toggle.controlField.disabled=!enabled || !toggle.checked;
    });
    document.querySelectorAll('.library-editor .tool-http-mapping > button, .library-editor .tool-http > .cfg-btn').forEach(button => {button.disabled=true;});
    syncOpenAIPresetReadonly();
  };
  window.decorateLibraryTool = (row,tool) => {
    if (!tool.libraryId) return;
    const base=tool.libraryBase || clone(tool);
    row.libraryMetadata.libraryBase=base;
    const overrides=new Set(tool.libraryOverrides || []);
    const body=row.querySelector('.tool-definition-body');
    const fields=[...body.querySelectorAll('[data-tool-field], [data-http-field]')];
    fields.forEach((field,index) => {
      const key=(field.dataset.toolField || field.dataset.httpField)+':'+index;
      let inherited;
      if(field.dataset.toolField) inherited=base[field.dataset.toolField];
      else if(field.closest('.tool-http-mapping')) {
        const mappingIndex=[...row.querySelectorAll('.tool-http-mapping')].indexOf(field.closest('.tool-http-mapping'));
        inherited=base.http?.mappings?.[mappingIndex]?.[field.dataset.httpField];
      } else inherited=base.http?.[field.dataset.httpField];
      const label=document.createElement('label'); label.className='library-override-label';
      const toggle=document.createElement('input'); toggle.type='checkbox'; toggle.className='library-override'; toggle.checked=overrides.has(key); toggle.controlField=field;
      const caption=document.createElement('span'); caption.textContent=text('Переопределить','Override');
      label.append(toggle,caption);
      // Separate labels avoid nesting interactive labels in the field label.
      const host=field.closest('.api-field') || field.closest('.api-toggle-row');
      host.before(label);
      const fieldName=host.querySelector('span')?.textContent || field.dataset.toolField || field.dataset.httpField;
      toggle.setAttribute('aria-label',text('Переопределить: ','Override: ')+fieldName);
      toggle.addEventListener('change',()=>{
        if(toggle.checked) overrides.add(key);
        else { overrides.delete(key); if(field.type==='checkbox')field.checked=Boolean(inherited);else field.value=inherited ?? ''; field.dispatchEvent(new Event('input',{bubbles:true})); }
        row.libraryMetadata.libraryOverrides=[...overrides]; syncLibraryOverrides(); onOpenAIToolDraftChange(); commitOpenAISettings();
      });
    });
    const editor=document.createElement('details'); editor.className='library-editor';
    const summary=document.createElement('summary'); summary.textContent=text('Посмотреть поля / переопределить выбранные','Inspect fields / override selected values');
    body.before(editor); editor.append(summary,body);
    const intro=document.createElement('div'); intro.className='library-tool-intro';
    const title=document.createElement('strong'); title.textContent=tool.libraryTitle || tool.libraryId;
    const info=document.createElement('p'); info.textContent=text('Отдельная копия заготовки. По умолчанию используются готовые значения. Для изменения отметьте только нужное поле.','Independent preset copy. Ready-made values are used by default. Check only the fields you want to change.');
    const description=document.createElement('p'); description.textContent=tool.description;
    const endpoint=document.createElement('code'); endpoint.textContent=(tool.http?.method || 'GET')+' '+(tool.http?.url || '');
    const detach=document.createElement('button'); detach.type='button'; detach.className='cfg-btn'; detach.textContent=text('Сделать полностью редактируемой','Make fully editable');
    detach.onclick=()=>{
      const tools=readOpenAIForm().tools, index=[...document.querySelectorAll('.tool-definition')].indexOf(row);
      for(const key of ['libraryId','libraryTitle','libraryBase','libraryOverrides']) delete tools[index][key];
      renderOpenAITools(tools); onOpenAIToolDraftChange(); commitOpenAISettings();
    };
    intro.append(title,info,description,endpoint,detach); editor.before(intro);
    if(tool.http?.auth && tool.http.auth.placement!=='none') {
      const label=document.createElement('label');label.className='api-field ym-hide-content';
      const caption=document.createElement('span');caption.textContent=text('API key инструмента · только в этой вкладке','Tool API key · this tab only');
      const input=document.createElement('input');input.type='password';input.autocomplete='off';input.className='api-input';
      input.placeholder=ToolLibrary.getSecret(tool.http.auth.secretId)?text('Ключ задан','Key is set'):text('Введите ключ','Enter key');
      input.addEventListener('change',()=>{try{ToolLibrary.setSecret(tool.http.auth.secretId,input.value,new URL(readToolHttpEditor(row).url).origin);input.value='';input.placeholder=text('Ключ задан','Key is set');}catch(error){toast(ToolLibrary.redact(error.message));}});
      label.append(caption,input); intro.append(label);
    }
    syncLibraryOverrides();
  };
  refreshPicker();
  document.querySelectorAll('.tool-definition').forEach((row,index)=>decorateLibraryTool(row,readOpenAIForm().tools[index]));
  window.addEventListener('storage',event=>{if(event.key==='ai_tool_library_v1')refreshPicker();});
  window.addEventListener('tool-library:change',refreshPicker);
  new MutationObserver(refreshPicker).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
