(() => {
  'use strict';
function renderDebugJson(container, content, format = true) {
  container.replaceChildren();
  try { JSON.parse(content); } catch (_) { container.textContent = content; return; }
  // Format whitespace only: preserve number precision, duplicate keys and string escapes.
  const parts = content.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) || [];
  let depth = 0;
  if (format) content = parts.map((part, index) => {
    if (part === '{' || part === '[') {
      depth++;
      return part + (/^[}\]]$/.test(parts[index + 1] || '') ? '' : '\n' + '  '.repeat(depth));
    }
    if (part === '}' || part === ']') {
      depth--;
      return (/^[{\[]$/.test(parts[index - 1] || '') ? '' : '\n' + '  '.repeat(depth)) + part;
    }
    if (part === ',') return ',\n' + '  '.repeat(depth);
    return part === ':' ? ': ' : part;
  }).join('');
  const tokens = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b/g;
  let offset = 0;
  for (const match of content.matchAll(tokens)) {
    container.appendChild(document.createTextNode(content.slice(offset, match.index)));
    const span = document.createElement('span');
    span.className = match[0][0] === '"' ? (/^\s*:/.test(content.slice(match.index + match[0].length)) ? 'json-key' : 'json-string') : (/^(true|false|null)$/.test(match[0]) ? 'json-literal' : 'json-number');
    span.textContent = match[0]; container.appendChild(span);
    offset = match.index + match[0].length;
  }
  container.appendChild(document.createTextNode(content.slice(offset)));
}
function renderDebugTree(container, content) {
  // Keep literal tokens intact, including large numbers and duplicate object keys.
  const tokens = content.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) || [];
  const stack = [];
  let root;
  tokens.forEach((token, index) => {
    if (token === ':' || token === ',') return;
    if (token === '}' || token === ']') { stack.pop(); return; }
    const parent = stack[stack.length - 1];
    if (tokens[index + 1] === ':') { parent.nextKey = token; return; }
    const node = { key: parent ? parent.type === '[' ? String(parent.children.length) : parent.nextKey : '', type: token, children: [] };
    if (parent) parent.children.push(node); else root = node;
    if (token === '{' || token === '[') stack.push(node);
  });
  function appendNode(parent, node, open = false) {
    const branch = node.type === '{' || node.type === '[';
    const el = document.createElement(branch ? 'details' : 'div');
    el.className = branch ? 'debug-json-node' : 'debug-json-leaf';
    const line = branch ? document.createElement('summary') : el;
    if (node.key) {
      const key = document.createElement('span'); key.className = 'json-key'; key.textContent = node.key + ': '; line.appendChild(key);
    }
    const value = document.createElement('span');
    value.className = branch ? '' : node.type.startsWith('"') ? 'json-string' : /^(true|false|null)$/.test(node.type) ? 'json-literal' : 'json-number';
    value.textContent = branch ? `${node.type}${node.children.length ? '…' : ''}${node.type === '{' ? '}' : ']'} (${node.children.length})` : node.type;
    line.appendChild(value);
    if (branch) {
      el.appendChild(line);
      let loaded = false;
      const populate = () => {
        if (!el.open || loaded) return;
        loaded = true;
        const children = document.createElement('div'); children.className = 'debug-json-children';
        node.children.forEach(child => appendNode(children, child)); el.appendChild(children);
      };
      el.addEventListener('toggle', populate); el.open = open; populate();
    }
    parent.appendChild(el);
  }
  if (root) appendNode(container, root, true);
}
  function create({pre, heading, before = null, language = () => 'ru'}) {
    const toggle = document.createElement('span'); toggle.className = 'debug-view-toggle';
    toggle.setAttribute('role','group');
    const tree = document.createElement('div'); tree.className = 'debug-json-tree'; tree.hidden = true;
    let content = '', mode = 'text', loaded = false;
    const buttons = ['text','tree'].map(view => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.view = view;
      button.onclick = event => {
        event.preventDefault(); event.stopPropagation();
        mode = view; show();
      };
      toggle.append(button); return button;
    });
    function show() {
      if (mode === 'tree' && !loaded) { renderDebugTree(tree,content); loaded = true; }
      pre.hidden = mode === 'tree'; tree.hidden = mode !== 'tree';
      buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.view === mode)));
    }
    heading.insertBefore(toggle,before); pre.after(tree);
    return { update(value) {
      content = String(value ?? ''); loaded = false; tree.replaceChildren();
      let valid = true;
      try { JSON.parse(content); } catch (_) { valid = false; }
      const ru = language() === 'ru';
      toggle.setAttribute('aria-label',ru ? 'Просмотр JSON' : 'JSON view');
      buttons[0].textContent = ru ? 'Текст' : 'Text'; buttons[1].textContent = ru ? 'Дерево' : 'Tree';
      buttons[1].disabled = !valid;
      buttons[1].title = valid ? '' : ru ? 'Данные не содержат корректный JSON' : 'Data is not valid JSON';
      if (!valid) mode = 'text';
      renderDebugJson(pre,content); show();
    }};
  }
  window.JsonViewer = {renderText:renderDebugJson,renderTree:renderDebugTree,create};
})();
