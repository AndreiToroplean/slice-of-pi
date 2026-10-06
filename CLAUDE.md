# Conventions

- Never hard-wrap prose: in Markdown documents, commit messages and similar text, one paragraph (or list item) is one line. Editors handle soft wrapping.
- Work directly on `main`; no feature branches (single developer).
- Don't mention commercial apps or companies (e.g. other apps we take inspiration from) anywhere in the repo: docs, code, CLAUDE.md, commit messages. Describe them generically instead. Open-source projects (e.g. F-Droid) and the tools and platforms we actually use (e.g. Angular) are fine.
- Commit and push every change as soon as it's made; the owner reviews on GitHub. Amending and force-pushing to fix things afterwards is fine.

# Skills

- Use the vendored skills in `.claude/skills/` (see `SOURCES.md` there): `angular-developer` and `angular-new-app` for Angular work, `modern-web-guidance` for HTML/CSS/client-side JS.

# Quality

- Keep test coverage high: every feature and bug fix comes with unit tests (Vitest).

# Development

- Node.js 24 (see `.nvmrc`). Cloud sessions get it from the environment's setup script (configured in the environment settings, not in the repo): `source /opt/nvm/nvm.sh && nvm install 24 && ln -sf "$(dirname "$(nvm which 24)")"/{node,npm,npx} /root/.local/bin/`. It puts Node.js 24 ahead of the image's default Node.js on the `PATH`. A SessionStart hook in `.claude/settings.json` then installs the npm dependencies.
- `npm start` serves the app, `npm run build` builds it, `npm test` runs the unit tests once, `npm run test:coverage` adds a coverage report.
- `npm run lint` runs ESLint (angular-eslint, including template accessibility rules).
- Run `npm run lint`, `npm run build` and `npm test` before every commit.

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
