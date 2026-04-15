import { Effect, FileSystem, Layer, Option, Path } from "effect";

import { PROJECT_READ_FILE_MAX_BYTES } from "@t3tools/contracts";

import {
  WorkspaceFileSystem,
  WorkspaceFileSystemError,
  WorkspaceFileSystemWriteConflictError,
  type WorkspaceFileSystemShape,
} from "../Services/WorkspaceFileSystem.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

function isBinaryText(contents: string, bytes: Uint8Array) {
  if (bytes.includes(0)) {
    return true;
  }

  for (let index = 0; index < contents.length; index += 1) {
    const codePoint = contents.charCodeAt(index);
    if (
      codePoint < 32 &&
      codePoint !== 9 &&
      codePoint !== 10 &&
      codePoint !== 13 &&
      codePoint !== 12
    ) {
      return true;
    }
  }

  return false;
}

export const makeWorkspaceFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;
  const textDecoder = new TextDecoder("utf-8", { fatal: true });

  const statOrNull = (absolutePath: string) =>
    fileSystem.stat(absolutePath).pipe(Effect.catch(() => Effect.succeed(null)));

  const mtimeMsOf = (mtime: Option.Option<Date>) => {
    const date = Option.getOrUndefined(mtime);
    return date ? Math.max(0, Math.trunc(date.getTime())) : 0;
  };

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
    const existing = yield* statOrNull(workspaceRoot);
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

  const readFile: WorkspaceFileSystemShape["readFile"] = Effect.fn("WorkspaceFileSystem.readFile")(
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
      const existing = yield* statOrNull(target.absolutePath);

      if (!existing) {
        return yield* new WorkspaceFileSystemError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readFile",
          detail: `File does not exist: ${target.relativePath}`,
        });
      }

      if (existing.type !== "File") {
        return yield* new WorkspaceFileSystemError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readFile",
          detail: `Path is not a file: ${target.relativePath}`,
        });
      }

      if (existing.size > PROJECT_READ_FILE_MAX_BYTES) {
        return yield* new WorkspaceFileSystemError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readFile",
          detail: `File is too large to open in Room: ${target.relativePath}`,
        });
      }

      const bytes = yield* fileSystem.readFile(target.absolutePath).pipe(
        Effect.mapError(
          (cause) =>
            new WorkspaceFileSystemError({
              cwd,
              relativePath: input.relativePath,
              operation: "workspaceFileSystem.readFile",
              detail: cause.message,
              cause,
            }),
        ),
      );

      const contents = yield* Effect.try({
        try: () => textDecoder.decode(bytes),
        catch: (cause) =>
          new WorkspaceFileSystemError({
            cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.readFile",
            detail: `File is not valid UTF-8 text: ${target.relativePath}`,
            cause,
          }),
      });

      if (isBinaryText(contents, bytes)) {
        return yield* new WorkspaceFileSystemError({
          cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.readFile",
          detail: `File is not a supported text document: ${target.relativePath}`,
        });
      }

      return {
        relativePath: target.relativePath,
        contents,
        sizeBytes: Number(existing.size),
        mtimeMs: mtimeMsOf(existing.mtime),
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
    const existing =
      input.expectedMtimeMs === undefined ? null : yield* statOrNull(target.absolutePath);

    if (existing && existing.type !== "File") {
      return yield* new WorkspaceFileSystemError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        operation: "workspaceFileSystem.writeFile",
        detail: `Path is not a file: ${target.relativePath}`,
      });
    }

    if (input.expectedMtimeMs !== undefined) {
      const actualMtimeMs = existing ? mtimeMsOf(existing.mtime) : undefined;
      if (!existing || actualMtimeMs !== input.expectedMtimeMs) {
        return yield* new WorkspaceFileSystemWriteConflictError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          expectedMtimeMs: input.expectedMtimeMs,
          ...(actualMtimeMs === undefined ? {} : { actualMtimeMs }),
        });
      }
    }

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
  return { createDirectory, statPath, readFile, writeFile } satisfies WorkspaceFileSystemShape;
});

export const WorkspaceFileSystemLive = Layer.effect(WorkspaceFileSystem, makeWorkspaceFileSystem);
