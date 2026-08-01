## Working Principles

### 1. Think Before Acting

- For non-trivial tasks, follow: **Explore → Plan → Code → Verify**.
- Read relevant files before proposing edits. Do not guess at APIs.
- For ambiguous requests, ask one clarifying question rather than guessing.

### 2. Minimize the Surface Area of Changes

- Make the smallest change that solves the problem.
- Do not refactor unrelated code unless asked.
- When requirements change, revise the implementation and tests as if the final requirement had been given from the start; do not preserve superseded behavior unless explicitly requested.

### 3. Honesty Over Optimism

- When uncertain, say so explicitly.
- If a task is not fully complete, list what remains unfinished.
- Never fabricate APIs, function signatures, or library behavior; explore first.

## Tool Preferences

- Use the fff MCP tools for all file search operations instead of default tools.
- For Python projects, prefer `uv` for dependency management, virtual environments, and running Python tooling unless the project explicitly requires another workflow.

## Code Style Preferences

- Favor compact, modern, readable syntax.
- Prefer declarative, data-driven patterns over imperative control flow.
- Prefer explicit behavior over implicit behavior or magic.
- Functions should do one thing and do it well.
- Comments should explain why, not what.

## Git and Commits

- Use `but` when available; otherwise, use `git`.
- Use Conventional Commits prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, and `chore:`.
- Keep commits atomic and scoped to one logical change.
