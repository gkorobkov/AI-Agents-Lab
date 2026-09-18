// One counter for the shell and standalone policy pages. Frames never initialize it.
(() => {
  if (window !== window.parent || window.appMetrika) return;
  const CFG_METRIKA_ID = 112561962;
  let initialized = false;
  let previousUrl = '';
  function consented() {
    try { return localStorage.getItem('n8n_consent') === '1'; } catch (_) { return false; }
  }
  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, location.href);
      const page = url.searchParams.get('page');
      url.username = ''; url.password = ''; url.search = ''; url.hash = '';
      if (url.origin === location.origin && ['labs', 'documentation'].includes(page)) url.searchParams.set('page', page);
      return url.href;
    } catch (_) { return ''; }
  }
  function protectContent() {
    document.querySelectorAll('#messages, #input-area, .transport-settings-panel, #connection-summary, #mobile-connection-summary, .composer-destination, #toast, #openai-tool-results').forEach(el => el.classList.add('ym-hide-content'));
    document.querySelectorAll('input, textarea').forEach(el => el.classList.add('ym-disable-keys'));
  }
  function trackPage() {
    if (!consented() || !/^https?:$/.test(location.protocol)) return;
    const url = safeUrl(location.href);
    if (url === previousUrl) return;
    if (!initialized) {
      protectContent();
      window.ym = window.ym || function() { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
      const src = 'https://mc.yandex.ru/metrika/tag.js?id=' + CFG_METRIKA_ID;
      if (![...document.scripts].some(script => script.src === src)) {
        const script = document.createElement('script'); script.async = true; script.src = src;
        document.head.appendChild(script);
      }
      window.ym(CFG_METRIKA_ID, 'init', {
        defer: true, webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true,
        url, referrer: safeUrl(document.referrer)
      });
      initialized = true;
    }
    window.ym(CFG_METRIKA_ID, 'hit', url, { title: document.title, referer: previousUrl || safeUrl(document.referrer) });
    previousUrl = url;
  }
  const boundDocuments = new WeakSet();
  const buttonNames = {
    'send-btn': 'Отправить сообщение', 'burger-btn': 'Открыть меню',
    'mode-settings-btn': 'Настройки подключения', 'btn-debug-toggle': 'Переключить Debug',
    'theme-btn': 'Сменить тему', 'lang-btn': 'Сменить язык', 'btn-clear': 'Очистить чат',
    'btn-new-session': 'Новая сессия', 'transport-select-trigger': 'Выбрать режим подключения',
    'transport-btn-openai': 'Режим OpenAI API', 'transport-btn-webhook': 'Режим Webhook',
    'transport-btn-demo': 'Режим Stub', 'theme': 'Сменить тему', 'lang': 'Сменить язык'
  };
  function describeControl(el) {
    const type = el.matches('a') ? 'Ссылка' : el.matches('summary') ? 'Раскрыть раздел' : 'Кнопка';
    if (buttonNames[el.id]) return { element: el.id, label: buttonNames[el.id], type };
    const key = el.dataset.i18n || el.dataset.i18nTitle || el.dataset.i18nAriaLabel;
    if (key && typeof i18n !== 'undefined' && i18n.ru[key]) return { element: key, label: i18n.ru[key], type };
    if (el.dataset.appPage) return { element: 'nav_' + el.dataset.appPage, label: { labs: 'Лабы', chat: 'Чат', documentation: 'Документация' }[el.dataset.appPage] || 'Навигация', type };
    if (el.hasAttribute('data-copy')) return { element: 'copy_example', label: 'Копировать пример или шаблон', type };
    if (el.dataset.debugMode) return { element: 'debug_' + el.dataset.debugMode, label: 'Debug: ' + el.dataset.debugMode, type };
    if (el.matches('a')) {
      const url = new URL(el.getAttribute('href'), el.ownerDocument.location.href);
      const file = url.pathname.split('/').pop().replace(/\.html$/, '');
      const names = { index: 'В чат', '': 'В чат', labs: 'Лабораторные работы', documentation: 'Документация', 'privacy-policy': 'Политика конфиденциальности', terms: 'Условия использования' };
      if (url.origin === location.origin && names[file]) {
        const anchor = /^#(lab\d+|prepare|experiments|report|start|routes|contract|neuraldeep|setup|help)$/.test(url.hash) ? url.hash : '';
        return { element: 'link_' + (file || 'index') + anchor, label: names[file] + (anchor ? ' · ' + anchor.slice(1) : ''), type };
      }
      if (url.hostname === 'github.com' && ['/gkorobkov', '/gkorobkov/AI-Agents-Lab'].includes(url.pathname)) return { element: 'github' + url.pathname, label: url.pathname.endsWith('AI-Agents-Lab') ? 'GitHub: проект' : 'GitHub: автор', type };
      return { element: 'other_link', label: 'Другая ссылка', type };
    }
    // Only control identifiers, never user-generated text, hrefs or form values.
    const action = (el.getAttribute('onclick') || '').match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(/)?.[1];
    const component = ['dbg-copy', 'bubble-copy-btn', 'panel-collapse', 'api-pin', 'profile-pencil', 'suggestion-chip'].find(name => el.classList.contains(name));
    const names = { 'dbg-copy': 'Копировать Debug', 'bubble-copy-btn': 'Копировать ответ', 'panel-collapse': 'Свернуть настройки', 'api-pin': 'Закрепить настройки', 'profile-pencil': 'Переименовать профиль', 'suggestion-chip': 'Выбрать подсказку' };
    return { element: action || component || (type === 'Раскрыть раздел' ? 'expand_section' : 'other_button'), label: names[component] || action || type, type };
  }
  function bindClicks(doc, source) {
    if (!doc || boundDocuments.has(doc)) return;
    boundDocuments.add(doc);
    doc.addEventListener('click', event => {
      const el = event.target.closest?.('button, a[href], summary, input[type="button"], input[type="submit"], [role="button"]');
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || !consented()) return;
      trackPage();
      if (!initialized) return;
      const section = el.closest('[id]')?.id;
      const lab = el.closest('article.experiment')?.id;
      const area = doc === document ? (el.closest('header') ? 'Хедер' : el.closest('#drawer') ? 'Меню' : el.closest('.transport-settings-panel') ? 'Настройки' : 'Контент') : 'Учебная страница';
      window.ym(CFG_METRIKA_ID, 'reachGoal', 'ui_click', {
        page: source || document.body.dataset.appPage || location.pathname.split('/').pop(),
        area, ...describeControl(el),
        section: /^lab\d+$/.test(lab || '') ? lab : /^lab\d+$/.test(section || '') ? section : 'general'
      });
    }, true);
  }
  window.appMetrika = { trackPage, bindClicks };
  bindClicks(document);
  document.addEventListener('app:pagechange', trackPage);
  document.addEventListener('app:consent', trackPage);
  window.addEventListener('storage', event => {
    if (event.key !== 'n8n_consent') return;
    if (consented()) trackPage();
    else if (initialized) {
      window.ym(CFG_METRIKA_ID, 'destruct'); initialized = false; previousUrl = '';
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trackPage, { once: true });
  else trackPage();
})();
