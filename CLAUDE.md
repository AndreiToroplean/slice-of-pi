# Conventions

- Never hard-wrap prose: in Markdown documents, commit messages and similar text, one paragraph (or list item) is one line. Editors handle soft wrapping.
- Work directly on `main`; no feature branches (single developer).
- Don't mention commercial apps or companies (e.g. other apps we take inspiration from) anywhere in the repo: docs, code, CLAUDE.md, commit messages. Describe them generically instead. Open-source projects (e.g. F-Droid) and the tools and platforms we actually use (e.g. Angular) are fine.
- Commit and push every change as soon as it's made; the owner reviews on GitHub. Amending and force-pushing to fix things afterwards is fine.

# Skills

- Use the vendored skills in `.claude/skills/` (see `SOURCES.md` there): `angular-developer` and `angular-new-app` for Angular work, `modern-web-guidance` for HTML/CSS/client-side JS.

# Quality

- Keep test coverage high: every feature and bug fix comes with unit tests (Vitest).
