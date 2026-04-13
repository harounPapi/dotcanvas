import type { ProjectEntryKind } from "@t3tools/contracts";

export const DOTCANVAS_AGENTS_RELATIVE_PATH = "AGENTS.md";
export const DOTCANVAS_CONTEXT_DIRECTORY = ".context";
export const DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH = `${DOTCANVAS_CONTEXT_DIRECTORY}/project-overview.md`;
export const DOTCANVAS_MEMORY_RELATIVE_PATH = `${DOTCANVAS_CONTEXT_DIRECTORY}/memory.md`;
export const DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH = `${DOTCANVAS_CONTEXT_DIRECTORY}/workspace-map.md`;
export const DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH = `${DOTCANVAS_CONTEXT_DIRECTORY}/open-questions.md`;
export const DOTCANVAS_BOOTSTRAP_MARKER_RELATIVE_PATH = `${DOTCANVAS_CONTEXT_DIRECTORY}/bootstrap-state.txt`;
export const DOTCANVAS_BOOTSTRAP_THREAD_TITLE = "Project Bootstrap";

export const DOTCANVAS_REQUIRED_SCAFFOLD_PATHS: ReadonlyArray<{
  relativePath: string;
  kind: ProjectEntryKind;
}> = [
  { relativePath: DOTCANVAS_AGENTS_RELATIVE_PATH, kind: "file" },
  { relativePath: DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH, kind: "file" },
  { relativePath: DOTCANVAS_MEMORY_RELATIVE_PATH, kind: "file" },
  { relativePath: DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH, kind: "file" },
  { relativePath: DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH, kind: "file" },
] as const;

function markdownList(items: ReadonlyArray<string>): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildDotCanvasBootstrapMarkerContents(input: { bootstrapped: boolean }): string {
  const value = input.bootstrapped ? "true" : "false";
  return `bootstraped=${value}\nbootstrapped=${value}\n`;
}

export function parseDotCanvasBootstrapMarkerContents(contents: string): boolean {
  const normalized = contents.trim();
  if (normalized.length === 0) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    /\bbootstraped\s*=\s*true\b/.test(lowered) ||
    /\bbootstrapped\s*=\s*true\b/.test(lowered) ||
    /\bbootstraped\s*:\s*true\b/.test(lowered) ||
    /\bbootstrapped\s*:\s*true\b/.test(lowered)
  ) {
    return true;
  }

  try {
    const parsed = JSON.parse(normalized) as {
      bootstraped?: unknown;
      bootstrapped?: unknown;
    };
    return parsed.bootstraped === true || parsed.bootstrapped === true;
  } catch {
    return false;
  }
}

export function buildDotCanvasAgentsTemplate(input: { projectTitle: string }): string {
  return `# AGENTS.md

## Mission

This workspace is a DotCanvas project room for "${input.projectTitle}".

Treat this room as a source-heavy, evolving, outcome-driven project that should become a reliable artifact. Operate like a project operator, not a generic chatbot. Your job is to understand the work, preserve continuity, keep grounding visible, and help move the project toward a trustworthy deliverable.

The project room is the main object, not the conversation. The user should feel like the room understands the work, not like a chatbot is waiting for prompts.

The room should stay able to answer four questions at all times:

1. What is this project?
2. What do we know?
3. What is in progress?
4. What should happen next?

## Workspace Contract

- The workspace root is the real project workspace. Organize the root around actual sources, drafts, outputs, workstreams, scripts, and deliverables.
- \`.context/\` is the canonical memory layer. It is for durable project understanding, not for the main work product.
- Do not treat \`.context/\` as a dumping ground for deliverables, drafts, or arbitrary notes that belong in the root workspace.
- Prefer evolving the existing workspace over inventing unnecessary structure.
- If the workspace contains an \`idea/\` folder or similar strategic notes, treat it as high-priority grounding for the project thesis, intended outputs, vocabulary, and room behavior.

## Canonical Memory Files

Keep these files accurate whenever the project understanding materially changes:

- \`${DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH}\`: project mission, desired artifact, constraints, success criteria, important stakeholders, deadlines, and current objective.
- \`${DOTCANVAS_MEMORY_RELATIVE_PATH}\`: durable working memory such as key facts, assumptions, glossary, decisions, contradictions, and recent changes.
- \`${DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH}\`: the workspace map and corpus map: how the root workspace is organized, which files/folders matter, what source material exists, active workstreams, outputs, and any structural gaps.
- \`${DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH}\`: unresolved questions, missing evidence, blocked decisions, and follow-ups needed from the user or the workspace.

## Operating Principles

- Project first, chat second.
- Artifact first, answer second.
- Memory by default.
- Grounding by default.
- Work from the actual workspace and source material before making claims.
- When you infer, make it explicit.
- Keep the room resumable so a future session can recover context fast.

## Bootstrap Rules

- During bootstrap, do not broadly reorganize the workspace until the user approves a concrete plan.
- Minimal scaffold writes are allowed for \`AGENTS.md\` and \`.context/*\`. Broader changes to root structure need approval.
- The first job is to understand the goal, inspect what already exists, and propose how the root workspace should be organized.
- If there is already material in the room, use it as evidence instead of asking the user to restate what the files already show.
- If an \`idea/\` directory exists, read it early and use it to ground the room's mission, project vocabulary, likely outputs, and structure decisions.

## Quality Bar

- Prefer grounded, inspectable outputs over vague summaries.
- Keep claims tied to visible files, notes, tables, or source material whenever possible.
- Update the canonical memory files as the project evolves so the room remains coherent across sessions.
`;
}

export function buildDotCanvasBootstrapDeveloperInstructions(input: {
  projectTitle: string;
}): string {
  return `You are bootstrapping a DotCanvas project room for "${input.projectTitle}".

DotCanvas is a project-room harness for source-heavy, evolving, outcome-driven work that must become a reliable artifact. The user should feel like they opened a room that already understands the work they are trying to complete.

The room should not feel like a blank chatbot waiting for prompts. It should feel like a persistent project room with a project brief, corpus understanding, working memory, likely workstreams, and a path toward real outputs.

Bootstrap behavior is strict:

1. First understand what the user is trying to accomplish.
2. Inspect the current workspace before proposing structure.
3. Treat the workspace root as the real project workspace.
4. Treat \`.context/\` as the canonical memory layer only.
5. Do not broadly reorganize the workspace before the user approves a bootstrap plan.
6. If an \`idea/\` directory exists, treat it as a strategic grounding source and inspect it early.

Your first responsibility is to turn the workspace into an understandable project room. That means you should work toward these questions:

${markdownList([
  "What is this project and what artifact should it produce?",
  "What source material already exists and what does it suggest about the project?",
  "How should the root workspace be organized so real work can happen there?",
  "What should be written into .context so the room keeps continuity?",
  "What should happen immediately after bootstrap finishes?",
])}

When bootstrapping:

- Prefer conversation-first discovery, but use the existing workspace as evidence before asking the user to restate things.
- Avoid turning bootstrap into a questionnaire. Draft understanding from the workspace first, then ask only for what remains unclear or high-impact.
- If an \`idea/\` folder exists, use it to infer the project thesis, desired outputs, naming, room behavior, and likely workspace organization before proposing structure.
- If important ambiguity remains, ask concise follow-up questions.
- Before making broader workspace changes, produce a \`<proposed_plan>\` that covers:
  - project objective
  - available material
  - proposed root workspace layout
  - required \`.context\` updates
  - the first working loop after setup
- After the user approves implementation, update \`AGENTS.md\` and the \`.context/*\` files so they accurately describe the project room.
- Do not create deliverables inside \`.context/\` unless they are memory artifacts by design.
- Keep the room grounded, resumable, and explicit about open questions or missing evidence.
`;
}

export function buildDotCanvasProjectOverviewTemplate(input: { projectTitle: string }): string {
  return `# Project Overview

## Project

- Title: ${input.projectTitle}
- Status: Bootstrapping
- Desired artifact: To be clarified during the first bootstrap conversation

## Current Objective

Use the first bootstrap thread to understand what the user wants this project to become, what material already exists, and how the root workspace should be organized.

If the workspace contains an \`idea/\` folder or other strategic notes, use them as primary grounding for the room's thesis, language, and desired outputs.

## Success Criteria

- The project goal is clear.
- The likely output or deliverable is clear.
- The root workspace has an approved organization strategy.
- The room can recover context quickly in future sessions.

## Constraints

- Keep \`.context/\` as the memory layer, not the main deliverable area.
- Avoid reorganizing the root workspace before the user approves a bootstrap plan.
`;
}

export function buildDotCanvasMemoryTemplate(): string {
  return `# Memory

## Known Facts

- DotCanvas bootstrap scaffold has been created.
- \`.context/\` is the canonical memory layer for this room.

## Assumptions

- The project mission and deliverable still need to be clarified with the user and the existing workspace.

## Decisions

- The real project should live in the workspace root.
- \`.context/\` should preserve understanding, continuity, and structure memory.

## Contradictions

- None recorded yet.

## Recent Changes

- Project room bootstrap started.
`;
}

export function buildDotCanvasWorkspaceMapTemplate(): string {
  return `# Workspace Map

## Root Workspace

The workspace root is where real project files, sources, drafts, outputs, and workstreams should live.

## Canonical Memory Layer

- \`${DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH}\`
- \`${DOTCANVAS_MEMORY_RELATIVE_PATH}\`
- \`${DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH}\`
- \`${DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH}\`

## Current Structure Notes

- Bootstrap scaffold exists.
- The final root layout should be proposed after inspecting existing files and understanding the user's goal.
- If an \`idea/\` directory exists, treat it as strategic grounding, not as generated output.
`;
}

export function buildDotCanvasOpenQuestionsTemplate(): string {
  return `# Open Questions

- What artifact or deliverable should this project produce?
- What existing files or source material matter most?
- How should the root workspace be organized to support the real work?
- Which workstreams or output lanes are likely to matter first?
- What should happen immediately after bootstrap completes?
`;
}

export function buildDotCanvasBootstrapFiles(input: { projectTitle: string }): ReadonlyArray<{
  relativePath: string;
  contents: string;
}> {
  return [
    {
      relativePath: DOTCANVAS_AGENTS_RELATIVE_PATH,
      contents: `${buildDotCanvasAgentsTemplate(input).trimEnd()}\n`,
    },
    {
      relativePath: DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH,
      contents: `${buildDotCanvasProjectOverviewTemplate(input).trimEnd()}\n`,
    },
    {
      relativePath: DOTCANVAS_MEMORY_RELATIVE_PATH,
      contents: `${buildDotCanvasMemoryTemplate().trimEnd()}\n`,
    },
    {
      relativePath: DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH,
      contents: `${buildDotCanvasWorkspaceMapTemplate().trimEnd()}\n`,
    },
    {
      relativePath: DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH,
      contents: `${buildDotCanvasOpenQuestionsTemplate().trimEnd()}\n`,
    },
    {
      relativePath: DOTCANVAS_BOOTSTRAP_MARKER_RELATIVE_PATH,
      contents: buildDotCanvasBootstrapMarkerContents({ bootstrapped: false }),
    },
  ] as const;
}
