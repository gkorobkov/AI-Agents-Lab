# AI Agents Lab — Proxy Integration Specification

**Version:** 1.0 · **18 November 2026**

**Target repository:** https://github.com/gkorobkov/AI-Agents-Lab

**Runtime implementation:** https://github.com/gkorobkov/Infrastructure/tree/main/proxy (when published)

**Recommended repository path:** `architecture/proxy_integration_spec.md`

## 0. Mandatory implementation instruction for Codex

Save this entire document to `architecture/proxy_integration_spec.md` in the AI Agents Lab repository. Start an isolated branch `feature/proxy-integration` from current main. Follow `AGENTS.md` and `ui/AGENTS.md`. Implement UI, transport module, persistence and tests; do not stop at an analysis. Do not deploy production or merge without separate permission. Existing Direct behavior, credentials, Alternative URL, site consent and Debug must be preserved. Commit tested work in logical increments; report untested browser scenarios truthfully.

The repository has already been examined. Do not substitute a generic investigation task for the concrete integration points below; inspect their current signatures only to account for newer commits.

## 1. Goal and UX

В UI поле URL (сейчас пусть это будут настройки OpenAI API, Tools, RAG, к остальным потом придумаем как добавить) на который идет запрос, может иметь рядом справа чекбокс (по умолчанию вазде выключен) `Use Proxy` (иконка статуса) и (?) как наш обычный попап подсказка, в котором есть поле для задания proxy URL и описание и статус. Сейчас пусть этот proxy url будет один общий для всех, для простоты и во всех попапах, поэтому напиши в попапе "Это один общий Proxy только для запросов, где выбран чек бокс `Use Proxy`. При изменении будет применен ко всем поляам/запросам где выбран чек бокс `Use Proxy`" - ну или более красиво напиши на двух языках как надо. 
Status, когда чек бокс выбран: Connected / Not running / Browser blocked / Invalid response - как иконка это будет просто кружочек с различными цветами чтобы визуально было понятно, к примеру Connected - "зеленая", остальные сам придумай. Конда чек бокс не выбран статус и иконка серая.  
 
`Default Proxy URL` - `http://localhost:8080`. When enabled, the UI retains the **Original URL** (after all template/query/credential substitutions), method, allowed end-to-end headers, and exactly the body that Direct mode would have sent. It sends the request to `<proxyUrl>/proxy`, adding an `X-Proxy-Target-URL` header whose value is the complete Original URL. The local proxy forwards it to the original API. When disabled the request goes directly without any changed behavior.

Правки в UI так же будут для страниц настроек. Надо сделать похожие общий UI с полями для настроек для разных страниц. Смысл в том что каждое поле с настройкой должно быть НЕ во всю ширину окна, а только немного больше чем значение настройки, поэтому подумай какая должна быть ширина у разных настроек. Сейчас смотрим на настройки OpenAI API, RAG. OpenAI API - OpenAI compatible
Настройки OpenAI API. Поменяй местами Настройки OpenAI API и OpenAI compatible. 
Убери "OpenAI API: пояснения и справочник →", но добавь ": описание →" к "OpenAI compatible" и будет "OpenAI compatible: описание →"
Далее сделай в одну строку все элементы NeuralDeep LLM Provider, ?, Clone и до удаления. 
Далее убери "Запрос OpenAI API", а оставь "Базовый URL" и далее в "одну высокую строку" удет три блока - урл (учти прокси), апи ключ, ллм модель, но в каждом блоке несколько строк - первая строка (имя/заголовок, (?), default|custom, а если узкое поле данных то default|custom можно перенести на строку ниже), и следующая строка ниже текстове поле. Про ширину следующих полей думай сам. Системный промпт можно оставить как есть, но добавь типа кнопки "расширить поле", чтобы можно было видеть весть тескт (думаю тут панель какую то можно показать, но не перекрывай всю страницу потому что переходы по страницам и так перегружены).
Поля с цифрами точно можно все в "одун высокую" строку. 
Если по ширине не помещаются, то просто переноси блоки ниже. 

Далее RAG: страница должна быть похожа на OpenAI API - выбор провайдера, как RAG-система. Статус подключения через кружочек с попап подсказкой. Далее настройки чере иконку-шестеренку. Не знаю зачем нужен "Подключить / обновить". 
Отдельную панель ниже с разделением не делай, а пусть это будет общай раздвигающаяся ниже панель. Далее url (учти прокси) и апи ключ, по стилю как писал выше. Далее векторизация так же. Дальше пока не знаю, посмотрим как получится по данным правкам.

 В Tools "альтернативный URL" можно убрать.

Keep controls compact/mobile-friendly. Never replace the user's Original URL with localhost in stored API settings.

## 2. Verified current architecture and exact changes

Подумай сам над архитектурой и кодом с учетом что Proxy URL везде один, и только для некоторыйх URL полей мы включаем этот прокси. Сейчас данный прокси и чек боксы будут только для OpenAI API, Tools, RAG и они по умолчанию выключены.

