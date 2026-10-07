# Лабораторная работа: Tool Calling в `/v1/chat/completions`

## Цель лабораторной

Разобраться, как работает полный цикл Tool Calling:

```text
User → LLM → Tool Call → приложение → внешний API → Tool Result → LLM → ответ
```

После лабораторной студент должен понимать:

- что возвращает LLM, когда решает вызвать Tool;
- кто фактически вызывает внешний REST API;
- что содержат `function.name` и `function.arguments`;
- зачем нужен `tool_call_id`;
- куда передавать JSON внешнего API;
- зачем возвращать в `messages` сообщение `assistant` с `tool_calls`;
- почему результат Tool передаётся с `role: "tool"`;
- как обрабатывать несколько Tool Calls и ошибки;
- как организовать многошаговый цикл AI-агента.

---

# 1. Как работает Tool Calling

Пользователь спрашивает:

```text
Какая сейчас погода в Москве?
```

Модель не должна придумывать текущую погоду.

Мы сообщаем модели, что приложению доступна функция:

```text
get_weather(latitude, longitude)
```

Полный процесс:

```text
User
  │
  ▼
Application
  │ POST /v1/chat/completions
  ▼
LLM
  │
  │ tool_calls:
  │ get_weather(...)
  ▼
Application
  │
  │ HTTP Request
  ▼
External Weather API
  │
  │ JSON
  ▼
Application
  │
  │ role = tool
  │ content = JSON
  ▼
LLM
  │
  ▼
Final Answer
```

### Кто вызывает внешний API?

Не LLM.

Модель только принимает решение:

```text
Нужно вызвать get_weather
с такими аргументами.
```

HTTP-запрос выполняет наше приложение.

Разделение ответственности:

```text
LLM
→ выбирает Tool и формирует arguments

Application
→ проверяет arguments и выполняет Tool

External API
→ возвращает данные

Application
→ возвращает результат модели

LLM
→ интерпретирует результат
```

---

# 2. Первый запрос к `/v1/chat/completions`

```json
{
  "model": "gpt-5.6-terra",

  "messages": [
    {
      "role": "developer",
      "content": "Ты погодный ассистент. Для получения актуальной погоды используй доступный Tool."
    },
    {
      "role": "user",
      "content": "Какая сейчас погода в Москве?"
    }
  ],

  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Получает текущую погоду по координатам",
        "parameters": {
          "type": "object",
          "properties": {
            "latitude": {
              "type": "number",
              "description": "Широта"
            },
            "longitude": {
              "type": "number",
              "description": "Долгота"
            }
          },
          "required": [
            "latitude",
            "longitude"
          ],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  ],

  "tool_choice": "auto"
}
```

Здесь:

```text
messages
→ контекст разговора

tools
→ какие инструменты доступны модели

tool_choice
→ как модель может выбирать инструменты
```

`tools` не выполняет функцию. Он только описывает модели доступную возможность.

---

# 3. Что возвращает LLM

Если модель решила использовать Tool, ответ может выглядеть так:

```json
{
  "choices": [
    {
      "index": 0,

      "message": {
        "role": "assistant",
        "content": null,

        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",

            "function": {
              "name": "get_weather",
              "arguments": "{\"latitude\":55.7558,\"longitude\":37.6173}"
            }
          }
        ]
      },

      "finish_reason": "tool_calls"
    }
  ]
}
```

Главные поля:

```text
tool_calls[].id
tool_calls[].function.name
tool_calls[].function.arguments
finish_reason
```

### `function.name`

```text
get_weather
```

Отвечает на вопрос:

```text
Какой Tool выполнить?
```

### `function.arguments`

```json
{
  "latitude": 55.7558,
  "longitude": 37.6173
}
```

Отвечает:

```text
С какими параметрами выполнить Tool?
```

### `finish_reason = "tool_calls"`

Означает, что модель ещё не закончила выполнение задачи.

Ей требуется результат Tool.

---

# 4. Почему `arguments` нужно проверять

`arguments` формирует модель.

Например, она теоретически может вернуть:

```json
{
  "latitude": 999,
  "longitude": 37.6173
}
```

Но широта должна находиться в диапазоне:

```text
-90 ... +90
```

Поэтому правильная последовательность:

```text
LLM arguments
      │
      ▼
JSON parsing
      │
      ▼
Validation
      │
      ▼
Authorization / Business Rules
      │
      ▼
Tool execution
```

Это особенно важно для Tools, выполняющих действия:

```text
send_email(...)
delete_file(...)
transfer_money(...)
create_user(...)
execute_sql(...)
```

LLM не должна являться границей безопасности приложения.

---

# 5. Эксперимент №1 — влияние JSON Schema

Сначала используйте:

```json
"latitude": {
  "type": "number"
}
```

Выполните запрос и сохраните:

```text
function.arguments
```

Теперь измените тип:

```json
"latitude": {
  "type": "string"
}
```

Повторите запрос.

### Сравните

```text
function.arguments
```

### Ответьте

1. Изменился ли тип `latitude`?
2. Как JSON Schema влияет на генерируемые аргументы?
3. Почему даже при `strict: true` приложение должно проверять бизнес-ограничения, например допустимый диапазон координат?

---

# 6. Приложение выполняет внешний API

После получения:

```json
{
  "name": "get_weather",
  "arguments": "{\"latitude\":55.7558,\"longitude\":37.6173}"
}
```

приложение:

1. разбирает JSON из `arguments`;
2. проверяет значения;
3. вызывает внешний сервис.

Например:

```text
GET https://weather.example/api/current?latitude=55.7558&longitude=37.6173
```

Внешний API возвращает:

```json
{
  "latitude": 55.7558,
  "longitude": 37.6173,
  "temperature": 12.4,
  "wind_speed": 3.8,
  "weather": "cloudy"
}
```

Теперь этот результат необходимо вернуть LLM.

---

# 7. Как вернуть результат Tool в `messages`

Добавляем сообщение:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\":12.4,\"wind_speed\":3.8,\"weather\":\"cloudy\"}"
}
```

Здесь:

```text
role = tool
→ сообщает происхождение данных

tool_call_id
→ указывает, результатом какого вызова являются данные

content
→ содержит сам результат
```

---

# 8. Почему нужен `tool_call_id`

В первом ответе модель создала:

```json
{
  "id": "call_abc123",
  "type": "function",
  "function": {
    "name": "get_weather",
    "arguments": "..."
  }
}
```

`id` идентифицирует **конкретный вызов**.

Это особенно важно, если одна функция вызывается несколько раз:

```text
call_101 → get_weather("Москва")
call_102 → get_weather("Париж")
call_103 → get_weather("Дубай")
```

У всех:

```text
function.name = get_weather
```

но вызовы разные.

Результаты связываются с запросами через ID:

```text
call_101 ───→ Москва 12°C
call_102 ───→ Париж 17°C
call_103 ───→ Дубай 31°C
```

Поэтому:

```text
function.name
→ какой код выполнить

tool_call_id
→ результат какого конкретного вызова возвращается
```

### Почему нельзя придумать свой `tool_call_id`

Если модель запросила:

```text
call_101
```

а приложение вернуло:

```text
my_call_777
```

получается:

```text
LLM:
Я запросила call_101.

Application:
Вот результат my_call_777.
```

`my_call_777` не соответствует ни одному Tool Call в истории.

`tool_call_id` выполняет роль **correlation ID** — связывает запрос на выполнение операции с результатом именно этой операции.

Поэтому нужно копировать:

```text
choices[0].message.tool_calls[n].id
```

в:

```text
messages[].tool_call_id
```

---

# 9. Эксперимент №2 — изменяем `tool_call_id`

Сначала выполните правильный запрос:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\":12.4}"
}
```

Затем замените ID:

```json
{
  "role": "tool",
  "tool_call_id": "call_I_INVENTED_MYSELF",
  "content": "{\"temperature\":12.4}"
}
```

### Зафиксируйте

```text
HTTP status
ответ API
error.message
```

### Объясните

Почему API не может считать результат:

```text
call_I_INVENTED_MYSELF
```

результатом:

```text
call_abc123
```

---

# 10. Почему используется `role: "tool"`

Сравним:

```json
{
  "role": "user",
  "content": "{\"temperature\":12.4}"
}
```

и:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\":12.4}"
}
```

Первый вариант означает:

```text
Пользователь сообщил:
температура = 12.4
```

Второй:

```text
Tool Call call_abc123 завершился
и вернул:
температура = 12.4
```

Роль определяет не только формат сообщения, но и **источник информации и место сообщения в истории взаимодействия**.

---

# 11. Эксперимент №3 — `user` вместо `tool`

После получения результата внешнего API сначала передайте его правильно:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\":12.4}"
}
```

Затем попробуйте передать те же данные как:

```json
{
  "role": "user",
  "content": "{\"temperature\":12.4}"
}
```

### Сравните

```text
ответ API
финальный ответ модели
историю messages
```

### Ответьте

Почему одинаковый `content` имеет разный смысл при разных `role`?

---

# 12. Зачем возвращать `assistant.tool_calls`

После первого запроса модель вернула:

```json
{
  "role": "assistant",
  "content": null,

  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"latitude\":55.7558,\"longitude\":37.6173}"
      }
    }
  ]
}
```

Это сообщение необходимо сохранить в истории.

Правильная последовательность:

```text
developer
    ↓
user
    ↓
assistant + tool_calls
    ↓
tool + tool_call_id + content
    ↓
assistant
```

Почему?

Потому что сообщение `tool` является **ответом на предыдущий запрос модели `assistant.tool_calls`**.

Если удалить `assistant.tool_calls`, в истории появится результат операции, которую модель в этой истории не запрашивала.

Практическое правило:

```text
Получили choices[0].message
        ↓
сохранили его в messages
        ↓
выполнили Tool
        ↓
добавили role = tool
```

Не нужно вручную восстанавливать сообщение модели — лучше сохранить реально полученный `choices[0].message`.

---

# 13. Эксперимент №4 — удаляем `assistant.tool_calls`

Сначала выполните правильную последовательность:

```text
developer
user
assistant + tool_calls
tool
```

Затем удалите:

```text
assistant + tool_calls
```

и попробуйте отправить:

```text
developer
user
tool
```

### Зафиксируйте

```text
HTTP status
ответ API
error.message
```

### Объясните

Откуда в истории появился `tool_call_id`, если соответствующего `assistant.tool_calls` больше нет?

---

# 14. Полный второй запрос

После выполнения внешнего API:

```json
{
  "model": "gpt-5.6-terra",

  "messages": [
    {
      "role": "developer",
      "content": "Ты погодный ассистент. Для актуальной погоды используй Tool."
    },

    {
      "role": "user",
      "content": "Какая сейчас погода в Москве?"
    },

    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"latitude\":55.7558,\"longitude\":37.6173}"
          }
        }
      ]
    },

    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"temperature_c\":12.4,\"wind_speed_ms\":3.8,\"weather\":\"cloudy\"}"
    }
  ],

  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Получает текущую погоду по координатам",
        "parameters": {
          "type": "object",
          "properties": {
            "latitude": {
              "type": "number"
            },
            "longitude": {
              "type": "number"
            }
          },
          "required": [
            "latitude",
            "longitude"
          ],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  ],

  "tool_choice": "auto"
}
```

После этого модель может вернуть:

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Сейчас в Москве около +12,4 °C, облачно. Скорость ветра — около 3,8 м/с."
      },
      "finish_reason": "stop"
    }
  ]
}
```

Теперь:

```text
finish_reason = stop
```

означает, что модель закончила текущую генерацию без запроса следующего Tool.

---

# 15. Что передавать в `tool.content`

Можно передать JSON:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature_c\":12.4,\"weather\":\"cloudy\"}"
}
```

Можно передать текст:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "Температура 12.4 °C, облачно."
}
```

Оба варианта понятны модели.

Для программных интеграций JSON обычно удобнее, потому что он:

```text
структурирован;
машиночитаем;
легко валидируется;
легко тестируется;
удобен для логирования.
```

Если внешний API вернул объект, приложение обычно сериализует его:

```text
JSON object
    ↓
JSON.stringify(...)
    ↓
tool.content
```

---

# 16. Эксперимент №5 — JSON против текста

Передайте сначала:

```json
{
  "temperature_c": 12.4,
  "wind_speed_ms": 3.8,
  "weather": "cloudy"
}
```

Затем тот же результат:

```text
На улице примерно 12 градусов, облачно,
скорость ветра около 4 м/с.
```

### Сравните

```text
финальный ответ
удобство автоматической проверки
структурированность результата
```

### Ответьте

Какой формат удобнее для взаимодействия между программными компонентами и почему?

---

# 17. Нужно ли передавать весь JSON внешнего API

Не обязательно.

Допустим API вернул 100 KB данных, включая:

```text
timezone
elevation
units
hourly forecast
metadata
generation time
current weather
...
```

А для ответа нужны:

```text
temperature
wind_speed
weather
```

Можно преобразовать результат в:

```json
{
  "temperature_c": 12.4,
  "wind_speed_ms": 3.8,
  "weather": "cloudy"
}
```

Это уменьшает:

```text
input tokens
стоимость
занимаемый context
количество нерелевантной информации
```

Но удалять данные нужно осознанно: если модель должна анализировать поле, его нельзя выбросить при нормализации.

---

# 18. Эксперимент №6 — полный и сокращённый JSON

Вариант A:

передайте полный ответ Weather API.

Вариант B:

оставьте только:

```json
{
  "temperature_c": 12.4,
  "wind_speed_ms": 3.8,
  "weather": "cloudy"
}
```

### Сравните

```text
usage.prompt_tokens
usage.total_tokens
финальный ответ
```

### Ответьте

1. Сколько токенов удалось сэкономить?
2. Изменилось ли качество ответа?
3. Какие поля действительно требовались модели?

---

# 19. Ошибка внешнего Tool

Если внешний API вернул:

```text
HTTP 503 Service Unavailable
```

не нужно подменять ошибку фиктивными данными.

Например, нельзя возвращать:

```json
{
  "temperature": 0
}
```

Потому что модель не сможет отличить:

```text
реально 0 °C
```

от:

```text
температура неизвестна из-за ошибки.
```

Лучше передать:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WEATHER_API_UNAVAILABLE",
    "http_status": 503,
    "message": "Weather service unavailable"
  }
}
```

Удобный единый контракт Tool:

```text
success
data
error
```

Успешный результат:

```json
{
  "success": true,
  "data": {
    "temperature_c": 12.4,
    "weather": "cloudy"
  },
  "error": null
}
```

Ошибка:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "WEATHER_API_UNAVAILABLE",
    "message": "Weather service unavailable"
  }
}
```

Такой контракт упрощает обработку, тестирование и логирование.

---

# 20. Эксперимент №7 — ошибка Tool

Сначала передайте успешный результат.

Затем имитируйте:

```text
HTTP 503
```

и передайте ошибку через `tool.content`.

Дополнительно добавьте в `developer`:

```text
Если Weather Tool вернул ошибку,
не придумывай актуальную погоду.
Сообщи пользователю, что получить данные не удалось.
```

### Сравните

```text
финальный ответ при success=true
финальный ответ при success=false
```

### Ответьте

Почему модель должна знать, что Tool завершился ошибкой?

---

# 21. Какие сообщения могут находиться в `messages`

Основные роли:

| Role | Назначение | Основные данные |
|---|---|---|
| `developer` | Инструкции приложения | `content`, optional `name` |
| `system` | Системные инструкции, особенно в старых моделях/интеграциях | `content`, optional `name` |
| `user` | Запрос пользователя | `content`, optional `name` |
| `assistant` | Ответ или Tool Call модели | `content`, `tool_calls`, `refusal`, optional `name`, `audio` |
| `tool` | Результат выполнения Tool | `tool_call_id`, `content` |

Для новых лабораторных с современными моделями инструкции приложения удобно задавать через:

```text
role = developer
```

Пример:

```json
{
  "role": "developer",
  "content": "Для актуальной погоды всегда используй Weather Tool."
}
```

А запрос пользователя:

```json
{
  "role": "user",
  "content": "Какая сейчас погода в Москве?"
}
```

---

# 22. `tool_choice`

`tool_choice` задаётся на верхнем уровне запроса.

### Модель решает сама

```json
{
  "tool_choice": "auto"
}
```

Подходит, если модель должна определить, требуется ли Tool.

### Запретить Tools

```json
{
  "tool_choice": "none"
}
```

Полезно, например, для тестирования поведения модели без внешних источников.

### Потребовать Tool

```json
{
  "tool_choice": "required"
}
```

Полезно, когда ответ обязательно должен основываться на актуальных внешних данных.

Например:

```text
текущий баланс;
актуальная погода;
текущий статус заказа;
актуальная стоимость товара.
```

Но `required` нельзя использовать механически для всех запросов: модель будет обязана вызвать Tool даже тогда, когда для ответа он не нужен.

---

# 23. Эксперимент №8 — `tool_choice`

Используйте один запрос:

```text
Какая сейчас погода в Москве?
```

Последовательно установите:

```text
tool_choice = auto
```

```text
tool_choice = none
```

```text
tool_choice = required
```

### Сравните

```text
finish_reason
message.content
message.tool_calls
```

### Объясните

1. Когда появился Tool Call?
2. Что произошло при `none`?
3. Почему `required` полезен для актуальных данных?
4. В каких ситуациях `required` будет лишним?

---

# 24. Несколько Tool Calls

Запрос:

```text
Сравни текущую погоду в Москве и Париже.
```

Модель может вернуть:

```json
{
  "role": "assistant",
  "content": null,

  "tool_calls": [
    {
      "id": "call_moscow",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\":\"Moscow\"}"
      }
    },

    {
      "id": "call_paris",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\":\"Paris\"}"
      }
    }
  ]
}
```

После выполнения Tools добавляем два результата:

```json
{
  "role": "tool",
  "tool_call_id": "call_moscow",
  "content": "{\"temperature_c\":12.4}"
}
```

```json
{
  "role": "tool",
  "tool_call_id": "call_paris",
  "content": "{\"temperature_c\":17.8}"
}
```

Так модель понимает, какой результат относится к какому вызову.

---

# 25. Эксперимент №9 — несколько вызовов одного Tool

Задайте:

```text
Сравни текущую погоду в Москве, Париже и Дубае.
```

Запишите для каждого Tool Call:

```text
id
function.name
function.arguments
```

### Ответьте

1. Почему `function.name` может быть одинаковым?
2. Почему `id` должны различаться?
3. Что произойдёт, если перепутать `tool_call_id` результатов?

---

# 26. `parallel_tool_calls`

Параметр:

```json
{
  "parallel_tool_calls": true
}
```

позволяет модели сформировать несколько независимых Tool Calls за один шаг.

Например:

```text
Москва ─┐
Париж ──┼── Weather API
Дубай ──┘
```

Если каждый запрос выполняется 500 ms:

последовательно:

```text
≈ 1500 ms
```

параллельно теоретически:

```text
≈ 500 ms + накладные расходы
```

Параллельность полезна только для независимых операций.

Нельзя параллельно выполнять:

```text
get_coordinates(city)
        ↓
get_weather(latitude, longitude)
```

если второй вызов требует результат первого.

---

# 27. Эксперимент №10 — Parallel Tool Calls

Запрос:

```text
Сравни погоду в Москве, Париже и Дубае.
```

Сравните:

```json
{
  "parallel_tool_calls": true
}
```

и:

```json
{
  "parallel_tool_calls": false
}
```

Зафиксируйте:

```text
tool_calls.length
число обращений к LLM
общее время выполнения
```

Объясните полученный результат.

---

# 28. Multi-step Agent

Теперь создадим два Tool:

```text
get_coordinates(city)

get_weather(latitude, longitude)
```

Запрос:

```text
Какая сейчас погода в Дубае?
```

Возможный процесс:

```text
USER
 │
 ▼
LLM
 │
 │ call_001
 ▼
get_coordinates("Дубай")
 │
 ▼
TOOL RESULT
tool_call_id = call_001
 │
 ▼
LLM
 │
 │ call_002
 ▼
get_weather(25.2048, 55.2708)
 │
 ▼
TOOL RESULT
tool_call_id = call_002
 │
 ▼
LLM
 │
 ▼
FINAL ANSWER
```

Здесь второй Tool зависит от результата первого.

Поэтому между ними снова вызывается LLM:

```text
coordinates
      ↓
LLM получает координаты
      ↓
LLM формирует arguments для get_weather
```

Это уже простой многошаговый AI-агент.

---

# 29. Эксперимент №11 — Multi-step Agent

Создайте:

```text
get_coordinates(city)
get_weather(latitude, longitude)
```

Запросите:

```text
Какая сейчас погода в Стамбуле?
```

На каждом обращении к модели сохраните:

```text
messages
finish_reason
tool_calls
tool_call.id
function.name
function.arguments
tool result
```

### Ответьте

1. Кто решил вызвать `get_coordinates`?
2. Кто фактически выполнил HTTP-запрос?
3. Кто решил после получения координат вызвать `get_weather`?
4. Почему `get_weather` нельзя выполнить раньше получения координат?

---

# 30. Agent Loop

Нельзя считать, что любой агент всегда работает так:

```text
LLM → Tool → LLM → END
```

Модель может запросить следующий Tool.

Поэтому приложение обычно реализует цикл:

```text
while true:

    response = call_llm(messages, tools)

    assistant_message =
        response.choices[0].message

    messages.append(assistant_message)

    if assistant_message.tool_calls is empty:

        return assistant_message.content

    for tool_call in assistant_message.tool_calls:

        arguments =
            parse(tool_call.function.arguments)

        validate(arguments)

        result =
            execute_tool(
                tool_call.function.name,
                arguments
            )

        messages.append({
            role: "tool",
            tool_call_id: tool_call.id,
            content: serialize(result)
        })
```

При этом нужен предел числа итераций, например:

```text
MAX_AGENT_STEPS = 10
```

Он защищает приложение от ситуации:

```text
LLM → Tool → LLM → Tool → LLM → Tool → ...
```

из-за ошибки prompt, Tool или логики агента.

---

# 31. Эксперимент №12 — ограничение Agent Loop

Установите:

```text
MAX_AGENT_STEPS = 1
```

Запустите задачу с:

```text
get_coordinates
+
get_weather
```

Затем установите:

```text
MAX_AGENT_STEPS = 10
```

### Сравните результаты

Ответьте:

1. Почему одного шага оказалось недостаточно?
2. Что должно делать приложение при достижении лимита?
3. Почему лимит лучше контролировать кодом приложения, а не только инструкцией модели?

---

# 32. Итоговое практическое задание

Реализуйте агента с Tools:

```text
get_coordinates(city)

get_weather(latitude, longitude)
```

Запрос:

```text
Сравни текущую погоду в Москве,
Париже и Дубае и скажи,
где сейчас теплее.
```

Агент должен:

```text
1. Определить необходимые Tool Calls.

2. Получить для каждого:
   id
   function.name
   function.arguments

3. Распарсить arguments.

4. Проверить arguments.

5. Выполнить внешние HTTP-запросы.

6. Нормализовать результаты.

7. Для каждого результата добавить:

   role = tool
   tool_call_id = исходный tool_call.id
   content = результат

8. Повторно вызвать LLM.

9. Если появились новые tool_calls —
   продолжить Agent Loop.

10. Если tool_calls отсутствуют —
    вернуть message.content пользователю.
```

---

# 33. Итоговый эксперимент — специально ломаем агента

После того как рабочий вариант готов, последовательно внесите ошибки.

### A. Неправильный ID

Замените настоящий:

```text
tool_call_id
```

на придуманный.

Посмотрите ответ API и объясните причину.

### B. Неправильная роль

Замените:

```text
role = tool
```

на:

```text
role = user
```

Объясните, как изменилась семантика истории.

### C. Потерян Tool Call

Удалите из истории:

```text
assistant.tool_calls
```

но оставьте `tool`.

Объясните, почему нарушилась последовательность событий.

### D. Лишние данные

Передайте сначала полный большой JSON Weather API, затем только необходимые поля.

Сравните:

```text
prompt_tokens
total_tokens
финальный ответ
```

### E. Ошибка внешнего API

Передайте:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "HTTP_503",
    "message": "Weather service unavailable"
  }
}
```

Проверьте, как агент обработает отсутствие данных.

---

# 34. Контрольные вопросы

1. Кто фактически вызывает внешний REST API — LLM или приложение?
2. Что содержится в `function.arguments`?
3. Почему `arguments` необходимо валидировать?
4. Что означает `finish_reason = "tool_calls"`?
5. Чем `function.name` отличается от `tool_call.id`?
6. Почему нельзя самостоятельно придумать `tool_call_id`?
7. Почему результат API передаётся с `role: "tool"`?
8. Зачем сохранять `assistant.tool_calls` в истории?
9. Что помещается в `tool.content`?
10. Обязательно ли использовать JSON в `tool.content`?
11. Почему большой ответ внешнего API иногда полезно сокращать?
12. Как передать модели ошибку Tool?
13. Зачем нужны несколько Tool Calls?
14. Когда Tool Calls можно выполнять параллельно?
15. Когда они должны выполняться последовательно?
16. Зачем нужен Agent Loop?
17. Зачем ограничивать количество итераций?
18. Когда можно считать выполнение агента завершённым?

---

# 35. Шпаргалка

```text
Что модель хочет вызвать?

choices[0].message.tool_calls[n].function.name


С какими параметрами?

choices[0].message.tool_calls[n].function.arguments


Какой конкретно вызов?

choices[0].message.tool_calls[n].id


Что делает приложение?

parse(arguments)
→ validate(arguments)
→ execute Tool
→ получить result


Как вернуть result модели?

messages[] += {
    "role": "tool",
    "tool_call_id": tool_call.id,
    "content": serialize(result)
}


Зачем tool_call_id?

Связать конкретный Tool Call
с результатом именно этого вызова.


Что делать дальше?

Снова:

POST /v1/chat/completions


Если снова появились tool_calls?

Выполнить их и продолжить Agent Loop.


Если tool_calls отсутствуют?

Использовать:

choices[0].message.content

как финальный ответ.
```

Главная схема:

```text
assistant.tool_calls[]
│
├── id ────────────────────────────┐
├── function.name                  │
└── function.arguments             │
          │                        │
          ▼                        │
      APPLICATION                  │
          │                        │
          ▼                        │
      EXTERNAL API                 │
          │                        │
          ▼                        │
        RESULT                     │
          │                        │
          ▼                        │
tool                               │
├── tool_call_id ◄─────────────────┘
└── content = RESULT
          │
          ▼
         LLM
          │
          ├── новый Tool Call → продолжить цикл
          │
          └── content → финальный ответ
```