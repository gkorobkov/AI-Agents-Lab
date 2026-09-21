(() => {
  'use strict';
  const CFG_MCP_VERSIONS = ['2025-11-25','2025-06-18','2025-03-26'];
  class McpClient {
    constructor(record, trace = () => {}) {
      this.record = structuredClone(record); McpLibrary.validate(this.record);
      this.trace = trace; this.sequence = 0; this.version = null; this.session = null; this.initialized = false;
    }
    async local(message, signal) {
      const {method,params,id} = message;
      let result;
      if (method === 'initialize') result = {protocolVersion:CFG_MCP_VERSIONS[0],capabilities:{tools:{}},serverInfo:{name:this.record.name,version:'1.0.0'}};
      else if (method === 'notifications/initialized') { this.initialized = true; return null; }
      else if (!this.initialized) return {jsonrpc:'2.0',id,error:{code:-32000,message:'Сначала initialize и notifications/initialized.'}};
      else if (method === 'tools/list') result = {tools:this.record.tools.map(({name,description,inputSchema}) => ({name,description,inputSchema}))};
      else if (method === 'tools/call') {
        const tool = this.record.tools.find(item => item.name === params.name);
        if (!tool) return {jsonrpc:'2.0',id,error:{code:-32602,message:'Инструмент не найден.'}};
        result = await McpLibrary.runtime.invoke(tool, params.arguments || {}, signal);
      } else return {jsonrpc:'2.0',id,error:{code:-32601,message:'Метод не поддерживается.'}};
      return {jsonrpc:'2.0',id,result};
    }
    async readSSE(response, id) {
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '', size = 0, dataLines = [];
      try {
        while (true) {
          const {value,done} = await reader.read();
          buffer += decoder.decode(value, {stream:!done}); size += value?.length || 0;
          if (size > 4000000) throw new Error('Поток ответа MCP слишком большой.');
          let boundary;
          while ((boundary = /\r\n|\r|\n/.exec(buffer))) {
            if (!done && boundary[0] === '\r' && boundary.index === buffer.length - 1) break;
            const line = buffer.slice(0,boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
            if (line) { if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /,'')); continue; }
            const data = dataLines.join('\n'); dataLines = [];
            if (!data.trim()) continue;
            const message = JSON.parse(data);
            if (message.jsonrpc === '2.0' && message.id === id && (Object.hasOwn(message,'result') || message.error)) return message;
            if (message.method && message.id !== undefined) throw new Error('Сервер запросил неподдерживаемую функцию клиента: ' + message.method);
          }
          if (done) throw new Error('MCP завершил поток без ответа на запрос. Повторите подключение.');
        }
      } finally { await reader.cancel().catch(() => {}); }
    }
    async rpc(method, params, signal, notification = false) {
      const message = {jsonrpc:'2.0',...(notification ? {} : {id:++this.sequence}),method,...(params === undefined ? {} : {params})};
      this.trace('request',message);
      const controller = new AbortController(); const abort = () => controller.abort();
      signal?.addEventListener('abort',abort,{once:true}); if (signal?.aborted) abort();
      const timer = setTimeout(abort,30000);
      try {
        let reply;
        if (this.record.mode === 'workshop') reply = await this.local(message,controller.signal);
        else {
          const headers = {'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
          if (this.version) headers['MCP-Protocol-Version'] = this.version;
          if (this.session) headers['Mcp-Session-Id'] = this.session;
          const token = McpLibrary.getToken(this.record); if (token) headers.Authorization = 'Bearer ' + token;
          const response = await fetch(McpLibrary.endpoint(this.record.url),{method:'POST',headers,body:JSON.stringify(message),credentials:'omit',redirect:'error',signal:controller.signal});
          if (!response.ok) {
            if (response.status === 404 && this.session) { this.session = null; this.version = null; this.initialized = false; throw new Error('Сессия MCP завершена. Подключитесь заново; вызов автоматически не повторяется.'); }
            throw new Error('MCP: HTTP ' + response.status + (response.status === 401 ? '. Проверьте токен доступа.' : ''));
          }
          if (notification) {
            if (response.status !== 202) throw new Error('MCP должен подтвердить уведомление статусом 202.');
            reply = null;
          } else {
            const type = response.headers.get('content-type') || '';
            if (type.includes('text/event-stream')) reply = await this.readSSE(response,message.id);
            else if (type.includes('application/json')) {
              const body = await response.text(); if (body.length > 2000000) throw new Error('Ответ MCP слишком большой.'); reply = JSON.parse(body);
            } else throw new Error('Ожидался JSON или SSE-ответ MCP.');
            if (method === 'initialize') this.session = response.headers.get('Mcp-Session-Id');
          }
        }
        if (controller.signal.aborted) throw new DOMException('Вызов отменён или истекло время ожидания.','AbortError');
        this.trace('response',reply || {status:202});
        if (notification) return;
        if (reply?.jsonrpc !== '2.0' || reply.id !== message.id) throw new Error('Неверный JSON-RPC ответ MCP.');
        if (reply.error) throw new Error('MCP ' + reply.error.code + ': ' + reply.error.message);
        if (!Object.hasOwn(reply,'result')) throw new Error('В ответе MCP нет result.');
        return reply.result;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
    }
    async connect(signal) {
      const init = await this.rpc('initialize',{protocolVersion:CFG_MCP_VERSIONS[0],capabilities:{},clientInfo:{name:'ai-agents-lab',version:'1.0.0'}},signal);
      if (!CFG_MCP_VERSIONS.includes(init?.protocolVersion) || !init.capabilities?.tools) throw new Error('Сервер не поддерживает совместимую версию MCP с tools.');
      this.version = init.protocolVersion;
      await this.rpc('notifications/initialized',undefined,signal,true); this.initialized = true;
      const tools = []; const cursors = new Set(); let cursor;
      do {
        const page = await this.rpc('tools/list',cursor ? {cursor} : {},signal);
        if (!Array.isArray(page.tools)) throw new Error('Неверный список MCP tools.');
        tools.push(...page.tools);
        if (tools.length > 200 || cursors.size > 50) throw new Error('Сервер вернул слишком много инструментов.');
        cursor = page.nextCursor;
        if (cursor !== undefined && (typeof cursor !== 'string' || !cursor || cursors.has(cursor))) throw new Error('Сервер повторяет или возвращает неверный курсор.');
        if (cursor) cursors.add(cursor);
      } while (cursor);
      const names = new Set();
      tools.forEach(tool => {
        if (typeof tool.name !== 'string' || !tool.name || tool.name.length > 128 || names.has(tool.name) || tool.inputSchema?.type !== 'object') throw new Error('Неверное или повторяющееся определение MCP-инструмента.');
        names.add(tool.name);
      });
      this.tools = tools; return {serverInfo:init.serverInfo,tools};
    }
    async call(name, args, signal) {
      if (!this.initialized) await this.connect(signal);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Аргументы должны быть JSON-объектом.');
      const result = await this.rpc('tools/call',{name,arguments:args},signal);
      if (!Array.isArray(result?.content)) throw new Error('Неверный результат tools/call.');
      return result;
    }
    async close() {
      if (!this.session || this.record.mode !== 'remote') return;
      const session = this.session; this.session = null; this.initialized = false;
      const headers = {'Mcp-Session-Id':session,'MCP-Protocol-Version':this.version};
      const token = McpLibrary.getToken(this.record); if (token) headers.Authorization = 'Bearer ' + token;
      await fetch(this.record.url,{method:'DELETE',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(3000)}).catch(() => {});
    }
  }
  window.McpClient = McpClient;
})();
