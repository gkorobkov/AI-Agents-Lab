# UI rules

## Mobile verification

- Read `../architecture/mobile-browser-testing.md` before mobile layout work. A resized desktop viewport is not a physical-phone test.
- Confirm actual viewport width/height, DPR, `pointer: coarse` and `hover: none` for touch checks. A mobile User-Agent or device preset alone is insufficient; agent-browser may leave mouse media queries active or reset viewport dimensions on later calls.
- Compare supplied phone screenshots with the same language, transport, app version and scroll position. Record emulation limits, especially browser bars, keyboard, visual viewport, font scaling and unknown physical-device metrics.
- Desktop Chrome vertical tabs reduce the available content width. Measure `innerWidth`/`innerHeight`; do not use whole-window screenshot dimensions as viewport dimensions.

## Controls

- Use a trash-can icon for every action that deletes or removes an artifact from the UI (messages, profiles, tools, arguments, parameters, saved entries, and credentials). Reuse the existing trash icon style. Text may accompany the icon when it helps clarify the action.
- Exception: on a very small button where a trash-can icon would be illegible, use a compact alternative with a clear accessible label.
- Icon-only deletion controls must have a localized accessible name and a tooltip. Do not use a close icon for deletion when a legible trash-can icon fits. Closing a panel is a separate action.
