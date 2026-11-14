// n8n Code node, JavaScript, Run Once for All Items.
// Paste this code into TWO consecutive Code nodes after Webhook.
// Send "delay 40", "delay 55" or "delay 70" from the UI.
// Each node waits at most 40 seconds to stay below a 60-second runner timeout.
const input = $input.first().json;
const previous = input.diagnosticDelay;
const body = input.body || {};
const query = input.query || {};
const message = String(body.message || query.message || '').trim();
const match = message.match(/^delay\s+(40|55|70)$/i);
const targetSeconds = previous?.targetSeconds ?? (match ? Number(match[1]) : 0);
if (![40, 55, 70].includes(targetSeconds)) {
  throw new Error('Send delay 40, delay 55 or delay 70 from the UI.');
}

const completedDelayMs = previous?.completedDelayMs || 0;
const stepDelayMs = Math.min(40000, Math.max(0, targetSeconds * 1000 - completedDelayMs));
const stepStartedMs = Date.now();
const startedAt = previous?.startedAt || new Date(stepStartedMs).toISOString();
const requestId = body.requestId || query.requestId || '';
const clientTimestamp = body.timestamp || query.timestamp || '';
const proxyRequestId = input.headers?.['x-request-id'] || '';
const executionId = String($execution.id);
console.log(JSON.stringify({ event:'diagnostic_delay_start', executionId, requestId, proxyRequestId, targetSeconds, stepDelayMs, startedAt }));

await new Promise(resolve => setTimeout(resolve, stepDelayMs));

const finishedAt = new Date().toISOString();
const diagnosticDelay = {
  executionId,
  requestId,
  clientTimestamp,
  proxyRequestId,
  targetSeconds,
  completedDelayMs: completedDelayMs + stepDelayMs,
  startedAt,
  finishedAt,
  elapsedMs: Date.parse(finishedAt) - Date.parse(startedAt),
};
console.log(JSON.stringify({ event:'diagnostic_delay_finish', ...diagnosticDelay }));

return [{ json: {
  ...input,
  diagnosticDelay,
  output_clean: `Delay test completed. Target ${targetSeconds}s. Actual ${diagnosticDelay.elapsedMs}ms. Execution ${executionId}. RequestID ${requestId}. Proxy RequestID ${proxyRequestId}.`,
  full_debug: JSON.stringify(diagnosticDelay),
} }];
