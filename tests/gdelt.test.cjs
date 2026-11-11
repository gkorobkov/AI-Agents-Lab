const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'../ui');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const defaults = JSON.parse(html.match(/const CFG_GDELT_DEFAULTS = (\{[\s\S]*?\n\});/)[1]);
const record = JSON.parse(fs.readFileSync(path.join(root,'tool-gdelt-news.json'),'utf8'));
const now = new Date('2026-11-11T12:00:00Z');
const article = {title:'News',url:'https://example.com/news',seendate:'20261110T120000Z',domain:'example.com',language:'English',sourcecountry:'Russia'};
const json = (value = {articles:[article]}, status = 200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function environment(fetch = async () => json(), overrides = {}) {
  const events = [], calls = [];
  const store = () => ({getItem:()=>null,setItem(){},removeItem(){},length:0});
  const env = {gdeltDefaults:{...defaults,retryDelayMs:1,minRequestIntervalMs:1,...overrides},URL,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,performance,crypto:require('node:crypto').webcrypto,Event,
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:event=>events.push(event),localStorage:store(),sessionStorage:store(),
    fetch:async (...args) => { calls.push(args); return fetch(...args); },MaterialCatalog:{load:async()=>({records:[record],errors:[]})}};
  env.window = env; env.parent = env;
  vm.createContext(env);
  for (const file of ['tool-gdelt.js','tool-library.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env,{filename:file});
  return {env,events,calls};
}
test('Moscow defaults, Petersburg 7d, topic-only and city + keywords',async()=>{
  const {env}=environment(); await env.ToolLibrary.ready;
  for (const [args,city,keywords,span] of [[{city:'Москва'},'Moscow',undefined,'24h'],[{city:'Санкт-Петербург',timespan:'7d'},'Saint Petersburg',undefined,'7d'],[{keywords:'AI'},undefined,'AI','24h'],[{city:'Москва',keywords:'festival'},'Moscow','festival','24h']]) {
    const request=env.GdeltTool.prepare(args,now), url=new URL(request.url);
    assert.equal(request.query.city,city); assert.equal(request.query.keywords,keywords);assert.equal(url.searchParams.get('timespan'),span);
    assert.equal(url.searchParams.get('mode'),'artlist'); assert.equal(url.searchParams.get('format'),'json');assert.equal(url.searchParams.get('sort'),'datedesc');assert.equal(url.searchParams.get('maxrecords'),'10');
  }
});
test('publisher filters stay inside query and encode country names safely',async()=>{
  const {env}=environment(); await env.GdeltTool.ready;
  const url=new URL(env.GdeltTool.prepare({city:'Москва',source_language:'русский',source_country:'United States'},now).url);
  assert.equal(url.searchParams.get('query'),'"Moscow" sourcelang:russian sourcecountry:unitedstates');
  assert.equal(url.searchParams.has('sourcelang'),false);assert.equal(url.searchParams.has('sourcecountry'),false);
});
test('absolute UTC ranges override timespan; one-sided ranges get explicit boundaries',async()=>{
  const {env}=environment();await env.GdeltTool.ready;
  const args={keywords:'AI',start_date:'2026-11-09T00:00:00Z',end_date:'2026-11-10T12:00:00Z',timespan:'ignored'};
  const url=new URL(env.GdeltTool.prepare(args,now).url);
  assert.equal(url.searchParams.has('timespan'),false);assert.equal(url.searchParams.get('startdatetime'),'20261109000000');assert.equal(url.searchParams.get('enddatetime'),'20261110120000');
  assert.equal(env.GdeltTool.prepare({city:'Moscow',start_date:args.start_date},now).query.end_date,now.toISOString());
  assert.equal(env.GdeltTool.prepare({city:'Moscow',end_date:args.end_date},now).query.start_date,'2026-08-11T12:00:00.000Z');
});
test('invalid criteria, types, operators, dates and limits fail before fetch, without retries',async()=>{
  const {env,calls}=environment();await env.GdeltTool.ready;
  for(const args of [{},{city:' '},{city:4},{keywords:'AI domain:evil.com'},{city:'Moscow OR Berlin'},{city:'Moscow',source_country:'russia -word'},{city:'Moscow',limit:51},{city:'Moscow',limit:0},{city:'Moscow',limit:1.5},{city:'Moscow',limit:'10'},{city:'Moscow',sort:'toneasc'},{city:'Moscow',timespan:'14min'},{city:'Moscow',timespan:'4m'},{city:'Moscow',timespan:'100d'},{city:'Moscow',start_date:'2026-11-12T00:00:00Z'},{city:'Moscow',start_date:'2026-02-30T00:00:00Z'},{city:'Moscow',start_date:'2026-07-01T00:00:00Z'},{city:'Moscow',start_date:'2026-11-10T00:00:00+03:00'},{city:'Moscow',start_date:'2026-11-10T01:00:00Z',end_date:'2026-11-10T00:00:00Z'}]) assert.throws(()=>env.GdeltTool.prepare(args,now));
  const result=await env.GdeltTool.execute(record.tool,{}); assert.equal(result.status,'error');assert.equal(result.error.category,'invalid_parameters');assert.equal(calls.length,0);
});
test('normalization removes URL duplicates/tracking, unsafe URLs and future dates; nullable fields and limit',async()=>{
  const {env}=environment(); await env.GdeltTool.ready;
  const result=env.GdeltTool.normalize({articles:[{...article,url:'https://EXAMPLE.com/news?utm_source=test#top',socialimage:'javascript:alert(1)'},{...article,url:'https://example.com/news'},{url:'javascript:alert(1)'},{...article,url:'https://future.example',seendate:'20261112T000000Z'},{url:'https://other.example',seendate:'broken'},{url:'https://third.example'}]}, {limit:2},now);
  assert.equal(result.status,'ok');assert.equal(result.count,2);assert.equal(result.articles[0].url,'https://example.com/news');assert.equal(result.articles[0].published_at,'2026-11-10T12:00:00Z');assert.equal(result.articles[0].image_url,null);assert.equal(result.articles[1].published_at,null);assert.equal(result.articles[1].title,null);
  assert.equal(env.GdeltTool.normalize({articles:Array.from({length:80},(_,i)=>({...article,url:'https://example.com/'+i}))},{limit:50},now).count,50);
});
test('empty, malformed JSON, HTTP 200 text/HTML and incorrect JSON structures stay distinct',async()=>{
  for(const [response,status,category] of [[()=>json({articles:[]}),'empty',undefined],[()=>new Response('{broken',{headers:{'Content-Type':'application/json'}}),'error','invalid_json'],[()=>new Response('Your query is too short',{headers:{'Content-Type':'text/plain'}}),'error','invalid_response'],[()=>new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}),'error','invalid_response'],[()=>json({error:'query'}),'error','invalid_response']]) {
    const {env,calls}=environment(response);const result=await env.GdeltTool.execute(record.tool,{city:'Москва'});
    assert.equal(result.status,status); assert.equal(result.error?.category,category);assert.equal(calls.length,1);
  }
});
test('temporary 503 and 429 retry once; permanent 400 does not retry',async()=>{
  for(const status of [503,429,400]) {
    let n=0;const {env,calls}=environment(()=>++n===1 ? json({},status) : json());
    const result=await env.GdeltTool.execute(record.tool,{city:'Москва'});
    assert.equal(calls.length,status===400?1:2);assert.equal(result.status,status===400?'error':'ok');
  }
});
test('timeouts, cancellation and network failures return sanitized errors and bounded retry',async()=>{
  const {env,calls}=environment(()=>{throw new Error('PRIVATE STACK SECRET');});
  const result=await env.GdeltTool.execute(record.tool,{keywords:'AI'});assert.equal(calls.length,2);assert.equal(result.error.category,'unavailable');assert(!JSON.stringify(result).includes('PRIVATE'));
  const timed=environment((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')))),{timeoutMs:5});
  assert.equal((await timed.env.GdeltTool.execute(record.tool,{keywords:'AI'})).error.category,'timeout');assert.equal(timed.calls.length,2);
  const abort=new AbortController();abort.abort();const cancelled=environment();
  assert.equal((await cancelled.env.GdeltTool.execute(record.tool,{keywords:'AI'},{signal:abort.signal})).error.category,'cancelled');assert.equal(cancelled.calls.length,0);
});
test('catalog snapshot routes model function-call arguments through shared adapter and records telemetry',async()=>{
  const {env,events,calls}=environment();await env.ToolLibrary.ready;
  const tool=env.ToolLibrary.snapshot('gdelt_news');assert.equal(tool.name,'search_news_gdelt');assert.equal(tool.adapter,'gdelt');
  const call={id:'call_1',type:'function',function:{name:tool.name,arguments:'{"city":"Москва","limit":1}'}};
  const request=env.ToolLibrary.buildRequest(tool,JSON.parse(call.function.arguments));assert.equal(new URL(request.url).searchParams.get('maxrecords'),'1');
  const result=await env.GdeltTool.execute(tool,JSON.parse(call.function.arguments));
  assert.equal(result.status,'ok');assert.equal(result.count,1);assert.equal(events.at(-1).type,'tool:request');assert.equal(result.meta.tool_name,'search_news_gdelt');assert.equal(result.meta.external_http_status,200);assert(result.meta.request_id);assert.equal(result.meta.error_category,null);assert(!JSON.stringify(result.meta).includes('Moscow'));
  assert.equal(calls[0][1].credentials,'omit');assert.equal(calls[0][1].redirect,'error');
  assert.throws(()=>env.ToolLibrary.buildRequest({...tool,http:{...tool.http,url:'https://other.example'}},{city:'Moscow'}));
  const ordinary={name:'old',description:'old',parameters:'{"type":"object","properties":{"name":{"type":"string"}}}',http:{url:'https://example.com',method:'GET',mappings:[{key:'q',value:'{{name}}'}]}};
  assert.equal(new URL(env.ToolLibrary.buildRequest(ordinary,{name:'a&b'}).url).searchParams.get('q'),'a&b');
});
test('standalone Tools consumes defaults from index.html without independent values',async()=>{
  const {env}=environment(()=>new Response(html)); delete env.gdeltDefaults;
  vm.runInContext(fs.readFileSync(path.join(root,'tool-gdelt.js'),'utf8'),env);
  await env.GdeltTool.ready;assert.equal(env.GdeltTool.prepare({city:'Москва'},now).query.timespan,defaults.timespan);
});
test('concurrent calls are serialized and leave a cooldown before the next fetch',async()=>{
  let active=0, maximum=0;const starts=[],finishes=[];
  const {env}=environment(async()=>{starts.push(performance.now());active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,5));active--;finishes.push(performance.now());return json();},{minRequestIntervalMs:15});
  const results=await Promise.all([env.GdeltTool.execute(record.tool,{city:'Moscow'}),env.GdeltTool.execute(record.tool,{keywords:'festival'})]);
  assert(results.every(result=>result.status==='ok'));assert.equal(maximum,1);assert(starts[1]-finishes[0]>=12);
});
test('429 is handled before reading an error body and long Retry-After is not shortened',async()=>{
  const {env,calls}=environment(()=>({status:429,ok:false,headers:new Headers({'Retry-After':'120'}),body:null,text:()=>{throw Error('Do not read rate-limit body');}}));
  const result=await env.GdeltTool.execute(record.tool,{city:'Moscow'});
  assert.equal(result.error.category,'rate_limit');assert.equal(result.meta.external_http_status,429);assert.equal(calls.length,1);
});
test('browser-hidden HTTP errors are explained honestly, without an invented status',async()=>{
  const {env}=environment(()=>{throw new TypeError('Failed to fetch');});
  const result=await env.GdeltTool.execute(record.tool,{city:'Moscow'});
  assert.equal(result.meta.external_http_status,null);assert.equal(result.error.category,'unavailable');assert.match(result.error.message,/CORS/);
});
test('cancelling a cooldown prevents another fetch and reports cancellation',async()=>{
  const {env,calls}=environment(async()=>json(),{minRequestIntervalMs:50});
  await env.GdeltTool.execute(record.tool,{city:'Moscow'});
  const controller=new AbortController();const pending=env.GdeltTool.execute(record.tool,{city:'Moscow'},{signal:controller.signal,onProgress:progress=>{if(progress.stage==='waiting')controller.abort();}});
  assert.equal((await pending).error.category,'cancelled');assert.equal(calls.length,1);
});
