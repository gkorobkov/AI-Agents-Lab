// Store data, then rebuild message controls through the normal renderers.
// Requests and tool actions are never restarted by restoring a transcript.
(() => {
  const key = 'ai_chat_session_v1';
  const container = document.getElementById('messages');
  let queued = false, storageErrorShown = false;
  function save() {
    queued = false;
    try {
      const rows = [...container.querySelectorAll('.msg-row')].map(row => {
        const bubble = row.querySelector('.bubble');
        const custom = row.chatHistoryPlain || row.classList.contains('tool-output-message') || row.classList.contains('site') || !!bubble?.querySelector('.tool-call-response');
        const copy = bubble?.cloneNode(true);
        copy?.querySelectorAll('button,textarea,input,.tool-result-actions').forEach(node => node.remove());
        const time = [...(row.querySelector('.bubble-meta')?.children || [])].find(node => node.tagName === 'SPAN' && /^\d{1,2}:\d{2}/.test(node.textContent));
        return {
          role: row.classList.contains('user') ? 'user' : row.classList.contains('site') ? 'site' : 'agent',
          text: custom || row.chatHistoryText == null ? copy?.textContent || '' : row.chatHistoryText,
          plain: custom || !!bubble?.classList.contains('error'), error: !!bubble?.classList.contains('error'),
          transport: row.dataset.transport, conversation: row.dataset.openaiConversation,
          provenance: row.dataset.provenance || '', message: row.dataset.openaiMessage, messages: row.dataset.openaiMessages,
          time: time?.textContent, response: row.chatHistoryResponse, debug: row.chatHistoryDebug,
          debugOpen: row.querySelector('.debug-block')?.open
        };
      });
      sessionStorage.setItem(key, JSON.stringify({ version: 1, rows, contextStart: openAIContextStart, conversation: openAIConversationId, suggestions: recentSuggestions }));
    } catch (_) {
      if (!storageErrorShown) {
        storageErrorShown = true;
        toast(lang === 'ru' ? 'Не удалось сохранить историю чата в сессии браузера.' : 'Could not save chat history in this browser session.');
      }
    }
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.rows)) {
      const rows = saved.rows.filter(item => item && ['user','agent','site'].includes(item.role) && typeof item.text === 'string');
      // Archive interrupted tool turns without sending unanswered tool_calls again.
      const readMessages = item => {
        try { return item.messages ? JSON.parse(item.messages) : item.message ? [JSON.parse(item.message)] : []; }
        catch (_) { return []; }
      };
      const contextRows = rows.slice(saved.contextStart || 0).filter(item => item.conversation === saved.conversation);
      const messages = contextRows.flatMap(readMessages).filter(Boolean);
      const results = new Set(messages.filter(message => message.role === 'tool').map(message => message.tool_call_id));
      const complete = new Set(messages.flatMap(message =>
        message.tool_calls?.length && message.tool_calls.every(call => results.has(call.id)) ? message.tool_calls.map(call => call.id) : []
      ));
      contextRows.forEach(item => {
        if (!item.message && !item.messages) return;
        const clean = readMessages(item).filter(message => message && (message.role !== 'tool' || complete.has(message.tool_call_id))).flatMap(message => {
          if (!message.tool_calls?.length || message.tool_calls.every(call => complete.has(call.id))) return [message];
          return message.content ? [{role:'assistant',content:message.content}] : [];
        });
        item.messages = JSON.stringify(clean);
      });
      if (typeof saved.conversation === 'string') {
        openAIConversationId = saved.conversation;
        sessionStorage.setItem('ai_openai_conversation', openAIConversationId);
      }
      openAIContextStart = Number.isInteger(saved.contextStart) ? Math.max(0, Math.min(saved.contextStart, rows.length)) : 0;
      if (rows.length) {
        container.querySelectorAll('.msg-row,.suggestions-row,.welcome').forEach(node => node.remove());
        for (const item of rows) {
          const row = appendMessage(item.role, item.plain ? '' : item.text, item.provenance);
          row.chatHistoryText = item.text;
          row.chatHistoryPlain = !!item.plain;
          if (item.transport) row.dataset.transport = item.transport;
          if (item.conversation) row.dataset.openaiConversation = item.conversation;
          if (typeof item.message === 'string') row.dataset.openaiMessage = item.message;
          if (typeof item.messages === 'string') row.dataset.openaiMessages = item.messages;
          if (item.plain) {
            const bubble = row.querySelector('.bubble'), copy = bubble.querySelector('.bubble-copy-btn');
            const text = document.createElement('div'); text.className = 'plain'; text.textContent = item.text;
            bubble.replaceChildren(text); if (copy) bubble.append(copy);
            bubble.classList.toggle('error', !!item.error);
          } else if (item.response) addResponseView(row, item.response.rawReply, item.response.parsed);
          if (item.time) {
            const time = [...row.querySelector('.bubble-meta').children].find(node => node.tagName === 'SPAN');
            if (time) time.textContent = item.time;
          }
          if (item.debug) {
            if (item.debug.summary?.status === 'pending') item.debug.summary.status = 'interrupted';
            appendDebug(row, item.debug);
            row.querySelector('.debug-block').open = !!item.debugOpen;
          }
        }
      }
      recentSuggestions = Array.isArray(saved.suggestions) ? saved.suggestions.filter(item => typeof item === 'string') : [];
      renderSuggestionMenu();
    }
  } catch (_) {} // An invalid saved transcript must not prevent a fresh chat.
  new MutationObserver(() => {
    if (queued) return;
    queued = true; queueMicrotask(save);
  }).observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
  window.addEventListener('pagehide', save);
})();
