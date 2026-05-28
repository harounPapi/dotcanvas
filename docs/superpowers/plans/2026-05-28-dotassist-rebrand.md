# .assist Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand DotCanvas to `.assist`, replace the purple brand/theme with a shadcn preset theme, preserve the existing logo mark shape, migrate internal project-kind persistence safely, then rename the GitHub repository and local workspace folder.

**Architecture:** Treat this as a compatibility migration, not a blind string replacement. Public UI/marketing copy moves to `.assist`, code identifiers move to `Assist`/`assist`, persisted `dotcanvas` project kinds decode and migrate to `assist`, and OS/package artifact names use `Assist`/`assist` where a leading dot would create hidden or awkward files. The local workspace folder and GitHub repository are renamed to `.assist` last, after validation and push.

**Tech Stack:** Bun monorepo, TypeScript, Effect Schema, Effect SQL migrations, React/Vite, Tailwind v4, shadcn/ui `base-mira`, Astro marketing app, Electron desktop app, GitHub CLI.

---

## Naming Policy

- User-facing brand text: `.assist`
- Internal TypeScript identifiers: `Assist`, `ASSIST_*`, `assist`
- Persisted canonical project kind: `"assist"`
- Legacy accepted project kind: `"dotcanvas"` decoded to `"assist"` and migrated by SQL
- Shared module subpath: `@t3tools/shared/assist`
- Temporary compatibility subpath: `@t3tools/shared/dotcanvas` re-exporting from `assist` for one release
- Local repository folder after final rename: `/Users/harounbaccar/WORKSPACE/other/.assist`
- GitHub repository after final rename: `harounPapi/.assist`
- OS bundle/artifact/executable names: `Assist` / `assist` / `Assist-${version}-${arch}.${ext}` to avoid hidden dot-prefixed app files

## Theme Choice

Use shadcn preset `b5Kc6P0Vc` as the chosen non-purple shadcn theme source.

Decoded values from `bunx --bun shadcn@latest preset decode b5Kc6P0Vc --json`:

```json
{
  "style": "luma",
  "baseColor": "olive",
  "theme": "lime",
  "chartColor": "sky",
  "iconLibrary": "hugeicons",
  "font": "geist",
  "fontHeading": "inherit",
  "radius": "default",
  "menuAccent": "subtle",
  "menuColor": "default"
}
```

Apply it theme-only so component source, Base UI setup, lucide imports, and `base-mira` component geometry are not churned:

```bash
bunx --bun shadcn@latest apply b5Kc6P0Vc --only theme -y
```

Use shadcn docs for the preset workflow:

- https://ui.shadcn.com/docs/cli
- https://ui.shadcn.com/docs/changelog/2026-04-preset-commands
- https://ui.shadcn.com/docs/changelog/2026-04-partial-preset-apply

## Preflight Risk

The shell currently prints:

```text
error: Requested version >=24.13.1 <25.0.0-0 is not currently installed
```

The repo requires Node `^24.13.1` in `package.json` and `.mise.toml`. Fix this before claiming final validation:

```bash
mise install node@24.13.1
mise use node@24.13.1
node -v
```

Expected final `node -v`:

```text
v24.13.1
```

If `mise` is unavailable, install Node 24.13.1 with the repo's active version manager and verify `node -v` is `v24.13.1` before running the final checks.

## Task 1: Create Branch And Establish Baseline

**Files:**

- Modify: none
- Test: none

- [ ] **Step 1: Create an implementation branch**

```bash
git switch -c harounPapi/dotassist-rebrand
```

Expected:

```text
Switched to a new branch 'harounPapi/dotassist-rebrand'
```

- [ ] **Step 2: Verify the working tree is clean before edits**

```bash
git status --short
```

Expected: no file output.

- [ ] **Step 3: Verify shadcn project context**

```bash
cd apps/web
bunx --bun shadcn@latest info --json
```

Expected JSON contains:

```json
{
  "config": {
    "style": "base-mira",
    "iconLibrary": "lucide"
  },
  "project": {
    "framework": "Vite",
    "tailwindVersion": "v4"
  }
}
```

- [ ] **Step 4: Run baseline focused tests**

Use `bun run test`, not `bun test`.

```bash
cd /Users/harounbaccar/WORKSPACE/other/dotcanvas
bun run test --filter=@t3tools/contracts --filter=@t3tools/shared --filter=t3 --filter=@t3tools/web
```

Expected: tests pass, or any existing failure is copied into the task notes before continuing.

- [ ] **Step 5: Commit only if branch metadata or toolchain files changed**

If no files changed, skip this step. If `.mise.toml` or another toolchain file changed while fixing Node, commit it:

```bash
git add .mise.toml
git commit -m "chore: align node toolchain"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] chore: align node toolchain
```

## Task 2: Add Contract Compatibility For Assist Project Kind

**Files:**

- Modify: `packages/contracts/src/orchestration.ts`
- Modify: `packages/contracts/src/orchestration.test.ts`

- [ ] **Step 1: Write the failing legacy decode test**

`packages/contracts/src/orchestration.test.ts` already imports `Effect` and `Schema` from `effect`, so no import change is needed.

Add this test after the existing test named `"decodes historical project.created payloads with a default provider"`:

```ts
it.effect("decodes legacy dotcanvas project kind as assist", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeProjectCreatedPayload({
      projectId: "project-1",
      title: "Project Title",
      workspaceRoot: "/tmp/workspace",
      kind: "dotcanvas",
      bootstrapState: "bootstrapping",
      defaultModelSelection: {
        provider: "codex",
        model: "gpt-5.4",
      },
      scripts: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.strictEqual(parsed.kind, "assist");
  }),
);
```

- [ ] **Step 2: Run the failing contract test**

```bash
bun --cwd packages/contracts run test src/orchestration.test.ts -t "decodes legacy dotcanvas project kind as assist"
```

Expected: FAIL because `parsed.kind` is still `"dotcanvas"` or because `"assist"` is not yet part of `ProjectKind`.

- [ ] **Step 3: Implement canonical `assist` with legacy decode support**

Modify the imports at the top of `packages/contracts/src/orchestration.ts`.

Current:

```ts
import { Schema } from "effect";
```

New:

```ts
import { Schema, SchemaGetter } from "effect";
```

Replace the current `ProjectKind` block:

```ts
export const ProjectKind = Schema.Literals(["plain", "dotcanvas"]);
export type ProjectKind = typeof ProjectKind.Type;
export const DEFAULT_PROJECT_KIND: ProjectKind = "plain";
```

With:

```ts
const CanonicalProjectKind = Schema.Literals(["plain", "assist"]);

export const ProjectKind = Schema.Literals(["plain", "assist", "dotcanvas"]).pipe(
  Schema.decodeTo(CanonicalProjectKind, {
    decode: SchemaGetter.transform((kind) => (kind === "dotcanvas" ? "assist" : kind)),
    encode: SchemaGetter.transform((kind) => kind),
  }),
);
export type ProjectKind = typeof ProjectKind.Type;
export const DEFAULT_PROJECT_KIND: ProjectKind = "plain";
```

- [ ] **Step 4: Run the focused contract test**

```bash
bun --cwd packages/contracts run test src/orchestration.test.ts -t "decodes legacy dotcanvas project kind as assist"
```

Expected: PASS.

- [ ] **Step 5: Run the full contract tests**

```bash
bun --cwd packages/contracts run test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/orchestration.ts packages/contracts/src/orchestration.test.ts
git commit -m "feat: canonicalize assist project kind"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] feat: canonicalize assist project kind
```

## Task 3: Rename Shared DotCanvas Scaffold Module To Assist

**Files:**

- Rename: `packages/shared/src/dotcanvas.ts` to `packages/shared/src/assist.ts`
- Rename: `packages/shared/src/dotcanvas.test.ts` to `packages/shared/src/assist.test.ts`
- Create: `packages/shared/src/dotcanvas.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Rename the shared files with git**

```bash
git mv packages/shared/src/dotcanvas.ts packages/shared/src/assist.ts
git mv packages/shared/src/dotcanvas.test.ts packages/shared/src/assist.test.ts
```

Expected: both renames appear in `git status --short`.

- [ ] **Step 2: Mechanically rename identifiers in the canonical module and test**

```bash
perl -0pi -e 's/DOTCANVAS/ASSIST/g; s/DotCanvas/Assist/g; s/dotcanvas/assist/g' packages/shared/src/assist.ts packages/shared/src/assist.test.ts
```

Expected: `packages/shared/src/assist.ts` exports `ASSIST_*` constants and `buildAssist*` functions.

- [ ] **Step 3: Update public copy inside `packages/shared/src/assist.ts` to `.assist`**

In template strings and generated markdown prose only, replace `Assist` with `.assist` where it refers to the product. Keep TypeScript identifiers as `Assist`.

The generated AGENTS template mission must contain:

```md
This workspace is a .assist project room for "${input.projectTitle}".
```

The bootstrap developer instruction opening must contain:

```md
You are bootstrapping a .assist project room for "${input.projectTitle}".

.assist is a project-room harness for source-heavy, evolving, outcome-driven work that must become a reliable artifact.
```

The memory template known facts section must contain:

```md
- .assist bootstrap scaffold has been created.
```

- [ ] **Step 4: Add a compatibility re-export file**

Create `packages/shared/src/dotcanvas.ts` with this exact content:

```ts
export * from "./assist";
```

- [ ] **Step 5: Update package subpath exports**

In `packages/shared/package.json`, replace the old `./dotcanvas` export block:

```json
"./dotcanvas": {
  "types": "./src/dotcanvas.ts",
  "import": "./src/dotcanvas.ts"
},
```

With both exports:

```json
"./assist": {
  "types": "./src/assist.ts",
  "import": "./src/assist.ts"
},
"./dotcanvas": {
  "types": "./src/dotcanvas.ts",
  "import": "./src/dotcanvas.ts"
},
```

- [ ] **Step 6: Update shared tests to canonical names**

In `packages/shared/src/assist.test.ts`, the import must be:

```ts
import {
  ASSIST_AGENTS_RELATIVE_PATH,
  ASSIST_BOOTSTRAP_MARKER_RELATIVE_PATH,
  ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH,
  ASSIST_REQUIRED_SCAFFOLD_PATHS,
  buildAssistAgentsTemplate,
  buildAssistBootstrapMarkerContents,
  buildAssistBootstrapDeveloperInstructions,
  buildAssistBootstrapFiles,
  parseAssistBootstrapMarkerContents,
} from "./assist";
```

The describe block must be:

```ts
describe("assist shared scaffold", () => {
```

The expectations in the template tests must include `.assist`:

```ts
expect(template).toContain(".assist project room");
expect(instructions).toContain(".assist is a project-room harness");
```

- [ ] **Step 7: Run the focused shared test**

```bash
bun --cwd packages/shared run test src/assist.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run full shared tests**

```bash
bun --cwd packages/shared run test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/package.json packages/shared/src/assist.ts packages/shared/src/assist.test.ts packages/shared/src/dotcanvas.ts
git commit -m "refactor: rename project scaffold helpers to assist"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] refactor: rename project scaffold helpers to assist
```

## Task 4: Migrate Runtime Code From DotCanvas Helpers To Assist Helpers

**Files:**

- Rename: `apps/web/src/dotcanvasProject.ts` to `apps/web/src/assistProject.ts`
- Rename: `apps/web/src/dotcanvasProject.test.ts` to `apps/web/src/assistProject.test.ts`
- Rename: `apps/web/src/hooks/useDotCanvasProjectFlow.ts` to `apps/web/src/hooks/useAssistProjectFlow.ts`
- Modify: `apps/server/src/ws.ts`
- Modify: `apps/server/src/serverRuntimeStartup.ts`
- Modify: `apps/server/src/orchestration/commandInvariants.ts`
- Modify: `apps/server/src/orchestration/decider.ts`
- Modify: `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- Modify: `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- Modify: `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.test.ts`
- Modify: `apps/server/src/orchestration/decider.projectScripts.test.ts`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/components/ChatView.tsx`
- Modify: `apps/web/src/components/ChatView.browser.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/hooks/useHandleNewThread.ts`
- Modify: `apps/web/src/components/ProjectCreationSurface.tsx`

- [ ] **Step 1: Rename web project helper files**

```bash
git mv apps/web/src/dotcanvasProject.ts apps/web/src/assistProject.ts
git mv apps/web/src/dotcanvasProject.test.ts apps/web/src/assistProject.test.ts
git mv apps/web/src/hooks/useDotCanvasProjectFlow.ts apps/web/src/hooks/useAssistProjectFlow.ts
```

Expected: all three renames appear in `git status --short`.

- [ ] **Step 2: Mechanically update imports and identifiers**

```bash
perl -0pi -e 's/@t3tools\\/shared\\/dotcanvas/@t3tools\\/shared\\/assist/g; s/dotcanvasProject/assistProject/g; s/useDotCanvasProjectFlow/useAssistProjectFlow/g; s/DOTCANVAS/ASSIST/g; s/DotCanvas/Assist/g; s/dotcanvas/assist/g' \
  apps/server/src/ws.ts \
  apps/server/src/serverRuntimeStartup.ts \
  apps/server/src/orchestration/commandInvariants.ts \
  apps/server/src/orchestration/decider.ts \
  apps/server/src/orchestration/Layers/ProviderCommandReactor.ts \
  apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts \
  apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.test.ts \
  apps/server/src/orchestration/decider.projectScripts.test.ts \
  apps/web/src/routes/__root.tsx \
  apps/web/src/components/ChatView.tsx \
  apps/web/src/components/ChatView.browser.tsx \
  apps/web/src/components/Sidebar.tsx \
  apps/web/src/hooks/useHandleNewThread.ts \
  apps/web/src/components/ProjectCreationSurface.tsx \
  apps/web/src/assistProject.ts \
  apps/web/src/assistProject.test.ts \
  apps/web/src/hooks/useAssistProjectFlow.ts
```

Expected: runtime checks now compare `project.kind === "assist"` and imports point to `@t3tools/shared/assist`.

- [ ] **Step 3: Correct public copy to `.assist`**

Replace visible strings that now say `Assist` with `.assist` in these files:

```text
apps/server/src/ws.ts
apps/server/src/serverRuntimeStartup.ts
apps/server/src/orchestration/decider.ts
apps/server/src/provider/Layers/ProviderService.ts
apps/server/src/provider/Layers/ClaudeProvider.ts
apps/server/src/provider/Layers/CodexProvider.ts
apps/web/src/components/ChatView.tsx
apps/web/src/components/ChatView.browser.tsx
apps/web/src/components/ProjectCreationSurface.tsx
apps/web/src/components/Sidebar.tsx
apps/web/src/hooks/useAssistProjectFlow.ts
```

Examples of required final copy:

```ts
throw new Error("Finish .assist bootstrap before creating additional threads.");
```

```tsx
title = ".assist is shaping the project room before normal work opens up.";
```

```tsx
title = "Create .assist project";
```

- [ ] **Step 4: Update focused tests**

In `apps/web/src/assistProject.test.ts`, use canonical names:

```ts
import {
  ASSIST_AGENTS_RELATIVE_PATH,
  ASSIST_MEMORY_RELATIVE_PATH,
  ASSIST_OPEN_QUESTIONS_RELATIVE_PATH,
  ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH,
  ASSIST_REQUIRED_SCAFFOLD_PATHS,
  ASSIST_WORKSPACE_MAP_RELATIVE_PATH,
  isAssistBootstrapThread,
  readAssistScaffoldReady,
} from "./assistProject";
```

The bootstrap project test objects must use:

```ts
kind: "assist" as never,
```

The describe block must be:

```ts
describe("isAssistBootstrapThread", () => {
```

- [ ] **Step 5: Run focused runtime tests**

```bash
bun --cwd apps/web run test src/assistProject.test.ts
bun --cwd apps/server run test src/orchestration/decider.projectScripts.test.ts
bun --cwd apps/server run test src/orchestration/Layers/ProviderRuntimeIngestion.test.ts -t "bootstrap"
```

Expected: PASS.

- [ ] **Step 6: Search for stale runtime identifiers**

```bash
rg -n "DotCanvas|DOTCANVAS|dotcanvas|isDotCanvas|useDotCanvas|@t3tools/shared/dotcanvas" apps packages --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/dist-electron/**'
```

Expected: only `packages/shared/src/dotcanvas.ts` compatibility export and migration/test files that explicitly mention legacy `dotcanvas` remain.

- [ ] **Step 7: Commit**

```bash
git add apps packages
git commit -m "refactor: migrate runtime project room naming to assist"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] refactor: migrate runtime project room naming to assist
```

## Task 5: Add Persistence Migration From dotcanvas To assist

**Files:**

- Create: `apps/server/src/persistence/Migrations/024_ProjectKindAssist.ts`
- Create: `apps/server/src/persistence/Migrations/024_ProjectKindAssist.test.ts`
- Modify: `apps/server/src/persistence/Migrations.ts`

- [ ] **Step 1: Write the migration test first**

Create `apps/server/src/persistence/Migrations/024_ProjectKindAssist.test.ts`:

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("024_ProjectKindAssist", (it) => {
  it.effect("migrates persisted dotcanvas project kinds to assist", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 23 });

      yield* sql`
        INSERT INTO projection_projects (
          project_id,
          title,
          workspace_root,
          kind,
          setup_state,
          bootstrap_thread_id,
          default_model_selection_json,
          scripts_json,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (
          'project-legacy',
          'Legacy Project',
          '/tmp/project-legacy',
          'dotcanvas',
          'bootstrapping',
          NULL,
          NULL,
          '[]',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          NULL
        )
      `;

      yield* sql`
        INSERT INTO orchestration_events (
          event_id,
          aggregate_kind,
          stream_id,
          stream_version,
          event_type,
          occurred_at,
          command_id,
          causation_event_id,
          correlation_id,
          actor_kind,
          payload_json,
          metadata_json
        )
        VALUES (
          'event-project-created',
          'project',
          'project-legacy',
          1,
          'project.created',
          '2026-01-01T00:00:00.000Z',
          'command-project-created',
          NULL,
          'correlation-project-created',
          'client',
          '{"projectId":"project-legacy","title":"Legacy Project","workspaceRoot":"/tmp/project-legacy","kind":"dotcanvas","bootstrapState":"bootstrapping","defaultModelSelection":null,"scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 24 });

      const projectionRows = yield* sql<{ readonly kind: string }>`
        SELECT kind FROM projection_projects WHERE project_id = 'project-legacy'
      `;
      assert.deepStrictEqual(projectionRows, [{ kind: "assist" }]);

      const eventRows = yield* sql<{ readonly payloadJson: string }>`
        SELECT payload_json AS "payloadJson"
        FROM orchestration_events
        WHERE event_id = 'event-project-created'
      `;
      const payload = JSON.parse(eventRows[0]!.payloadJson) as { kind?: unknown };
      assert.strictEqual(payload.kind, "assist");
    }),
  );
});
```

- [ ] **Step 2: Run the failing migration test**

```bash
bun --cwd apps/server run test src/persistence/Migrations/024_ProjectKindAssist.test.ts
```

Expected: FAIL because migration `24_ProjectKindAssist` is not registered.

- [ ] **Step 3: Create the migration implementation**

Create `apps/server/src/persistence/Migrations/024_ProjectKindAssist.ts`:

```ts
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE projection_projects
    SET kind = 'assist'
    WHERE kind = 'dotcanvas'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(payload_json, '$.kind', 'assist')
    WHERE json_extract(payload_json, '$.kind') = 'dotcanvas'
  `;
});
```

- [ ] **Step 4: Register migration 24**

In `apps/server/src/persistence/Migrations.ts`, add:

```ts
import Migration0024 from "./Migrations/024_ProjectKindAssist.ts";
```

And add the entry:

```ts
[24, "ProjectKindAssist", Migration0024],
```

The final tail of `migrationEntries` must be:

```ts
  [21, "ProjectionProjectsDotCanvasState", Migration0021],
  [22, "ProjectionProjectsBootstrapThread", Migration0022],
  [23, "LegacyBootstrapCompatibility", Migration0023],
  [24, "ProjectKindAssist", Migration0024],
] as const;
```

- [ ] **Step 5: Run focused migration tests**

```bash
bun --cwd apps/server run test src/persistence/Migrations/024_ProjectKindAssist.test.ts
bun --cwd apps/server run test src/persistence/Migrations/023_LegacyBootstrapCompatibility.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/persistence/Migrations.ts apps/server/src/persistence/Migrations/024_ProjectKindAssist.ts apps/server/src/persistence/Migrations/024_ProjectKindAssist.test.ts
git commit -m "feat: migrate legacy project kind to assist"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] feat: migrate legacy project kind to assist
```

## Task 6: Rebrand Web UI, Logo Wordmark, And Browser Metadata

**Files:**

- Modify: `apps/web/src/branding.ts`
- Modify: `apps/web/src/components/branding/Logo.tsx`
- Modify: `apps/web/src/components/branding/LogoMark.test.tsx`
- Create: `apps/web/src/components/branding/Logo.test.tsx`
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/components/desktopUpdate.logic.test.ts`
- Modify: `apps/web/src/components/desktopUpdate.logic.ts`
- Modify: visible copy in `apps/web/src/components/**`, `apps/web/src/hooks/**`, and `apps/web/src/routes/**`

- [ ] **Step 1: Add a failing logo wordmark test**

Create `apps/web/src/components/branding/Logo.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Logo } from "./Logo";

describe("Logo", () => {
  it("renders the .assist wordmark while keeping the logo mark", () => {
    const html = renderToStaticMarkup(<Logo />);

    expect(html).toContain(".assist");
    expect(html).toContain("<svg");
    expect(html).not.toContain("DOT");
    expect(html).not.toContain("CANVAS");
  });
});
```

- [ ] **Step 2: Run the failing logo test**

```bash
bun --cwd apps/web run test src/components/branding/Logo.test.tsx
```

Expected: FAIL because the current wordmark still renders `DOT` and `CANVAS`.

- [ ] **Step 3: Update app branding constants**

Replace `apps/web/src/branding.ts` with:

```ts
export const APP_BASE_NAME = ".assist";
export const APP_STAGE_LABEL = import.meta.env.DEV ? "Dev" : "Alpha";
export const APP_DISPLAY_NAME = `${APP_BASE_NAME} (${APP_STAGE_LABEL})`;
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
```

- [ ] **Step 4: Update the logo wordmark without changing the mark paths**

In `apps/web/src/components/branding/Logo.tsx`, change only the title text and rendered wordmark.

The compact logo return must be:

```tsx
return <LogoMark size={config.icon} title=".assist" {...(className ? { className } : {})} />;
```

The full logo mark must be:

```tsx
<LogoMark size={config.icon} title=".assist" />
```

The rendered wordmark must be:

```tsx
<span className="font-semibold">.assist</span>
```

The full wordmark block must not contain `DOT` or `CANVAS`.

- [ ] **Step 5: Update logo mark tests**

In `apps/web/src/components/branding/LogoMark.test.tsx`, replace both test titles:

```tsx
<LogoMark title="DotCanvas" />
```

With:

```tsx
<LogoMark title=".assist" />
```

And:

```tsx
<LogoMark variant="foreground" title="DotCanvas" />
```

With:

```tsx
<LogoMark variant="foreground" title=".assist" />
```

- [ ] **Step 6: Update browser document title**

In `apps/web/index.html`, replace:

```html
<title>DotCanvas</title>
```

With:

```html
<title>.assist</title>
```

- [ ] **Step 7: Update visible DotCanvas copy across web**

Run:

```bash
rg -l "DotCanvas" apps/web/src apps/web/index.html --glob '!**/node_modules/**' | xargs perl -0pi -e 's/DotCanvas/\\.assist/g'
```

Then inspect every changed TSX file to make sure identifiers were not damaged:

```bash
rg -n "is\\.assist|use\\.assist|\\.assistProject|ASSIST|DotCanvas|DOTCANVAS" apps/web/src apps/web/index.html --glob '!**/node_modules/**'
```

Expected:

- No `is.assist`, `use.assist`, or `.assistProject` matches
- No `DotCanvas` or `DOTCANVAS` matches
- `ASSIST_*` matches are acceptable only in `assistProject.ts` and its tests

- [ ] **Step 8: Update desktop update confirmation tests and copy**

In `apps/web/src/components/desktopUpdate.logic.test.ts`, replace:

```ts
).toContain("Install update 1.1.1 and restart DotCanvas?");
```

With:

```ts
).toContain("Install update 1.1.1 and restart .assist?");
```

Replace:

```ts
).toContain("Install update and restart DotCanvas?");
```

With:

```ts
).toContain("Install update and restart .assist?");
```

In `apps/web/src/components/desktopUpdate.logic.ts`, update the implementation string to `.assist` so both tests pass.

- [ ] **Step 9: Run focused web branding tests**

```bash
bun --cwd apps/web run test src/components/branding/Logo.test.tsx src/components/branding/LogoMark.test.tsx src/components/desktopUpdate.logic.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat: rebrand web interface to dot assist"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] feat: rebrand web interface to dot assist
```

## Task 7: Apply Non-Purple shadcn Theme And Remove Violet Status Styling

**Files:**

- Modify: `apps/web/src/index.css`
- Modify: `packages/shared/src/branding.ts`
- Modify: `apps/web/src/components/Sidebar.logic.ts`
- Modify: `apps/web/src/components/Sidebar.logic.test.ts`
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/PullRequestThreadDialog.tsx`

- [ ] **Step 1: Apply the selected shadcn preset theme only**

```bash
cd apps/web
bunx --bun shadcn@latest apply b5Kc6P0Vc --only theme -y
cd /Users/harounbaccar/WORKSPACE/other/dotcanvas
```

Expected:

- `apps/web/src/index.css` changes
- `apps/web/components.json` remains `style: "base-mira"` and `iconLibrary: "lucide"`
- No UI component source files are overwritten by the shadcn command

- [ ] **Step 2: Update brand mark color variables away from purple**

In `apps/web/src/index.css`, ensure the brand mark variables are:

```css
--brand-mark-light: #bef264;
--brand-mark-mid: #84cc16;
--brand-mark-dark: #3f6212;
```

In `packages/shared/src/branding.ts`, replace:

```ts
export const BRAND_PRIMARY_BACKGROUND_HEX = "#7c3aed";
```

With:

```ts
export const BRAND_PRIMARY_BACKGROUND_HEX = "#3f6212";
```

- [ ] **Step 3: Replace hardcoded violet status classes**

In `apps/web/src/components/Sidebar.logic.ts`, replace the `Plan Ready` status classes:

```ts
colorClass: "text-violet-600 dark:text-violet-300/90",
dotClass: "bg-violet-500 dark:bg-violet-300/90",
```

With:

```ts
colorClass: "text-lime-700 dark:text-lime-300/90",
dotClass: "bg-lime-600 dark:bg-lime-300/90",
```

In `apps/web/src/components/Sidebar.tsx`, replace any remaining plan-ready violet pair with the same lime classes.

In `apps/web/src/components/PullRequestThreadDialog.tsx`, replace the merged PR indicator:

```ts
return "text-violet-600 dark:text-violet-300/90";
```

With:

```ts
return "text-lime-700 dark:text-lime-300/90";
```

- [ ] **Step 4: Update status tests**

In `apps/web/src/components/Sidebar.logic.test.ts`, replace:

```ts
colorClass: "text-violet-600",
dotClass: "bg-violet-500",
```

With:

```ts
colorClass: "text-lime-700",
dotClass: "bg-lime-600",
```

Replace:

```ts
).toMatchObject({ label: "Plan Ready", dotClass: "bg-violet-500" });
```

With:

```ts
).toMatchObject({ label: "Plan Ready", dotClass: "bg-lime-600" });
```

- [ ] **Step 5: Search for purple/violet leftovers**

```bash
rg -n "violet|purple|#7c3aed|#8f57ef|#a273f2" apps packages scripts --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/dist-electron/**'
```

Expected: no matches in source code. Matches in historical docs or lockfiles are not part of this task.

- [ ] **Step 6: Run focused theme-adjacent tests**

```bash
bun --cwd apps/web run test src/components/Sidebar.logic.test.ts src/components/branding/LogoMark.test.tsx
bun --cwd packages/shared run test
```

Expected:

- Both commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/index.css packages/shared/src/branding.ts apps/web/src/components/Sidebar.logic.ts apps/web/src/components/Sidebar.logic.test.ts apps/web/src/components/Sidebar.tsx apps/web/src/components/PullRequestThreadDialog.tsx apps/web/components.json
git commit -m "style: switch brand theme away from purple"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] style: switch brand theme away from purple
```

## Task 8: Rebrand Marketing Site And Release Links

**Files:**

- Modify: `apps/marketing/src/layouts/Layout.astro`
- Modify: `apps/marketing/src/pages/index.astro`
- Modify: `apps/marketing/src/pages/download.astro`
- Modify: `apps/marketing/src/lib/releases.ts`
- Modify: `.github/workflows/desktop-release-assets.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `docs/release.md`

- [ ] **Step 1: Update marketing layout defaults**

In `apps/marketing/src/layouts/Layout.astro`, set:

```ts
const GITHUB_URL = "https://github.com/harounPapi/.assist";
```

And:

```ts
const {
  title = ".assist",
  description = ".assist turns messy project material into grounded deliverables.",
} = Astro.props;
```

The nav icon alt text must be:

```astro
<img src="/icon.png" alt=".assist" class="nav-icon" />
```

- [ ] **Step 2: Update marketing page copy**

In `apps/marketing/src/pages/index.astro`, replace visible `DotCanvas` with `.assist`, including:

```astro
<span id="download-label">Download .assist</span>
```

And:

```astro
<img src="/screenshot.jpeg" alt=".assist project room" class="screenshot" />
```

In `apps/marketing/src/pages/download.astro`, use:

```astro
<Layout
  title="Download .assist"
  description="Download .assist for macOS or Windows."
>
  <h1 class="heading">Download .assist</h1>
```

- [ ] **Step 3: Update release metadata**

In `apps/marketing/src/lib/releases.ts`, set:

```ts
const REPO = "harounPapi/.assist";
```

And:

```ts
const CACHE_KEY = "assist-latest-release";
```

Set release downloads to `Assist` artifact names:

```ts
export const RELEASE_DOWNLOADS = {
  macArm64Dmg: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/Assist-0.0.15-arm64.dmg`,
  macArm64Zip: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/Assist-0.0.15-arm64.zip`,
  macX64Dmg: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/Assist-0.0.15-x64.dmg`,
  macX64Zip: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/Assist-0.0.15-x64.zip`,
  winX64Exe: `${RELEASES_URL}/download/${CURRENT_RELEASE_TAG}/Assist-0.0.15-x64.exe`,
} as const;
```

- [ ] **Step 4: Update release workflow display names**

In `.github/workflows/desktop-release-assets.yml`, replace release name text with:

```yaml
name: .assist v${{ needs.preflight.outputs.version }}
```

In `.github/workflows/release.yml`, replace release name text with:

```yaml
name: .assist v${{ needs.preflight.outputs.version }}
```

- [ ] **Step 5: Update README**

Replace the top of `README.md` with:

```md
# .assist

.assist is a project-room GUI for coding agents and source-heavy project work.

## Installation

> [!WARNING]
> .assist currently supports Codex and Claude.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://github.com/openai/codex) and run `codex login`
> - Claude: install Claude Code and run `claude auth login`
```

Update the GitHub releases URL to:

```md
[GitHub Releases](https://github.com/harounPapi/.assist/releases)
```

- [ ] **Step 6: Run marketing checks**

```bash
bun run build:marketing
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/marketing README.md docs/release.md .github/workflows/desktop-release-assets.yml .github/workflows/release.yml
git commit -m "feat: rebrand marketing and release metadata"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] feat: rebrand marketing and release metadata
```

## Task 9: Rebrand Desktop App, Runtime Metadata, Storage, And Artifacts

**Files:**

- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/scripts/electron-launcher.mjs`
- Modify: `apps/desktop/scripts/dev-electron.mjs`
- Modify: `turbo.json`
- Modify: `apps/server/src/provider/codexAppServer.ts`
- Modify: `apps/server/src/codexAppServerManager.test.ts`
- Modify: `apps/server/src/cli.ts`
- Modify: `apps/server/src/cli-config.test.ts`
- Modify: `scripts/dev-runner.ts`
- Modify: `scripts/dev-runner.test.ts`
- Modify: `scripts/build-desktop-artifact.ts`
- Modify: `scripts/release-smoke.ts`
- Modify: `scripts/merge-mac-update-manifests.test.ts`
- Modify: `scripts/generate-app-icons.ts`
- Modify: `scripts/lib/brand-assets.ts`

- [ ] **Step 1: Update desktop package product name**

In `apps/desktop/package.json`, replace:

```json
"productName": "DotCanvas"
```

With:

```json
"productName": "Assist"
```

- [ ] **Step 2: Update Electron display names and app IDs**

In `apps/desktop/src/main.ts`, use:

```ts
const BASE_DIR =
  process.env.ASSIST_HOME?.trim() ||
  process.env.T3CODE_HOME?.trim() ||
  Path.join(OS.homedir(), ".assist");
const STATE_DIR = Path.join(BASE_DIR, "userdata");
const DESKTOP_SCHEME = "assist";
const ROOT_DIR = Path.resolve(__dirname, "../../..");
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const APP_DISPLAY_NAME = isDevelopment ? ".assist (Dev)" : ".assist (Alpha)";
const APP_USER_MODEL_ID = "com.harounpapi.assist";
const LINUX_DESKTOP_ENTRY_NAME = isDevelopment ? "assist-dev.desktop" : "assist.desktop";
const LINUX_WM_CLASS = isDevelopment ? "assist-dev" : "assist";
const USER_DATA_DIR_NAME = isDevelopment ? "assist-dev" : "assist";
const LEGACY_USER_DATA_DIR_NAME = isDevelopment ? "t3code-dev" : "t3code";
```

Keep the later existing legacy migration logic that moves `LEGACY_USER_DATA_DIR_NAME` into the new `USER_DATA_DIR_NAME`.

- [ ] **Step 3: Update Electron launcher**

In `apps/desktop/scripts/electron-launcher.mjs`, use:

```js
const APP_DISPLAY_NAME = isDevelopment ? ".assist (Dev)" : ".assist (Alpha)";
const APP_BUNDLE_ID = "com.harounpapi.assist";
```

- [ ] **Step 4: Update dev Electron process marker**

In `apps/desktop/scripts/dev-electron.mjs`, replace `--t3code-dev-root=` with:

```js
`--assist-dev-root=${desktopDir}`;
```

Both the `pkill` pattern and spawned arguments must use `--assist-dev-root=`.

- [ ] **Step 5: Update Codex app-server client info**

In `apps/server/src/provider/codexAppServer.ts`, replace `buildCodexInitializeParams` return value with:

```ts
export function buildCodexInitializeParams() {
  return {
    clientInfo: {
      name: "assist_desktop",
      title: ".assist Desktop",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  } as const;
}
```

Update `apps/server/src/codexAppServerManager.test.ts` expected values:

```ts
name: "assist_desktop",
title: ".assist Desktop",
```

And old-version messages:

```ts
"Codex CLI v0.36.0 is too old for .assist. Upgrade to v0.37.0 or newer and restart .assist.";
```

- [ ] **Step 6: Add `ASSIST_HOME` while preserving `T3CODE_HOME` fallback**

In `scripts/dev-runner.ts`, replace `DEFAULT_T3_HOME` with:

```ts
export const DEFAULT_ASSIST_HOME = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(homedir(), ".assist"),
);
```

Change `resolveBaseDir` signature to:

```ts
function resolveBaseDir(input: {
  readonly assistHome: string | undefined;
  readonly legacyT3Home: string | undefined;
}): Effect.Effect<string, never, Path.Path> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const configured = input.assistHome?.trim() || input.legacyT3Home?.trim();

    if (configured) {
      return path.resolve(configured);
    }

    return yield* DEFAULT_ASSIST_HOME;
  });
}
```

In the environment creation result, set both variables:

```ts
ASSIST_HOME: resolvedBaseDir,
T3CODE_HOME: resolvedBaseDir,
```

Update CLI flag description to:

```ts
Flag.withDescription("Base directory for all .assist data (equivalent to ASSIST_HOME; T3CODE_HOME remains a legacy fallback)."),
```

Add fallback config lookup for `ASSIST_HOME` first and `T3CODE_HOME` second.

In `turbo.json`, add `ASSIST_HOME` next to the existing legacy home variable:

```json
"ASSIST_HOME",
"T3CODE_HOME",
```

- [ ] **Step 7: Update dev-runner tests**

In `scripts/dev-runner.test.ts`, rename tests to say `ASSIST_HOME` and `.assist`, and assert both env variables for compatibility:

```ts
assert.equal(env.ASSIST_HOME, resolve(homedir(), ".assist"));
assert.equal(env.T3CODE_HOME, resolve(homedir(), ".assist"));
```

For custom base dirs:

```ts
assert.equal(env.ASSIST_HOME, resolve("/tmp/custom-assist"));
assert.equal(env.T3CODE_HOME, resolve("/tmp/custom-assist"));
```

- [ ] **Step 8: Update server CLI env support**

In `apps/server/src/cli.ts`, read `ASSIST_HOME` before `T3CODE_HOME`:

```ts
t3Home: Config.string("ASSIST_HOME").pipe(
  Config.option,
  Config.map(Option.getOrUndefined),
  Config.orElse(() => Config.string("T3CODE_HOME").pipe(Config.option, Config.map(Option.getOrUndefined))),
),
```

Update descriptions from `T3CODE_HOME` to `ASSIST_HOME` with legacy fallback text.

- [ ] **Step 9: Update desktop artifact config**

In `scripts/build-desktop-artifact.ts`, change build config:

```ts
appId: "com.harounpapi.assist",
artifactName: "Assist-${version}-${arch}.${ext}",
```

Linux config:

```ts
executableName: "assist",
desktop: {
  entry: {
    StartupWMClass: "assist",
  },
},
```

Stage root prefix:

```ts
prefix: `assist-desktop-${options.platform}-stage-`,
```

Stage package JSON:

```ts
name: "assist",
assistCommitHash: commitHash,
description: ".assist desktop build",
```

Keep `t3codeCommitHash` for one release only if `apps/desktop/src/main.ts` still reads it. If both are present, write both:

```ts
assistCommitHash: commitHash,
t3codeCommitHash: commitHash,
```

- [ ] **Step 10: Update release smoke and manifest tests**

In `scripts/release-smoke.ts` and `scripts/merge-mac-update-manifests.test.ts`, replace artifact names such as:

```text
T3-Code-9.9.9-smoke.0-arm64.zip
```

With:

```text
Assist-9.9.9-smoke.0-arm64.zip
```

Repeat for `.dmg`, `.exe`, x64, and arm64 entries.

- [ ] **Step 11: Run desktop and script tests**

```bash
bun --cwd apps/desktop run test src
bun --cwd apps/server run test src/codexAppServerManager.test.ts src/cli-config.test.ts
bun --cwd scripts run test dev-runner.test.ts merge-mac-update-manifests.test.ts release-smoke.ts
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/desktop apps/server scripts
git commit -m "feat: rebrand desktop runtime to assist"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] feat: rebrand desktop runtime to assist
```

## Task 10: Final Source Sweep And Quality Gates

**Files:**

- Modify: any source file found by the sweeps below that still contains stale names outside intentional compatibility references

- [ ] **Step 1: Search stale DotCanvas and T3 Code references**

```bash
rg -n "DotCanvas|DOTCANVAS|dotcanvas|T3 Code|T3-Code|t3code|T3CODE_HOME" apps packages scripts docs README.md .github package.json --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/dist-electron/**' --glob '!**/.turbo/**' --glob '!bun.lock'
```

Expected remaining matches only in:

- Legacy migration SQL/tests that explicitly migrate `dotcanvas`
- Compatibility export `packages/shared/src/dotcanvas.ts`
- Documentation lines explaining `T3CODE_HOME` as a legacy fallback

- [ ] **Step 2: Search stale purple references**

```bash
rg -n "violet|purple|#7c3aed|#8f57ef|#a273f2" apps packages scripts docs README.md --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/dist-electron/**' --glob '!**/.turbo/**' --glob '!bun.lock'
```

Expected: no matches in active source. Historical prose can remain only if it describes the old theme.

- [ ] **Step 3: Format**

```bash
bun fmt
```

Expected: PASS.

- [ ] **Step 4: Lint**

```bash
bun lint
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
bun typecheck
```

Expected: PASS.

- [ ] **Step 6: Full test suite**

Use `bun run test`, not `bun test`.

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 7: Build desktop and marketing artifacts**

```bash
bun run build:marketing
bun run build:desktop
```

Expected: PASS.

- [ ] **Step 8: Commit final source fixes**

If any sweep or quality gate produced additional fixes:

```bash
git add apps packages scripts docs README.md .github package.json bun.lock
git commit -m "chore: finish assist rebrand cleanup"
```

Expected:

```text
[harounPapi/dotassist-rebrand ...] chore: finish assist rebrand cleanup
```

If no files changed, skip this step.

## Task 11: Browser Verification

**Files:**

- Modify: none unless verification finds a UI issue

- [ ] **Step 1: Start the web app**

```bash
bun run dev:web
```

Expected: Vite starts, normally at `http://localhost:5733` or an offset port chosen by the dev runner.

- [ ] **Step 2: Open the app in the Codex Browser plugin**

Navigate to the Vite URL from Step 1.

Expected:

- Sidebar/logo renders `.assist`
- Logo mark shape is unchanged
- Primary color is lime/olive, not purple
- No visible `DotCanvas` or `T3 Code` text appears in normal first-screen UI
- Project creation copy says `.assist`

- [ ] **Step 3: Capture screenshots**

Capture:

- Desktop viewport around 1440x900
- Mobile viewport around 390x844

Expected:

- `.assist` wordmark fits without clipping
- Sidebar status pills do not overlap text
- Project creation cards remain readable
- No purple primary controls remain

- [ ] **Step 4: Stop the dev server**

Stop the `bun run dev:web` process with Ctrl-C.

Expected: no long-running dev server remains.

## Task 12: Push Branch And Rename GitHub Repository

**Files:**

- Modify: Git remote configuration after GitHub rename

- [ ] **Step 1: Verify GitHub CLI accounts**

```bash
gh auth status
```

Expected:

- Account `harounPapi` is authenticated
- Token has `repo` scope

If `harounPapi` is not active, switch to it:

```bash
gh auth switch --hostname github.com --user harounPapi
```

Expected:

```text
✓ Switched active account for github.com to harounPapi
```

- [ ] **Step 2: Push the implementation branch before repo rename**

```bash
git push -u origin harounPapi/dotassist-rebrand
```

Expected: branch is pushed to `harounPapi/dotassist-rebrand`.

- [ ] **Step 3: Confirm target repo name is free**

```bash
gh repo view harounPapi/.assist --json nameWithOwner
```

Expected:

```text
GraphQL: Could not resolve to a Repository
```

If it resolves to an existing repository, stop and ask the user whether to use `.assist-app`, `dotassist`, or another available name.

- [ ] **Step 4: Rename the GitHub repository**

```bash
gh repo rename .assist --repo harounPapi/dotcanvas --yes
```

Expected:

```text
✓ Renamed repository harounPapi/dotcanvas to harounPapi/.assist
```

If GitHub rejects a leading-dot repository name, stop and ask the user for a repository-safe fallback name before changing local remotes.

- [ ] **Step 5: Update origin remote**

```bash
git remote set-url origin https://github.com/harounPapi/.assist.git
git remote -v
```

Expected:

```text
origin  https://github.com/harounPapi/.assist.git (fetch)
origin  https://github.com/harounPapi/.assist.git (push)
```

- [ ] **Step 6: Push branch to renamed repository**

```bash
git push -u origin harounPapi/dotassist-rebrand
```

Expected: branch pushes successfully to the renamed repository.

## Task 13: Rename Local Workspace Folder

**Files:**

- Modify: local filesystem path outside git

- [ ] **Step 1: Leave the repository directory**

```bash
cd /Users/harounbaccar/WORKSPACE/other
```

Expected:

```text
/Users/harounbaccar/WORKSPACE/other
```

- [ ] **Step 2: Rename the folder**

```bash
mv dotcanvas .assist
```

Expected: `/Users/harounbaccar/WORKSPACE/other/.assist` exists.

- [ ] **Step 3: Verify git still works from the new hidden folder**

```bash
cd /Users/harounbaccar/WORKSPACE/other/.assist
git status --short --branch
git remote -v
```

Expected:

```text
## harounPapi/dotassist-rebrand...origin/harounPapi/dotassist-rebrand
origin  https://github.com/harounPapi/.assist.git (fetch)
origin  https://github.com/harounPapi/.assist.git (push)
```

- [ ] **Step 4: Tell the user to reopen the workspace from the new path**

After this step, the active Codex desktop thread may still point at `/Users/harounbaccar/WORKSPACE/other/dotcanvas`. Continue only if commands are running inside:

```text
/Users/harounbaccar/WORKSPACE/other/.assist
```

## Task 14: Final Completion Checks

**Files:**

- Modify: none unless final checks reveal a fix

- [ ] **Step 1: Re-run required quality gates from the renamed folder**

```bash
cd /Users/harounbaccar/WORKSPACE/other/.assist
bun fmt
bun lint
bun typecheck
```

Expected: all pass.

- [ ] **Step 2: Re-run tests from the renamed folder**

Use `bun run test`, not `bun test`.

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 3: Final stale-name sweep**

```bash
rg -n "DotCanvas|DOTCANVAS|dotcanvas|T3 Code|T3-Code|t3code|T3CODE_HOME|violet|purple|#7c3aed|#8f57ef|#a273f2" apps packages scripts docs README.md .github package.json --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/dist-electron/**' --glob '!**/.turbo/**' --glob '!bun.lock'
```

Expected remaining matches only in:

- Legacy compatibility migration/tests
- Compatibility export file
- Documentation that explicitly names old env vars as legacy fallbacks

- [ ] **Step 4: Create final commit if needed**

If final renamed-folder checks caused file changes:

```bash
git add apps packages scripts docs README.md .github package.json bun.lock
git commit -m "chore: verify assist rename from new workspace"
git push
```

Expected: commit and push succeed.

If no files changed:

```bash
git push
```

Expected: push succeeds or reports everything is already up to date.

## Self-Review

Spec coverage:

- Rebrand `.canvas`/DotCanvas visible copy to `.assist`: covered by Tasks 4, 6, 8, 9, and 10.
- Keep logo mark shape unchanged: covered by Tasks 6 and 7; `BRAND_MARK_PATHS` is not changed.
- Replace purple with another shadcn theme: covered by Task 7 using preset `b5Kc6P0Vc` theme-only.
- Rename internal runtime concepts robustly: covered by Tasks 2, 3, 4, and 5.
- Rename GitHub repo and local folder: covered by Tasks 12 and 13.
- Required checks `bun fmt`, `bun lint`, `bun typecheck`: covered by Tasks 10 and 14.
- Use `bun run test`, never `bun test`: included in every test step.

Placeholder scan:

- No placeholder or deferred implementation markers remain in this plan.
- Conditional stops are explicit where external systems can reject an operation, such as a leading-dot GitHub repo name.

Type consistency:

- Canonical project kind is consistently `"assist"`.
- Legacy persistence string is consistently `"dotcanvas"`.
- Shared helpers are consistently named `ASSIST_*`, `buildAssist*`, and `parseAssist*`.
- Web project helpers are consistently named `assistProject`, `isAssist*`, and `readAssist*`.
