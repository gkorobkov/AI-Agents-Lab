(() => {
  const transport = LocalProxyTransport;
  const {tr} = transport;
  const controls = new WeakMap();
  let status = {status:'idle'};
  let pending;
  let popupStatus;

  function label(state) {
    return {
      off:tr('Прокси выключен', 'Proxy off'),
      idle:tr('Прокси не проверен', 'Proxy not checked'),
      checking:tr('Проверка прокси…', 'Checking proxy…'),
      connected:tr('Прокси подключён', 'Proxy connected'),
      unreachable:tr('Прокси недоступен. Возможно, он не запущен или браузер заблокировал доступ.', 'Proxy unavailable. It may be stopped or blocked by the browser.'),
      blocked:tr('Браузер заблокировал доступ к прокси', 'Browser blocked proxy access'),
      offline:tr('Нет подключения к сети', 'Offline'),
      invalid:tr('Некорректный ответ прокси', 'Invalid proxy response')
    }[state];
  }

  function refresh() {
    document.querySelectorAll('.proxy-option').forEach(host => controls.get(host)?.refresh());
    if (popupStatus?.isConnected) {
      const heading=popupStatus.closest('#api-field-tooltip')?.querySelector('.help-parameter-path');
      if (heading) heading.textContent='Proxy URL · '+transport.getUrl();
      popupStatus.replaceChildren();
      for (const [name, value] of [[tr('Статус','Status'),label(status.status)],['URL',status.url],[tr('Версия','Version'),status.version]]) {
        if (!value) continue;
        const row=document.createElement('span'),caption=document.createElement('span'),text=document.createElement('span');
        caption.className='proxy-status-label';caption.textContent=name+':';text.textContent=value;
        row.append(caption,text);popupStatus.append(row);
      }
    }
  }

  function check() {
    if (document.getElementById('consent-overlay') && localStorage.getItem('n8n_consent') !== '1') return;
    pending?.abort();
    const controller = pending = new AbortController();
    status = {status:'checking'}; refresh();
    transport.check(controller.signal).then(result => {
      if (pending !== controller) return;
      if (status.status !== 'connected' || result.status === 'connected') {
        status = result; refresh();
      }
    }).catch(() => {
      if (pending !== controller) return;
      if (status.status !== 'connected') { status = {status:'invalid'}; refresh(); }
    }).finally(() => { if (pending === controller) pending = null; });
  }

  globalThis.addEventListener('local-proxy-response', () => {
    if (status.status === 'connected') return;
    status = {status:'connected', url:transport.getUrl()};
    refresh();
  });

  function addressChanged() {
    pending?.abort(); pending = null;
    status = {status:'idle'}; refresh();
    if (document.querySelector('.proxy-option input:checked')) check();
  }

  function renderPopup() {
    const panel = document.createElement('div');
    panel.className = 'proxy-popover ym-hide-content';
    const help = document.createElement('p');
    help.textContent = tr(
      'Это общий адрес прокси для OpenAI API, Tools и RAG. Изменение адреса применяется ко всем запросам, для которых включён флажок «use Proxy». Прокси получает исходный URL и данные запроса, включая ключи API.',
      'OpenAI API, Tools and RAG share this proxy address. Changes apply to every request with use Proxy enabled. The proxy receives the original URL and request data, including API keys.'
    );
    const form = document.createElement('form');
    const caption = document.createElement('label');
    caption.textContent = 'Proxy URL';
    const url = document.createElement('input');
    url.inputMode = 'url'; url.autocomplete = 'off'; url.spellcheck = false;
    url.value = transport.getUrl();
    transport.ready().then(() => { if (!url.value) url.value = transport.getUrl(); refresh(); }).catch(() => {});
    caption.append(url);
    const save = document.createElement('button');
    save.textContent = tr('Сохранить и проверить', 'Save and check');
    const error = document.createElement('small');
    error.setAttribute('role','alert');
    popupStatus = document.createElement('small');
    popupStatus.setAttribute('role','status');
    form.append(caption, save, error);
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const previous = transport.getUrl();
        transport.setUrl(url.value);
        url.value = transport.getUrl(); error.textContent = '';
        if (previous === transport.getUrl() || !pending) check();
      } catch (reason) { error.textContent = reason.message; }
    });
    panel.append(help, form, popupStatus);
    queueMicrotask(refresh);
    return panel;
  }

  function mount(input, {onChange} = {}) {
    const field = input.closest('label');
    const wrapper = document.createElement('div'); wrapper.className = 'proxy-field';
    const host = document.createElement('span'); host.className = 'proxy-option';
    const toggleLabel = document.createElement('label');
    const toggle = document.createElement('input'); toggle.type = 'checkbox';
    const name = document.createElement('span');
    const dot = document.createElement('span'); dot.className = 'proxy-dot'; dot.role = 'status';
    toggleLabel.append(toggle, name);
    const help = document.createElement('button'); help.type = 'button'; help.className = 'api-help proxy-help'; help.textContent = '?';
    host.append(toggleLabel, dot, help);
    field.before(wrapper); wrapper.append(field, host);
    FieldHelp.attach(help, renderPopup, wrapper);
    const control = {
      input:toggle,
      refresh() {
        name.textContent = 'use Proxy';
        help.dataset.helpPath = 'Proxy URL · '+transport.getUrl();
        help.setAttribute('aria-label', tr('Настройки прокси', 'Proxy settings'));
        const state = toggle.checked ? status.status : 'off';
        dot.dataset.state = state;
        dot.title = label(state); dot.setAttribute('aria-label', dot.title);
      },
      set(on) {
        toggle.checked = on === true;
        control.refresh();
        if (toggle.checked && status.status === 'idle') check();
      },
      read:() => toggle.checked
    };
    controls.set(host, control);
    toggle.addEventListener('change', () => {
      control.set(toggle.checked);
      onChange?.(toggle.checked);
    });
    control.refresh();
    return control;
  }

  document.addEventListener('app:consent', addressChanged);
  window.addEventListener('ai-proxy:url-change', addressChanged);
  window.addEventListener('storage', event => {
    if (event.key === transport.storageKey) addressChanged();
    if (event.key === 'n8n_lang') refresh();
  });
  transport.ready().then(refresh).catch(() => {});
  window.ProxyControls = {mount, refresh};
})();
