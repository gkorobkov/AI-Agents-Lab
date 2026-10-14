// Field explanations follow the form's limits; provider/model support can differ.
(() => {
  const help = {
    'openai-profile-select': ['Профиль хранит подключение и параметры генерации. Default использует исходное значение профиля, Custom — ваше. Эти переключатели определяют, какое значение попадёт в следующий запрос. Clone создаёт отдельную копию профиля.', 'A saved connection and generation setup. Default / Custom compares the original value with yours and sends the selected value. The toggle is disabled while values match. Clone copies a profile; the pencil renames your own profile.'],
    'openai-profile-name': ['Название помогает найти профиль в списке. Оно не отправляется LLM модели.', 'Profile label, up to 32 characters. Helps identify settings; not sent to the model.'],
    'openai-base-url': ['Адрес сервера, которому приложение отправит запрос к LLM модели. Сервер должен поддерживать Chat Completions. Для прямого запроса из браузера сервер должен разрешать CORS.', 'OpenAI-compatible server address. Chooses the request destination; direct browser calls need Chat Completions and CORS support.'],
    'openai-api-key': ['Ключ авторизации на сервере провайдера. Это HTTP-заголовок, а не инструкция LLM модели. Для серверного профиля ключ берётся на сервере; собственный ключ хранится в этом браузере.', 'Provider credential. Server profiles use a server-held key; a custom key is saved in this browser. Changing it changes request authorization.'],
    'openai-model': ['Идентификатор LLM модели у выбранного провайдера. LLM модели отличаются качеством, скоростью, стоимостью и поддержкой инструментов. Укажите точное доступное имя, иначе сервер вернёт ошибку.', 'Exact model ID offered by your provider. Changes capabilities, quality, speed and token usage; an unknown ID causes an error.'],
    'openai-system-prompt': ['Правила для LLM модели: роль, стиль и ограничения ответа. Приложение добавляет текст как сообщение с role: system. Пустое поле не добавляет системную инструкцию.', 'Model instructions: role, style and response rules. Free text or empty. Adds to request context and affects subsequent answers.'],
    'openai-temperature': ['Определяет случайность выбора следующего токена LLM моделью. При низком значении ответы обычно более предсказуемы; при высоком — разнообразнее. Даже 0 не гарантирует одинаковый ответ. В отличие от top_p меняет вероятности кандидатов, а не ограничивает их набор. Меняйте один из этих параметров за раз. Поддержка зависит от LLM модели.', 'Sampling randomness. Lower is usually more consistent, higher more varied. Adjust separately from top_p. Some models do not support it.'],
    'openai-top-p': ['Ограничивает набор кандидатов на следующий токен: LLM модель выбирает из токенов, суммарная вероятность которых достигает top_p. При 1 это ограничение отсутствует; при меньшем значении редкие варианты исключаются. В отличие от temperature сужает набор кандидатов. Меняйте один из этих параметров за раз.', 'Probability mass retained for candidate tokens. Lower narrows the selection; 1 removes this restriction. Adjust separately from temperature.'],
    'openai-max-completion-tokens': ['Максимальное число токенов, которое LLM модель может потратить на ответ. Для LLM моделей с рассуждением в лимит входят и скрытые токены рассуждения. Это верхняя граница, а не требуемая длина ответа. Слишком маленький лимит может оборвать ответ до завершения.', 'Output token ceiling, including internal reasoning tokens where applicable. Default: 10000. Integer from 1; maximum depends on the model. A small budget can truncate output.'],
    'openai-n': ['Сколько вариантов ответа должна сгенерировать LLM модель на один запрос. При 1 — один вариант, при большем значении — несколько в choices[]. Это не число вызовов инструмента. Больше вариантов расходуют больше токенов; поддержка зависит от провайдера.', 'Number of alternatives per request. More alternatives generate more tokens. Provider support may be limited; inspect choices[] for all results.'],
    'openai-context': ['Включено: LLM модель получает предыдущие сообщения текущего диалога вместе с новым вопросом. Выключено: получает только новый вопрос и системную инструкцию. История помогает учитывать беседу, но увеличивает размер и стоимость запроса.', 'On: previous turns from the current OpenAI conversation are added to messages[]. This preserves conversational context but increases input size. Off: current text and system instructions only.'],
    'openai-tools-enabled': ['Включено: LLM модель получает имена, описания и схемы аргументов инструментов. Дальше режим tool_choice определяет, может ли она ответить без вызова. LLM модель формирует имя и аргументы вызова; HTTP-запрос выполняет приложение по кнопке, либо вы вводите результат вручную. Выключено: tools не отправляются.', 'Sends function definitions to the model. The model can request a call; the app runs HTTP on your click or accepts a manually entered result.'],
    'openai-tool-choice': ['auto: LLM модель сама решает, ответить текстом или запросить вызов инструмента.\nnone: LLM модель отвечает без вызова инструментов.\nrequired: LLM модель должна запросить хотя бы один вызов, но сама выбирает инструмент из списка.\nfunction: LLM модель должна вызвать инструмент, указанный в поле «Имя принудительной функции».\nОтличие required от function — свободный выбор инструмента или конкретное имя. После передачи результатов приложение отправляет продолжение с auto, чтобы LLM модель могла дать итоговый ответ.', 'auto: the LLM model chooses a text answer or tool calls. none: the LLM model must answer without tools. required: the LLM model must request at least one tool call and chooses the tool itself. function: the LLM model must call the named tool. After tool results, the application uses auto so the LLM model can give a final answer.'],
    'openai-forced-tool': ['Укажите точное имя подключённой функции, например geocode_city. При tool_choice = function LLM модель должна запросить вызов именно этой функции. При auto, none или required это поле не используется. Имя — до 64 латинских букв, цифр, _ или -.', 'Name of a defined function, up to 64 characters. Used only with tool choice = function; must match exactly.'],
    'openai-parallel-tools': ['Включено: LLM модель может запросить несколько вызовов инструментов в одном ответе. Выключено: не более одного вызова за ответ. Это разрешение, а не требование. Зависимые вызовы, например погода после получения координат, требуют отдельных шагов. Параметр не означает, что браузер обязательно выполнит HTTP-запросы одновременно.', 'Allows multiple function calls in one response. Disable to request sequential calls; provider support varies.'],
    name: ['Техническое имя, которое LLM модель указывает при вызове инструмента. Используйте уникальное имя из 1–64 латинских букв, цифр, _ или -. Название в библиотеке служит для отображения и не заменяет это имя.', 'Function name: letters, digits, _ and -, up to 64 characters. Used in model calls; names must be unique.'],
    description: ['Объясните LLM модели, что делает инструмент, когда его вызывать, какие данные передать и что вернётся. Укажите ограничения и действия при ошибке. По этому тексту LLM модель выбирает инструмент; описание само по себе не выполняет запрос.', 'What the function does and when to call it. Free text helps the model select the right tool; specific descriptions reduce incorrect choices.'],
    parameters: ['Схема входных аргументов для LLM модели: properties описывает поля и их типы, required — обязательные поля. LLM модель заполнит значения при вызове. Это JSON Schema, а не готовые аргументы и не пример ответа сервера.', 'JSON Schema for the argument object: properties, types and required fields. Changes expected arguments. Enter valid JSON Schema, not an example result.'],
    strict: ['Включено: запрос просит LLM модель формировать аргументы строго по поддерживаемой JSON Schema. Обычно все свойства должны входить в required, а additionalProperties должно быть false. Выключено: строгий режим не запрашивается, аргументы всё равно описываются схемой. Strict не проверяет истинность данных и не гарантирует успех HTTP-запроса. Поддержка зависит от провайдера.', 'Strict adherence to the supported JSON Schema. Usually requires all properties in required and additionalProperties: false. Unsupported schemas may be rejected.'],
    url: ['Адрес HTTP API инструмента. Его вызывает приложение, а не LLM модель. Шаблоны {{имя_аргумента}} заменяются значениями из вызова LLM модели. Сервер должен разрешать CORS для браузера.', 'HTTP function endpoint. Supports {{argument}} substitutions. Run it with the chat button; the server must allow CORS.'],
    method: ['GET: приложение передаёт связанные параметры в строке URL. POST: передаёт их в JSON-теле. Выбирайте по документации HTTP API. Это настройка выполнения инструмента, она не задаёт поведение LLM модели.', 'GET sends fields as query parameters; POST sends a JSON body. Choose the method supported by your HTTP service.'],
    key: ['Имя параметра HTTP API. Для GET станет параметром URL, для POST — ключом JSON-тела. Имя должно соответствовать документации сервера; оно может отличаться от имени аргумента для LLM модели.', 'HTTP service field name. Becomes a GET query parameter or a POST JSON key. Must match the service contract.'],
    value: ['Постоянный текст передаётся как задан. Шаблон {{name}} берёт значение аргумента name из вызова LLM модели; {{location.latitude}} — вложенное значение. Это связь между аргументами LLM модели и параметрами HTTP API.', 'Field value: literal text or a model {{argument_name}}. Nested paths such as {{location.latitude}} are supported.'],
    body: ['Шаблон JSON-тела для POST. {{name}} заменяется значением аргумента из вызова LLM модели. Если шаблон пустой, приложение собирает тело из списка связанных HTTP-параметров. GET этот шаблон не использует.', 'Optional POST JSON body template with {{arguments}}. Overrides the mapped fields. Leave empty to build JSON automatically.']
  };
  const paths = {
    'openai-profile-select':'Настройка приложения · профиль (не передаётся в JSON запроса)',
    'openai-profile-name':'Настройка приложения · название профиля (не передаётся в JSON запроса)',
    'openai-base-url':'HTTP · URL запроса',
    'openai-api-key':'HTTP · headers.Authorization',
    'openai-model':'model',
    'openai-system-prompt':'messages[].content · role: system',
    'openai-temperature':'temperature', 'openai-top-p':'top_p',
    'openai-max-completion-tokens':'max_completion_tokens', 'openai-n':'n',
    'openai-context':'messages[] · история сообщений',
    'openai-tools-enabled':'tools[]', 'openai-tool-choice':'tool_choice',
    'openai-forced-tool':'tool_choice.function.name',
    'openai-parallel-tools':'parallel_tool_calls',
    name:'tools[].function.name', description:'tools[].function.description',
    parameters:'tools[].function.parameters', strict:'tools[].function.strict',
    url:'Настройка HTTP-инструмента · http.url (не передаётся LLM)',
    method:'Настройка HTTP-инструмента · http.method (не передаётся LLM)',
    key:'Настройка HTTP-инструмента · http.mappings[].key (не передаётся LLM)',
    value:'Настройка HTTP-инструмента · http.mappings[].value (не передаётся LLM)',
    body:'Настройка HTTP-инструмента · http.body (не передаётся LLM)'
  };
  const panel = document.getElementById('openai-settings');
  const { hide } = window.FieldHelp;
  function attach() {
    panel.querySelectorAll('input, select, textarea').forEach(field => {
      const key = field.dataset.toolField || field.dataset.httpField || field.id;
      if (key === 'openai-profile-name') return;
      const copy = help[key]; if (!copy) return;
      let host = field.closest('.api-field')?.querySelector(':scope > span');
      if (!host) host = field.closest('.api-toggle-row')?.querySelector(':scope > span > strong') || field.closest('.api-toggle-row')?.querySelector(':scope > span');
      if (!host && field.id === 'openai-context') host = document.getElementById('client-history-label');
      if (!host && field.id === 'openai-tools-enabled') host = panel.querySelector('.tool-builder-summary > span');
      if (!host && field.closest('.profile-combo')) {
        host = document.getElementById('openai-profile-help');
        if (!host) { host = document.createElement('span'); host.id = 'openai-profile-help'; field.closest('.profile-combo').after(host); }
      }
      if (!host) return;
      host = host.closest('.parameter-heading') || host.querySelector('.parameter-heading') || host;
      let button = [...host.querySelectorAll('.api-help')].find(el => el.dataset.helpKey === key);
      if (!button) {
        button = document.createElement('span'); button.className = 'api-help'; button.tabIndex = 0; button.role = 'button'; button.textContent = '?'; button.dataset.helpKey = key;
        FieldHelp.attach(button);
        const toggle = host.querySelector(':scope > .parameter-toggle');
        if (toggle) toggle.before(button); else host.append(button);
      }
      const ru = document.documentElement.lang !== 'en';
      const range = field.type === 'number' ? (ru ? '\nДиапазон формы: ' : '\nForm range: ') + (field.min || '—') + ' … ' + (field.max || (ru ? 'лимит LLM модели' : 'model limit')) + '.' : '';
      button.dataset.helpText = (copy[ru ? 0 : 1] + range).replace(/(?<!LLM )\bmodel(s)?\b/gi, 'LLM model$1');
      button.dataset.helpPath = paths[key];
      button.setAttribute('aria-label', (ru ? 'Справка: ' : 'Help: ') + (field.getAttribute('aria-label') || key));
    });
  }
  new MutationObserver(attach).observe(panel, { childList:true, subtree:true });
  new MutationObserver(() => { hide(); attach(); }).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  attach();
})();
