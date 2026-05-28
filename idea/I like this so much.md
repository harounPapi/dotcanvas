I think the key is: we should not give them “Codex, but less technical.” We should give them a `project operator harness` built on Codex.

Under the hood, it can still be Codex:

- file-aware
- stateful
- tool-using
- able to run workflows
- able to draft artifacts
- able to keep memory

But on the surface, it should feel like:

`I opened my project room, and the system already understands what I’m trying to produce.`

**Core Harness**
I’d structure the harness around 6 things:

1. `Project brief`
   What is this project, what is the goal, what is the deliverable, what matters, what counts as “good”.

2. `Corpus map`
   What files exist, what kind they are, which ones matter most, what is missing, what is stale.

3. `Working memory`
   Assumptions, glossary, stakeholders, open questions, unresolved contradictions, key findings.

4. `Workstreams`
   Not generic chats. Real lanes like:

- literature review
- findings memo
- business plan draft
- market sizing
- investor recommendation
- grant compliance

5. `Playbooks`
   Codex skills, but surfaced as role-shaped actions:

- “Build literature review”
- “Extract KPIs”
- “Compare 5 startups”
- “Map grant requirements to evidence”
- “Draft market landscape”

6. `Artifacts`
   The product should always know what output is being built:

- paper
- memo
- deck
- proposal
- thesis
- investment note
- business plan

That feels much more native than “what would you like to ask?”

**How It Helps Them**
I think .assist helps these users in 5 main ways:

- `Recover context fast`
  When they come back after 2 days, they should see:
  what changed, what’s done, what’s unresolved, what output is in flight.

- `Turn source material into structure`
  Most of their pain is not writing from zero. It’s turning scattered material into an organized mental model.

- `Preserve project memory`
  Especially for students, researchers, consultants, investors:
  “Why did I believe this?”
  “Which source supported that?”
  “What did I decide last week?”

- `Draft serious outputs`
  Not just answer questions, but actually produce sections, summaries, outlines, comparison tables, issue logs, review-ready drafts.

- `Keep grounding visible`
  Every serious claim should be traceable back to source files, pages, notes, cells, or links.

**How A New Project Should Start**
I don’t think “upload files and chat” is enough. Starting a project should feel like opening a room.

A good new-project flow might be:

1. `What are you trying to produce?`
   Examples:

- thesis
- research paper
- business plan
- investment memo
- grant proposal
- market research report

2. `What material do you already have?`

- folder of files
- scattered documents
- nothing yet
- a prior draft
- research links
- spreadsheet/model

3. `What stage are you at?`

- just starting
- collecting material
- analyzing
- drafting
- revising
- finalizing

4. `What matters most?`

- speed
- source trust
- structure
- comparison
- writing quality
- deadline tracking

From that, .assist can create the first room:

- project brief
- suggested workstreams
- initial memory sections
- recommended playbooks
- empty outputs folder with the right artifact templates

**How Old Projects Should Be Imported**
This is really important. Most people won’t start greenfield.

I think there are a few strong import modes:

1. `Import a folder`
   Best for consultants, students, researchers, founders.
   The system scans the folder and builds:

- project map
- important files
- probable deliverables
- timeline of drafts
- missing context questions

2. `Import from a final artifact backward`
   Very strong move.
   User gives:

- thesis draft
- grant proposal
- business plan
- memo
- deck

Then .assist asks:
“Do you want me to reconstruct the project behind this?”
It can infer:

- core themes
- likely source sets
- unresolved support gaps
- sections that need better grounding
- project memory starter

3. `Import from a working bundle`
   Examples:

- deck + spreadsheet + notes
- paper draft + citations + comments
- proposal draft + RFP + prior responses
  This is probably the most realistic real-world mode.

4. `Import from a question`
   For messy users:
   “I need to decide whether to invest in these 4 startups.”
   Then .assist creates the room and asks for materials progressively.

**What The Import Should Produce**
Import should not just index files. It should produce a usable project state:

- what this project seems to be about
- what the likely output is
- what source types exist
- what key entities are involved
- what workstreams are obvious
- what gaps block progress
- what should happen next

Basically, import should end with:
`Here is my understanding of your project. Is this right?`

That confirmation moment feels crucial.

**What Makes This Feel Like Codex, In The Right Way**
The Codex part should show up as competence, not as developer UX.

So instead of exposing:

- thread
- skill
- agent
- context window
- tool call

We surface:

- workstream
- playbook
- project brief
- source-backed draft
- review step

But the harness still benefits from Codex strengths:

- persistent workspace
- instruction files
- reusable playbooks
- routines
- approvals
- real file operations
- artifact generation

**A Few Product Shapes I Really Like**
These feel promising to me:

- `Start from deliverable`
  “Create a new research paper project.”
  “Create a grant proposal room.”
  “Create an investment review room.”

- `Start from evidence`
  “Here is my folder. Tell me what kind of project this is and organize it.”

- `Start from continuity pain`
  “I worked on this 2 months ago and I need to get back into it.”

- `Start from decision pressure`
  “I need to decide whether this startup is investable.”
  “I need to turn this market research into a recommendation.”

Those are much more natural than “start a chat.”

**One Strong Principle**
I think the harness should always answer 4 things on entry:

- What is this project?
- What do we know?
- What is in progress?
- What should happen next?

If it does that well, it will already feel very different from normal chat.

My instinct is the best next design exercise would be to sketch 3 concrete entry flows:

- `new project from goal`
- `import old project from folder`
- `resume abandoned project`

That would force us to make this much more tangible.
