import { describe, expect, it, vi } from "vitest";

import {
  DOTCANVAS_AGENTS_RELATIVE_PATH,
  DOTCANVAS_MEMORY_RELATIVE_PATH,
  DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH,
  DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH,
  DOTCANVAS_REQUIRED_SCAFFOLD_PATHS,
  DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH,
  isDotCanvasBootstrapThread,
  readDotCanvasScaffoldReady,
} from "./dotcanvasProject";

describe("readDotCanvasScaffoldReady", () => {
  it("returns true only when every required scaffold path exists with the expected kind", async () => {
    const statPath = vi.fn(async ({ relativePath }: { cwd: string; relativePath: string }) => {
      switch (relativePath) {
        case DOTCANVAS_AGENTS_RELATIVE_PATH:
        case DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH:
        case DOTCANVAS_MEMORY_RELATIVE_PATH:
        case DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH:
        case DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH:
          return { relativePath, exists: true, kind: "file" as const };
        default:
          return { relativePath, exists: false };
      }
    });

    await expect(
      readDotCanvasScaffoldReady({
        cwd: "/tmp/project",
        statPath,
      }),
    ).resolves.toBe(true);
    expect(statPath).toHaveBeenCalledTimes(DOTCANVAS_REQUIRED_SCAFFOLD_PATHS.length);
  });

  it("returns false when any scaffold path is missing or has the wrong kind", async () => {
    const statPath = vi.fn(async ({ relativePath }: { cwd: string; relativePath: string }) => {
      if (relativePath === DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH) {
        return { relativePath, exists: true, kind: "directory" as const };
      }
      return { relativePath, exists: true, kind: "file" as const };
    });

    await expect(
      readDotCanvasScaffoldReady({
        cwd: "/tmp/project",
        statPath,
      }),
    ).resolves.toBe(false);
  });
});

describe("isDotCanvasBootstrapThread", () => {
  it("matches the designated bootstrap thread", () => {
    expect(
      isDotCanvasBootstrapThread({
        thread: { id: "thread-1" as never },
        project: {
          kind: "dotcanvas" as never,
          bootstrapState: "bootstrapping" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(true);
  });

  it("returns false when the project does not point at the thread", () => {
    expect(
      isDotCanvasBootstrapThread({
        thread: { id: "thread-2" as never },
        project: {
          kind: "dotcanvas" as never,
          bootstrapState: "bootstrapping" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(false);
  });

  it("returns false once the bootstrap project is ready", () => {
    expect(
      isDotCanvasBootstrapThread({
        thread: { id: "thread-1" as never },
        project: {
          kind: "dotcanvas" as never,
          bootstrapState: "ready" as never,
          bootstrapThreadId: "thread-1" as never,
        },
      }),
    ).toBe(false);
  });
});
