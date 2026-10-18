# Repository Guidelines

## Project Structure & Module Organization

The application is a dependency-free browser frontend in `ui/`. `ui/index.html` contains the main UI, inline styles, state management, webhook requests, localization, consent handling, and responsive behavior. Keep `privacy-policy.html` and `terms.html` aligned with consent-facing changes. The root JavaScript utilities (`webhook-check.js` and `run-check.mjs`) support webhook diagnostics; n8n workflow helper code and prompts live under `Part_1/` and `Part_2/`. Reference material is under `RAG/`, and deploy artifacts are generated into `.build/`.

## Build, Test, and Development Commands

- `ui-start.cmd` serves the UI locally.
- `ui-build.cmd` increments the application version and copies deployable UI files into `.build/ui/`.
- `ui-deploy.cmd` uploads `.build/ui/*` using the target configured in `.env`.
- `build-deploy.cmd` runs the existing build and deployment workflow.

There is no package manifest or automated browser test suite in this repository. For frontend changes, inspect the page at desktop width, at 640px or below, and at 400px or below. Check JavaScript syntax and run `git diff --check` before handoff.

## Browser Testing Instructions

On a fresh site load, the consent overlay is expected. Accept the agreement yourself before testing the page; never wait for the user to click the consent button. Then verify mouse, keyboard, and touch-oriented interactions as relevant. Preserve consent behavior and its localStorage state unless the requested task explicitly changes it.

## Coding Style & Naming Conventions

Keep the site's UI vertically compact. Match navigation and lab bars to the standard 34px application header; use small headings, buttons, progress indicators, and form fields with modest spacing. Avoid oversized hero titles and tall cards or controls. Prefer collapsible detail/answer sections for long content, while retaining readable text and usable controls on mobile.

Match the existing inline HTML/CSS/JavaScript style in `ui/index.html`: two-space indentation, compact DOM helpers, CSS custom properties for theme colors, and `CFG_` prefixes for configuration constants. Reuse existing components and variables instead of introducing a framework or external dependency. Keep mobile rules near the existing responsive media queries.

## Help and Documentation UI

- In Help explanations, always identify the mode explicitly (for example, «Режим ИИ Агента и вызова LLM определяет…» or «Режим расположения окон определяет…»). Avoid an ambiguous «Режим определяет…».
- Name the kind of UI element explicitly: page «Чат», field «Base URL», button, mode list, or section. End prose sentences with periods, not semicolons.
- Reuse each element's header SVG, stroke style, and icon color (`help-element-icon`, normally `--accent2`). Never inherit the muted green text color onto icons. Treat icon and caption as one name: omit quotation marks, or enclose both together.
- Use `help-ui-name` for muted green documentation names. References to interactive elements use standard link styling plus the matching icon. Clicking a reference only highlights the existing element twice. It must not open panels, navigate, switch transport, or reveal hidden settings.
- Reuse `appWorkspace.highlightHelp` / `highlightField` and `CFG_HELP_HIGHLIGHT_*`: exactly two gentle pulses. Highlight every visible counterpart in the main header and window headers together. Do not create separate animations.
- «Показать режимы» only opens the header dropdown and highlights both its trigger and list twice. Preserve the current panels and layout.
- For links intended to open a panel, explicitly write «Открыть» before the icon-link and add an arrow after its caption. Keep opening actions distinct from highlight-only references.
- Links to sections on the same Help page expand the target section and scroll smoothly to it. Keep Help free of Stub descriptions.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries such as `add favicon`, `update system prompt`, and focused `Update`/`Refactor` descriptions. Keep each change scoped and describe visible behavior in the commit summary. Do not include generated `.build/` output unless the release workflow requires it.
