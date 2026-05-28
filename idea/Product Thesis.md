## Working Title

.assist is a workspace-native AI product for project-based knowledge work.

## Core Belief

The next great category of AI tools will not be defined by better chat.

It will be defined by better project operation.

Developers already have tools like Codex because software work naturally lives inside structured systems: repositories, files, scripts, review loops, and repeatable workflows.

That structure makes it possible for AI to become useful beyond conversation.

The important insight is that developers are not special because they code.

They are special because their work already lives inside a project system.

Many non-developer users have the same structure in practice:

- consultants doing audits or financial analysis
- students doing a thesis or PFE
- researchers writing papers
- grant and proposal teams
- investors reviewing startups
- market researchers
- entrepreneurs building business plans

These people are not doing the same job.

But they are often doing the same kind of work:

- gathering a corpus
- understanding it
- organizing it
- comparing it
- drafting from it
- revising it
- defending it

That is the real category.

## The Deeper Segmentation

.assist should not be defined first by profession.

It should be defined by the shape of the project.

The right question is not:

`Who is the one perfect job title?`

The better question is:

`What kind of project creates the need for .assist?`

## What Is A .assist Project

A .assist project is a source-heavy, evolving, outcome-driven body of work that must become a reliable artifact.

It usually has:

- `A corpus`: documents, notes, PDFs, spreadsheets, links, transcripts, drafts, templates, references, or data
- `A goal`: answer a question, support a decision, or produce a deliverable
- `An evolving understanding`: assumptions, findings, gaps, contradictions, and open questions
- `A time horizon`: the work unfolds over days, weeks, or months
- `A continuity need`: the user should not have to restart from scratch every time
- `An output`: thesis, memo, proposal, deck, business plan, report, recommendation
- `A trust requirement`: claims and numbers need support

This is not just "files in a folder."

It is a real project room.

## The Problem

General chat products break down in this kind of work for a few repeatable reasons:

- they start from a blank prompt instead of the current project state
- they do not maintain durable memory of assumptions, findings, and prior drafts
- they treat files as temporary attachments instead of as the workspace itself
- they are weak at repeatable multi-step workflows
- they produce answers, but not always usable outputs
- they do not make grounding visible enough for serious work
- they do not help people resume interrupted projects gracefully

The result is that users keep manually holding the whole project together in their head.

They do not lack intelligence.

They lack a project-aware operating environment.

## Product Thesis

If we give project-based knowledge workers a project room harness built on Codex that understands their corpus, retains working memory, organizes work into reusable playbooks and workstreams, and produces grounded deliverables, then AI can move from being a chat assistant to being a project operator.

That matters because the hard part of many serious workflows is not generating words.

It is maintaining continuity, preserving trust, and turning scattered material into a reliable artifact.

## Product Definition

.assist should feel like a persistent project room for serious work.

At the center of the product is not the chat thread.

It is the project itself.

The harness should include:

- `Project brief`: what this project is, why it exists, what needs to be produced
- `Corpus map`: what material exists, what matters most, what may be missing
- `Working memory`: assumptions, glossary, key facts, open questions, contradictions, decisions
- `Workstreams`: natural lanes of work such as literature review, startup comparison, proposal compliance, or findings memo
- `Playbooks`: repeatable project actions built on top of Codex capabilities
- `Outputs`: the actual artifacts being produced
- `Review state`: what is draft, what is unsupported, and what needs review

The user should feel that the project room understands the work, not that a chatbot is waiting for prompts.

## How Projects Should Begin

Starting the project is part of the product.

.assist should support at least 3 natural entry modes:

### 1. New project from goal

Examples:

- create a thesis project
- create a research paper room
- create a grant proposal room
- create an investment review room
- create a business plan room

### 2. Import existing project from folder or bundle

Examples:

- a folder of research and drafts
- a business plan plus supporting notes
- a deck plus spreadsheet plus comments
- a proposal draft plus RFP materials

### 3. Resume an old or abandoned project

Examples:

- a thesis that has been idle for weeks
- an investor memo that needs to be reopened
- a market study that needs to be finished

The important product behavior is that intake should produce understanding, not just indexing.

The system should come back with:

- what this project appears to be
- what the likely output is
- what sources matter most
- what is in progress
- what looks unresolved
- what should happen next

## Positioning

The strongest positioning is still:

`From chatbot to project operator.`

More concretely:

`.assist helps people turn a messy project corpus into a reliable deliverable.`

This is broad enough to include the right users and narrow enough to exclude generic chat.

## Wedge

The broad category is project-based knowledge work.

The initial wedge should still be users whose project shape is especially clear and trust-heavy:

- audit and financial consulting
- diligence and evaluative analysis
- business planning and investment assessment

These workflows make the problem obvious:

- the corpus is real
- the output matters
- the trust requirement is high
- the continuity pain is severe

But the product should be designed from the start to generalize to adjacent users who share the same project shape.

## Experience Principles

.assist should be designed around a few strong principles:

### 1. Project first, chat second

The project room is the main object, not the conversation.

### 2. Artifact first, answer second

The product should help ship work, not just generate pleasant responses.

### 3. Memory by default

Users should not have to reload the same context over and over.

### 4. Grounding by default

Serious work becomes more trustworthy when claims are traceable.

### 5. Workstreams over generic threads

Projects often split naturally into multiple lanes of work.

### 6. Start, import, and resume are core UX

Beginning and re-entering a project are first-class product moments.

### 7. Human review stays central

The system should prepare work and structure it well, while the user remains in control of what becomes final.

## Translation Layer

Under the hood, .assist can rely on concepts similar to technical agent products, but the surface language should fit the user's world.

- `Skills` -> `Playbooks`
- `Automations` -> `Routines`
- `Threads` -> `Workstreams`
- `Context` -> `Project Brief`
- `Workspace` -> `Project Room`
- `Review` -> `Draft With Approval`

This matters because most users do not want to learn an agent framework.

They want a system that understands their project.

## Why This Matters Now

Model quality is no longer the only bottleneck.

Packaging, trust, continuity, and workflow fit now matter more than raw intelligence for many serious use cases.

The technical pieces are increasingly available:

- strong multimodal models
- file understanding
- spreadsheet and document processing
- durable memory patterns
- workflow automation
- artifact generation

What is still missing is the product layer that turns these capabilities into a native project room.

## What Success Looks Like

.assist is successful when a user no longer thinks of AI as a separate tool they occasionally consult.

Instead, they experience it as the operating layer of their project:

- it knows what the project is
- it remembers what matters
- it helps them recover context quickly
- it prepares structure before they ask
- it drafts real outputs
- it keeps claims grounded
- it makes interrupted work resumable

At that point, the product has moved beyond chat and become infrastructure for serious knowledge work.

## Non-Goals

.assist should not begin as:

- a general-purpose assistant for every kind of task
- a shallow wrapper around chat with file upload
- a product for casual, one-off questions
- a system that acts autonomously without clear user control
- a product defined only by one profession forever

The right starting move is depth in one strong project shape, while keeping the category definition broader.

## One-Sentence Thesis

.assist brings the project-aware, stateful, action-oriented power of Codex to people working on bounded, source-heavy projects that need to become reliable deliverables.
