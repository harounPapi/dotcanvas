import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";

import { WorkspaceChangeBroadcaster } from "../Services/WorkspaceChangeBroadcaster.ts";
import { WorkspaceChangeBroadcasterLive } from "./WorkspaceChangeBroadcaster.ts";
import { WorkspacePathsLive } from "./WorkspacePaths.ts";

type WatchEvent = FileSystem.WatchEvent;

function withWorkspaceChangeBroadcaster<A, E, R>(
  watchOverride: (watchPath: string) => Stream.Stream<WatchEvent>,
  effect: Effect.Effect<A, E, R | WorkspaceChangeBroadcaster>,
) {
  return Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const overriddenFileSystem = {
      ...fileSystem,
      watch: (watchPath: string) => watchOverride(watchPath),
    } satisfies typeof fileSystem;
    const overriddenFileSystemLayer = Layer.succeed(FileSystem.FileSystem, overriddenFileSystem);
    const workspacePathsLayer = WorkspacePathsLive.pipe(
      Layer.provide(overriddenFileSystemLayer),
      Layer.provide(NodeServices.layer),
    );
    const broadcasterLayer = WorkspaceChangeBroadcasterLive.pipe(
      Layer.provide(workspacePathsLayer),
      Layer.provide(overriddenFileSystemLayer),
      Layer.provide(NodeServices.layer),
    );

    return yield* effect.pipe(Effect.provide(broadcasterLayer));
  }).pipe(Effect.provide(NodeServices.layer));
}

function isDocsWatchPath(watchPath: string): boolean {
  return watchPath.replaceAll("\\", "/").endsWith("/docs");
}

const writeTextFile = Effect.fn("WorkspaceChangeBroadcaster.test.writeTextFile")(function* (
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

describe("WorkspaceChangeBroadcasterLive", () => {
  it.effect("emits pathChanged for external file edits in a watched directory", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const cwd = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-workspace-change-broadcaster-edit-",
      });

      yield* writeTextFile(cwd, "docs/note.md", "# Updated\n");

      const events = yield* withWorkspaceChangeBroadcaster(
        (watchPath) =>
          isDocsWatchPath(watchPath)
            ? Stream.make({ _tag: "Update", path: "note.md" })
            : Stream.empty,
        Effect.gen(function* () {
          const broadcaster = yield* WorkspaceChangeBroadcaster;
          return yield* broadcaster
            .streamChanges({
              cwd,
              directoryPaths: ["docs"],
            })
            .pipe(Stream.take(1), Stream.runCollect);
        }),
      );

      expect(Array.from(events)).toEqual([
        {
          _tag: "pathChanged",
          relativePath: "docs/note.md",
          exists: true,
          entryKind: "file",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("emits create and delete events with the correct exists flag", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const cwd = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-workspace-change-broadcaster-create-delete-",
      });

      yield* writeTextFile(cwd, "docs/created.md", "# Created\n");
      yield* fileSystem
        .makeDirectory(path.join(cwd, "docs"), { recursive: true })
        .pipe(Effect.orDie);
      yield* fileSystem
        .remove(path.join(cwd, "docs", "deleted.md"), { force: true })
        .pipe(Effect.orDie);

      const createdEvents = yield* withWorkspaceChangeBroadcaster(
        (watchPath) =>
          isDocsWatchPath(watchPath)
            ? Stream.make({ _tag: "Create", path: "created.md" })
            : Stream.empty,
        Effect.gen(function* () {
          const broadcaster = yield* WorkspaceChangeBroadcaster;
          return yield* broadcaster
            .streamChanges({
              cwd,
              directoryPaths: ["docs"],
            })
            .pipe(Stream.take(1), Stream.runCollect);
        }),
      );

      const deletedEvents = yield* withWorkspaceChangeBroadcaster(
        (watchPath) =>
          isDocsWatchPath(watchPath)
            ? Stream.make({ _tag: "Remove", path: "deleted.md" })
            : Stream.empty,
        Effect.gen(function* () {
          const broadcaster = yield* WorkspaceChangeBroadcaster;
          return yield* broadcaster
            .streamChanges({
              cwd,
              directoryPaths: ["docs"],
            })
            .pipe(Stream.take(1), Stream.runCollect);
        }),
      );

      expect(Array.from(createdEvents)).toEqual([
        {
          _tag: "pathChanged",
          relativePath: "docs/created.md",
          exists: true,
          entryKind: "file",
        },
      ]);
      expect(Array.from(deletedEvents)).toEqual([
        {
          _tag: "pathChanged",
          relativePath: "docs/deleted.md",
          exists: false,
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("emits directoryInvalidated for ambiguous directory watch bursts", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const cwd = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-workspace-change-broadcaster-invalidated-",
      });

      yield* fileSystem
        .makeDirectory(path.join(cwd, "docs"), { recursive: true })
        .pipe(Effect.orDie);

      const events = yield* withWorkspaceChangeBroadcaster(
        (watchPath) =>
          isDocsWatchPath(watchPath) ? Stream.make({ _tag: "Update", path: "" }) : Stream.empty,
        Effect.gen(function* () {
          const broadcaster = yield* WorkspaceChangeBroadcaster;
          return yield* broadcaster
            .streamChanges({
              cwd,
              directoryPaths: ["docs"],
            })
            .pipe(Stream.take(1), Stream.runCollect);
        }),
      );

      expect(Array.from(events)).toEqual([
        {
          _tag: "directoryInvalidated",
          directoryPath: "docs",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
