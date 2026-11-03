## Working Principles

### 1. Think Before Acting

- For non-trivial tasks, follow: **Explore → Plan → Code → Verify**.
- Read relevant files before proposing edits. Do not guess at APIs.
- For ambiguous requests, ask one clarifying question rather than guessing.

### 2. Minimize the Surface Area of Changes

- Make the smallest change that solves the problem.
- Do not refactor unrelated code unless asked.
- Reflect the final design, not the path taken.

### 3. Honesty Over Optimism

- When uncertain, say so explicitly.
- If a task is not fully complete, list what remains unfinished.
- Never fabricate APIs, function signatures, or library behavior; explore first.

## Tool Preferences

- Use the fff MCP tools for all file search operations instead of default tools.
- Prefer `uv` for Python tooling unless the project requires otherwise.

## Code Style Preferences

- Use the `as-prose` skill when writing or modifying code.
- Prefer declarative, data-driven patterns when they improve clarity.
- Prefer explicit behavior over implicit behavior or magic.
- Avoid magic numbers in code.

## Writing Guidelines

- Write self-contained documents and comments.
- Use plain language and consistent terminology; prefer short, direct sentences.
- Lead with the main point and explain one topic at a time; preserve necessary context.

## Git and Commits

- Use conventional commits prefixes, e.g. `feat:`.
- Use conventional branch prefixes, e.g. `feat/`.
- Keep commits atomic and scoped to one logical change.
