# Repository Guidelines

## Project Structure & Module Organization

The application is a dependency-free browser frontend in `ui/`. `ui/index.html` contains the main UI, inline styles, state management, webhook requests, localization, consent handling, and responsive behavior. Keep `privacy-policy.html` and `terms.html` aligned with consent-facing changes. The root JavaScript utilities (`webhook-check.js` and `run-check.mjs`) support webhook diagnostics; n8n workflow helper code and prompts live under `Part_1/` and `Part_2/`. Reference material is under `RAG/`, and the UI is deployed directly from `ui/`.

## Build, Test, and Development Commands

- `ui-start.cmd` serves the UI locally.
- `ui-build.cmd` increments the application version and prepares asset URLs directly in `ui/`.
- `ui-deploy.cmd` uploads `ui/*` using the target configured in `.env`.
- `build-deploy.cmd` runs the existing build and deployment workflow.

There is no package manifest or automated browser test suite in this repository. For frontend changes, inspect the page at desktop width, at 640px or below, and at 400px or below. Check JavaScript syntax and run `git diff --check` before handoff.

## Browser Testing Instructions

On a fresh site load, the consent overlay is expected. Accept the agreement yourself before testing the page; never wait for the user to click the consent button. Then verify mouse, keyboard, and touch-oriented interactions as relevant. Preserve consent behavior and its localStorage state unless the requested task explicitly changes it.

## Proxy health contract

Validate `/health` against service `universal-http-proxy` and status `ok`. After an actual relay response, recheck health when the shared proxy indicator is not connected; keep upstream API status separate from proxy availability.

## Configuration

All configurable settings and defaults must be declared only in the `CONFIGURABLE DEFAULTS` block at the top of `ui/index.html`. Other files consume these settings and must not introduce independent configurable defaults. `CFG_PANEL_LAYOUT_ORDER` defines both the initial window mode (first entry, unless a saved browser preference exists) and the switching order.

## Coding Style & Naming Conventions

Keep the site's UI vertically compact. Match navigation and lab bars to the standard 34px application header; use small headings, buttons, progress indicators, and form fields with modest spacing. Avoid oversized hero titles and tall cards or controls. Prefer collapsible detail/answer sections for long content, while retaining readable text and usable controls on mobile.

Match the existing inline HTML/CSS/JavaScript style in `ui/index.html`: two-space indentation, compact DOM helpers, CSS custom properties for theme colors, and `CFG_` prefixes for configuration constants. Reuse existing components and variables instead of introducing a framework or external dependency. Keep mobile rules near the existing responsive media queries.

- The RAG «Проверить подключение» button sends only GET `/readyz` to check server readiness. It must not fetch collections or their details. Collection loading belongs to the collection section's own controls.

## Connection layout

- OpenAI API provider pickers in RAG and Chat use the same saved profiles. Do not add a separate Custom option. Reserve space for conditional notices and statuses, including «Этот профиль используется в Chat.», so showing or hiding them never moves nearby controls.

- In RAG model settings, place `only Embeddings` directly below the `Список моделей (N)` caption in the left column. Keep the scrollable model field in the right column. Loading must preserve the controls' positions and the model field's dimensions. If a layout instruction is ambiguous, ask which element and position the user means before changing it.

- Connection settings use a strict 2×2 grid on wide screens: provider/profile and URL in the first row, API key and connection/resource controls in the second. Align the top and bottom edges of corresponding inputs and buttons across columns. Help icons and log links are centered on the control row. Status text sits below the controls and must not shift their alignment. At narrow widths, stack the cells in their existing order. Verify alignment with browser element coordinates as well as screenshots after changing these panels.

## Shared UI consistency

- Preserve the site's established styles for parameter/value pairs, JSON viewers, panels, tabs, dropdowns, buttons, and help popovers. Reuse existing components, CSS classes, typography, colors, spacing, and interaction patterns before adding a new style. Present the same kind of element consistently across pages; avoid page-specific visual variants without a functional reason.
- Display metadata (IDs, status, model, counts, timing and similar parameters) as the standard labelled parameter/value pairs. Keep artifact hierarchy explicit: collection operations belong inside their collection, and sibling operations use the same tab style. A document-list tab starts with the list; creation/import actions belong in their own clearly named place.

## URL request visibility

- Every outgoing URL request must record the request before sending and then its response or network error. Provide a compact nearby button, link, icon, or collapsible panel to inspect these records, including pending and failed requests. Show method, URL, HTTP status, and timing as standard labelled parameter/value pairs; show request and response JSON with the shared JsonViewer. Mask credentials and secrets in headers and echoed responses, and keep diagnostics in memory rather than persistent storage.

- Use the shared `HttpDebug` component (`ui/http-debug.js` and `ui/http-debug.css`) for request/response presentation everywhere, including chat Debug and log popups. Keep method and URL separate from collapsible HTTP headers, mask secrets, and use JsonViewer only for actual bodies. GET/HEAD requests have no body or JSON view. RAG connection settings show only Connect, the standard help control, and `view logs`; the popup shows the three latest requests, never an inline journal or a duplicate collection list.

## JSON presentation

- Show selected RAG model metadata beside the model list with the shared JsonViewer. Compact styling may reduce spacing and font size while preserving syntax colors and expand/collapse controls. Keep the viewer within the panel and scroll long content internally.

- Always render read-only JSON using the shared site `JsonViewer` component (`ui/json-viewer.js` and its CSS), with the standard syntax colors and expand/collapse behavior. Do not display JSON as uncolored plain text or introduce a separate highlighter. Editable JSON fields may remain text editors; provide the standard colored viewer for previews and results.

## Help and Documentation UI

- Use the shared `.api-help` spacing between a field caption and its help icon. Do not add local margins or gaps that make this spacing larger or smaller.

- Tooltips and settings popovers must never cover their trigger or the field they describe. Anchor them to the entire field group, including its input, and place them in available space outside that group at desktop and mobile widths.

- In Help explanations, always identify the mode explicitly (for example, «Режим ИИ Агента и вызова LLM определяет…» or «Режим расположения окон определяет…»). Avoid an ambiguous «Режим определяет…».
- Name the kind of UI element explicitly: page «Чат», field «Base URL», button, mode list, or section. End prose sentences with periods, not semicolons.
- Reuse each element's header SVG, stroke style, and icon color (`help-element-icon`, normally `--accent2`). Never inherit the muted green text color onto icons. Treat icon and caption as one name: omit quotation marks, or enclose both together.
- Use `help-ui-name` for muted green documentation names. References to interactive elements use standard link styling plus the matching icon. Clicking a reference only highlights the existing element twice. It must not open panels, navigate, switch transport, or reveal hidden settings.
- Reuse `appWorkspace.highlightHelp` / `highlightField` and `CFG_HELP_HIGHLIGHT_*`: exactly two gentle pulses. Highlight every visible counterpart in the main header and window headers together. Do not create separate animations.
- «Показать режимы» only opens the header dropdown and highlights both its trigger and list twice. Preserve the current panels and layout.
- For links intended to open a panel, explicitly write «Открыть» before the icon-link and add an arrow after its caption. Keep opening actions distinct from highlight-only references.
- Links to sections on the same Help page expand the target section and scroll smoothly to it. Keep Help free of Stub descriptions.

## Commit & Pull Request Guidelines

Create a Git commit only after the user explicitly approves committing the current changes. Leave changes uncommitted when approval has not been given. A request to implement, fix, or test changes does not authorize a commit.

Recent commits use short imperative summaries such as `add favicon`, `update system prompt`, and focused `Update`/`Refactor` descriptions. Keep each change scoped and describe visible behavior in the commit summary. Do not include generated `.build/` output unless the release workflow requires it.
