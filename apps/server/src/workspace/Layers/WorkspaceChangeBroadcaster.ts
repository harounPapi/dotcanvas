import { Duration, Effect, Exit, FileSystem, Layer, Path, PubSub, Scope, Stream } from "effect";

import type { ProjectWorkspaceChangeEvent, ProjectWorkspaceWatchInput } from "@t3tools/contracts";

import {
  WorkspaceChangeBroadcaster,
  WorkspaceChangeBroadcasterError,
  type WorkspaceChangeBroadcasterShape,
} from "../Services/WorkspaceChangeBroadcaster.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

interface WatchTarget {
  readonly absolutePath: string;
  readonly directoryPath: string | undefined;
}

function toPosixPath(input: string): string {
  return input.replaceAll("\\", "/");
}

function parentPathOf(relativePath: string | undefined): string | undefined {
  if (!relativePath) {
    return undefined;
  }

  const normalizedPath = toPosixPath(relativePath).replace(/\/+$/, "");
  const separatorIndex = normalizedPath.lastIndexOf("/");
  if (separatorIndex === -1) {
    return undefined;
  }

  return normalizedPath.slice(0, separatorIndex);
}

export const makeWorkspaceChangeBroadcaster = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;

  const toError = (
    input: Pick<ProjectWorkspaceWatchInput, "cwd">,
    operation: string,
    cause: unknown,
  ) =>
    new WorkspaceChangeBroadcasterError({
      cwd: input.cwd,
      operation,
      detail: cause instanceof Error ? cause.message : String(cause),
      cause,
    });

  const resolveWatchTargets = Effect.fn("WorkspaceChangeBroadcaster.resolveWatchTargets")(
    function* (input: ProjectWorkspaceWatchInput) {
      const workspaceRoot = yield* workspacePaths.normalizeWorkspaceRoot(input.cwd).pipe(
        Effect.mapError(
          (cause) =>
            new WorkspaceChangeBroadcasterError({
              cwd: input.cwd,
              operation: "workspaceChangeBroadcaster.normalizeWorkspaceRoot",
              detail: cause.message,
              cause,
            }),
        ),
      );

      const candidateDirectoryPaths = new Set<string>();
      for (const directoryPath of input.directoryPaths ?? []) {
        candidateDirectoryPaths.add(directoryPath);
      }

      const selectedParentPath = parentPathOf(input.selectedFilePath);
      if (selectedParentPath) {
        candidateDirectoryPaths.add(selectedParentPath);
      }

      const targets: WatchTarget[] = [{ absolutePath: workspaceRoot, directoryPath: undefined }];
      for (const directoryPath of candidateDirectoryPaths) {
        const resolved = yield* workspacePaths
          .resolveRelativePathWithinRoot({
            workspaceRoot,
            relativePath: directoryPath,
          })
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (!resolved) {
          continue;
        }

        const stat = yield* fileSystem
          .stat(resolved.absolutePath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (!stat || stat.type !== "Directory") {
          continue;
        }

        targets.push({
          absolutePath: resolved.absolutePath,
          directoryPath: resolved.relativePath,
        });
      }

      return {
        workspaceRoot,
        targets,
      };
    },
  );

  const toWorkspaceRelativePath = (
    workspaceRoot: string,
    absolutePath: string,
  ): string | undefined => {
    const relativePath = toPosixPath(path.relative(workspaceRoot, absolutePath));
    if (
      relativePath.length === 0 ||
      relativePath === "." ||
      relativePath === ".." ||
      relativePath.startsWith("../") ||
      path.isAbsolute(relativePath)
    ) {
      return undefined;
    }
    return relativePath;
  };

  const normalizeWatchEvent = Effect.fn("WorkspaceChangeBroadcaster.normalizeWatchEvent")(
    function* (workspaceRoot: string, target: WatchTarget, event: { path?: string }) {
      const eventPath = typeof event.path === "string" ? event.path.trim() : "";
      if (eventPath.length === 0 || eventPath === ".") {
        return {
          _tag: "directoryInvalidated" as const,
          ...(target.directoryPath ? { directoryPath: target.directoryPath } : {}),
        };
      }

      const absolutePath = path.isAbsolute(eventPath)
        ? path.resolve(eventPath)
        : path.resolve(target.absolutePath, eventPath);
      const relativePath = toWorkspaceRelativePath(workspaceRoot, absolutePath);
      if (!relativePath) {
        if (path.resolve(absolutePath) === path.resolve(target.absolutePath)) {
          return {
            _tag: "directoryInvalidated" as const,
            ...(target.directoryPath ? { directoryPath: target.directoryPath } : {}),
          };
        }
        return null;
      }

      if (parentPathOf(relativePath) !== target.directoryPath) {
        return null;
      }

      const stat = yield* fileSystem
        .stat(absolutePath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      return {
        _tag: "pathChanged" as const,
        relativePath,
        exists: stat !== null,
        ...(stat?.type === "File"
          ? { entryKind: "file" as const }
          : stat?.type === "Directory"
            ? { entryKind: "directory" as const }
            : {}),
      };
    },
  );

  const streamChanges: WorkspaceChangeBroadcasterShape["streamChanges"] = (input) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const { targets, workspaceRoot } = yield* resolveWatchTargets(input);
        const changesPubSub = yield* PubSub.unbounded<ProjectWorkspaceChangeEvent>();
        const watcherScope = yield* Scope.make("sequential");

        const emitEvent = (event: ProjectWorkspaceChangeEvent | null) =>
          event ? PubSub.publish(changesPubSub, event).pipe(Effect.asVoid) : Effect.void;

        for (const target of targets) {
          const watchStream = fileSystem.watch(target.absolutePath).pipe(
            Stream.debounce(Duration.millis(100)),
            Stream.mapEffect((event) =>
              normalizeWatchEvent(workspaceRoot, target, event as { path?: string }),
            ),
          );

          yield* Stream.runForEach(watchStream, emitEvent).pipe(
            Effect.mapError((cause) =>
              toError(input, "workspaceChangeBroadcaster.watchDirectory", cause),
            ),
            Effect.ignoreCause({ log: true }),
            Effect.forkIn(watcherScope),
            Effect.asVoid,
          );
        }

        return Stream.fromPubSub(changesPubSub).pipe(
          Stream.ensuring(Scope.close(watcherScope, Exit.void)),
        );
      }),
    );

  return {
    streamChanges,
  } satisfies WorkspaceChangeBroadcasterShape;
});

export const WorkspaceChangeBroadcasterLive = Layer.effect(
  WorkspaceChangeBroadcaster,
  makeWorkspaceChangeBroadcaster,
);
