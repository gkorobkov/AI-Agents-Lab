const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const ui = join(__dirname, '..', 'ui');
const html = readFileSync(join(ui, 'index.html'), 'utf8');
const defaultUrl = html.match(/const CFG_LOCAL_PROXY_DEFAULT_URL = '([^']+)'/)[1];
const timeout = Number(html.match(/const CFG_LOCAL_PROXY_HEALTH_TIMEOUT_MS = (\d+)/)[1]);
const targetHeader = 'X-Proxy-Target-URL';

function environment(fetch, {storage = new Map(), standalone = false, navigator = {onLine:true}} = {}) {
  const env = {
    URL, Headers, AbortSignal, fetch, Event, dispatchEvent() {},
    navigator, document:{documentElement:{lang:'en'}},
    location:new URL('https://lab.example/ui/'),
    localStorage:{getItem:key => storage.get(key) ?? null, setItem:(key,value) => storage.set(key,value)}
  };
  if (!standalone) Object.assign(env, {CFG_LOCAL_PROXY_DEFAULT_URL:defaultUrl, CFG_LOCAL_PROXY_HEALTH_TIMEOUT_MS:timeout});
  env.window = env;
  vm.runInNewContext(readFileSync(join(ui,'local_proxy_transport.js'),'utf8'),env);
  return env.LocalProxyTransport;
}

test('Direct mode preserves the original fetch call and Response', async () => {
  const original = 'https://api.example/path';
  const options = {credentials:'same-origin'};
  const response = new Response('direct');
  const transport = environment((url, init) => {
    assert.equal(url, original);
    assert.equal(init, options);
    return response;
  });
  assert.equal(await transport.fetch(original, options), response);
});

test('enabled requests share the current address, retaining target, headers, body and signal', async () => {
  const storage = new Map();
  const calls = [];
  const fetch = (url, options) => { calls.push({url,options}); return new Response('ok'); };
  const first = environment(fetch, {storage}), second = environment(fetch, {storage});
  const signal = new AbortController().signal;
  const form = new FormData();
  form.set('snapshot', new Blob(['snapshot']));
  first.setUrl('http://localhost:19090/base/');
  await first.fetch('../api?x=1&x=2', {method:'POST',headers:{Authorization:'Bearer fixture'},body:form,signal}, true);
  second.setUrl('http://localhost:19091');
  const bytes = new Uint8Array([1, 2, 255]);
  await first.fetch('https://api.example/second', {method:'POST',body:bytes,signal}, true);
  assert.equal(calls[0].url, 'http://localhost:19090/base/proxy');
  assert.equal(calls[0].options.headers.get(targetHeader), 'https://lab.example/api?x=1&x=2');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer fixture');
  assert.equal(calls[0].options.headers.has('Content-Type'), false);
  assert.equal(calls[0].options.body, form);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[1].url, 'http://localhost:19091/proxy');
  assert.equal(calls[1].options.body, bytes);
});

test('reject unsafe proxy URLs and reserved headers and never retry using Direct', async () => {
  const calls = [];
  const transport = environment(url => { calls.push(url); throw new TypeError('network'); });
  for (const url of ['file:///a','http://user:password@localhost','http://localhost/?x=1','http://localhost/#']) {
    assert.throws(() => transport.setUrl(url), /Invalid proxy URL/);
  }
  await assert.rejects(transport.fetch('/api', {headers:{[targetHeader]:'https://example.com'}}, true), /reserved/);
  assert.deepEqual(calls, []);
  await assert.rejects(transport.fetch('/api', {}, true), /proxy is unavailable/);
  assert.deepEqual(calls, [defaultUrl + '/proxy']);
});

test('standalone pages read the central default and health checks omit credentials', async () => {
  const calls = [];
  const transport = environment(async (url, options) => {
    calls.push(url);
    if (url === 'index.html') return new Response(html);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    return Response.json({service:'ai-agents-local-proxy',status:'ok',version:'1.0'});
  }, {standalone:true});
  const result = await transport.check();
  assert.equal(result.status, 'connected');
  assert.equal(result.version, '1.0');
  assert.deepEqual(calls, ['index.html', defaultUrl + '/health']);
});

test('health reports confirmed permission denial separately from an ambiguous failure', async () => {
  const offline = () => Promise.reject(new TypeError('network'));
  const denied = environment(offline, {navigator:{onLine:true, permissions:{query:async () => ({state:'denied'})}}});
  assert.equal((await denied.check()).status, 'blocked');
  assert.equal((await environment(offline).check()).status, 'unreachable');
  assert.equal((await environment(async () => Response.json({status:'ok'})).check()).status, 'invalid');
});
