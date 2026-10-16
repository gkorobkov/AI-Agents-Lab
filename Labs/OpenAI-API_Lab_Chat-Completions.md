# Table of contents

- [Лабораторная работа №1. OpenAI `POST /v1/chat/completions`](#лабораторная-работа-1-openai-post-v1chatcompletions)
  - [Цель](#цель)
- [1. Минимальный запрос](#1-минимальный-запрос)
- [2. Главная схема: INPUT → OUTPUT](#2-главная-схема-input-output)
- [3. `model`](#3-model)
    - [Эксперимент](#эксперимент)
- [4. `messages`](#4-messages)
    - [`developer`](#developer)
    - [`system`](#system)
    - [`user`](#user)
    - [`assistant`](#assistant)
    - [Лабораторный эксперимент](#лабораторный-эксперимент)
- [5. `temperature`](#5-temperature)
    - [Эксперимент](#эксперимент-1)
- [6. `top_p`](#6-top_p)
    - [Эксперимент](#эксперимент-2)
- [7. `max_completion_tokens`](#7-max_completion_tokens)
    - [Эксперимент](#эксперимент-3)
- [8. `n`](#8-n)
    - [Что наблюдать](#что-наблюдать)
- [9. `stop`](#9-stop)
    - [Эксперимент](#эксперимент-4)
- [10. `frequency_penalty`](#10-frequency_penalty)
    - [Эксперимент](#эксперимент-5)
- [11. `presence_penalty`](#11-presence_penalty)
    - [Эксперимент](#эксперимент-6)
- [12. `logit_bias`](#12-logit_bias)
    - [Эксперимент](#эксперимент-7)
- [13. `logprobs`](#13-logprobs)
- [14. `top_logprobs`](#14-top_logprobs)
    - [Отличная лабораторная](#отличная-лабораторная)
- [15. `response_format`](#15-response_format)
    - [Пример Structured Output](#пример-structured-output)
    - [Эксперимент](#эксперимент-8)
- [16. `reasoning_effort`](#16-reasoning_effort)
    - [Эксперимент](#эксперимент-9)
- [17. `verbosity`](#17-verbosity)
    - [Эксперимент](#эксперимент-10)
- [18. `tools`](#18-tools)
- [19. `tool_choice`](#19-tool_choice)
    - [Запретить](#запретить)
    - [Решает модель](#решает-модель)
    - [Обязательно вызвать tool](#обязательно-вызвать-tool)
    - [Заставить вызвать определённую функцию](#заставить-вызвать-определённую-функцию)
    - [Что изменится](#что-изменится)
- [20. `parallel_tool_calls`](#20-parallel_tool_calls)
    - [Лабораторная](#лабораторная)
- [21. `stream`](#21-stream)
    - [Что изучает пользователь](#что-изучает-пользователь)
- [22. `stream_options`](#22-stream_options)
- [23. `metadata`](#23-metadata)
- [24. `modalities`](#24-modalities)
- [25. `audio`](#25-audio)
- [26. `prediction`](#26-prediction)
    - [Эксперимент](#эксперимент-11)
- [27. Prompt Caching](#27-prompt-caching)
    - [Лабораторная](#лабораторная-1)
- [28. `service_tier`](#28-service_tier)
- [29. `safety_identifier`](#29-safety_identifier)
- [30. `store`](#30-store)
- [31. `moderation`](#31-moderation)
- [32. `web_search_options`](#32-web_search_options)
- [33. Deprecated параметры](#33-deprecated-параметры)
- [34. Все основные OUTPUT-параметры](#34-все-основные-output-параметры)
  - [`id`](#id)
  - [`object`](#object)
  - [`created`](#created)
  - [`model`](#model)
- [35. `choices[]`](#35-choices)
- [36. `choices[].index`](#36-choicesindex)
- [37. `choices[].message.role`](#37-choicesmessagerole)
- [38. `choices[].message.content`](#38-choicesmessagecontent)
- [39. `choices[].message.refusal`](#39-choicesmessagerefusal)
- [40. `choices[].message.annotations`](#40-choicesmessageannotations)
- [41. `choices[].message.tool_calls`](#41-choicesmessagetool_calls)
- [42. `choices[].logprobs`](#42-choiceslogprobs)
- [43. `finish_reason`](#43-finish_reason)
- [44. `usage.prompt_tokens`](#44-usageprompt_tokens)
- [45. `usage.completion_tokens`](#45-usagecompletion_tokens)
- [46. `usage.total_tokens`](#46-usagetotal_tokens)
- [47. `completion_tokens_details.reasoning_tokens`](#47-completion_tokens_detailsreasoning_tokens)
- [48. `accepted_prediction_tokens`](#48-accepted_prediction_tokens)
- [49. `rejected_prediction_tokens`](#49-rejected_prediction_tokens)
- [50. `prompt_tokens_details.cached_tokens`](#50-prompt_tokens_detailscached_tokens)
- [51. `prompt_tokens_details.cache_write_tokens`](#51-prompt_tokens_detailscache_write_tokens)
- [52. `service_tier`](#52-service_tier)
- [Практическая программа лабораторной](#практическая-программа-лабораторной)
- [Что пользователь должен сдавать](#что-пользователь-должен-сдавать)
- [Итоговая карта зависимостей](#итоговая-карта-зависимостей)

API `POST /v1/chat/completions` очень удобен именно для обучения: у него хорошо видна связь **request → поведение модели → response**, и на нём удобно изучить sampling, токены, роли, Structured Output, function calling и streaming. OpenAI при этом прямо указывает, что поддержка отдельных параметров зависит от выбранной модели. ([OpenAI Developers][1])

Основная документация:

[OpenAI API Reference — Create Chat Completion](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create?utm_source=chatgpt.com)

[OpenAI Text Generation Guide](https://developers.openai.com/api/docs/guides/text?utm_source=chatgpt.com)

[OpenAI Models](https://platform.openai.com/docs/models?utm_source=chatgpt.com)

# Лабораторная работа №1. OpenAI `POST /v1/chat/completions`

## Цель

После лабораторной пользователь должен понимать не просто «как отправить запрос», а:

**какой входной параметр чем управляет → где это проявляется в response → какой эксперимент это доказывает.**

API разделено ана 8 логических частей:

1. базовый HTTP-запрос;
2. `model` и `messages`;
3. управление генерацией;
4. управление длиной и стоимостью;
5. Structured Output;
6. log probabilities;
7. Tool / Function Calling;
8. Streaming, caching и служебные параметры.

---

# 1. Минимальный запрос

Endpoint:

```text
POST https://api.openai.com/v1/chat/completions
```

Минимальный рабочий `curl`:

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5.4",
    "messages": [
      {
        "role": "user",
        "content": "Объясни REST API одним предложением."
      }
    ]
  }'
```

Именно такую структуру — `model + messages` — показывает текущий официальный пример OpenAI. ([OpenAI Developers][1])

Типичный ответ:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1741569952,
  "model": "gpt-5.4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "...",
        "refusal": null,
        "annotations": []
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 19,
    "completion_tokens": 10,
    "total_tokens": 29,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default"
}
```

Структура официального response сейчас именно такая. ([OpenAI Developers][1])

---

# 2. Главная схема: INPUT → OUTPUT

Это основная таблица лабораторной.

| Входной параметр        | Что регулирует                        | Что смотреть в ответе                              |
| ----------------------- | ------------------------------------- | -------------------------------------------------- |
| `model`                 | модель                                | `model`, качество, latency, `usage`                |
| `messages`              | контекст диалога                      | `choices[].message.content`, `usage.prompt_tokens` |
| `temperature`           | случайность генерации                 | различия `message.content`                         |
| `top_p`                 | nucleus sampling                      | различия `message.content`                         |
| `max_completion_tokens` | максимум генерации                    | `finish_reason`, `completion_tokens`               |
| `n`                     | число вариантов ответа                | количество `choices[]`                             |
| `stop`                  | последовательность остановки          | `message.content`, `finish_reason`                 |
| `frequency_penalty`     | повторение одинаковых токенов         | текст ответа                                       |
| `presence_penalty`      | склонность вводить новые темы         | текст ответа                                       |
| `logit_bias`            | вероятность конкретных токенов        | текст + `logprobs`                                 |
| `logprobs`              | вернуть вероятности токенов           | `choices[].logprobs`                               |
| `top_logprobs`          | альтернативные токены                 | `logprobs.content[].top_logprobs`                  |
| `response_format`       | формат результата                     | `message.content`                                  |
| `reasoning_effort`      | объём reasoning                       | latency, `reasoning_tokens`                        |
| `verbosity`             | подробность                           | длина `content`, `completion_tokens`               |
| `tools`                 | доступные функции                     | `message.tool_calls`                               |
| `tool_choice`           | выбирать/обязать tool                 | `tool_calls`, `finish_reason`                      |
| `parallel_tool_calls`   | параллельные function calls           | количество `tool_calls`                            |
| `stream`                | потоковая выдача                      | вместо одного JSON идут chunks                     |
| `stream_options`        | параметры streaming                   | `usage` в stream                                   |
| `modalities`            | text/audio output                     | `message.content`, `message.audio`                 |
| `audio`                 | формат/голос audio                    | `message.audio`                                    |
| `prediction`            | ожидаемый output                      | prediction-token statistics                        |
| `prompt_cache_key`      | группировка cache                     | `cached_tokens`                                    |
| `prompt_cache_options`  | управление cache                      | `cached_tokens`, `cache_write_tokens`              |
| `service_tier`          | способ обработки                      | `service_tier`, latency                            |
| `metadata`              | metadata объекта                      | `metadata`                                         |
| `moderation`            | moderation                            | `moderation`                                       |
| `safety_identifier`     | идентификатор пользователя для safety | напрямую качество текста не меняет                 |
| `store`                 | хранение completion                   | текст обычно не меняется                           |
| `web_search_options`    | Web Search                            | content + `annotations`                            |
| `seed`                  | best-effort determinism, deprecated   | повторяемость + `system_fingerprint`               |
| `user`                  | deprecated                            | заменён `safety_identifier` / `prompt_cache_key`   |

Теперь разберём это практически.

---

# 3. `model`

Тип:

```json
"model": "gpt-5.4"
```

Это обязательный параметр, определяющий модель, которая генерирует ответ. OpenAI прямо предупреждает, что **не все параметры поддерживаются всеми моделями**, особенно reasoning-моделями. ([OpenAI Developers][1])

### Эксперимент

Один и тот же prompt выполнить на двух моделях:

```json
"model": "gpt-5.4"
```

и:

```json
"model": "gpt-4.1-mini"
```

Сравнить:

```text
response.model
response.choices[0].message.content
response.usage.prompt_tokens
response.usage.completion_tokens
response.usage.completion_tokens_details.reasoning_tokens
latency
```

Важно: `model` в response показывает **реально использованную модель**. ([OpenAI Developers][1])

---

# 4. `messages`

Это центральный входной параметр Chat Completions.

```json
"messages": [
  {
    "role": "developer",
    "content": "Отвечай как преподаватель."
  },
  {
    "role": "user",
    "content": "Что такое API?"
  }
]
```

OpenAI определяет `messages` как список сообщений, составляющих текущий разговор. ([OpenAI Developers][1])

Основные роли:

```text
developer
system
user
assistant
tool
```

Есть также legacy `function`.

Особенно важно для пользователей:

### `developer`

```json
{
  "role": "developer",
  "content": "Отвечай только одним предложением."
}
```

На новых моделях OpenAI рекомендует `developer` вместо прежней роли `system`. ([OpenAI Developers][1])

### `system`

```json
{
  "role": "system",
  "content": "Ты преподаватель Python."
}
```

Сохраняется для совместимости, но для новых моделей документация рекомендует `developer`. ([OpenAI Developers][1])

### `user`

```json
{
  "role": "user",
  "content": "Что такое REST?"
}
```

Это пользовательский запрос.

### `assistant`

Позволяет передать предыдущий ответ модели:

```json
{
  "role": "assistant",
  "content": "REST — архитектурный стиль..."
}
```

Так Chat Completions реализует историю разговора: **сервер сам вашу conversation history за вас не собирает — вы передаёте нужные сообщения снова.**

### Лабораторный эксперимент

Запрос №1:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Меня зовут Алексей."
    },
    {
      "role": "user",
      "content": "Как меня зовут?"
    }
  ]
}
```

Запрос №2:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Как меня зовут?"
    }
  ]
}
```

Сравнить:

```text
choices[0].message.content
usage.prompt_tokens
```

Так пользователь практически увидит, что **контекст = `messages[]`**.

---

# 5. `temperature`

Диапазон:

```text
0 ... 2
```

Пример:

```json
"temperature": 0.2
```

или:

```json
"temperature": 1.5
```

Чем выше значение, тем более вариативным становится sampling. Низкое значение делает ответ более сфокусированным. OpenAI рекомендует менять либо `temperature`, либо `top_p`, а не оба одновременно. ([OpenAI Developers][1])

### Эксперимент

Prompt:

```text
Придумай название стартапа, который использует AI для обучения программистов.
```

Сделать по 5 запросов:

```json
"temperature": 0
```

```json
"temperature": 0.5
```

```json
"temperature": 1
```

```json
"temperature": 1.8
```

Смотреть:

```text
choices[0].message.content
```

Здесь важно объяснить пользователям:

**temperature не появляется отдельным числом в response.**

Она меняет статистическое поведение генерации, поэтому эффект видим через контент.

---

# 6. `top_p`

Диапазон:

```text
0 ... 1
```

Например:

```json
"top_p": 0.1
```

означает, что sampling ограничивается токенами, составляющими верхнюю часть probability mass. ([OpenAI Developers][1])

Практически:

```text
top_p ≈ 1 → широкий выбор токенов

top_p ↓ → выбор становится более ограниченным
```

### Эксперимент

Оставить:

```json
"temperature": 1
```

и проверить:

```json
"top_p": 1
```

```json
"top_p": 0.5
```

```json
"top_p": 0.1
```

Затем сравнить разнообразие ответов.

Не надо одновременно строить эксперимент:

```text
temperature 0.2 → 1.8
и
top_p 0.1 → 1
```

Иначе пользователь не поймёт причинно-следственную связь.

---

# 7. `max_completion_tokens`

Пример:

```json
"max_completion_tokens": 100
```

Это верхняя граница количества генерируемых токенов, включая visible output и reasoning tokens. ([OpenAI Developers][1])

Старый параметр:

```json
"max_tokens": 100
```

сейчас deprecated; OpenAI рекомендует `max_completion_tokens`. ([OpenAI Developers][1])

### Эксперимент

Prompt:

```text
Подробно расскажи историю языка Python.
```

Запросы:

```json
"max_completion_tokens": 30
```

```json
"max_completion_tokens": 100
```

```json
"max_completion_tokens": 500
```

Смотреть:

```text
choices[0].finish_reason
usage.completion_tokens
choices[0].message.content
```

Если лимит оборвал генерацию:

```json
"finish_reason": "length"
```

Если модель закончила сама:

```json
"finish_reason": "stop"
```

OpenAI определяет эти значения именно так. ([OpenAI Developers][1])

---

# 8. `n`

```json
"n": 3
```

Означает:

> сгенерировать три варианта completion.

Диапазон сейчас:

```text
1 ... 128
```

OpenAI отдельно предупреждает: оплачиваются токены **всех choices**. ([OpenAI Developers][1])

При:

```json
"n": 1
```

получим:

```json
"choices": [
  {
    "index": 0
  }
]
```

При:

```json
"n": 3
```

получим:

```json
"choices": [
  {"index": 0},
  {"index": 1},
  {"index": 2}
]
```

### Что наблюдать

Меняется напрямую:

```text
choices.length
choices[].index
usage.completion_tokens
total_tokens
```

---

# 9. `stop`

Например:

```json
"stop": "END"
```

или до четырёх последовательностей:

```json
"stop": [
  "END",
  "---",
  "STOP"
]
```

Когда модель собирается сгенерировать соответствующую последовательность, generation прекращается, а сама stop sequence в returned text не включается. ([OpenAI Developers][1])

### Эксперимент

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Напиши числа от 1 до 10 в формате: 1, 2, 3..."
    }
  ],
  "stop": "5"
}
```

Смотреть:

```text
message.content
finish_reason
```

Примечание: параметр не поддерживается некоторыми новыми reasoning models, включая указанные в документации `o3` и `o4-mini`. ([OpenAI Developers][1])

---

# 10. `frequency_penalty`

Диапазон:

```text
-2 ... 2
```

Положительное значение уменьшает вероятность повторения уже часто встречавшихся токенов. ([OpenAI Developers][1])

Например:

```json
"frequency_penalty": 2
```

### Эксперимент

Prompt:

```text
Напиши длинный рекламный текст про кофе, много раз используя слова кофе, вкусный и ароматный.
```

Запустить:

```json
"frequency_penalty": 0
```

и:

```json
"frequency_penalty": 2
```

Посчитать частоту слов:

```text
кофе
вкусный
ароматный
```

Это отличный эксперимент для пользователей, потому что эффект можно измерить программно.

---

# 11. `presence_penalty`

Диапазон:

```text
-2 ... 2
```

Положительное значение штрафует токены уже за сам факт их появления и тем самым увеличивает вероятность перехода к новым темам. ([OpenAI Developers][1])

Это важно отличать от предыдущего параметра:

```text
frequency_penalty
→ насколько часто уже встречался token

presence_penalty
→ встречался ли token вообще
```

### Эксперимент

Prompt:

```text
Рассказывай о разработке программного обеспечения в свободной форме.
```

Сравнить:

```json
"presence_penalty": 0
```

и:

```json
"presence_penalty": 2
```

Посмотреть, насколько модель расширяет набор затрагиваемых тем.

---

# 12. `logit_bias`

Это уже очень хорошая лабораторная для понимания LLM.

Формат:

```json
"logit_bias": {
  "TOKEN_ID": -100
}
```

Диапазон bias:

```text
-100 ... 100
```

OpenAI добавляет bias непосредственно к logits перед sampling. Значения около `-100` практически запрещают token, около `100` резко увеличивают вероятность его выбора. ([OpenAI Developers][1])

Концептуально:

```text
logits
  ↓
+ logit_bias
  ↓
softmax
  ↓
probabilities
  ↓
sampling
```

### Эксперимент

1. Найти token ID слова.
2. Попросить модель использовать это слово.
3. Выполнить запрос без `logit_bias`.
4. Выполнить запрос:

```json
"logit_bias": {
  "12345": -100
}
```

5. Сравнить output.

Это один из лучших способов связать API с внутренней механикой Transformer → logits → probabilities → sampling.

---

# 13. `logprobs`

```json
"logprobs": true
```

Просит API вернуть log probability каждого output token. ([OpenAI Developers][1])

Response:

```json
"logprobs": {
  "content": [
    {
      "token": "Paris",
      "bytes": [...],
      "logprob": -0.002,
      "top_logprobs": [...]
    }
  ]
}
```

OpenAI возвращает для токена:

```text
token
bytes
logprob
top_logprobs
```

([OpenAI Developers][1])

Из:

```text
logprob = ln(P)
```

можно восстановить вероятность:

```text
P = e^logprob
```

Например:

```text
logprob = -0.1

P ≈ 0.905
```

---

# 14. `top_logprobs`

Работает вместе с:

```json
"logprobs": true
```

Например:

```json
"logprobs": true,
"top_logprobs": 5
```

Допустимый диапазон:

```text
0 ... 20
```

API возвращает наиболее вероятные альтернативные токены для каждой позиции. ([OpenAI Developers][1])

### Отличная лабораторная

Prompt:

```text
Столица Франции —
```

Response можно анализировать концептуально как:

```text
Paris       0.97
Lyon        0.01
Marseille   0.004
...
```

Фактически API возвращает `logprob`, поэтому вероятность пользователь вычисляет сам:

```python
import math

probability = math.exp(logprob)
```

---

# 15. `response_format`

Один из важнейших параметров прикладной разработки.

Есть три основных варианта:

```json
{"type": "text"}
```

```json
{"type": "json_object"}
```

```json
{
  "type": "json_schema",
  "json_schema": {...}
}
```

OpenAI рекомендует `json_schema` вместо старого JSON mode для моделей, которые поддерживают Structured Outputs. ([OpenAI Developers][1])

### Пример Structured Output

```json
"response_format": {
  "type": "json_schema",
  "json_schema": {
    "name": "student",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "age": {
          "type": "integer"
        }
      },
      "required": ["name", "age"],
      "additionalProperties": false
    }
  }
}
```

### Эксперимент

Prompt:

```text
Извлеки данные: Иван Петров, 21 год.
```

Сначала обычный запрос.

Получим что-то вроде:

```text
Имя пользователя — Иван Петров, возраст — 21 год.
```

Затем `response_format=json_schema`.

Получим:

```json
{
  "name": "Иван Петров",
  "age": 21
}
```

В response по-прежнему основное место:

```text
choices[0].message.content
```

но теперь содержимое подчиняется заданной схеме.

---

# 16. `reasoning_effort`

Для reasoning-capable моделей:

```json
"reasoning_effort": "low"
```

В текущей документации перечислены:

```text
none
minimal
low
medium
high
xhigh
max
```

При этом конкретная модель может поддерживать не все значения. Уменьшение reasoning effort может уменьшить latency и расход reasoning tokens. ([OpenAI Developers][1])

### Эксперимент

Дать задачу:

```text
У Маши в два раза больше яблок, чем у Пети.
Вместе у них 18 яблок. Сколько у каждого?
```

Запустить:

```json
"reasoning_effort": "low"
```

```json
"reasoning_effort": "medium"
```

```json
"reasoning_effort": "high"
```

Смотреть:

```text
message.content
usage.completion_tokens_details.reasoning_tokens
usage.completion_tokens
latency
```

Причём reasoning tokens входят в `completion_tokens`. ([OpenAI Developers][1])

---

# 17. `verbosity`

Современный и очень наглядный параметр:

```json
"verbosity": "low"
```

```json
"verbosity": "medium"
```

```json
"verbosity": "high"
```

Default:

```text
medium
```

Он регулирует подробность ответа. ([OpenAI Developers][1])

### Эксперимент

Одинаковый prompt:

```text
Объясни архитектуру Kubernetes.
```

Три запроса:

```text
low
medium
high
```

Смотреть:

```text
length(message.content)
completion_tokens
```

Это гораздо более прямой параметр управления подробностью, чем пытаться делать это только через prompt.

---

# 18. `tools`

Это основа Function Calling.

Например:

```json
"tools": [
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Получить текущую погоду",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {
            "type": "string"
          }
        },
        "required": ["city"]
      },
      "strict": true
    }
  }
]
```

В function definition доступны:

```text
name
description
parameters
strict
```

`parameters` задаются через JSON Schema. ([OpenAI Developers][1])

Важно объяснить пользователям:

**модель сама функцию не выполняет.**

Она возвращает намерение вызвать функцию:

```json
"tool_calls": [
  {
    "id": "call_123",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"city\":\"Moscow\"}"
    }
  }
]
```

Ваш код выполняет функцию, а результат отправляет обратно как:

```json
{
  "role": "tool",
  "tool_call_id": "call_123",
  "content": "15°C, дождь"
}
```

---

# 19. `tool_choice`

Управляет тем, должна ли модель использовать tool.

### Запретить

```json
"tool_choice": "none"
```

### Решает модель

```json
"tool_choice": "auto"
```

### Обязательно вызвать tool

```json
"tool_choice": "required"
```

### Заставить вызвать определённую функцию

```json
"tool_choice": {
  "type": "function",
  "function": {
    "name": "get_weather"
  }
}
```

OpenAI описывает именно эти режимы. ([OpenAI Developers][1])

### Что изменится

Обычный ответ:

```json
"finish_reason": "stop"
```

При function calling:

```json
"finish_reason": "tool_calls"
```

и появляется:

```text
message.tool_calls
```

([OpenAI Developers][1])

---

# 20. `parallel_tool_calls`

```json
"parallel_tool_calls": true
```

Разрешает модели сформировать несколько function calls параллельно. ([OpenAI Developers][1])

### Лабораторная

Определить:

```text
get_weather(city)
get_time(city)
```

Prompt:

```text
Какая сейчас погода и время в Москве?
```

При подходящей модели можно получить сразу несколько элементов:

```text
message.tool_calls[0]
message.tool_calls[1]
```

---

# 21. `stream`

Без streaming:

```json
"stream": false
```

клиент ждёт полный response.

При:

```json
"stream": true
```

ответ идёт постепенно через **Server-Sent Events (SSE)**. ([OpenAI Developers][1])

То есть вместо:

```text
request
   ↓
wait
   ↓
complete JSON
```

получаем:

```text
request
   ↓
chunk
chunk
chunk
chunk
[DONE]
```

### Что изучает пользователь

Это важный вывод:

**stream не ускоряет генерацию модели как таковую — он уменьшает perceived latency, потому что клиент получает начало ответа раньше.**

---

# 22. `stream_options`

Используется только при:

```json
"stream": true
```

Основные поля:

```json
"stream_options": {
  "include_usage": true,
  "include_obfuscation": true
}
```

`include_usage=true` добавляет перед `[DONE]` специальный chunk с полной статистикой token usage. ([OpenAI Developers][1])

---

# 23. `metadata`

До 16 пар key/value:

```json
"metadata": {
  "course": "openai-api",
  "student": "student-42",
  "lab": "chat-completions"
}
```

Ограничения:

```text
key ≤ 64 chars
value ≤ 512 chars
```

Metadata можно использовать для последующего поиска/аналитики объектов. ([OpenAI Developers][1])

В response может появиться:

```json
"metadata": {...}
```

---

# 24. `modalities`

По умолчанию:

```json
"modalities": ["text"]
```

Для поддерживающих моделей возможно:

```json
"modalities": [
  "text",
  "audio"
]
```

([OpenAI Developers][1])

Тогда в response помимо:

```text
message.content
```

может появиться:

```text
message.audio
```

---

# 25. `audio`

Если запросили audio output, задаются:

```json
"audio": {
  "voice": "alloy",
  "format": "mp3"
}
```

Поддерживаемые форматы включают:

```text
wav
aac
mp3
flac
opus
pcm16
```

([OpenAI Developers][1])

В response audio object содержит:

```text
id
data
expires_at
transcript
```

`data` — Base64 encoded audio. ([OpenAI Developers][1])

---

# 26. `prediction`

Интересный продвинутый параметр.

Можно сообщить модели:

> я примерно знаю, каким будет output.

Например при небольшом изменении большого файла:

```json
"prediction": {
  "type": "content",
  "content": "..."
}
```

Если модель генерирует текст, совпадающий с prediction, response потенциально можно вернуть быстрее. ([OpenAI Developers][1])

В `usage` появляются особенно интересные поля:

```text
accepted_prediction_tokens
rejected_prediction_tokens
```

([OpenAI Developers][1])

### Эксперимент

Сначала выполнить обычное исправление большого текста.

Затем передать старую версию через `prediction`.

Сравнить:

```text
latency
accepted_prediction_tokens
rejected_prediction_tokens
```

---

# 27. Prompt Caching

Современный Chat Completions API также содержит:

```text
prompt_cache_key
prompt_cache_options
prompt_cache_breakpoint
```

Для новых моделей, включая текущие GPT-5.6, OpenAI документирует явное управление cache breakpoints. ([OpenAI Developers][1])

Например:

```json
"prompt_cache_key": "course-openai-api"
```

Статистику искать здесь:

```text
usage.prompt_tokens_details.cached_tokens
usage.prompt_tokens_details.cache_write_tokens
```

([OpenAI Developers][1])

### Лабораторная

Отправить длинный одинаковый prefix дважды:

```text
developer message: 10 000+ tokens
user message №1
```

затем:

```text
тот же developer message
user message №2
```

Сравнить:

```text
cached_tokens
```

---

# 28. `service_tier`

В текущем API возможны значения вроде:

```text
auto
default
flex
scale
priority
fast
```

Поддержка зависит от доступных вашему проекту режимов. ([OpenAI Developers][1])

Response содержит:

```json
"service_tier": "default"
```

Причём OpenAI предупреждает, что реально использованный tier в response может отличаться от переданного значения. ([OpenAI Developers][1])

Лабораторная здесь не столько про качество текста, сколько про:

```text
latency
price
service_tier
```

---

# 29. `safety_identifier`

```json
"safety_identifier": "sha256-hash-of-user-id"
```

Это стабильный идентификатор пользователя приложения для abuse/safety detection.

OpenAI рекомендует не передавать email напрямую, а использовать хешированный идентификатор. Максимум — 64 символа. ([OpenAI Developers][1])

Это хороший пример параметра, который:

**не обязан менять `message.content`.**

То есть не каждый input parameter имеет наблюдаемую связь с semantic output.

---

# 30. `store`

```json
"store": true
```

Указывает, можно ли сохранить completion для использования в продуктах evals/model distillation. ([OpenAI Developers][1])

Это инфраструктурный параметр.

Не нужно ожидать:

```text
store=true
→ другой текст
```

---

# 31. `moderation`

Современный endpoint позволяет настраивать moderation input/output:

```json
"moderation": {
  "model": "omni-moderation-latest",
  "policy": {
    "input": {
      "mode": "score"
    },
    "output": {
      "mode": "score"
    }
  }
}
```

Режимы:

```text
score
block
```

([OpenAI Developers][1])

При использовании moderated completions response может содержать:

```text
moderation.input
moderation.output
```

включая:

```text
categories
category_scores
flagged
model
```

([OpenAI Developers][1])

---

# 32. `web_search_options`

Chat Completions сейчас также позволяет подключать Web Search через:

```json
"web_search_options": {
  "search_context_size": "medium"
}
```

Возможны:

```text
low
medium
high
```

и approximate location:

```json
"user_location": {
  "type": "approximate",
  "approximate": {
    "city": "Moscow",
    "country": "RU",
    "timezone": "Europe/Moscow"
  }
}
```

([OpenAI Developers][1])

Главное изменение response:

```text
choices[].message.annotations
```

где могут появиться:

```text
url
title
start_index
end_index
```

для web citations. ([OpenAI Developers][1])

---

# 33. Deprecated параметры

Пользователям их стоит показать, но **не строить на них новую лабораторную**.

Сейчас deprecated:

```text
max_tokens
functions
function_call
user
seed
prompt_cache_retention
system_fingerprint в response
```

Их замены:

```text
max_tokens
↓
max_completion_tokens

functions
↓
tools

function_call
↓
tool_choice

user
↓
safety_identifier + prompt_cache_key
```

Официальная документация явно помечает эти поля deprecated. ([OpenAI Developers][1])

---

# 34. Все основные OUTPUT-параметры

Теперь обратная сторона лабораторной.

## `id`

```json
"id": "chatcmpl-..."
```

Уникальный идентификатор completion. ([OpenAI Платформа][2])

Его нельзя «настроить» prompt-параметром.

Каждый новый completion получает собственный ID.

---

## `object`

```json
"object": "chat.completion"
```

Для обычного ответа всегда:

```text
chat.completion
```

([OpenAI Developers][1])

Streaming использует другую структуру chunks.

---

## `created`

```json
"created": 1741569952
```

Unix timestamp создания completion. ([OpenAI Developers][1])

Меняется просто между запросами.

---

## `model`

```json
"model": "gpt-5.4"
```

Связь:

```text
request.model
        ↓
response.model
```

---

# 35. `choices[]`

Главный массив результатов.

```json
"choices": [
  {...}
]
```

Количество прежде всего определяется:

```text
request.n
```

OpenAI прямо указывает, что при `n > 1` choices может быть несколько. ([OpenAI Платформа][2])

---

# 36. `choices[].index`

```json
"index": 0
```

Если:

```json
"n": 3
```

получим индексы:

```text
0
1
2
```

---

# 37. `choices[].message.role`

Для model response:

```json
"role": "assistant"
```

([OpenAI Developers][1])

---

# 38. `choices[].message.content`

Самый главный output:

```json
"content": "..."
```

На него влияют практически все semantic generation parameters:

```text
messages
model
temperature
top_p
frequency_penalty
presence_penalty
logit_bias
max_completion_tokens
stop
response_format
reasoning_effort
verbosity
```

Но связь не всегда детерминирована.

---

# 39. `choices[].message.refusal`

```json
"refusal": null
```

или refusal content, если модель отказалась выполнять запрос.

Документация определяет поле как refusal message generated by model. ([OpenAI Developers][1])

Не стоит строить лабораторную с целью «заставить модель отказаться». Достаточно объяснить структуру поля.

---

# 40. `choices[].message.annotations`

Обычно:

```json
"annotations": []
```

При использовании Web Search могут появляться:

```json
{
  "type": "url_citation",
  "url_citation": {
    "start_index": 10,
    "end_index": 40,
    "title": "...",
    "url": "..."
  }
}
```

([OpenAI Developers][1])

Связь:

```text
web_search_options
      ↓
annotations
```

---

# 41. `choices[].message.tool_calls`

Появляется при Function Calling.

Связь:

```text
tools
tool_choice
      ↓
message.tool_calls
finish_reason = "tool_calls"
```

Функциональный вызов содержит:

```text
id
type
function.name
function.arguments
```

([OpenAI Developers][1])

---

# 42. `choices[].logprobs`

По умолчанию:

```json
"logprobs": null
```

При:

```json
"logprobs": true
```

получаем структуру вероятностей токенов.

Связь чрезвычайно прямая:

```text
request.logprobs=false
↓
response.logprobs=null

request.logprobs=true
↓
response.logprobs={...}
```

---

# 43. `finish_reason`

Одно из самых полезных диагностических полей.

Основные значения:

```text
stop
length
tool_calls
content_filter
function_call   ← deprecated
```

([OpenAI Developers][1])

Соответствия:

```text
нормальное завершение
→ stop

max_completion_tokens закончились
→ length

модель хочет вызвать функцию
→ tool_calls

остановка фильтрацией
→ content_filter
```

---

# 44. `usage.prompt_tokens`

```json
"prompt_tokens": 123
```

Количество input tokens. ([OpenAI Developers][1])

Чтобы изменить его:

```text
увеличить messages
↓
увеличивается prompt_tokens
```

Очень простая лабораторная:

```text
Prompt 10 слов
Prompt 100 слов
Prompt 1000 слов
```

Построить график:

```text
длина текста → prompt_tokens
```

---

# 45. `usage.completion_tokens`

```json
"completion_tokens": 85
```

Количество tokens, использованных completion. ([OpenAI Developers][1])

Зависит, например, от:

```text
max_completion_tokens
verbosity
prompt
reasoning_effort
n
```

---

# 46. `usage.total_tokens`

```text
total_tokens =
prompt_tokens + completion_tokens
```

Так именно определяет поле документация OpenAI. ([OpenAI Developers][1])

Это одна из главных метрик:

```text
context
стоимость
capacity planning
LLMOps monitoring
```

---

# 47. `completion_tokens_details.reasoning_tokens`

```json
"reasoning_tokens": 123
```

Число tokens, затраченных моделью на reasoning. ([OpenAI Developers][1])

Лучший входной параметр для эксперимента:

```text
reasoning_effort
```

---

# 48. `accepted_prediction_tokens`

Связь:

```text
prediction
↓
accepted_prediction_tokens
```

Показывает количество prediction tokens, совпавших с результатом модели. ([OpenAI Developers][1])

---

# 49. `rejected_prediction_tokens`

Количество prediction tokens, которые модель не приняла. Они всё равно учитываются в token accounting. ([OpenAI Developers][1])

---

# 50. `prompt_tokens_details.cached_tokens`

Связь:

```text
повторяющийся prompt prefix
+ prompt caching
↓
cached_tokens
```

([OpenAI Developers][1])

---

# 51. `prompt_tokens_details.cache_write_tokens`

Количество prompt tokens, записанных в cache. ([OpenAI Developers][1])

Это особенно полезно для LLMOps.

---

# 52. `service_tier`

```json
"service_tier": "default"
```

Связан с:

```text
request.service_tier
```

но response показывает фактически применённый tier. ([OpenAI Developers][1])

---

# Практическая программа лабораторной

Я предлагаю пользователям **не дать сразу все 30+ параметров**. Они ничего не запомнят.

Сделать одну лабораторную из **12 последовательных экспериментов**.

|  № | Эксперимент         | Меняем                                  | Наблюдаем                |
| -: | ------------------- | --------------------------------------- | ------------------------ |
|  1 | Первый запрос       | `messages`                              | `content`, `usage`       |
|  2 | Выбор модели        | `model`                                 | `model`, content, tokens |
|  3 | Контекст            | `messages[]`                            | content, `prompt_tokens` |
|  4 | Случайность         | `temperature`                           | вариативность            |
|  5 | Nucleus sampling    | `top_p`                                 | вариативность            |
|  6 | Ограничение длины   | `max_completion_tokens`                 | `finish_reason`, tokens  |
|  7 | Несколько вариантов | `n`                                     | `choices[]`              |
|  8 | Penalties           | `frequency_penalty`, `presence_penalty` | повторяемость текста     |
|  9 | Token probability   | `logprobs`, `top_logprobs`              | token probabilities      |
| 10 | Structured Output   | `response_format`                       | JSON schema              |
| 11 | Reasoning           | `reasoning_effort`, `verbosity`         | reasoning tokens, длина  |
| 12 | Function Calling    | `tools`, `tool_choice`                  | `tool_calls`             |

А **streaming, cache, prediction, audio, moderation, web search** я бы сделал как дополнительную часть для сильных пользователей.

---

# Что пользователь должен сдавать

На каждый эксперимент — не просто код, а таблицу:

```text
Эксперимент:
Изменяемый параметр:

Контрольное значение:
Экспериментальное значение:

Что ожидали изменить:

Фактический результат:

request JSON:
...

response JSON:
...

Изменившиеся поля response:
...

Вывод:
...
```

Главное правило лабораторной:

> **За один эксперимент изменяется только один независимый параметр.**

Иначе нельзя доказать причинно-следственную связь.

---

# Итоговая карта зависимостей

Вот эту схему я бы вообще поставил в начало методички:

```text
REQUEST
│
├── model
│   └──► response.model
│
├── messages
│   ├──► choices[].message.content
│   └──► usage.prompt_tokens
│
├── temperature
├── top_p
├── frequency_penalty
├── presence_penalty
├── logit_bias
│   └──► choices[].message.content
│
├── max_completion_tokens
│   ├──► usage.completion_tokens
│   └──► finish_reason = length
│
├── n
│   └──► choices.length
│
├── logprobs = true
│   └──► choices[].logprobs
│
├── top_logprobs
│   └──► logprobs.content[].top_logprobs
│
├── response_format
│   └──► message.content → JSON / JSON Schema
│
├── reasoning_effort
│   └──► completion_tokens_details.reasoning_tokens
│
├── verbosity
│   ├──► message.content length
│   └──► completion_tokens
│
├── tools + tool_choice
│   ├──► message.tool_calls
│   └──► finish_reason = tool_calls
│
├── prediction
│   ├──► accepted_prediction_tokens
│   └──► rejected_prediction_tokens
│
├── prompt cache
│   ├──► cached_tokens
│   └──► cache_write_tokens
│
├── web_search_options
│   └──► message.annotations
│
├── modalities + audio
│   └──► message.audio
│
└── service_tier
    └──► response.service_tier
```

Это, на мой взгляд, и должна быть **главная идея лабораторной №1**: не выучить список полей OpenAI API, а экспериментально понять цепочку:

```text
параметр API
→ изменение inference
→ observable effect
→ поле response
→ эксплуатационная метрика
```

После этой лабораторной следующий API — **`POST /v1/responses`**. Тут можно понять, **как современный Responses API отличается от Chat Completions по input/output, state, tools и multimodality**. OpenAI сейчас прямо рекомендует Responses для новых проектов, поэтому сравнение получится методически очень сильным. ([OpenAI Developers][1])

[1]: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create "Create chat completion | OpenAI API Reference"
[2]: https://platform.openai.com/docs/api-reference/chat/create "Chat | OpenAI API Reference"
