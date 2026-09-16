// Persistent panels are positioned with CSS, never detached or reloaded on switching.
(() => {
  const workspace = document.createElement('main');
  workspace.id = 'workspace';
  document.querySelector('body > header').after(workspace);
  const definitions = {
    chat: ['Чат', 'Chat'], settings: ['Настройки API', 'API settings'],
    labs: ['Лабы', 'Labs', 'labs.html'], tools: ['Библиотека Tools', 'Tool library', 'tools.html'], documentation: ['Документация', 'Documentation', 'documentation.html']
  };
  const panels = {};
  let slots = ['chat', null];
  let side = localStorage.getItem('ai_panel_side') === 'start' ? 'start' : 'end';
  let ratio = 50;
  const mobile = matchMedia('(max-width: 640px)');
  const initialized = new Set();
  const scrollPositions = new Map();
  const text = (ru, en) => lang === 'ru' ? ru : en;
  const label = id => text(...definitions[id]);
  const button = (caption, action) => {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = caption; el.onclick = action;
    return el;
  };
  const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const panelIcons = {
    chat: document.querySelector('[data-app-page="chat"] svg').outerHTML,
    labs: document.querySelector('[data-app-page="labs"] svg').outerHTML,
    settings: document.querySelector('#mode-settings-btn svg').outerHTML,
    tools: document.querySelector('[data-app-page="tools"] svg').outerHTML,
    documentation: icon('<path d="M4 3h11l5 5v13H4zM14 3v6h6M8 13h8M8 17h6"/>')
  };
  const actionIcons = {
    maximize: icon('<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>'),
    close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
    swap: icon('<path d="M3 8h18l-4-4M21 16H3l4 4"/>')
  };
  const iconButton = (markup, caption, action, className) => {
    const el = button('', action); el.innerHTML = markup;
    el.title = caption; el.setAttribute('aria-label', caption); el.className = className;
    return el;
  };
  Object.entries(definitions).forEach(([id, definition]) => {
    const panel = document.createElement('section');
    panel.className = 'workspace-panel'; panel.dataset.panel = id; panel.hidden = true;
    const head = document.createElement('div'); head.className = 'workspace-panel-head'; head.tabIndex = -1;
    const content = document.createElement('div'); content.className = 'workspace-panel-content';
    panel.append(head, content); workspace.append(panel);
    panels[id] = { panel, head, content };
    if (definition[2]) {
      const frame = document.createElement('iframe'); frame.title = label(id);
      frame.addEventListener('load', () => {
        syncTheme(); window.appMetrika?.bindClicks(frame.contentDocument, id);
      });
      content.append(frame); panels[id].frame = frame;
    }
  });
  panels.chat.content.append(document.getElementById('messages'), document.getElementById('input-area'));
  document.querySelectorAll('.transport-settings-panel').forEach(panel => panels.settings.content.append(panel));
  const scrollable = [document.getElementById('messages'), ...document.querySelectorAll('.transport-settings-panel')];
  scrollable.forEach(el => el.addEventListener('scroll', () => {
    if (el.clientHeight) scrollPositions.set(el, el.scrollTop);
  }));
  const sideButton = button('', () => {
    side = side === 'start' ? 'end' : 'start';
    localStorage.setItem('ai_panel_side', side); refreshLabels();
  });
  sideButton.id = 'panel-side-btn'; sideButton.className = 'icon-btn';
  document.getElementById('btn-debug-toggle').before(sideButton);
  const separator = document.createElement('div');
  separator.id = 'workspace-separator'; separator.tabIndex = 0;
  separator.setAttribute('role', 'separator');
  separator.setAttribute('aria-valuemin', '25'); separator.setAttribute('aria-valuemax', '75');
  workspace.append(separator);
  function syncTheme() {
    Object.values(panels).forEach(({ frame }) => {
      if (frame?.contentDocument) frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme;
    });
  }
  function refreshLabels() {
    const position = mobile.matches ? (side === 'start' ? text('сверху', 'above') : text('снизу', 'below')) : (side === 'start' ? text('слева', 'on the left') : text('справа', 'on the right'));
    sideButton.title = text('Новая панель ', 'New panel ') + position + text('. Нажмите, чтобы сменить сторону.', '. Click to change side.');
    sideButton.setAttribute('aria-label', sideButton.title);
    const rect = mobile.matches ? `x="3" y="${side === 'start' ? 3 : 12}" width="14" height="5"` : `x="${side === 'start' ? 3 : 12}" y="3" width="5" height="14"`;
    sideButton.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="1"/><rect ${rect} fill="currentColor" stroke="none"/></svg>`;
    Object.entries(panels).forEach(([id, { panel, head, frame }]) => {
      if (frame) frame.title = label(id);
      head.replaceChildren();
      const title = document.createElement('strong'); title.innerHTML = panelIcons[id];
      const caption = document.createElement('span'); caption.textContent = label(id);
      title.append(caption); title.title = label(id); head.append(title);
      panel.setAttribute('aria-label', label(id));
      ['chat', 'settings', 'labs', 'tools'].filter(candidate => !slots.includes(candidate)).forEach(candidate => {
        const split = slots.filter(Boolean).length > 1;
        const target = split ? slots.indexOf(id) : undefined;
        const targetStart = split ? target === 0 : side === 'start';
        const destination = mobile.matches
          ? (targetStart ? text('сверху', 'above') : text('снизу', 'below'))
          : (targetStart ? text('слева', 'on the left') : text('справа', 'on the right'));
        const hint = (split ? text('Открыть в этой панели ', 'Open in this panel ') : text('Открыть в новой панели ', 'Open in a new panel ')) + destination + ': ' + label(candidate);
        const switcher = iconButton(panelIcons[candidate], hint, () => {
          open(candidate, target); panels[candidate].head.focus();
        }, 'workspace-switch');
        head.append(switcher);
      });
      const split = slots.filter(Boolean).length > 1;
      const swap = iconButton(actionIcons.swap, text('Поменять панели местами', 'Swap panels'), () => {
        slots.reverse(); ratio = 100 - ratio; render(); head.focus();
      }, 'workspace-swap');
      swap.disabled = !split;
      const maximize = iconButton(actionIcons.maximize, text('На всю рабочую область: ', 'Fill workspace: ') + label(id), () => {
        slots = [id, null]; render(); head.focus();
      }, 'workspace-maximize');
      maximize.disabled = !split;
      const collapse = iconButton(actionIcons.close, text('Закрыть панель: ', 'Close panel: ') + label(id), () => {
        close(id);
        const remaining = slots.find(Boolean);
        (remaining ? panels[remaining].head : document.querySelector('[data-app-page="chat"]')).focus();
      }, 'workspace-collapse');
      collapse.disabled = !split;
      head.append(swap, maximize, collapse);
    });
    separator.setAttribute('aria-label', text('Размер областей', 'Panel sizes'));
    separator.setAttribute('aria-orientation', mobile.matches ? 'horizontal' : 'vertical');
  }
  function prepareSettings(mode) {
    if (initialized.has(mode)) return;
    api.preparing = true;
    try {
      if (mode === 'openai') openOpenAISettings(false);
      else if (mode === 'demo') openDemoSettings();
      else openWebhookSettings();
      initialized.add(mode);
    } finally { api.preparing = false; }
  }
  function render() {
    scrollable.forEach(el => { if (el.clientHeight) scrollPositions.set(el, el.scrollTop); });
    const split = slots.filter(Boolean).length === 2;
    workspace.dataset.split = String(split);
    workspace.style.setProperty('--workspace-ratio', ratio + '%');
    separator.hidden = !split; separator.setAttribute('aria-valuenow', String(ratio));
    Object.entries(panels).forEach(([id, { panel, frame }]) => {
      const index = slots.indexOf(id); panel.hidden = index < 0;
      panel.style.gridArea = index < 0 ? '' : split && index === 1 ? 'second' : 'first';
      if (index >= 0 && frame && !frame.hasAttribute('src')) frame.src = definitions[id][2] + '?embedded=1';
    });
    document.querySelectorAll('.transport-settings-panel').forEach(panel => {
      const visible = slots.includes('settings') && panel.id === transportMode + '-settings';
      panel.classList.toggle('open', visible); panel.setAttribute('aria-hidden', String(!visible));
    });
    document.getElementById('mode-settings-btn').setAttribute('aria-expanded', String(slots.includes('settings')));
    scrollable.forEach(el => { if (el.clientHeight && scrollPositions.has(el)) el.scrollTop = scrollPositions.get(el); });
    document.querySelectorAll('a[data-app-page]').forEach(link => {
      if (slots.includes(link.dataset.appPage)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    refreshLabels(); document.dispatchEvent(new Event('app:pagechange'));
  }
  function open(id, target) {
    if (!definitions[id]) id = 'chat';
    if (slots.includes(id)) {
      panels[id].panel.animate([{ outline: '2px solid var(--accent2)' }, { outline: '2px solid transparent' }], { duration: 600 });
      return;
    }
    if (id === 'settings') prepareSettings(transportMode);
    if (target === undefined || target < 0) {
      target = side === 'start' ? 0 : 1;
      if (slots.filter(Boolean).length === 1) {
        const current = slots.find(Boolean); slots = target === 0 ? [id, current] : [current, id];
      } else slots[target] = id;
    } else slots[target] = id;
    render();
  }
  function close(id) {
    if (!slots.includes(id) || slots.filter(Boolean).length < 2) return;
    slots = [slots.find(candidate => candidate && candidate !== id) || null, null];
    render();
  }
  const api = window.appWorkspace = {
    preparing: false, open, refreshLabels,
    openSettings(mode) {
      if (mode !== transportMode) setTransport(mode);
      prepareSettings(mode); open('settings');
    },
    closeSettings() { close('settings'); },
    refreshSettings() { if (slots.includes('settings')) prepareSettings(transportMode); render(); }
  };
  function resize(value) {
    ratio = Math.round(Math.max(25, Math.min(75, value)));
    workspace.style.setProperty('--workspace-ratio', ratio + '%');
    separator.setAttribute('aria-valuenow', String(ratio));
  }
  separator.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); separator.setPointerCapture(event.pointerId); workspace.classList.add('resizing');
  });
  separator.addEventListener('pointermove', event => {
    if (!separator.hasPointerCapture(event.pointerId)) return;
    const rect = workspace.getBoundingClientRect();
    resize(mobile.matches ? (event.clientY - rect.top) / rect.height * 100 : (event.clientX - rect.left) / rect.width * 100);
  });
  separator.addEventListener('lostpointercapture', () => workspace.classList.remove('resizing'));
  separator.addEventListener('keydown', event => {
    const keys = mobile.matches ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!keys.includes(event.key)) return;
    event.preventDefault(); resize(ratio + (event.key === keys[0] ? -5 : 5));
  });
  window.navigateApp = (page, hash = '', push = true) => {
    const id = definitions[page] ? page : 'chat'; closeDrawer(); open(id);
    const frame = panels[id].frame;
    if (frame && hash) {
      const jump = () => frame.contentDocument.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      if (frame.contentDocument?.readyState === 'complete' && frame.contentDocument.URL !== 'about:blank') jump();
      else frame.addEventListener('load', jump, { once: true });
    }
    const url = new URL(location.href);
    if (id === 'chat') url.searchParams.delete('page'); else url.searchParams.set('page', id);
    url.hash = hash; if (push) history.pushState({ page: id }, '', url);
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    const url = new URL(link.href, location.href); if (url.origin !== location.origin) return;
    const file = url.pathname.split('/').pop().replace(/\.html$/, '');
    const page = link.dataset.appPage || (['labs', 'documentation', 'tools'].includes(file) ? file : null);
    if (!page) return;
    event.preventDefault(); navigateApp(page, url.hash);
  });
  new MutationObserver(() => { syncTheme(); refreshLabels(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
  mobile.addEventListener('change', refreshLabels);
  function syncConsent() {
    const locked = localStorage.getItem('n8n_consent') !== '1';
    workspace.inert = locked; sideButton.disabled = locked;
  }
  document.addEventListener('app:consent', syncConsent);
  syncConsent();
  window.addEventListener('popstate', () => navigateApp(new URL(location.href).searchParams.get('page'), location.hash, false));
  render();
  const initialPage = new URL(location.href).searchParams.get('page');
  if (initialPage) navigateApp(initialPage, location.hash, false);
})();
