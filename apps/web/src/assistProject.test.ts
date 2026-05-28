import { describe, expect, it, vi } from "vitest";

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

describe("readAssistScaffoldReady", () => {
  it("returns true only when every required scaffold path exists with the expected kind", async () => {
    const statPath = vi.fn(async ({ relativePath }: { cwd: string; relativePath: string }) => {
      switch (relativePath) {
        case ASSIST_AGENTS_RELATIVE_PATH:
        case ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH:
        case ASSIST_MEMORY_RELATIVE_PATH:
        case ASSIST_WORKSPACE_MAP_RELATIVE_PATH:
        case ASSIST_OPEN_QUESTIONS_RELATIVE_PATH:
          return { relativePath, exists: true, kind: "file" as const };
        default:
          return { relativePath, exists: false };
      }
    });

    await expect(
      readAssistScaffoldReady({
        cwd: "/tmp/project",
        statPath,
      }),
    ).resolves.toBe(true);
    expect(statPath).toHaveBeenCalledTimes(ASSIST_REQUIRED_SCAFFOLD_PATHS.length);
  });

  it("returns false when any scaffold path is missing or has the wrong kind", async () => {
    const statPath = vi.fn(async ({ relativePath }: { cwd: string; relativePath: string }) => {
      if (relativePath === ASSIST_WORKSPACE_MAP_RELATIVE_PATH) {
        return { relativePath, exists: true, kind: "directory" as const };
      }
      return { relativePath, exists: true, kind: "file" as const };
    });

    await expect(
      readAssistScaffoldReady({
        cwd: "/tmp/project",
        statPath,
      }),
    ).resolves.toBe(false);
  });
});

describe("isAssistBootstrapThread", () => {
  it("matches the designated bootstrap thread", () => {
    expect(
      isAssistBootstrapThread({
        thread: { id: "thread-1" as never },
        project: {
          kind: "assist" as never,
          bootstrapState: "bootstrapping" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(true);
  });

  it("returns false when the project does not point at the thread", () => {
    expect(
      isAssistBootstrapThread({
        thread: { id: "thread-2" as never },
        project: {
          kind: "assist" as never,
          bootstrapState: "bootstrapping" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(false);
  });

  it("returns false once the bootstrap project is ready", () => {
    expect(
      isAssistBootstrapThread({
        thread: { id: "thread-1" as never },
        project: {
          kind: "assist" as never,
          bootstrapState: "ready" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(false);
  });
});
