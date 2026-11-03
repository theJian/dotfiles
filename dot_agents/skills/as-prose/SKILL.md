---
name: as-prose
description: Make code and its documentation clear to engineers encountering it for the first time. Use for readability refactors, clearer naming, and concise, accurate comments and public API documentation in any programming language.
---

# As Prose

Let names and structure explain the mechanics, public documentation explain the contract, and implementation comments explain reasoning the code cannot express.

## Readability principles

- **Prefer self-explanatory code.** Use the shortest clear name within its scope: an internal `delete_button` does not need its parent component's name. Preserve meaningful distinctions, such as queued refresh versus immediate rebuild. Rename or simplify code when that removes the need for explanation; introduce helpers only when they reduce the reader's work.
- **Comment on non-obvious reasoning.** Capture intent, domain rules, constraints, trade-offs, and hazards. Assume programming experience; omit narration of assignments, pending flags, deduplication, and ordinary control flow. Place each comment beside the code it explains, with enough context to make its causal connection explicit.
- **Document stable meaning.** Ask whether a caller would care if a detail changed. Retain units, scope, side effects, and failure behavior; omit incidental delimiters, symbols, visual shades, and internal sequencing. Check claims against relevant code paths, including asynchronous completion, defaults, and validation. Investigate uncertain behavior rather than hiding a bug with wording.
- **Make module and public API documentation self-contained.** Every module in scope needs a top-of-file overview, placed according to language syntax and required headers. Reading that overview alone must establish purpose, main responsibilities, broad operation, public entry points and their roles, basic usage, and essential prerequisites or constraints. Include a minimal example when useful; for internal modules, explain their role and how they are used. Distinguish existing repository configuration from standalone setup. Individual API docs supply inputs, outputs, defaults, side effects, and meaningful lifecycle/error contracts without repeating the overview. An external guide or bare symbol list cannot substitute for the overview.
- **Use native documentation conventions.** Use the language's doc comments/docstrings and supported tags for useful contracts and tooling: parameters, returns, errors, examples, generics, deprecation, or links. Follow project conventions; do not invent tags, duplicate clear signature types, or annotate every private helper mechanically. Keep API documentation about that API and broader architecture in the module overview.
- **Explain difficult concepts proportionately.** Use a worked example or diagram when it clarifies non-obvious logic. State assumptions and distinguish illustrative values from guarantees. Remove repetition unless needed for independently understandable public documentation; do not turn routine code into a tutorial.

## Review and revision

The coordinator manages scope and verification. Reviewers assess; a separate implementation agent edits. Never use a reviewer as the editor or self-award the final score.

### Prepare

Read applicable repository instructions, target files, relevant docs, and working-tree status. Preserve existing edits and behavior, including public interfaces, unless changes are authorized. Limit work to the requested component and directly affected docs/tests. Identify appropriate checks; ask for the target only if it cannot be inferred.

### Run the loop

1. **Review independently.** Start a new reviewer with `collaboration.spawn_agent` and `fork_turns: "none"`, or equivalent clean context. Send only target paths, scope constraints, and the reviewer brief below. Do not send this whole workflow, conversation history, prior feedback/scores, suspected problems, proposed fixes, or the target score.
2. **Delegate improvements.** If findings remain, send a different agent the review, target paths, scope constraints, and readability principles. It must verify findings against source, make proportionate improvements, and report changes, checks, and any rejected findings with reasons. The implementation agent may continue across rounds; each reviewer must be fresh.
3. **Verify.** Inspect the actual diff and keep related public docs consistent. For comment-only changes, confirm executable code is unchanged and check syntax/format as appropriate. For refactors, run relevant tests and required checks. Change test expectations only for demonstrably stale expectations or authorized contract changes; never weaken tests to hide regressions. Resolve failures before re-review.
4. **Re-review the revised artifacts.** Repeat from step 1 with the same rubric. Retain unresolved findings in the coordinator's record so a later review cannot silently erase them.

Finish when an independent review gives 10/10 overall and in every dimension, no material findings remain unresolved, and relevant checks pass. If a lower score has no actionable basis, ask that reviewer to clarify its assessment without suggesting a higher score. Do not seek favorable ratings by changing the rubric or repeating reviews without substantive revisions.

Continue while meaningful progress is possible. If delegation or required validation is unavailable, or successive rounds repeat incompatible preferences without progress, report the actual result and unresolved issues rather than claiming success or looping indefinitely. Respect user cancellation, budgets, and existing authorization boundaries; this workflow does not authorize publishing, committing, or unrelated changes.

## Reviewer brief

Supply the actual paths and constraints with this brief:

> Review these files as an engineer encountering the module for the first time. Read applicable repository instructions. Remain read-only and do not consult prior reviews or history.
>
> First read only each top-of-module overview. Record whether it establishes purpose, broad operation, public entry points, basic usage, and essential constraints without needing other files. Then read public API docs for detailed contracts. Finally inspect implementation to verify accuracy and assess whether names or simple refactoring could replace comments. Companion guides may supplement, but cannot excuse an insufficient module overview.
>
> Score overall and each dimension out of 10:
> 1. **Discoverability:** Module overviews and public API docs are self-contained and useful without overwhelming the reader. A missing or insufficient top-of-module overview is a material finding.
> 2. **Honesty and economy:** No misleading guarantees, needless repetition, incidental decoration, or routine implementation narration.
> 3. **Added value:** Comments convey information code cannot readily express; names and structure are concise and self-explanatory.
> 4. **Explanatory quality:** Deeper explanations are accurate, locally understandable, and effective. Examples clarify difficult concepts rather than restating mechanics; their absence is not a defect when none are needed.
>
> Report concrete findings with locations, reader impact, and minimal suggestions. Separate material defects from subjective polish. Rate honestly: 10 means no material improvement is needed under this rubric, not theoretical perfection. Do not inflate scores to satisfy an assumed target.

## Delivery

Summarize meaningful changes, validation, and review results. Attribute ratings to the independent reviewers rather than presenting them as objective proof. If the target was not reached, report the actual score and remaining issues. Include the full review transcript only if requested.
