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

- The RAG «Проверить подключение» button checks readiness with GET `/readyz` and reads the responding Qdrant instance version with GET `/`. Display both results in the reserved connection status and record both requests in the connection log. Collection loading belongs to the collection section's own controls.

## Connection layout

- OpenAI API provider pickers in RAG and Chat use the same saved profiles. Do not add a separate Custom option. Reserve space for conditional notices and statuses, including «Этот профиль используется в Chat.», so showing or hiding them never moves nearby controls.

- In RAG model settings, place `only Embeddings` directly below the `Список моделей (N)` caption in the left column. Keep the scrollable model field in the right column. Loading must preserve the controls' positions and the model field's dimensions. If a layout instruction is ambiguous, ask which element and position the user means before changing it.

- Connection settings use a strict 2×2 grid on wide screens: provider/profile and URL in the first row, API key and connection/resource controls in the second. Align the top and bottom edges of corresponding inputs and buttons across columns. Help icons and log links are centered on the control row. Status text sits below the controls and must not shift their alignment. At narrow widths, stack the cells in their existing order. Verify alignment with browser element coordinates as well as screenshots after changing these panels.

## Shared UI consistency

- Keep UI text selectable throughout the application, including tab captions. Selecting text within a tab must not activate it.
- Keep layout stable when transient labels, statuses, progress, notices, or validation messages appear, change, or clear. Use space reserved in all states or an out-of-flow surface. Never insert a status row that moves nearby controls. Verify element coordinates during pending, success, and failure states.
- Keep editable document metadata visible in the form and give it, text fields, and embedding model pickers standard help controls. Avoid duplicate headings and standalone explanations in semantic search. Put search scope in the query help and show the result area after a search.
- Label the selected collection settings tab «Параметры». Put editable vector and collection fields first and synchronize their changes immediately with the editable JSON request below. Read the server configuration again after applying changes.
- In «Добавить», show the target vector with its dimension and distance metric. Create a separate named dense vector from «Параметры» on supported Qdrant instances. Keep its dimension and metric fixed after creation, and guide users to a new collection if the existing schema uses an unnamed vector.
- In the collection header and table, format named vectors as `name (dimension · metric)` and separate multiple vectors with a comma. For an unnamed vector show only `dimension · metric`.
- Allow collection tabs to be reordered live with a dedicated drag handle at the far right and remember their order. Place the standard help control immediately after the tab caption, before auxiliary actions.
- In collection headers, show vector size and metric alongside the other metadata. Keep document cards compact and show the text once. Use low-emphasis icon buttons for collection actions and compact summaries for JSON viewers.
- In «Добавить», place one shared settings block above the source switch for text and files. Both sources use the same model, target vector, chunk length, overlap, and batch size. Use the same settings block style for document editing. Show a single filename with its size in file import. Assign new document IDs automatically. Label manually entered metadata optional and keep it in the text source.
- Keep «По ID» as one tab with one lookup field and document and point JSON modes. Provide clear controls for ID lookup, semantic search, collection search, and the request journal's URL filter. Preserve the operation settings when clearing a search.
- Give RAG collection tasks dedicated tabs for browsing, adding documents, lookup and editing by ID, semantic search, collection parameters, indexes, and snapshots. Put model, vector selection, and the relevant prefix in the operation that uses them. For adding and editing, prepend the document prefix to each fragment sent for embedding. For semantic search, prepend the query prefix to the search text. Preserve the original document text and the literal prefix, including trailing spaces. Offer horizontal and vertical tab layouts and remember the user's choice.

- The RAG «Коллекция» panel has a static heading without a collapse control. Show the selected collection content while the panel is visible.

- A tab that displays a list uses the label «Название (N)» followed by the standard help icon. Show «(…)» while the total is unknown and «(0)» for a confirmed empty list. The count refers to the whole list, not the current page. Place an available refresh action inside the tab outline, as in «Коллекции (2) ?». Avoid a duplicate title and refresh toolbar above the list.

- Record each user-approved UI rule here and state in the handoff how it was interpreted and what was recorded.
- All tabs use the same visual style across the UI, including their active and inactive states, unless the user explicitly requests an exception for a specific tab. If it is unclear whether a tab should follow the shared style or have a unique look, ask before changing it.
- Highlight the entire tab outline on hover. The frame, label, and internal gaps all activate the tab. Help, refresh, and log controls inside the outline keep their own actions.
- Keep the RAG collection table compact and use one help control for the collection column and its filter. Place the labelled icon buttons for editing, snapshots, and deletion in the rightmost column. Deleting a collection requires the exact phrase `удалить <collection name>` in a confirmation dialog.
- In RAG, inactive tabs use the original «Коллекции» style: a visible border on the top and sides, transparent background, and a shared bottom baseline. Apply the same outline to every inactive tab. The «Коллекции» refresh control belongs inside its tab outline. Keep the active tab's accent fill and underline.

- Preserve the site's established styles for parameter/value pairs, JSON viewers, panels, tabs, dropdowns, buttons, and help popovers. Reuse existing components, CSS classes, typography, colors, spacing, and interaction patterns before adding a new style. Present the same kind of element consistently across pages; avoid page-specific visual variants without a functional reason.
- Display metadata (IDs, status, model, counts, timing and similar parameters) as the standard labelled parameter/value pairs. Keep artifact hierarchy explicit: collection operations belong inside their collection, and sibling operations use the same tab style. A document-list tab starts with the list; creation/import actions belong in their own clearly named place.

## URL request visibility

- Open RAG logs as compact collapsed rows ordered by action label, HTTP method, URL, HTTP status, response duration, and request timestamp within each row. Limit the action label to eight characters and expose the full action and request purpose in its tooltip. Preserve the actual HTTP status when validation fails in the application, and show the validation issue separately. Render standard HttpDebug request and response sections only in expanded rows. Filter by any URL substring and show all requests when the filter is empty. Document logs include automatic loads, refresh, and pagination.

- Use the same shared trigger and popup styling for every `view logs`. Place it immediately after the refresh control on the RAG «Коллекции» tab for the latest inventory refresh. Inside the selected collection use exactly one `view logs` at the far right of the collection header. This journal contains every request made for the selected collection, including automatic loads, document operations, vectorization, indexes, configuration, and snapshots. Open it with the URL filter empty so the full journal is visible.
- Keep `view logs` open when the surrounding page scrolls. Provide a close button and support Escape. Preserve token usage counters and their detail objects when masking credentials in HTTP logs.

- Every outgoing URL request must record the request before sending and then its response or network error. Provide a compact control to inspect these records, including pending and failed requests. For collection operations use the shared collection journal in the header. Show method, URL, HTTP status, and timing as standard labelled parameter/value pairs; show request and response JSON with the shared JsonViewer. Mask credentials and secrets in headers and echoed responses, and keep diagnostics in memory rather than persistent storage.

- Render the full HTTP exchange everywhere through `HttpDebug.record` (`ui/http-debug.js` and `ui/http-debug.css`), including Chat Debug and RAG logs. Keep the same request/response markup and styles across hosts. Hosts can set data and the initial expanded state. Show the request start date and time in the exchange heading when available. Use the same 34px header for requests and responses in every host, including Chat and RAG. Put bold method and URL in the request header without labels. Use «Response» for the response header. Put the respective HTTP headers toggle in each header and omit source badges. Mask secrets and use JsonViewer only for actual bodies. GET/HEAD requests have no body or JSON view. RAG connection settings show only Connect, the standard help control, and `view logs`; the popup shows the three latest requests, never an inline journal or a duplicate collection list.

## JSON presentation

- Show selected RAG model metadata beside the model list with the shared JsonViewer. Compact styling may reduce spacing and font size while preserving syntax colors and expand/collapse controls. Keep the viewer within the panel and scroll long content internally.

- Always render read-only JSON using the shared site `JsonViewer` component (`ui/json-viewer.js` and its CSS), with the standard syntax colors and expand/collapse behavior. Do not display JSON as uncolored plain text or introduce a separate highlighter. Editable JSON fields may remain text editors; provide the standard colored viewer for previews and results.

## Help and Documentation UI

- In «Доки», explain protocols, concepts, and API behavior independently of AI Agents Lab. Use «Помощь» to explain which UI controls perform those operations.
- Whenever documentation introduces an HTTP operation (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.), follow it immediately with a compact example showing the method and concrete path, plus the body or query parameters where applicable.

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
