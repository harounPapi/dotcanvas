## Decision Summary

The fastest path to a working .assist MVP is still to build on top of `t3code`, but to do so intentionally as a `product shell accelerator`, not as the final architecture.

The core runtime should still be `Codex app-server`.

That means the practical strategy is:

- use `t3code` as the starting shell
- keep the backend `Codex-only`
- remove or ignore product areas that are specifically about multi-provider coding workflows
- reshape the user experience around project rooms, playbooks, outputs, and start/import/resume flows
- preserve a clean path to gradually replacing the `t3code` shell later if needed

This remains the best tradeoff between speed and long-term correctness.

## Why This Is Still The Right Near-Term Move

.assist is not trying to invent a new agent runtime.

It is trying to package an existing agent runtime into a new kind of project workflow.

The desired experience is still deeply Codex-like under the hood:

- a workspace is the source of truth
- instructions live with the project
- the system can plan or execute
- reusable workflows exist
- real tools can run
- artifacts can be produced
- approvals and interruptions still matter

That means the important layer to preserve is the `Codex operating model`.

What has changed is the product framing on top of it.

The product is no longer best understood as "agent chat for non-developers."

It is better understood as:

`a project room harness built on Codex`

## Strategic Position

### Short version

Build on `t3code` now.

Build toward a Codex-native .assist later.

### What this means in practice

For the MVP:

- fork `t3code`
- strip it down to `Codex-only`
- keep the working parts of orchestration and UI
- replace the product framing and workflow assumptions
- add project-aware behavior for source-heavy deliverable work

For the longer term:

- gradually decouple .assist from `t3code` implementation details
- retain `Codex app-server` as the stable backend engine
- own the product layer completely

## Architecture Principle

.assist should be thought of as:

`Codex runtime + project harness + project room UX + domain playbooks + artifact workflows`

Not:

`chat app + file upload`

And not:

`a fork of T3 Code forever`

## Product-Driven Architecture

The architecture should map to the product model directly.

### 1. Runtime Layer

Use `Codex app-server` as the backend runtime for threads, turns, approvals, sandboxing, skills, and tool execution.

Why:

- it already supports the thread and turn model we want
- it already supports collaboration modes
- it already supports skills and mentions
- it already supports approvals and user-input requests
- it already supports shell and tool execution

This is the real engine of the product.

### 2. Shell Layer

Use a fork of `t3code` as the fastest shell for the MVP.

Keep:

- thread and session UI
- streaming message and event rendering
- approval panels
- user-input request UI
- orchestration event flow
- desktop and web packaging

Remove, disable, or de-prioritize:

- Claude provider support
- git-first product assumptions
- coding-centric helper prompts
- code review-specific language
- features that only matter for software repos

### 3. Project Harness Layer

This is the most important product addition.

Each project should have a visible structure that includes:

- project brief
- corpus map
- working memory
- workstreams
- outputs
- review state

This is the layer that turns a generic runtime into a native project room.

### 4. Workspace Layer

Introduce a .assist-specific project model on top of the existing folder concept.

Each project should have:

- a root project folder
- workstream history
- project instructions
- memory files
- a place for custom playbooks
- a place for generated outputs

Example structure:

```text
Project Folder/
  AGENTS.md
  .assist/
    project-brief.md
    corpus-map.md
    memory.md
    workstreams/
    playbooks/
    outputs/
```

The exact naming can evolve.

What matters is that the workspace becomes durable and explicit.

### 5. Project Intake Layer

Project entry is not just setup.

It is part of the product.

The MVP should support at least 3 project entry modes:

- start from goal
- import from folder or working bundle
- resume an old project

The intake flow should produce:

- a draft project brief
- a corpus map
- an initial memory scaffold
- suggested workstreams
- likely outputs
- obvious gaps and next steps

This is one of the biggest ways .assist will feel different from generic chat.

### 6. Playbook Layer

Use Codex-native skills as one of the central product primitives.

This is one of the biggest reasons to build around Codex rather than around a generic chat interface.

Examples:

- `pdf`
- `spreadsheet`
- `slides`
- custom .assist playbooks like `financial-review`, `literature-review`, `proposal-compliance`, `investment-memo`, `market-study`, `business-plan`

On the product surface, these should be presented as `Playbooks`, but under the hood they can remain skills.

### 7. Artifact Layer

.assist should treat the deliverable as a first-class object.

Common artifact types:

- thesis drafts
- research papers
- memos
- PDF summaries
- spreadsheet commentary
- proposal sections
- business plans
- deck outlines
- recommendation reports

The agent should be allowed to write code or scripts when needed to produce these outputs reliably.

That is a feature, not a workaround.

## Why Not Build From Scratch Immediately

Building from scratch would give the cleanest architecture, but it is not the fastest way to validate the concept.

The expensive parts to rebuild are not just the UI. They are:

- turn lifecycle management
- event streaming
- approval routing
- user-input interruptions
- provider session state
- resume and recovery flows
- orchestration and projection logic
- desktop app packaging and runtime integration

These are real engineering tasks and not where .assist creates differentiation first.

The product edge will come from:

- project intake and resume flows
- project harness design
- project-aware UX
- non-code playbooks
- source-grounded outputs
- artifact workflows
- memory and continuity

So it still makes sense to borrow the shell and spend product energy on the new layer.

## Why Not Fork Codex Core

Codex core is powerful, but it is the wrong place to start for speed.

Reasons:

- it is a much larger and more complex codebase
- much of the core is in Rust
- many of its concerns are runtime and infrastructure concerns, not product workflow concerns
- forking core too early would make upgrades harder
- we do not yet know enough about the non-code workflow to justify runtime-level changes

Codex core should be treated as infrastructure we build on top of, not the first place we customize.

## Product Strategy For The T3 Fork

If we use `t3code`, we should fork it with discipline.

### Rule 1: Codex only

Do not carry the complexity of a multi-provider product in the MVP.

### Rule 2: Preserve seams

Keep the boundary between:

- .assist product code
- `t3code` shell and orchestration code
- Codex runtime integration

This will make it easier to replace shell pieces later.

### Rule 3: Change the mental model quickly

Do not leave the product framed as coding software with renamed buttons.

The user-facing concepts should shift early toward:

- projects
- workstreams
- playbooks
- outputs
- sources
- memory

### Rule 4: Add project intake early

Starting, importing, and resuming a project should be part of the first meaningful product loop.

### Rule 5: Add artifacts early

A chat timeline alone will not prove the concept.

The MVP should visibly produce and manage outputs.

### Rule 6: Keep real execution

Do not over-sandbox the product into a toy.

The ability for the agent to:

- run Python
- inspect files
- transform spreadsheets
- render PDFs
- write helper scripts

is a core strength of the concept.

## What To Reuse From T3 Code

Reuse aggressively:

- thread and turn handling
- provider service shape
- runtime event normalization patterns
- approval and user-input UI
- streaming event rendering
- desktop and web wiring

Study carefully and selectively reuse:

- orchestration engine patterns
- runtime ingestion logic
- projection and read-model patterns

Do not anchor the product around:

- git-specific generation helpers
- coding-specific labels and language
- multi-provider abstraction unless needed
- software repo assumptions as the main product model

## What .assist Must Add

To become a real product rather than a themed fork, .assist must add:

- project intake and import flows
- project metadata and project room structure
- project brief and corpus map generation
- persistent project memory
- workstream organization
- custom non-code playbooks
- artifact viewers and output surfaces
- source citation and grounding patterns
- domain-specific starter templates
- project-level instructions and defaults
- routines for recurring project maintenance

This is the real product layer.

## Suggested MVP Scope

The MVP should be intentionally narrow in go-to-market, but broad enough in product shape to avoid painting us into a corner.

### Broad target user

People working on bounded, source-heavy projects with real deliverables.

### Primary wedge

- financial consulting
- audit-like review work
- diligence and evaluative analysis

### Architecture should still generalize to

- students and researchers
- proposal and grant writers
- investors and market researchers
- entrepreneurs building plans

### Supported source types

- PDFs
- spreadsheets
- markdown and text notes
- linked references
- templates
- draft documents

### Supported output types

- markdown memos
- PDF summaries
- spreadsheet commentary and extracted metrics
- business plan section drafts
- proposal section drafts
- thesis or paper section drafts
- deck outline drafts

### Initial playbooks

- extract KPIs from financial statements
- summarize a project folder
- compare two source documents
- draft an executive summary
- build a business plan section from source material
- reconstruct project state from an imported bundle

## Recommended Implementation Phases

### Phase 1: Fast fork

Goal:

Get a working .assist shell quickly by forking `t3code`.

Main work:

- remove or hide Claude
- rebrand the product
- rename core UX concepts where helpful
- keep Codex runtime integration intact
- prove workstream creation and turn execution inside a project folder

### Phase 2: Project awareness

Goal:

Make the app understand a project rather than just a thread.

Main work:

- define project folder conventions
- add project metadata and memory files
- add project brief and corpus map generation
- add project-level instruction loading
- add explicit workspace views for sources and outputs

### Phase 3: Project intake

Goal:

Make starting, importing, and resuming a project feel native.

Main work:

- add new-project flow from goal
- add import flow from folder or bundle
- add resume flow for dormant projects
- generate proposed project understanding for confirmation
- suggest workstreams and likely outputs

### Phase 4: Playbook-native workflows

Goal:

Make playbooks and document workflows first-class.

Main work:

- register and expose core skills
- add playbook launcher UX
- support artifact-focused execution patterns
- support citation and grounding workflows

### Phase 5: Deliverable surfaces

Goal:

Make the app feel built for artifacts, not just for conversation.

Main work:

- better PDF, spreadsheet, and deck handling
- output browsing
- versioned deliverables
- side-by-side source and output workflows

### Phase 6: Reduce T3 dependence

Goal:

Own more of the product layer while keeping Codex runtime stable underneath.
