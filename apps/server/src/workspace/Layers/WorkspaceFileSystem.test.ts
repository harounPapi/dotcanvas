import * as NodeServices from "@effect/platform-node/NodeServices";
import { it, describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Option, Path } from "effect";

import { ServerConfig } from "../../config.ts";
import { GitCoreLive } from "../../git/Layers/GitCore.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspaceFileSystem, WorkspaceFileSystemError } from "../Services/WorkspaceFileSystem.ts";
import { WorkspacePathOutsideRootError } from "../Services/WorkspacePaths.ts";
import { WorkspaceEntriesLive } from "./WorkspaceEntries.ts";
import { WorkspaceFileSystemLive } from "./WorkspaceFileSystem.ts";
import { WorkspacePathsLive } from "./WorkspacePaths.ts";

const ProjectLayer = WorkspaceFileSystemLive.pipe(
  Layer.provide(WorkspacePathsLive),
  Layer.provide(WorkspaceEntriesLive.pipe(Layer.provide(WorkspacePathsLive))),
);

const TestLayer = Layer.empty.pipe(
  Layer.provideMerge(ProjectLayer),
  Layer.provideMerge(WorkspaceEntriesLive.pipe(Layer.provide(WorkspacePathsLive))),
  Layer.provideMerge(WorkspacePathsLive),
  Layer.provideMerge(GitCoreLive),
  Layer.provide(
    ServerConfig.layerTest(process.cwd(), {
      prefix: "t3-workspace-files-test-",
    }),
  ),
  Layer.provideMerge(NodeServices.layer),
);

const makeTempDir = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* fileSystem.makeTempDirectoryScoped({
    prefix: "t3code-workspace-files-",
  });
});

const writeTextFile = Effect.fn("writeTextFile")(function* (
  cwd: string,
  relativePath: string,
  contents = "",
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(cwd, relativePath);
  yield* fileSystem
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(Effect.orDie);
  yield* fileSystem.writeFileString(absolutePath, contents).pipe(Effect.orDie);
});

function detailOf(error: WorkspaceFileSystemError | WorkspacePathOutsideRootError): string {
  return "detail" in error ? error.detail : error.message;
}

it.layer(TestLayer)("WorkspaceFileSystemLive", (it) => {
  describe("createDirectory", () => {
    it.effect("creates a child directory inside the chosen parent", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parentPath = yield* makeTempDir;

        const result = yield* workspaceFileSystem.createDirectory({
          parentPath,
          directoryName: "dotcanvas-project",
        });

        expect(result.workspaceRoot).toBe(path.join(parentPath, "dotcanvas-project"));
        const created = yield* fileSystem.stat(result.workspaceRoot).pipe(Effect.orDie);
        expect(created.type).toBe("Directory");
      }),
    );

    it.effect("rejects duplicate project directories", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const parentPath = yield* makeTempDir;

        yield* workspaceFileSystem.createDirectory({
          parentPath,
          directoryName: "dotcanvas-project",
        });

        const error = yield* workspaceFileSystem
          .createDirectory({
            parentPath,
            directoryName: "dotcanvas-project",
          })
          .pipe(Effect.flip);

        expect(error.detail).toContain("Directory already exists");
      }),
    );

    it.effect("rejects blank names and path separators", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const parentPath = yield* makeTempDir;

        const blankError = yield* workspaceFileSystem
          .createDirectory({
            parentPath,
            directoryName: "   ",
          })
          .pipe(Effect.flip);
        expect(blankError.detail).toContain("must not be blank");

        const separatorError = yield* workspaceFileSystem
          .createDirectory({
            parentPath,
            directoryName: "nested/project",
          })
          .pipe(Effect.flip);
        expect(separatorError.detail).toContain("must not contain path separators");
      }),
    );
  });

  describe("writeFile", () => {
    it.effect("writes files relative to the workspace root", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const result = yield* workspaceFileSystem.writeFile({
          cwd,
          relativePath: "plans/effect-rpc.md",
          contents: "# Plan\n",
        });
        const saved = yield* fileSystem
          .readFileString(path.join(cwd, "plans/effect-rpc.md"))
          .pipe(Effect.orDie);

        expect(result).toEqual({ relativePath: "plans/effect-rpc.md" });
        expect(saved).toBe("# Plan\n");
      }),
    );

    it.effect("invalidates workspace entry search cache after writes", () =>
      Effect.gen(function* () {
        const workspaceEntries = yield* WorkspaceEntries;
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;
        yield* writeTextFile(cwd, "src/existing.ts", "export {};\n");

        const beforeWrite = yield* workspaceEntries.search({
          cwd,
          query: "rpc",
          limit: 10,
        });
        expect(beforeWrite).toEqual({
          entries: [],
          truncated: false,
        });

        yield* workspaceFileSystem.writeFile({
          cwd,
          relativePath: "plans/effect-rpc.md",
          contents: "# Plan\n",
        });

        const afterWrite = yield* workspaceEntries.search({
          cwd,
          query: "rpc",
          limit: 10,
        });
        expect(afterWrite.entries).toEqual(
          expect.arrayContaining([expect.objectContaining({ path: "plans/effect-rpc.md" })]),
        );
        expect(afterWrite.truncated).toBe(false);
      }),
    );

    it.effect("rejects writes outside the workspace root", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;
        const path = yield* Path.Path;
        const fileSystem = yield* FileSystem.FileSystem;

        const error = yield* workspaceFileSystem
          .writeFile({
            cwd,
            relativePath: "../escape.md",
            contents: "# nope\n",
          })
          .pipe(Effect.flip);

        expect(error.message).toContain(
          "Workspace file path must be relative to the project root: ../escape.md",
        );

        const escapedPath = path.resolve(cwd, "..", "escape.md");
        const escapedStat = yield* fileSystem
          .stat(escapedPath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        expect(escapedStat).toBeNull();
      }),
    );

    it.effect("rejects writes when the file changed on disk", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cwd = yield* makeTempDir;
        const relativePath = "notes/plan.md";
        const absolutePath = path.join(cwd, relativePath);

        yield* writeTextFile(cwd, relativePath, "# First\n");
        const initialStat = yield* fileSystem.stat(absolutePath).pipe(Effect.orDie);
        const initialMtimeMs = Math.trunc(
          Option.getOrElse(initialStat.mtime, () => new Date(0)).getTime(),
        );
        const staleExpectedMtimeMs = initialMtimeMs > 0 ? initialMtimeMs - 1 : initialMtimeMs + 1;

        yield* fileSystem.writeFileString(absolutePath, "# Second\n").pipe(Effect.orDie);

        const error = yield* workspaceFileSystem
          .writeFile({
            cwd,
            relativePath,
            contents: "# Third\n",
            expectedMtimeMs: staleExpectedMtimeMs,
          })
          .pipe(Effect.flip);

        expect(error.message).toBe("Workspace file was modified on disk.");
      }),
    );
  });

  describe("statPath", () => {
    it.effect("reports file and directory kinds within the workspace root", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeTextFile(cwd, "DotCanvas/project-brief.md", "# Brief\n");

        const fileStat = yield* workspaceFileSystem.statPath({
          cwd,
          relativePath: "DotCanvas/project-brief.md",
        });
        const directoryStat = yield* workspaceFileSystem.statPath({
          cwd,
          relativePath: "DotCanvas",
        });

        expect(fileStat).toEqual({
          relativePath: "DotCanvas/project-brief.md",
          exists: true,
          kind: "file",
        });
        expect(directoryStat).toEqual({
          relativePath: "DotCanvas",
          exists: true,
          kind: "directory",
        });
      }),
    );

    it.effect("reports missing paths without failing", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;

        const stat = yield* workspaceFileSystem.statPath({
          cwd,
          relativePath: "DotCanvas/memory.md",
        });

        expect(stat).toEqual({
          relativePath: "DotCanvas/memory.md",
          exists: false,
        });
      }),
    );
  });

  describe("readFile", () => {
    it.effect("reads text files with metadata", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const cwd = yield* makeTempDir;

        yield* writeTextFile(cwd, "notes/plan.md", "# Plan\n");

        const result = yield* workspaceFileSystem.readFile({
          cwd,
          relativePath: "notes/plan.md",
        });

        expect(result.relativePath).toBe("notes/plan.md");
        expect(result.contents).toBe("# Plan\n");
        expect(result.sizeBytes).toBeGreaterThan(0);
        expect(result.mtimeMs).toBeGreaterThan(0);
      }),
    );

    it.effect("rejects directories, oversized files, and binary files", () =>
      Effect.gen(function* () {
        const workspaceFileSystem = yield* WorkspaceFileSystem;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cwd = yield* makeTempDir;

        yield* fileSystem
          .makeDirectory(path.join(cwd, "notes"), { recursive: true })
          .pipe(Effect.orDie);
        yield* fileSystem
          .writeFileString(path.join(cwd, "notes", "large.md"), "a".repeat(600_000))
          .pipe(Effect.orDie);
        yield* fileSystem
          .writeFile(path.join(cwd, "notes", "binary.md"), Uint8Array.from([0, 159, 146, 150]))
          .pipe(Effect.orDie);

        const directoryError = yield* workspaceFileSystem
          .readFile({
            cwd,
            relativePath: "notes",
          })
          .pipe(Effect.flip);
        expect(detailOf(directoryError)).toContain("Path is not a file");

        const largeError = yield* workspaceFileSystem
          .readFile({
            cwd,
            relativePath: "notes/large.md",
          })
          .pipe(Effect.flip);
        expect(detailOf(largeError)).toContain("File is too large to open in Room");

        const binaryError = yield* workspaceFileSystem
          .readFile({
            cwd,
            relativePath: "notes/binary.md",
          })
          .pipe(Effect.flip);
        expect(detailOf(binaryError)).toContain("File is not valid UTF-8 text");
      }),
    );
  });
});
