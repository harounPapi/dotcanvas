import { Effect, Exit, FileSystem, Layer, Path, PubSub, Scope, Stream } from "effect";

import type { ProjectWorkspaceChangeEvent, ProjectWorkspaceWatchInput } from "@t3tools/contracts";

import {
  WorkspaceChangeBroadcaster,
  WorkspaceChangeBroadcasterError,
  type WorkspaceChangeBroadcasterShape,
} from "../Services/WorkspaceChangeBroadcaster.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

function toPosixPath(input: string): string {
  return input.replaceAll("\\", "/");
}

function eventKeyOf(event: ProjectWorkspaceChangeEvent): string {
  return event._tag === "pathChanged"
    ? [event._tag, event.relativePath, String(event.exists), event.entryKind ?? ""].join(":")
    : [event._tag, event.directoryPath ?? ""].join(":");
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

  const resolveWorkspaceRoot = Effect.fn("WorkspaceChangeBroadcaster.resolveWorkspaceRoot")(
    function* (input: ProjectWorkspaceWatchInput) {
      return yield* workspacePaths.normalizeWorkspaceRoot(input.cwd).pipe(
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
    function* (workspaceRoot: string, event: { path?: string }) {
      const eventPath = typeof event.path === "string" ? event.path.trim() : "";
      if (eventPath.length === 0 || eventPath === ".") {
        return {
          _tag: "directoryInvalidated" as const,
        };
      }

      const absolutePath = path.isAbsolute(eventPath)
        ? path.resolve(eventPath)
        : path.resolve(workspaceRoot, eventPath);
      const relativePath = toWorkspaceRelativePath(workspaceRoot, absolutePath);
      if (!relativePath) {
        if (path.resolve(absolutePath) === path.resolve(workspaceRoot)) {
          return {
            _tag: "directoryInvalidated" as const,
          };
        }
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
        const workspaceRoot = yield* resolveWorkspaceRoot(input);
        const changesPubSub = yield* PubSub.unbounded<ProjectWorkspaceChangeEvent>();
        const watcherScope = yield* Scope.make("sequential");
        const recentlyEmitted = new Map<string, number>();
        const RECENT_EVENT_WINDOW_MS = 250;

        const emitEvent = (event: ProjectWorkspaceChangeEvent | null) => {
          if (!event) {
            return Effect.void;
          }

          const now = Date.now();
          for (const [key, emittedAt] of recentlyEmitted) {
            if (now - emittedAt > RECENT_EVENT_WINDOW_MS) {
              recentlyEmitted.delete(key);
            }
          }

          const eventKey = eventKeyOf(event);
          const lastEmittedAt = recentlyEmitted.get(eventKey);
          if (lastEmittedAt !== undefined && now - lastEmittedAt < RECENT_EVENT_WINDOW_MS) {
            return Effect.void;
          }

          recentlyEmitted.set(eventKey, now);
          return PubSub.publish(changesPubSub, event).pipe(Effect.asVoid);
        };

        const watchStream = fileSystem
          .watch(workspaceRoot)
          .pipe(
            Stream.mapEffect((event) =>
              normalizeWatchEvent(workspaceRoot, event as { path?: string }),
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
