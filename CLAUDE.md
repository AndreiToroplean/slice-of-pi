# Conventions

- Never hard-wrap prose: in Markdown documents, commit messages and similar text, one paragraph (or list item) is one line. Editors handle soft wrapping.
- Don't mention commercial apps or companies (e.g. other apps we take inspiration from) anywhere in the repo: docs, code, CLAUDE.md, commit messages. Describe them generically instead. Open-source projects (e.g. F-Droid) and the tools and platforms we actually use (e.g. Angular) are fine.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and pull request titles, e.g. `feat: add a backspace key` or `docs: describe the seasons layer`.
- Commit and push every change as soon as it's made; the owner reviews on GitHub. Amending and force-pushing to fix things afterwards is fine.
- When a pull request changes what players see or hear, ask for a preview: right after opening it, add the line `Preview: https://andreitoroplean.github.io/slice-of-pi/pr-<number>/` to its description, with its number. Leave it out of other pull requests (CI, docs, refactors). See `design/architecture.md` §1.
- Every pull request description includes a high-level Mermaid sequence diagram (a `mermaid` code block starting with `sequenceDiagram`) showing how its changes work: the actors involved (player, components, browser, CI, …) and the messages between them. Keep it to the essentials. Skip it only when nothing runs, as in docs-only pull requests.

# Skills

- Use the vendored skills in `.claude/skills/` (see `SOURCES.md` there): `angular-developer` and `angular-new-app` for Angular work, `modern-web-guidance` for HTML/CSS/client-side JS.

# Quality

- Keep test coverage high: every feature and bug fix comes with unit tests (Vitest).

# Development

- Node.js 24 (see `.nvmrc`). Cloud sessions get it from the environment's setup script (configured in the environment settings, not in the repo): `source /opt/nvm/nvm.sh && nvm install 24 && ln -sf "$(dirname "$(nvm which 24)")"/{node,npm,npx} /root/.local/bin/`. It puts Node.js 24 ahead of the image's default Node.js on the `PATH`. A SessionStart hook in `.claude/settings.json` then installs the npm dependencies.
- `npm start` serves the app, `npm run build` builds it, `npm test` runs the unit tests once, `npm run test:coverage` adds a coverage report.
- `npm run lint` runs ESLint (angular-eslint with the strict type-checked rules, including template accessibility rules). TypeScript runs with extra strict flags (see `tsconfig.json`). Don't loosen either; fix the code instead.
- `npm run format` formats everything with Prettier; `npm run format:check` verifies it (vendored skills are ignored).
- Run `npm run check` before every commit. It runs the formatting check, the linter, the build and the unit tests, then prints how long each took against its time budget.

## Time budgets

The point is to spend our time developing, not waiting on checks. Checks come in two tiers:

- Before every commit (`npm run check`): must stay fast. Budgets: 30s for the whole check, 10s for the unit tests, 300ms per test. They live in `scripts/check-timing.ts`.
- Before opening a pull request (CI, see `.github/workflows/deploy.yml`): for checks worth keeping but too slow for every commit. Today it only adds the coverage report.

Going over a budget only warns. When `npm run check` warns, say so in the reply and the pull request, and propose a fix: make the slow part faster, or move it to the pull request tier. Don't raise a budget without the owner's agreement.

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
