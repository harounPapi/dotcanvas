import { Effect, FileSystem, Layer, Path } from "effect";

import {
  WorkspaceFileSystem,
  WorkspaceFileSystemError,
  type WorkspaceFileSystemShape,
} from "../Services/WorkspaceFileSystem.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

export const makeWorkspaceFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;

  const createDirectory: WorkspaceFileSystemShape["createDirectory"] = Effect.fn(
    "WorkspaceFileSystem.createDirectory",
  )(function* (input) {
    const parentPath = yield* workspacePaths.normalizeWorkspaceRoot(input.parentPath).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.parentPath,
            operation: "workspaceFileSystem.normalizeParentPath",
            detail: cause.message,
            cause,
          }),
      ),
    );

    const directoryName = input.directoryName.trim();
    if (directoryName.length === 0) {
      return yield* new WorkspaceFileSystemError({
        cwd: parentPath,
        operation: "workspaceFileSystem.createDirectory",
        detail: "Directory name must not be blank.",
      });
    }
    if (directoryName.includes("/") || directoryName.includes("\\")) {
      return yield* new WorkspaceFileSystemError({
        cwd: parentPath,
        operation: "workspaceFileSystem.createDirectory",
        detail: "Directory name must not contain path separators.",
      });
    }
    if (directoryName === "." || directoryName === "..") {
      return yield* new WorkspaceFileSystemError({
        cwd: parentPath,
        operation: "workspaceFileSystem.createDirectory",
        detail: "Directory name must not be '.' or '..'.",
      });
    }

    const workspaceRoot = path.resolve(parentPath, directoryName);
    const existing = yield* fileSystem
      .stat(workspaceRoot)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (existing) {
      return yield* new WorkspaceFileSystemError({
        cwd: parentPath,
        operation: "workspaceFileSystem.createDirectory",
        detail: `Directory already exists: ${workspaceRoot}`,
      });
    }

    yield* fileSystem.makeDirectory(workspaceRoot, { recursive: false }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: parentPath,
            operation: "workspaceFileSystem.createDirectory",
            detail: cause.message,
            cause,
          }),
      ),
    );

    yield* Effect.all([
      workspaceEntries.invalidate(parentPath),
      workspaceEntries.invalidate(workspaceRoot),
    ]).pipe(Effect.ignore);

    return { workspaceRoot };
  });

  const statPath: WorkspaceFileSystemShape["statPath"] = Effect.fn("WorkspaceFileSystem.statPath")(
    function* (input) {
      const cwd = yield* workspacePaths.normalizeWorkspaceRoot(input.cwd).pipe(
        Effect.mapError(
          (cause) =>
            new WorkspaceFileSystemError({
              cwd: input.cwd,
              relativePath: input.relativePath,
              operation: "workspaceFileSystem.normalizeWorkspaceRoot",
              detail: cause.message,
              cause,
            }),
        ),
      );
      const target = yield* workspacePaths.resolveRelativePathWithinRoot({
        workspaceRoot: cwd,
        relativePath: input.relativePath,
      });
      const existing = yield* fileSystem
        .stat(target.absolutePath)
        .pipe(Effect.catch(() => Effect.succeed(null)));

      if (!existing) {
        return {
          relativePath: target.relativePath,
          exists: false,
        };
      }

      return {
        relativePath: target.relativePath,
        exists: true,
        ...(existing.type === "File"
          ? { kind: "file" as const }
          : existing.type === "Directory"
            ? { kind: "directory" as const }
            : {}),
      };
    },
  );

  const writeFile: WorkspaceFileSystemShape["writeFile"] = Effect.fn(
    "WorkspaceFileSystem.writeFile",
  )(function* (input) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    yield* fileSystem.makeDirectory(path.dirname(target.absolutePath), { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.makeDirectory",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* fileSystem.writeFileString(target.absolutePath, input.contents).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.writeFile",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* workspaceEntries.invalidate(input.cwd);
    return { relativePath: target.relativePath };
  });
  return { createDirectory, statPath, writeFile } satisfies WorkspaceFileSystemShape;
});

export const WorkspaceFileSystemLive = Layer.effect(WorkspaceFileSystem, makeWorkspaceFileSystem);
