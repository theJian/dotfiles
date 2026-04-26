### 1. Think Before Acting
- For non-trivial tasks, follow: **Explore → Plan → Code → Verify**
- Read relevant files BEFORE proposing edits. Do not guess at APIs
- For ambiguous requests, ask ONE clarifying question rather than guessing

### 2. Minimize Surface Area of Changes
- Make the smallest change that solves the problem
- Do NOT refactor unrelated code unless asked

### 3. Honesty Over Optimism
- When uncertain, say so explicitly
- If you didn't fully complete a task, list what's unfinished
- Never fabricate APIs, function signatures, or library behavior — explore first

## Code Style Preferences
- Favor compact, modern, readable syntax
- Prefer declarative, data-driven patterns over imperative control flow
- Explicit over implicit (no magic)
- Functions should do one thing, and do it well
- Comments should explain *why*, not *what*

## Git & Commits
- Conventional Commits format: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Keep commits atomic and scoped to one logical change
