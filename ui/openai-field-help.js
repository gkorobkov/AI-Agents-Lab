// Field explanations follow the form's limits; provider/model support can differ.
(() => {
  const help = {
    'openai-profile-select': ['Набор настроек подключения и генерации. Выбор профиля подставляет его значения для следующих запросов.', 'A saved connection and generation setup. Selecting a profile loads its values for subsequent requests.'],
    'openai-profile-name': ['Название профиля, до 32 символов. Нужно для выбора настроек; модели не отправляется.', 'Profile label, up to 32 characters. Helps identify settings; not sent to the model.'],
    'openai-base-url': ['Адрес OpenAI-совместимого сервера. Определяет, куда отправится запрос; должен поддерживать Chat Completions и CORS при прямом вызове из браузера.', 'OpenAI-compatible server address. Chooses the request destination; direct browser calls need Chat Completions and CORS support.'],
    'openai-api-key': ['Ключ доступа провайдера. Для серверного профиля ключ хранится на сервере; свой ключ сохраняется в этом браузере. Изменение меняет авторизацию запросов.', 'Provider credential. Server profiles use a server-held key; a custom key is saved in this browser. Changing it changes request authorization.'],
    'openai-model': ['Точное имя доступной модели у выбранного провайдера. Меняет возможности, качество, скорость и расход токенов; произвольное имя вызовет ошибку.', 'Exact model ID offered by your provider. Changes capabilities, quality, speed and token usage; an unknown ID causes an error.'],
    'openai-system-prompt': ['Инструкция модели: роль, стиль и правила ответа. Любой текст или пустое поле. Добавляется к запросу и занимает контекст; изменение влияет на следующие ответы.', 'Model instructions: role, style and response rules. Free text or empty. Adds to request context and affects subsequent answers.'],
    'openai-temperature': ['Случайность выбора токенов. Меньше — обычно стабильнее, больше — разнообразнее. Меняйте отдельно от top_p. Некоторые модели не поддерживают настройку.', 'Sampling randomness. Lower is usually more consistent, higher more varied. Adjust separately from top_p. Some models do not support it.'],
    'openai-top-p': ['Доля вероятностной массы кандидатов на следующий токен. Ниже — уже выбор, 1 — без этого ограничения. Меняйте отдельно от temperature.', 'Probability mass retained for candidate tokens. Lower narrows the selection; 1 removes this restriction. Adjust separately from temperature.'],
    'openai-max-completion-tokens': ['Верхний предел токенов ответа, включая внутреннее рассуждение у reasoning-моделей. Целое от 1; верхняя граница зависит от модели. Малое значение может оборвать ответ.', 'Output token ceiling, including internal reasoning tokens where applicable. Integer from 1; maximum depends on the model. A small budget can truncate output.'],
    'openai-n': ['Число вариантов ответа на один запрос. Больше вариантов — больше генерируемых токенов. Провайдер может ограничить поддержку; полный набор смотрите в choices[].', 'Number of alternatives per request. More alternatives generate more tokens. Provider support may be limited; inspect choices[] for all results.'],
    'openai-context': ['Включено: предыдущие сообщения текущего OpenAI-диалога добавляются в messages[]. Это помогает помнить беседу, но увеличивает контекст. Выключено: текущий текст и системная инструкция.', 'On: previous turns from the current OpenAI conversation are added to messages[]. This preserves conversational context but increases input size. Off: current text and system instructions only.'],
    'openai-tools-enabled': ['Включает передачу описаний функций модели. Модель может попросить вызов, а приложение выполняет HTTP по кнопке или принимает результат вручную.', 'Sends function definitions to the model. The model can request a call; the app runs HTTP on your click or accepts a manually entered result.'],
    'openai-tool-choice': ['auto — выбор модели; none — без вызовов; required — нужен вызов; function — конкретная функция по имени. Выбор влияет и на продолжение после результата.', 'auto: model decides; none: no calls; required: a call is needed; function: force the named function. Applies to continuations after tool results too.'],
    'openai-forced-tool': ['Имя одной из описанных функций, до 64 символов. Используется только при tool choice = function; должно точно совпадать с её именем.', 'Name of a defined function, up to 64 characters. Used only with tool choice = function; must match exactly.'],
    'openai-parallel-tools': ['Разрешает несколько вызовов функций в одном ответе. Выключите, чтобы запросить последовательные вызовы; поддержка зависит от провайдера.', 'Allows multiple function calls in one response. Disable to request sequential calls; provider support varies.'],
    name: ['Имя функции: латинские буквы, цифры, _ и -, до 64 символов. Модель использует его в вызове; имена должны быть уникальными.', 'Function name: letters, digits, _ and -, up to 64 characters. Used in model calls; names must be unique.'],
    description: ['Что делает функция и когда её вызывать. Свободный текст помогает модели выбрать нужный инструмент; конкретное описание уменьшает ошибочные вызовы.', 'What the function does and when to call it. Free text helps the model select the right tool; specific descriptions reduce incorrect choices.'],
    parameters: ['JSON Schema объекта аргументов: свойства, типы и обязательные поля. Изменение меняет ожидаемые аргументы функции. Введите корректный JSON, а не пример результата.', 'JSON Schema for the argument object: properties, types and required fields. Changes expected arguments. Enter valid JSON Schema, not an example result.'],
    strict: ['Строгое соответствие аргументов поддерживаемой JSON Schema. Обычно нужны required для всех свойств и additionalProperties: false. Несовместимую схему API может отклонить.', 'Strict adherence to the supported JSON Schema. Usually requires all properties in required and additionalProperties: false. Unsupported schemas may be rejected.'],
    url: ['HTTP-адрес выполнения функции. Можно подставлять {{аргумент}}. Запрос выполняется кнопкой в чате; сервер должен разрешать CORS.', 'HTTP function endpoint. Supports {{argument}} substitutions. Run it with the chat button; the server must allow CORS.'],
    method: ['GET передаёт поля в query-параметрах; POST — в JSON-теле. Выберите метод, который принимает ваш HTTP-сервис.', 'GET sends fields as query parameters; POST sends a JSON body. Choose the method supported by your HTTP service.'],
    key: ['Имя поля HTTP-сервиса. В GET станет query-параметром, в POST — ключом JSON. Должно соответствовать контракту сервиса.', 'HTTP service field name. Becomes a GET query parameter or a POST JSON key. Must match the service contract.'],
    value: ['Значение поля: постоянный текст или {{имя_аргумента}} модели. Для вложенных полей используйте {{location.latitude}}.', 'Field value: literal text or a model {{argument_name}}. Nested paths such as {{location.latitude}} are supported.'],
    body: ['Необязательный шаблон JSON-тела POST с {{аргументами}}. Заменяет тело из списка полей. Пустое поле оставляет автоматическую сборку JSON.', 'Optional POST JSON body template with {{arguments}}. Overrides the mapped fields. Leave empty to build JSON automatically.']
  };
  const panel = document.getElementById('openai-settings');
  const tooltip = document.createElement('div'); tooltip.id = 'api-field-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true; document.body.append(tooltip);
  let current;
  const hide = () => { tooltip.hidden = true; current?.removeAttribute('aria-describedby'); current = null; };
  const show = button => {
    hide(); current = button; tooltip.textContent = button.dataset.helpText; tooltip.hidden = false; button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(rect.left, innerWidth - tooltip.offsetWidth - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - tooltip.offsetHeight - 8)) + 'px';
  };
  function attach() {
    panel.querySelectorAll('input, select, textarea').forEach(field => {
      const key = field.dataset.toolField || field.dataset.httpField || field.id;
      const copy = help[key]; if (!copy) return;
      let host = field.closest('.api-field')?.querySelector(':scope > span');
      if (!host) host = field.closest('.api-toggle-row')?.querySelector(':scope > span');
      if (!host && field.id === 'openai-context') host = document.getElementById('client-history-label');
      if (!host && field.id === 'openai-tools-enabled') host = panel.querySelector('.tool-builder-summary > span');
      if (!host && field.closest('.profile-combo')) host = field.closest('.profile-combo');
      if (!host) return;
      let button = [...host.querySelectorAll('.api-help')].find(el => el.dataset.helpKey === key);
      if (!button) {
        button = document.createElement('span'); button.className = 'api-help'; button.tabIndex = 0; button.role = 'button'; button.textContent = '?'; button.dataset.helpKey = key;
        button.addEventListener('pointerenter', () => show(button)); button.addEventListener('pointerleave', hide);
        button.addEventListener('focus', () => show(button)); button.addEventListener('blur', hide);
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show(button); });
        button.addEventListener('keydown', event => { if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') hide(); else show(button); } });
        host.append(button);
      }
      const ru = document.documentElement.lang !== 'en';
      const range = field.type === 'number' ? (ru ? '\nДиапазон формы: ' : '\nForm range: ') + (field.min || '—') + ' … ' + (field.max || (ru ? 'лимит модели' : 'model limit')) + '.' : '';
      button.dataset.helpText = copy[ru ? 0 : 1] + range;
      button.setAttribute('aria-label', (ru ? 'Справка: ' : 'Help: ') + (field.getAttribute('aria-label') || key));
    });
  }
  new MutationObserver(attach).observe(panel, { childList:true, subtree:true });
  new MutationObserver(() => { hide(); attach(); }).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  panel.addEventListener('scroll', () => { if (current && document.activeElement === current) show(current); else hide(); });
  window.addEventListener('resize', hide);
  document.addEventListener('app:pagechange', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.api-help')) hide(); });
  attach();
})();
