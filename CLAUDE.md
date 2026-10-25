# Conventions

- Help the owner's vocabulary grow: when he uses a loose or wrong term for something (e.g. "touch down" for what the Pointer Events API calls `pointerdown`), say so in one sentence in your reply, with the right term, then use it. Precise terms make our exchanges, and his with other developers, more accurate.
- Never hard-wrap prose: in Markdown documents, commit messages and similar text, one paragraph (or list item) is one line. Editors handle soft wrapping.
- The design docs (`design/`) hold only what the code can't: the vision, the meaning, the glossary and the roadmap. They never describe or link to the code: how it works lives in its doc comments, and why in them and in the commit history. Keep them short and timeless (no "for now"; the roadmap aside), and give each idea one home.
- Don't mention commercial apps or companies (e.g. other apps we take inspiration from) anywhere in the repo: docs, code, CLAUDE.md, commit messages. Describe them generically instead. Open-source projects (e.g. F-Droid) and the tools and platforms we actually use (e.g. Angular) are fine.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and pull request titles, e.g. `feat: add a backspace key` or `docs: describe the seasons layer`.
- Keep commit and pull request titles to 100 characters at most, everything included. What more there is to say, such as the reasons for a change, goes in the commit's description as a list of `-` bullets, each one worth saying: leave out what isn't.
- Commit and push every change as soon as it's made; the owner reviews on GitHub. Amending and force-pushing to fix things afterwards is fine.
- An action on a whole page or screen, such as a button in a page's top bar, is a candy button (`appCandy`), red (`danger`) when it erases or resets. Small plain buttons only ever act on the one setting or slider they sit by.
- When a pull request changes what players see or hear, ask for a preview: right after opening it, put the line `Preview: https://andreitoroplean.github.io/slice-of-pi/pr-<number>/`, with its number, at the very top of its description, so the link is the first thing in it. Leave it out of other pull requests (CI, docs, refactors).

# Skills

- Use the vendored skills in `.claude/skills/` (see `SOURCES.md` there): `angular-developer` and `angular-new-app` for Angular work, `modern-web-guidance` for HTML/CSS/client-side JS.

# Tuning

- To tune a game parameter or compare options for it (colors, color spaces, timings, …), add a control for it to a developer mode page, or a new page in the Developer section, instead of building a separate mockup: the owner tries it in the real game on his phone, the tweak applies to the whole game while developer mode is on, and the page's copy button hands the values back to go into the code, as the JSON of a backup file holding them alone (the one format to read). See the glossary's developer mode and tweaks (`design/glossary.md`).

# Quality

- Keep test coverage high: every feature and bug fix comes with unit tests (Vitest).
- End-to-end tests (Playwright, in `e2e/`) are written sparingly, only for what the unit tests can't check: what takes a real browser, such as the focus, popovers and dialogs, or a flow across screens. They run on pull requests in CI, not in `npm run check`.
- Test behavior, not where things sit in the UI: no tests pinning which button is where or which menu holds what.
- Keep each commit as small as its title promises. If a change turns out to touch far more than its intent suggests (many tests, docs or files for a small feature or fix), the code around it needs refactoring: refactor first, in its own commit, so the change itself stays small, and mention it in the pull request.

# Development

- Stay on the latest stable versions of everything (Angular, TypeScript, tools, libraries), never experimental features: when an update would help, update rather than work around an older version. Node.js is the one to update with care: it also takes updating the cloud sessions' setup script below and the machines that run the project.
- Node.js 24 (see `.nvmrc`). Cloud sessions get it from the environment's setup script (configured in the environment settings, not in the repo): `source /opt/nvm/nvm.sh && nvm install 24 && ln -sf "$(dirname "$(nvm which 24)")"/{node,npm,npx} /root/.local/bin/`. It puts Node.js 24 ahead of the image's default Node.js on the `PATH`. A SessionStart hook in `.claude/settings.json` then installs the npm dependencies.
- `npm start` serves the app, `npm run build` builds it, `npm test` runs the unit tests once, `npm run test:coverage` adds a coverage report. Slow tests of things that never change are tagged `manual`: only `npm run test:manual` runs them, never CI. `npm run test:e2e` runs the end-to-end tests in Chromium (installed once with `npx playwright install chromium`), on the server `npm start` serves, or one started for them: run them when a change touches what they cover.
- `npm run lint` runs ESLint (angular-eslint with the strict type-checked rules, including template accessibility rules). TypeScript runs with extra strict flags (see `tsconfig.json`). Don't loosen either; fix the code instead.
- `npm run format` formats everything with Prettier; `npm run format:check` verifies it (vendored skills are ignored).
- Run `npm run check` before every commit. It runs the formatting check and the linter on the files changed since they last passed, and the unit tests; pull requests also run them in full and build the app.

# Angular

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
