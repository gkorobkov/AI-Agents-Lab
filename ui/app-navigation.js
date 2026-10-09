// Persistent panels are positioned with CSS, never detached or reloaded on switching.
(() => {
  const workspace = document.createElement('main');
  workspace.id = 'workspace';
  document.querySelector('body > header').after(workspace);
  const definitions = {
    chat: ['Чат', 'Chat'], settings: ['Настройки OpenAI API', 'OpenAI API settings'],
    labs: ['Лабы', 'Labs', 'labs.html'], tools: ['Библиотека Tools', 'Tool library', 'tools.html'], mcp: ['Библиотека MCP', 'MCP library', 'mcp.html'], help: ['Помощь', 'Help', 'documentation.html'], documentation: ['Документация', 'Documentation', 'documentation.html']
  };
  const panels = {};
  let slots = ['chat', null];
  let side = localStorage.getItem('ai_panel_side') === 'start' ? 'start' : 'end';
  const savedLayout = localStorage.getItem('ai_panel_layout_v2');
  const legacyLayout = localStorage.getItem('ai_panel_layout');
  let layoutStep = /^[0-2]$/.test(savedLayout || '') ? Number(savedLayout)
    : /^[0-3]$/.test(legacyLayout || '') ? (Number(legacyLayout) % 2 ? 2 : Number(legacyLayout) === 2 ? 0 : 1)
    : side === 'start' ? 0 : 1;
  let singlePanel = layoutStep === 2;
  if (!singlePanel) side = layoutStep === 0 ? 'start' : 'end';
  let activePanel = 'chat';
  let ratio = 50;
  const mobile = matchMedia('(max-width: 640px)');
  const initialized = new Set();
  const scrollPositions = new Map();
  const frameScrollPositions = new Map();
  const text = (ru, en) => lang === 'ru' ? ru : en;
  const label = id => id === 'settings' && transportMode !== 'openai' ? text('Настройки API', 'API settings') : text(...definitions[id]);
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
    mcp: document.querySelector('[data-app-page="mcp"] svg').outerHTML,
    help: document.querySelector('[data-app-page="help"] svg').outerHTML,
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
        frame.contentWindow.addEventListener('scroll', () => {
          if (!panel.hidden && frame.clientHeight) frameScrollPositions.set(frame, [frame.contentWindow.scrollX, frame.contentWindow.scrollY]);
        }, { passive: true });
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
    layoutStep = (layoutStep + 1) % 3;
    singlePanel = layoutStep === 2;
    if (!singlePanel) side = layoutStep === 0 ? 'start' : 'end';
    localStorage.setItem('ai_panel_layout_v2', String(layoutStep));
    localStorage.setItem('ai_panel_side', side);
    refreshLabels();
    toast(singlePanel ? text('Новая панель на весь экран', 'New full-screen panel') : side === 'start' ? text('Новая панель СЛЕВА', 'New panel on the LEFT') : text('Новая панель СПРАВА', 'New panel on the RIGHT'));
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
    const nextLayout = (layoutStep + 1) % 3;
    const nextCaption = nextLayout === 2 ? text('новая панель на весь экран', 'new full-screen panel') : nextLayout === 0 ? text('новая панель СЛЕВА', 'new panel on the LEFT') : text('новая панель СПРАВА', 'new panel on the RIGHT');
    sideButton.title = text('Переключить: ', 'Switch to: ') + nextCaption;
    sideButton.dataset.layout = singlePanel ? 'single' : side;
    sideButton.setAttribute('aria-label', sideButton.title);
    const fill = singlePanel ? '' : `<rect x="${side === 'start' ? 4 : 14}" y="4" width="6" height="8" fill="currentColor" stroke="none"/><path d="M12 2v12"/>`;
    sideButton.innerHTML = `<svg viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="20" height="12" rx="1.2"/>${fill}</svg>`;
    Object.entries(panels).forEach(([id, { panel, head, frame }]) => {
      if (frame) frame.title = label(id);
      head.replaceChildren();
      const title = document.createElement('strong'); title.innerHTML = panelIcons[id];
      const caption = document.createElement('span'); caption.textContent = label(id);
      title.append(caption); title.title = label(id); head.append(title);
      panel.setAttribute('aria-label', label(id));
      ['help', 'labs', 'tools', 'mcp', 'chat', 'settings'].forEach(candidate => {
        const split = slots.filter(Boolean).length > 1;
        const target = split ? slots.indexOf(id) : undefined;
        const targetStart = split ? target === 0 : side === 'start';
        const destination = mobile.matches
          ? (targetStart ? text('сверху', 'above') : text('снизу', 'below'))
          : (targetStart ? text('слева', 'on the left') : text('справа', 'on the right'));
        const hint = singlePanel ? text('Открыть на всю рабочую область: ', 'Fill workspace: ') + label(candidate) : (split ? text('Открыть в этой панели ', 'Open in this panel ') : text('Открыть в новой панели ', 'Open in a new panel ')) + destination + ': ' + label(candidate);
        const switcher = iconButton(panelIcons[candidate], hint, () => {
          open(candidate, target); panels[candidate].head.focus();
        }, 'workspace-switch');
        switcher.dataset.page = candidate;
        if (candidate === id) switcher.setAttribute('aria-current', 'page');
        switcher.disabled = slots.includes(candidate);
        if (switcher.disabled) {
          switcher.title = text('Уже открыто: ', 'Already open: ') + label(candidate);
          switcher.setAttribute('aria-label', switcher.title);
        }
        head.append(switcher);
      });
      const split = slots.filter(Boolean).length > 1;
      const swap = iconButton(actionIcons.swap, text('Поменять панели местами', 'Swap panels'), () => {
        slots.reverse(); ratio = 100 - ratio; render(); head.focus();
      }, 'workspace-swap');
      swap.disabled = !split;
      const maximize = iconButton(actionIcons.maximize, text('На всю рабочую область: ', 'Fill workspace: ') + label(id), () => {
        activePanel = id; slots = [id, null]; render(); head.focus();
      }, 'workspace-maximize');
      maximize.disabled = !split;
      const collapse = iconButton(actionIcons.close, text('Закрыть панель: ', 'Close panel: ') + label(id), () => {
        close(id);
        const remaining = slots.find(Boolean);
        (remaining ? panels[remaining].head : document.querySelector('[data-app-page="chat"]')).focus();
      }, 'workspace-collapse');
      collapse.disabled = !split;
      const layout = iconButton(sideButton.innerHTML, sideButton.title, () => {
        activePanel = id; sideButton.click();
        panels[id].head.querySelector('.workspace-layout')?.focus();
      }, 'workspace-layout');
      layout.dataset.layout = sideButton.dataset.layout;
      head.append(swap, layout, maximize, collapse);
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
    Object.values(panels).forEach(({ panel, frame }) => {
      if (frame?.contentWindow && !panel.hidden && frame.clientHeight) frameScrollPositions.set(frame, [frame.contentWindow.scrollX, frame.contentWindow.scrollY]);
    });
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
    Object.values(panels).forEach(({ panel, frame }) => {
      if (frame && !panel.hidden && frame.clientHeight && frameScrollPositions.has(frame)) {
        const [left, top] = frameScrollPositions.get(frame);
        frame.contentWindow.scrollTo({ left, top, behavior: 'instant' });
      }
    });
    refreshLabels(); document.dispatchEvent(new Event('app:pagechange'));
  }
  function open(id, target) {
    if (!definitions[id]) id = 'chat';
    activePanel = id;
    if (slots.includes(id) && !(singlePanel && slots.filter(Boolean).length > 1)) {
      panels[id].panel.animate([{ outline: '2px solid var(--accent2)' }, { outline: '2px solid transparent' }], { duration: 600 });
      return;
    }
    if (id === 'settings') prepareSettings(transportMode);
    if (singlePanel) slots = [id, null];
    else if (target === undefined || target < 0) {
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
    openBeside(id, sourceWindow) {
      if (!definitions[id]) return;
      const sourceId = typeof sourceWindow === 'string' ? sourceWindow : Object.keys(panels).find(key => panels[key].frame?.contentWindow === sourceWindow);
      if (!sourceId || sourceId === id) return;
      const sourceIndex = slots.indexOf(sourceId);
      if (sourceIndex < 0) return;
      slots = sourceIndex === 0 ? [sourceId, id] : [id, sourceId];
      activePanel = id; render();
      panels[id].head.focus();
    },
    setLabLocation(id) {
      const url = new URL(location.href);
      url.searchParams.set('page', 'labs'); url.searchParams.set('lab', id); url.hash = '';
      history.replaceState({ page: 'labs' }, '', url);
    },
    openSettings(mode, options = {}) {
      if (mode !== transportMode) setTransport(mode);
      prepareSettings(mode);
      if (mode === 'openai' && options.profile && options.profile !== localStorage.getItem('ai_openai_active_profile') && allOpenAIProfiles().some(profile => profile.id === options.profile)) {
        commitOpenAISettings();
        document.getElementById('openai-profile-select').value = options.profile;
        loadOpenAIProfile(options.profile);
      }
      if (options.sourceWindow) api.openBeside('settings', options.sourceWindow);
      else if (options.beside && panels[options.beside]?.frame) {
        if (!slots.includes(options.beside)) open(options.beside);
        api.openBeside('settings', panels[options.beside].frame.contentWindow);
      } else open('settings');
      if (options.field) api.highlightField(options.field);
    },
    highlightField(id) {
      const field = document.getElementById(id);
      if (!field || !workspace.contains(field)) return;
      for (let parent = field.parentElement; parent && parent !== workspace; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      if (!field.getClientRects().length) return;
      field.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      field.focus({ preventScroll: true });
      field._helpAnimation?.cancel();
      const theme = getComputedStyle(document.documentElement);
      const isGreen = value => {
        const channels = value.match(/[0-9.]+/g)?.map(Number);
        if (!channels || channels.length < 3 || channels[3] === 0) return false;
        const [r, g, b] = channels;
        return g > r * 1.2 && g > b * 1.15;
      };
      const surfaces = [field, field.parentElement?.querySelector('.slider')].filter(Boolean);
      const green = surfaces.some(el => {
        const style = getComputedStyle(el);
        return [style.color, style.backgroundColor, style.borderTopColor].some(isGreen);
      });
      const color = theme.getPropertyValue(green ? CFG_HELP_HIGHLIGHT_ALTERNATE_COLOR : CFG_HELP_HIGHLIGHT_COLOR).trim();
      field._helpAnimation = field.animate([
        { outline: '3px solid transparent', outlineOffset: '3px', boxShadow: 'none', offset: 0 },
        { outline: '3px solid ' + color, outlineOffset: '3px', boxShadow: '0 0 12px ' + color, offset: .35 },
        { outline: '3px solid ' + color, outlineOffset: '3px', boxShadow: '0 0 12px ' + color, offset: .55 },
        { outline: '3px solid transparent', outlineOffset: '3px', boxShadow: 'none', offset: .85 },
        { outline: '3px solid transparent', outlineOffset: '3px', boxShadow: 'none', offset: 1 }
      ], { duration: CFG_HELP_HIGHLIGHT_DURATION_MS, iterations: CFG_HELP_HIGHLIGHT_PULSES, easing: 'ease-in-out' });
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
  window.navigateApp = (page, hash = '', push = true, labId = null, beside = null) => {
    if (page === 'help') hash = ({ '#neuraldeep': '#connect-neuraldeep', '#setup': '#connect-settings' })[hash] || hash;
    if (page === 'documentation') page = 'help';
    const id = definitions[page] ? page : 'chat'; closeDrawer();
    const params = new URL(location.href).searchParams;
    if (id === 'settings') api.openSettings('openai', { profile: params.get('profile'), field: params.get('field'), beside: params.get('beside') });
    else {
      const source = beside || params.get('beside');
      if (source && source !== id && panels[source]) {
        if (!slots.includes(source)) open(source);
        api.openBeside(id, source);
      } else open(id);
      if (id === 'chat' && hash) api.highlightField(hash.slice(1));
    }
    const frame = panels[id].frame;
    if (frame && (hash || (id === 'labs' && labId))) {
      const jump = () => {
        if (id === 'labs' && frame.contentWindow.openLab) frame.contentWindow.openLab(labId, hash);
        else frame.contentDocument.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      };
      if (frame.contentDocument?.readyState === 'complete' && frame.contentDocument.URL !== 'about:blank') jump();
      else frame.addEventListener('load', jump, { once: true });
    }
    const url = new URL(location.href);
    url.searchParams.delete('beside');
    if (id !== 'settings') { url.searchParams.delete('profile'); url.searchParams.delete('field'); }
    if (id === 'chat') url.searchParams.delete('page'); else url.searchParams.set('page', id);
    if (id === 'labs' && labId) url.searchParams.set('lab', labId); else url.searchParams.delete('lab');
    url.hash = hash; if (push) history.pushState({ page: id }, '', url);
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    const url = new URL(link.href, location.href); if (url.origin !== location.origin) return;
    const file = url.pathname.split('/').pop().replace(/\.html$/, '');
    const page = link.dataset.appPage || (['labs', 'documentation', 'tools', 'mcp', 'help'].includes(file) ? file : null);
    if (url.searchParams.get('page') === 'settings') {
      event.preventDefault(); closeDrawer();
      api.openSettings('openai', { profile: url.searchParams.get('profile'), field: url.searchParams.get('field'), beside: url.searchParams.get('beside') });
      return;
    }
    if (!page) return;
    event.preventDefault(); navigateApp(page, url.hash, true, url.searchParams.get('lab'), link.dataset.appBeside);
  });
  new MutationObserver(() => { syncTheme(); refreshLabels(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
  mobile.addEventListener('change', refreshLabels);
  function syncConsent() {
    const locked = localStorage.getItem('n8n_consent') !== '1';
    workspace.inert = locked; sideButton.disabled = locked;
  }
  document.addEventListener('app:consent', syncConsent);
  syncConsent();
  window.addEventListener('popstate', () => navigateApp(new URL(location.href).searchParams.get('page'), location.hash, false, new URL(location.href).searchParams.get('lab')));
  render();
  const initialPage = new URL(location.href).searchParams.get('page');
  if (initialPage) navigateApp(initialPage, location.hash, false, new URL(location.href).searchParams.get('lab'));
  else if (location.hash) api.highlightField(location.hash.slice(1));
})();
