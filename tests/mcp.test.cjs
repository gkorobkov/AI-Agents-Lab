const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function storage() {
  const values = new Map();
  return { get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,String(value)), removeItem: key => values.delete(key) };
}
function environment(fetch = async () => { throw new Error('Unexpected fetch'); }) {
  const sandbox = { fetch, URL, AbortController, AbortSignal, DOMException, TextDecoder, structuredClone, setTimeout, clearTimeout, Event, crypto:require('node:crypto').webcrypto, localStorage:storage(), sessionStorage:storage(), dispatchEvent() {}, location:{origin:'https://lab.example'}, ToolLibrary:{authorizeRequest:request=>request,redact:value=>value,validate() {}} };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const name of ['mcp-runtime.js','mcp-library.js','mcp-client.js','mcp-export.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui',name),'utf8'),context,{filename:name});
  return context;
}
const remote = () => ({schemaVersion:1,id:'remote',title:'Remote',name:'remote',description:'test',mode:'remote',url:'https://mcp.example/mcp',tools:[]});
const tool = {name:'echo',description:'Echo',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}};
const json = (id,result,headers={}) => new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{headers:{'Content-Type':'application/json',...headers}});

test('workshop lifecycle and typed template substitution preserve arbitrary input',async()=>{
  const env=environment(), record=env.McpLibrary.builtin();
  record.tools[0].inputSchema.properties.count={type:'integer',minimum:0};
  record.tools[0].execution.template='{"message":"Привет, {{name}}!","count":"{{count}}"}';
  const trace=[], client=new env.McpClient(record,(direction,message)=>trace.push({direction,message}));
  await client.connect();
  const name='"}<script>throw 1</script>';
  const result=await client.call('greet_student',{name,count:0});
  assert.equal(result.structuredContent.count,0);assert.equal(result.structuredContent.message,'Привет, '+name+'!');
  assert.deepEqual(trace.filter(item=>item.direction==='request').map(item=>item.message.method),['initialize','notifications/initialized','tools/list','tools/call']);
});

test('invalid arguments return tool errors before running a handler',async()=>{
  const env=environment(), client=new env.McpClient(env.McpLibrary.builtin());
  const result=await client.call('greet_student',{name:42});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/неверный тип/);
  const extra=await client.call('greet_student',{name:'Анна',other:true});assert.equal(extra.isError,true);
  const missing=await client.call('greet_student',{});assert.equal(missing.isError,true);
});

test('supported schema constraints and unsupported keywords are checked explicitly',()=>{
  const runtime=environment().McpLibrary.runtime;
  assert.throws(()=>runtime.schemaCheck({type:'string',pattern:'x'}),/не поддерживает/);
  assert.throws(()=>runtime.validate({type:'string',minLength:2},'😀'),/длина/);
  assert.throws(()=>runtime.validate({type:'array',items:{type:'integer'},maxItems:2},[1,2,3]),/длина/);
  assert.throws(()=>runtime.validate({type:'number',maximum:5},6),/диапазона/);
  runtime.validate({type:['string','null']},null);
});

test('HTTP templates retain JSON types, encode URL data, and block prototype paths',()=>{
  const runtime=environment().McpLibrary.runtime;
  const request=runtime.buildRequest({url:'https://api.example/search',method:'GET',mappings:[{key:'q',value:'{{name}}'}]}, {name:'a&b'});
  assert.equal(new URL(request.url).searchParams.get('q'),'a&b');
  const post=runtime.buildRequest({url:'https://api.example/data',method:'POST',mappings:[],body:'{"count":"{{count}}","query":"{{name}}"}'},{count:0,name:'"hello"'});
  assert.deepEqual(JSON.parse(post.body),{count:0,query:'"hello"'});
  assert.throws(()=>runtime.buildRequest({url:'https://api.example',method:'GET',mappings:[{key:'q',value:'{{__proto__.x}}'}]},{}),/Нет аргумента/);
});

test('remote handshake negotiates version, sends session/token, reads paginated SSE, and closes session',async()=>{
  const calls=[];
  const env=environment(async(url,options)=>{
    const message=options.body?JSON.parse(options.body):null;calls.push({url,options,message});
    if(options.method==='DELETE')return new Response(null,{status:204});
    if(message.method==='initialize')return json(message.id,{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'remote',version:'1'}},{'Mcp-Session-Id':'session-1'});
    assert.equal(options.headers['MCP-Protocol-Version'],'2025-06-18');assert.equal(options.headers['Mcp-Session-Id'],'session-1');assert.equal(options.headers.Authorization,'Bearer test-secret');
    if(message.method==='notifications/initialized')return new Response(null,{status:202});
    let result;
    if(message.method==='tools/list')result=message.params.cursor?{tools:[{...tool,name:'second'}]}:{tools:[tool],nextCursor:'next'};
    else result={content:[{type:'text',text:'remote result'}]};
    const data=': keepalive\r\n\r\nevent: message\r\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{}})+'\r\n\r\ndata: '+JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\r\n\r\n';
    const bytes=new TextEncoder().encode(data);
    return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  const record=remote();env.McpLibrary.setToken(record,'test-secret');const trace=[];const client=new env.McpClient(record,(_,value)=>trace.push(value));
  const connected=await client.connect();assert.equal(connected.tools.length,2);
  const result=await client.call('echo',{name:'Anna'});assert.equal(result.content[0].text,'remote result');
  await client.close();assert.equal(calls.at(-1).options.method,'DELETE');
  assert.equal(calls[0].options.headers['MCP-Protocol-Version'],undefined);
  assert(!JSON.stringify(trace).includes('test-secret'));assert(!JSON.stringify(env.McpLibrary.clean(record)).includes('test-secret'));
  assert.throws(()=>env.McpLibrary.getToken({...record,url:'https://other.example/mcp'}),/Адрес сервера изменился/);
});

test('repeated pagination cursors fail instead of looping',async()=>{
  const env=environment(async(_,options)=>{
    const message=JSON.parse(options.body);
    if(message.method==='initialize')return json(message.id,{protocolVersion:'2025-11-25',capabilities:{tools:{}}});
    if(message.method==='notifications/initialized')return new Response(null,{status:202});
    return json(message.id,{tools:[],nextCursor:'same'});
  });
  await assert.rejects(new env.McpClient(remote()).connect(),/курсор/);
});

test('SSE accepts bare CR line endings split across chunks',async()=>{
  const env=environment();const client=new env.McpClient(env.McpLibrary.builtin());
  const text='data: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\r\r';
  const stream=new ReadableStream({start(controller){for(const char of text)controller.enqueue(new TextEncoder().encode(char));controller.close();}});
  const reply=await client.readSSE(new Response(stream),7);assert.equal(reply.result.ok,true);
});

test('expired sessions do not automatically repeat tools/call',async()=>{
  let calls=0;
  const env=environment(async(_,options)=>{
    const message=JSON.parse(options.body);
    if(message.method==='initialize')return json(message.id,{protocolVersion:'2025-11-25',capabilities:{tools:{}}},{'Mcp-Session-Id':'expired'});
    if(message.method==='notifications/initialized')return new Response(null,{status:202});
    if(message.method==='tools/list')return json(message.id,{tools:[tool]});
    calls++;return new Response('',{status:404});
  });
  await assert.rejects(new env.McpClient(remote()).call('echo',{name:'Anna'}),/Сессия MCP завершена/);assert.equal(calls,1);
});

test('cancellation aborts an outstanding remote request',async()=>{
  const env=environment((_,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});}));
  const controller=new AbortController();const request=new env.McpClient(remote()).connect(controller.signal);controller.abort();
  await assert.rejects(request,error=>error.name==='AbortError');
});

test('server export contains executable handlers and no browser credential values',async()=>{
  const env=environment();const remoteRecord=remote();env.McpLibrary.setToken(remoteRecord,'never-export-me');
  const record=env.McpLibrary.builtin();const source=await env.McpExport.server(record);
  assert(source.includes('StreamableHTTPServerTransport'));assert(source.includes('StdioServerTransport'));assert(source.includes('127.0.0.1'));assert(source.includes('https://lab.example'));
  assert(!source.includes('never-export-me'));assert(!source.includes('sessionStorage'));assert(!source.includes('window.'));
});
