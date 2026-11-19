---
name: as-prose
description: Make code understandable to new readers through clear names, module overviews, and public API documentation. Use when improving code readability or documenting what modules do, how they fit together, and which interfaces to use.
---

Make the reader's next decision easy: decide whether this module is relevant, understand how work and state move through it, and locate the operation or boundary that needs closer inspection. Optimize for the work required to understand, not the amount of prose or the number of documented facts.

## Shape the explanation

Read the implementation, public declarations, relevant callers, and tests before writing. Build the explanation from those sources rather than polishing existing comments sentence by sentence. Preserve behavior and public interfaces unless changes are authorized. Existing prose may be replaced, relocated, or removed when it does not help the reader.

Give information a useful home:

- **Names and structure** expose ordinary mechanics. Prefer a small naming or control-flow improvement when it removes the need for explanation. Preserve meaningful distinctions; add helpers only when they reduce the reader's work.
- **Module overview** gives purpose, a map of the public interface, and the main collaboration or data flow.
- **Public API comments** give operation-specific contracts: consequential inputs, outputs, units, side effects, errors, and lifecycle rules that signatures leave unclear.
- **Implementation comments** explain non-obvious reasons, domain constraints, or trade-offs beside the relevant code. Do not narrate ordinary control flow.

A fact earns space when it helps a reader choose, call, interpret, or safely change something. Truth alone is insufficient. Remove needless caveats, internal sequencing, decoration, and repeated explanations; retain constraints whose omission would mislead callers. Express a prerequisite as an action when useful. Verify claims about defaults, asynchronous completion, and failures against the actual paths; do not word around uncertain behavior.

## Write the module overview

Every module implementing application or library runtime behavior needs a leading doc comment or docstring, placed according to language conventions and required headers. Tests, type-only declarations, re-export-only files, static configuration, and data-only files do not need ceremonial overviews; document useful constraints locally.

Help the reader answer these questions in order, without enforcing a fixed set of headings:

1. **When is this relevant, and what is its responsibility?** Open with the responsibility in plain language. Explain the important boundary or collaboration: what it receives, owns, delegates, and produces. Name collaborators when that helps locate behavior. A brief flow such as `route → store → API → normalized videos` can replace a longer explanation when the relationships are clear. Avoid an import inventory or a tour of private helpers. Make its responsibility specific enough to select it for a concrete task and distinguish it from adjacent modules. Name the relevant collaborator or public entry point for delegated work. A reader should be able to route a feature request or symptom to a useful first location; avoid a generic “use this for…” slogan or an exhaustive navigation index.
2. **How does it work?** Explain the mechanism at the level of responsibilities and state transitions, not just a sequence of API calls. Show what triggers work, where state lives, how results reach consumers, and which collaborator handles each boundary when those relationships matter. Names, types, and declaration structure should reinforce this model. A usage example complements that explanation; it cannot substitute for it. Show the normal interaction and the obligations needed to start correctly. Prefer a short working example when it communicates relationships, branching, callback shapes, or pagination more directly than sentences. Use prose for why the interaction exists and for constraints the example cannot show. For a simple module, the opening sentence may already suffice.
3. **What can I use?** Make actual exported names and public methods easy to locate. A small interface can fit in a sentence. For larger interfaces, use short task-oriented groups or bullets pairing callable names with their purpose and main result. Distinguish instance methods from module exports and inherited APIs. Cover distinct public capabilities, grouping related operations; direct specialized details to their API comments. Do not bury method names in paragraphs, provide a bare export dump, or copy every full signature into the header.
4. **Where can the model break down?** Surface consequential boundaries supported by source and callers: what happens on failure or overlapping work, what is and is not isolated, and which assumptions the implementation relies on. Select only those that change use or review. Explain the consequence and point to the responsible method or collaborator so a reviewer knows where to inspect. State a verified limitation honestly; distinguish intended behavior from enforced guarantees and unresolved suspicions. Do not invent weaknesses, imply a security audit, or promise that comments expose every defect.

Across the overview, API comments, and visible code structure, a reviewer should be able to sketch the main data/control flow and identify the important correctness questions without reading every body. Put cross-cutting ownership and failure boundaries in the overview; keep operation-specific catches beside the operation, with a short pointer from the overview when otherwise hard to discover. Do not append a standard risk checklist to every file.

The overview is a usable map, not a complete manual. Include essential input/result representations and shared rules, but place exhaustive options and specialized protocols beside their operations. A reader should be able to choose an entry point and follow the main workflow without scanning the implementation. A named type alone does not explain what a callback must return or whether a value is a URL, parsed object, ID, or serialized data.

### Choose prose, code, or structure deliberately

- Lead with the idea; keep each paragraph about one relationship. Use concrete subjects and familiar verbs. Expand domain terms when their meaning is needed to use the interface.
- Use a list or compact table when a reader needs to compare or find operations. Group by reader task, not declaration order. Avoid wide tables or long signature rows that are harder to scan in a source comment.
- Use code for sequences and shapes. A few real calls often explain an interaction faster than a paragraph describing those calls. Choose the main workflow rather than letting an unusual case dominate the introduction; put a specialized example beside its API.
- Keep examples internally consistent, with real names and essential setup. Identify supplied inputs and external collaborators; do not make illustrative placeholders look like available exports. Verify examples against signatures, result discriminators, required headers, and cursor conventions. State units when they affect use.
- Use native inline code, language-labelled fenced blocks or equivalent literal blocks, blank lines, and ordinary indentation. Do not flatten multi-field shapes or several calls into wrapping prose. Use supported documentation tags only when their actual meaning helps scope, navigation, or tooling.
- Check both the source comment and how its documentation is displayed. Formatting success does not establish readability. Avoid maintaining an external guide that repeats a module contract merely to make it easier to read.

## Review and revision

Use a coordinator and two separate roles: an independent reviewer assesses; an implementation agent edits. Keep these roles separate. The implementation agent may continue across rounds; every review round uses a fresh reviewer. The coordinator owns scope, evidence, and verification and must not award its own final score.

### Prepare

Read repository instructions and working-tree status. Identify target modules, relevant callers, permitted edits, and appropriate checks. Preserve existing work and limit edits to the requested scope and directly affected docs/tests. Ask for a target only when it cannot be inferred.

### Iterate

1. **Review independently.** Read [references/reviewer.md](references/reviewer.md). Spawn a fresh reviewer with `collaboration.spawn_agent` and `fork_turns: "none"`, or equivalent clean context. Send the brief from that reference, actual target paths, and scope constraints only. Withhold conversation history, this workflow, earlier feedback or scores, suspected problems, proposed fixes, and the target score.
2. **Delegate improvements.** If findings remain, give a different agent the findings, target paths, scope constraints, and the explanation guidance above. It verifies findings against source, makes proportionate improvements, and reports changes, checks, and rejected findings with reasons. The reviewer remains read-only.
3. **Verify the artifacts.** Inspect the diff and retain unresolved findings in the coordinator's record. For comment-only changes, verify executable code is unchanged and check syntax/format as appropriate. Check examples and documented producer/consumer handoffs against declared public types, not only runtime values; try a minimal caller when compatibility is unclear. For refactors, run relevant tests and required repository checks. Resolve failures before re-review; never weaken tests to conceal regressions.
4. **Re-review.** Repeat with a fresh reviewer using the same brief and rubric. Prior findings stay open until resolved or rejected with evidence; a later review's silence does not close them.

Finish when an independent review gives 10/10 overall and in every dimension, no material findings remain unresolved, and relevant checks pass. A 10 means no material improvement is needed under the rubric, not theoretical perfection. If a lower score has no actionable basis, ask that reviewer to clarify without suggesting a higher score. Do not seek favorable ratings by changing the rubric or repeating reviews without substantive revisions.

Continue while meaningful progress is possible. If delegation or required validation is unavailable, or rounds repeat incompatible preferences without progress, report the actual result and remaining issues. Respect cancellation, budgets, and authorization boundaries; this workflow does not authorize publishing, committing, or unrelated changes.
