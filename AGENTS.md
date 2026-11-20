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

## Shared UI consistency

- Preserve the site's established styles for parameter/value pairs, JSON viewers, panels, tabs, dropdowns, buttons, and help popovers. Reuse existing components, CSS classes, typography, colors, spacing, and interaction patterns before adding a new style. Present the same kind of element consistently across pages; avoid page-specific visual variants without a functional reason.
- Display metadata (IDs, status, model, counts, timing and similar parameters) as the standard labelled parameter/value pairs. Keep artifact hierarchy explicit: collection operations belong inside their collection, and sibling operations use the same tab style. A document-list tab starts with the list; creation/import actions belong in their own clearly named place.

## JSON presentation

- Always render read-only JSON using the shared site `JsonViewer` component (`ui/json-viewer.js` and its CSS), with the standard syntax colors and expand/collapse behavior. Do not display JSON as uncolored plain text or introduce a separate highlighter. Editable JSON fields may remain text editors; provide the standard colored viewer for previews and results.

## Help and Documentation UI

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
