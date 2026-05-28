# .assist

This note captures the discussion in detail and preserves the assistant responses verbatim in a standalone project note.

## Public/Open-Source Status and Initial Thesis

As of April 7, 2026, the public/open-source part from OpenAI is clearly the Codex CLI repo, plus related open pieces like the skills catalog and sandboxing references. I don’t see an official public repo for the Codex desktop app itself in OpenAI’s materials, so I’d describe the app as publicly available but not clearly open-sourced. T3 Code is different: it has a public GitHub repo and an MIT license. Sources: [OpenAI Codex app announcement](https://openai.com/index/introducing-the-codex-app/), [openai/codex](https://github.com/openai/codex), [openai/skills](https://github.com/openai/skills), [pingdotgg/t3code](https://github.com/pingdotgg/t3code), [T3 Code install docs](https://www.mintlify.com/pingdotgg/t3code/installation).

On the bigger idea: yes, I think you’re pointing at a real product gap. Developers got great tools because they already work in structured systems: files, diffs, tickets, scripts, review loops. Non-technical professionals also do structured work, but their “codebase” is email, meetings, docs, decks, CRMs, and approvals. A blank AI chat box is too generic for them. What they need is the same underlying agent logic, but packaged around their jobs instead of around code.

The strongest wedge is not “AI for everyone.” It’s “an operating system for a role.” For consultants, that could be: pre-meeting brief, stakeholder map, follow-up draft, proposal/RFP draft, weekly client status pack, RAID log updates, executive summary from scattered notes. For managers: 1:1 prep, project health digest, decision log, escalation drafts, weekly leadership update, dependency/risk tracking, hiring pipeline summaries. That’s exactly the same mental model as dev `skills` and `automations`, just renamed and hidden behind native actions.

If I were building it, I’d translate the dev concepts like this:

- `Skills` becomes `Playbooks`
- `Automations` becomes `Routines`
- `Threads` becomes `Workstreams`
- `Context files` becomes `Team memory`
- `Tool calls` becomes `Connected apps`
- `Diff/review` becomes `Draft with approvals`

The key design move is: don’t teach people “agent workflows” first. Give them buttons that match their stress. “Prepare tomorrow’s client meeting.” “Draft the follow-up.” “Summarize this week for leadership.” Under the hood, you still use skills, memory, automations, and connectors. On the surface, it feels like relief, not technology.

The big unsolved problem for these users is recurring coordination work. Not raw intelligence. Trust, packaging, and workflow-fit matter more than model quality. If you want, I can sketch what a really strong v1 for “consultant mode” or “manager mode” would look like.

## Refined Framing: Project-Based Knowledge Work

Yes, I think your correction is important.

The opportunity is not “AI for email people.” It’s “Codex for project-based knowledge work.”

Developers happen to have codebases. But a financial consultant, analyst, strategist, business-plan writer, PMO lead, investment team, even some legal/ops people often have something very similar in practice:

- a project folder
- a set of source documents
- spreadsheets
- PDFs
- links
- templates
- prior deliverables
- deadlines
- a final artifact they need to produce

That is basically a codebase equivalent. Not software code, but a working corpus.

Why `ChatGPT` feels limited there is the same reason it feels limited for devs compared to Codex:

- it starts from a blank chat too often
- project context is weak
- files are attached, not lived in
- repeatable workflows are thin
- tool use is not the main UX
- outputs are not naturally tied back to the workspace

So I think your instinct is right: the missing product is a `workspace-native agent` for non-developer professionals.

What would make it truly useful:

- Persistent project memory: knows the folder, key docs, assumptions, glossary, client/company context.
- Artifact-first workflow: produces models, memos, decks, plans, briefs, not just chat answers.
- Reusable skills/playbooks: “build management summary”, “extract KPIs from statements”, “draft business plan section”, “compare version A vs B”.
- Automations/routines: “every morning scan new files and update risk list”, “before Monday create client status draft”.
- Source-grounded output: every number or claim linked to a file/cell/page.
- Safe collaboration: suggestions, drafts, approvals, audit trail.

A few concrete verticals where this feels very real:

- Financial consulting: normalize statements, pull ratios, flag anomalies, draft investor/client memos, build board-pack summaries.
- Business planning: market research synthesis, TAM/SAM/SOM drafts, assumption tracking, financial narrative, slide outline generation.
- Strategy/operations: status packs, dependency mapping, decision logs, scenario comparison, KPI commentary.
- Due diligence / deal work: organize data rooms, extract findings, build issue lists, summarize risks by theme.
- Grant/proposal work: gather evidence, map requirements to source docs, draft sections, track gaps.

The key insight is: devs are not special because they code. They are special because their tools are `project-aware`, `stateful`, and `action-oriented`. Other professionals deserve the same thing.

If you wanted to package this well, I would avoid dev words on the surface:

- `Skills` -> `Playbooks`
- `Automations` -> `Routines`
- `Context` -> `Project Brief`
- `Workspace` -> `Engagement Room`
- `Agent` -> maybe `Analyst` or `Project Assistant`

Under the hood, it’s the same architecture as Codex. On the surface, it feels like “the tool understands my engagement and helps me produce work.”

The strongest framing might be:
`From chatbot to project operator.`

If you want, I can help you do the next step and sketch:

1. a sharp product thesis,
2. the best first user/persona to target,
3. and what a v1 of this would actually contain.

## Further Refinement: Project Definition Over Job Title

The next important refinement is that the product probably should not be defined first by profession.

It should be defined by the shape of the project.

The common thread is not "consultant" or "manager" or "researcher" by itself.

The common thread is:

- a bounded project
- a real corpus
- an evolving understanding
- a meaningful output
- continuity over time
- pressure to be right

That means the same product category may include:

- audit or financial consulting work
- a student thesis or PFE
- a research paper
- a proposal or grant
- startup investment analysis
- market research
- an entrepreneur building a business plan

These are different roles, but they share a similar operating need: turning a messy project corpus into a trustworthy output.

## Codex Harness Framing

From there, the right product move is not "Codex for non-technical people."

It is a `Codex harness for project rooms`.

Under the hood, the strengths are still Codex-like:

- workspace awareness
- durable context
- reusable instructions
- tool use
- real execution
- artifact generation

But on the surface, the user should experience:

- a project brief
- a corpus map
- working memory
- workstreams
- playbooks
- outputs
- review state

The user should feel that the room already understands the work.

## How The Product Should Start

The start of the experience is part of the product.

The system should not simply open on a blank chat box.

It should support at least 3 natural entry modes:

1. start a new project from a goal
2. import an existing project from a folder or bundle
3. resume an old or abandoned project

The best version of import is not passive indexing.

It is an active reconstruction step where the system returns:

- what this project appears to be
- what the likely output is
- what material matters most
- what is incomplete or unsupported
- what the best next step is

That "here is my understanding of your project" moment feels central to the product.
