(() => {
  // No credentials or application settings are included in exported source.
  async function launchMcpServer(definition, createRuntime, allowedOrigins) {
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
    const { createServer } = await import('node:http');
    const runtime = createRuntime((request,http,tool) => {
      const auth=http.auth;if(!auth||auth.placement==='none')return request;
      const key=process.env['MCP_TOOL_KEY_'+(definition.tools.indexOf(tool)+1)];
      if(!key)throw new Error('Set MCP_TOOL_KEY_'+(definition.tools.indexOf(tool)+1));
      if(new URL(request.url).origin!==new URL(http.url).origin)throw new Error('Tool endpoint origin changed; refusing to send credentials.');
      const result={...request,headers:{...request.headers}}, value=(auth.prefix||'')+key;
      if(auth.placement==='header')result.headers[auth.name]=value;
      else if(auth.placement==='query'){const url=new URL(result.url);url.searchParams.set(auth.name,value);result.url=url.href;}
      return result;
    });
    const redact = value => {
      let text=JSON.stringify(value);
      for(const [key,secret] of Object.entries(process.env))if(secret&&(key==='MCP_TOKEN'||key.startsWith('MCP_TOOL_KEY_')))for(const form of [secret,encodeURIComponent(secret)])text=text.split(form).join('[REDACTED]');
      return JSON.parse(text);
    };
    definition.tools.forEach(tool => runtime.schemaCheck(tool.inputSchema));
    function makeServer() {
      const server=new Server({name:definition.name,version:'1.0.0'},{capabilities:{tools:{}}});
      server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:definition.tools.map(({name,description,inputSchema})=>({name,description,inputSchema}))}));
      server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
        const tool=definition.tools.find(item=>item.name===request.params.name);
        if(!tool)return {isError:true,content:[{type:'text',text:'Tool not found'}]};
        const signal=AbortSignal.any([extra.signal,AbortSignal.timeout(30000)]);
        return redact(await runtime.invoke(tool,request.params.arguments||{},signal));
      });
      return server;
    }
    if(process.argv.includes('--stdio')) {
      await makeServer().connect(new StdioServerTransport());return;
    }
    const port=Number(process.env.PORT||3100);
    if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
    const allowed=new Set([...allowedOrigins,...(process.env.MCP_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean)]);
    const app=createServer(async(req,res)=>{
      const host=req.headers.host;
      if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);res.end('Host not allowed');return;}
      const origin=req.headers.origin;
      if(origin&&!allowed.has(origin)){res.writeHead(403);res.end('Origin not allowed');return;}
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
      res.setHeader('Access-Control-Expose-Headers','Mcp-Session-Id, MCP-Protocol-Version');
      if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
      if(req.url!=='/mcp'){res.writeHead(404);res.end();return;}
      if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
      if(process.env.MCP_TOKEN&&req.headers.authorization!=='Bearer '+process.env.MCP_TOKEN){res.writeHead(401);res.end('Unauthorized');return;}
      if(req.method!=='POST'){res.writeHead(405,{Allow:'POST, OPTIONS'});res.end();return;}
      let transport,server;
      try {
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
        let body;
        try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}));return;}
        server=makeServer();transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
        res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
        await server.connect(transport);await transport.handleRequest(req,res,body);
      }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);if(!res.writableEnded)res.end('MCP server error');await server?.close().catch(()=>{});}
    });
    app.listen(port,'127.0.0.1',()=>console.error('MCP listening at http://127.0.0.1:'+port+'/mcp'));
  }
  window.McpExport = {
    async server(record) {
      McpLibrary.validate(record);if(record.mode!=='workshop')throw new Error('Скачать можно сервер, собранный в конструкторе.');
      const definition=McpLibrary.clean(record);
      // Session credential identifiers are local to the browser, not server secrets.
      definition.tools.forEach(tool=>{if(tool.execution.http?.auth)tool.execution.http.auth.secretId='';});
      return '// Generated by AI Agents Lab. Node.js 20+.\n// npm install @modelcontextprotocol/sdk@1.30.0\n// node server.mjs  (or node server.mjs --stdio)\n\nconst definition = '+JSON.stringify(definition,null,2)+';\n\n'+createMcpRuntime.toString()+'\n\n'+launchMcpServer.toString()+'\n\nawait launchMcpServer(definition, createMcpRuntime, '+JSON.stringify([location.origin])+');\n';
    }
  };
})();
