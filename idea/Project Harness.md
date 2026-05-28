# Project Harness

This note captures the current product idea more concretely:

.assist should be a `Codex harness for project-based knowledge work`.

That means it should not feel like "Codex, but for non-technical people."

It should feel like:

`I opened my project room, and the system already understands the work I am trying to complete.`

## Under The Hood Vs On The Surface

Under the hood, the product can still rely on the same strengths that make Codex powerful:

- workspace awareness
- durable context
- reusable instructions
- tool use
- structured workflows
- artifact creation
- approvals and review loops

But on the surface, the product should not teach users developer concepts first.

It should present a work-native model:

- `Project room`
- `Project brief`
- `Workstreams`
- `Playbooks`
- `Routines`
- `Outputs`
- `Review`

The user should feel operational support, not agent infrastructure.

## The Core Harness

The harness should be built around a few core objects.

### 1. Project Brief

This is the anchor.

It should answer:

- what is this project
- why does it exist
- what is the desired output
- what deadline or milestone matters
- what counts as a good result
- what constraints or priorities matter

### 2. Corpus Map

The system should understand the materials that make up the project:

- what files and sources exist
- what kind of sources they are
- which ones are likely central
- which ones are stale, duplicated, or low-signal
- what appears to be missing

The user should feel that the room has been read, not just indexed.

### 3. Working Memory

This is where continuity lives.

It should capture:

- assumptions
- key facts
- glossary
- stakeholders or important entities
- open questions
- contradictions
- decisions already made
- what changed recently

### 4. Workstreams

The harness should not force everything into one generic conversation.

It should let a project split into natural lanes such as:

- literature review
- market sizing
- findings memo
- business plan draft
- startup comparison
- proposal compliance
- results write-up

This is how chat becomes project operation.

### 5. Playbooks

These are the role-shaped workflows built on top of Codex capabilities.

Examples:

- build literature review
- extract KPIs
- compare several startups
- map proposal requirements to source evidence
- summarize market landscape
- draft executive summary

Playbooks should feel like native actions, not like prompt engineering.

### 6. Outputs

The product should always know what artifact is being built.

Examples:

- thesis
- research paper
- memo
- deck
- proposal
- business plan
- investment recommendation
- market research report

The output should be first-class, not an accidental by-product of chat.

### 7. Review State

Serious work needs a visible review layer.

The room should show:

- what is draft
- what is ready for review
- what is unsupported
- what still has gaps
- what changed since the last revision

This is especially important in high-trust workflows.

## What The Harness Should Actually Do For People

I think the product helps most in a few repeatable ways.

### Recover Context Fast

When the user returns after a day, a week, or a month, the system should answer:

- what this project is
- what we already know
- what changed
- what is unresolved
- what is in progress
- what should happen next

This alone is a huge improvement over general chat.

### Turn Source Material Into Structure

Most users are not starting from zero.

They already have a mess of material.

The system should help turn that mess into:

- themes
- comparisons
- findings
- assumptions
- evidence chains
- draftable structure

### Preserve Project Memory

The user should not have to keep re-explaining:

- why they believed something
- which source supported a claim
- what decision was made last week
- why an assumption changed

### Draft Serious Outputs

.assist should produce real work:

- sections
- outlines
- comparisons
- summaries
- issue logs
- review-ready drafts

Not just "good answers."

### Keep Grounding Visible

Every important claim should be easy to trace back to:

- a file
- a page
- a note
- a table
- a figure
- a source link

The product should help users trust the draft, not just admire it.

## How A Project Should Start

The beginning matters a lot.

.assist should probably not start with:

`What would you like to chat about?`

It should start with:

`What are we trying to get done here?`

## Strong Entry Modes

There are at least 3 very natural ways to begin.

### 1. New Project From Goal

This is for someone starting fresh.

Examples:

- create a thesis project
- create a research paper project
- create a business plan room
- create a grant proposal room
- create an investment review room

The system should ask a few orienting questions:

- what are you trying to produce
- what material do you already have
- what stage are you at
- what matters most: speed, trust, structure, comparison, deadline

From that, it can create the initial room.

### 2. Import Existing Project From Folder Or Bundle

This is probably the most common real-world case.

The user already has:

- a folder
- a thesis draft and sources
- a proposal plus requirements
- a business plan plus notes
- a deck plus spreadsheet plus comments

The system should scan that material and return:

- what this project seems to be
- what sources matter most
- what outputs are already present
- what workstreams are obvious
- what seems incomplete or unsupported
- what the likely next steps are

The important moment is:

`Here is my understanding of your project. Is this right?`

### 3. Resume An Old Or Abandoned Project

This may be the most emotionally powerful flow.

Examples:

- I worked on this 2 months ago and need to get back into it
- I need to finish this thesis
- I need to reopen this investor analysis
- I need to revive this proposal draft

The system should reconstruct continuity by showing:

- what the project was trying to achieve
- where the last draft stopped
- what changed since then
- what open questions were left behind
- what the best next step is now

## Additional Import Modes Worth Considering

There are a couple of especially good import patterns.

### Import From Final Artifact Backward

The user gives a final or near-final artifact:

- thesis draft
- grant proposal
- business plan
- memo
- deck

Then .assist helps reconstruct the project behind it:

- the core themes
- likely source dependencies
- weakly supported claims
- sections that need revision
- the missing memory state

### Import From The Decision

Some users will begin with a high-pressure question rather than a neat folder.

Examples:

- should we invest in these startups
- build me a market view for this category
- help me produce a business plan from this material

In that case, the room can be created from the decision goal first, with the corpus added progressively.

## What Intake Should Produce

A good intake flow should not just upload files.

It should produce a usable project state:

- a draft project brief
- a corpus map
- a list of key entities
- an initial memory scaffold
- suggested workstreams
- candidate outputs
- obvious gaps
- a recommended next step

The user should feel that the project has started to organize itself.

## The Four Questions The Room Should Always Answer

On entry, .assist should be able to answer:

1. What is this project?
2. What do we know?
3. What is in progress?
4. What should happen next?

If it can do that well, it will already feel fundamentally different from generic chat.

## Why This Still Wants Codex Underneath

This product shape is still a strong fit for Codex as the underlying engine because the job requires:

- persistent workspace awareness
- file operations
- structured instructions
- reusable workflows
- real tool use
- artifact generation
- review and approvals

The trick is not to surface the developer mental model directly.

The real job is to turn Codex into a native harness for project rooms.

## Working Product Line

The simplest version of the idea may be:

`.assist is a project room harness built on Codex for people turning a messy corpus into a reliable deliverable.`
