{{ JSON.stringify({
  text: $json.output_clean
    || (($json.body?.message || $json.user_message_text)
      ? `Вы ввели: "${$json.body?.message || $json.user_message_text}". Ваша сессия: ${$json.body?.sessionId || $json.sessionId || ""}`
      : ""),
  error: $json.error ?? null,
  debug: $json.full_debug ?? ""
}) }}