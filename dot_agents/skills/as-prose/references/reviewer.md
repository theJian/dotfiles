# Independent reviewer brief

Send the following brief with actual target paths and scope constraints. Do not send earlier reviews or the coordinator's desired outcome.

---

Review these files as an engineer encountering the modules for the first time. Read applicable repository instructions. Remain read-only; do not consult prior reviews or history.

For each runtime implementation module, read its leading overview **before** declarations or implementation. Record what you can learn from that overview alone:

- Its responsibility and place in the system: what it owns, receives, delegates, or produces.
- The public operations you can choose, their purpose and main inputs/results. Distinguish instance methods, module exports, and inherited interfaces when relevant.
- How you would start the main workflow and connect its operations, including essential caller obligations.

Mark unknowns explicitly rather than inferring them from names or later code. Next, inspect only public declarations, types, member names, API comments, and structural organization, without reading method bodies. Record this second account before implementation verification:

- Sketch the main trigger → work/state owner → collaborator → result/consumer flow. Explain why the main boundaries exist. A list of methods or an example call sequence is insufficient if ownership and result propagation remain unknown.
- Give representative tasks or symptoms and choose the module/entry point to inspect first. Include one nearby responsibility delegated elsewhere, so routing is discriminating rather than “everything belongs here.” Ground tasks in the interface and actual caller context; do not tailor them to suspected defects.
- Identify consequential assumptions and likely failure or overlap questions a human reviewer should investigate. Predict the documented outcomes where possible; otherwise mark the boundary unknown and name a concrete location to inspect. Separate verified limitations from questions and suspicions.

Then read the implementation, callers, and tests to verify both accounts. Report material gaps where the comments and structure would send a reader to the wrong place or hide an important ownership, failure, lifecycle, or correctness boundary. This is a test of explanation and navigation, not a full bug or security audit. Do not invent hazards to fill a checklist. The overview need not enumerate every option or specialized workflow; operation-specific detail belongs beside its API.
Each runtime module needs a leading doc comment or docstring, even if names and later API comments are clear. Tests, type-only declarations, re-export-only files, static configuration, and data-only files have no blanket overview requirement. Improve an unhelpful runtime overview rather than removing it.

Read API and implementation comments as well. Verify useful contracts, important units, side effects, lifecycle and failure behavior. Assess whether names or simple structure could replace implementation narration. A truthful inherited claim is not automatically useful: for a caveat or repeated claim, identify the likely misunderstanding it prevents and its practical consequence, grounded in the interface or callers. Do not invent hypothetical expectations to justify it.

Judge the effort needed to understand, not just factual coverage or brevity. Check the overview's reading order and whether its actual public names are easy to find. Dense paragraphs can hide an interface even when they mention every method. A list, a small example, or a compact shape may communicate more directly; do not require any particular format when the existing form works. Examples should use real interfaces, make supplied inputs clear, and show a representative interaction. Check native documentation syntax, source presentation, and rendered layout where available. Do not infer readability from a formatter passing.

Score overall and each dimension out of 10:

1. **Orientation and routing:** The overview makes the module selectable for realistic tasks and distinguishes adjacent responsibilities. Public capabilities and useful next locations are easy to find. Main inputs/results and an initial workflow are clear; later docs cannot replace a missing overview.
2. **Accuracy and economy:** Contracts match behavior. No misleading guarantees, needless repetition, incidental detail, or routine implementation narration.
3. **Architectural understanding:** Comments plus visible structure support a causal account of the main flow, ownership, collaboration, and result propagation without reading every body. A method catalog or usage recipe alone is insufficient for a stateful or coordinating module. Simple modules need only proportionate explanation.
4. **Reviewability and contracts:** Important assumptions, caller obligations, and failure/overlap boundaries are discoverable and accurately scoped. A reviewer can identify concrete correctness questions and where to inspect. Examples illuminate relationships and are correct and proportionate; neither an example nor a hazard list is mandatory when unnecessary.
5. **Coherence and presentation:** Purpose comes first; explanation develops in a meaningful order with clear subjects. Public operations are scannable, and code/data keep their native layout and spacing. Complete coverage does not excuse a dense or disconnected explanation.

Report concrete findings with locations, reader impact, and minimal suggestions. Separate material defects from subjective polish. Rate honestly: 10 means no material improvement is needed under this rubric, not theoretical perfection. Do not inflate scores to satisfy an assumed target. Return both pre-implementation accounts, their verification, concrete task-to-location decisions, and findings alongside scores. Do not award full marks based only on accurate API coverage.
