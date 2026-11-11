
const rows = $input.all();
const agentResponse = $('AI Agent Output Parser').first().json;

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// При повторяющихся field_key берём последнюю запись
const byKey = new Map();

for (const item of rows) {
  const row = item.json ?? {};
  if (row.field_key == null) continue;

  const key = String(row.field_key).trim();
  if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) {
    continue;
  }

  const rawTime = row.updatedAt ?? row.createdAt;
  const parsedTime = rawTime ? Date.parse(rawTime) : 0;
  const timestamp = Number.isFinite(parsedTime) ? parsedTime : 0;
  const previous = byKey.get(key);

  if (!previous || timestamp > previous.timestamp) {
    byKey.set(key, {
      value: String(row.field_value ?? ''),
      timestamp,
    });
  }
}

// Формируем словарь
const last_chat_history = {};

for (const [key, record] of byKey) {
  last_chat_history[key] = record.value;
}

// Добавляем новый раздел отладки
const historyDebug =
  '<b>Last Chat History for Next Request</b>\n' +
  (Object.keys(last_chat_history).length
    ? `<code>${escHtml(JSON.stringify(last_chat_history, null, 2))}</code>`
    : '<code>No chat history</code>');

const full_debug = [
  String(agentResponse.full_debug ?? '').trim(),
  historyDebug,
].filter(Boolean).join('\n\n');

// Сохраняем все поля ответа AI Agent Output Parser
return [{
  json: {
    ...agentResponse,
    last_chat_history,
    full_debug,
  },
}];
