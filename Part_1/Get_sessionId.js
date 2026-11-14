const ts_start_ms = Date.now();
const trace_id =
`trc_${ts_start_ms}_${Math.floor(Math.random() *
100000)}`;
const ts = new Date(ts_start_ms).toISOString();

// n8n Webhook node wraps the full request:
//   $json.headers  — HTTP headers
//   $json.body     — POST JSON body
//   $json.query    — GET query string params
//   $json.webhookUrl — the webhook URL itself (provided by n8n)
const headers = $json.headers || {};
const body    = $json.body   || {};
const query   = $json.query  || {};

// message_source: WH = webhook, TG = Telegram (future)
// Determined by the presence of webhookUrl in the n8n data
const webhookUrlN8n = $json.webhookUrl || '';
const message_source = webhookUrlN8n ? 'WH' : '';

const executionMode = $json.executionMode || '';

// Keep the UI operation ID separate from the HTTP proxy's request ID.
// An intermediary can assign a new header ID when forwarding the same payload again.
const client_request_id = body.requestId || query.requestId || '';
const client_timestamp = body.timestamp || query.timestamp || '';
const proxy_request_id = headers['x-request-id'] || '';
const request_id = client_request_id || proxy_request_id;

// message and sessionId come from body (POST) or query string (GET)
const user_message_text = body.message || body.user_message_text
                       || query.message || query.user_message_text || '';
const sessionId = body.sessionId || query.sessionId || '';

return [{ json: {
 sessionId,
 message_source,
 executionMode,
 user_message_text,
 trace_id,
 ts,
 ts_start_ms,
 request_id,
 client_request_id,
 client_timestamp,
 proxy_request_id } }];
