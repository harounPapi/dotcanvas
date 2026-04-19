import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type {
  ProjectReadTabularFileInput,
  ProjectReadTabularFileResult,
  ProjectReadTabularMediaInput,
  ProjectReadTabularMediaResult,
  ProjectWriteTabularFileInput,
  ProjectWriteTabularFileResult,
} from "@t3tools/contracts";

import { WorkspaceFileSystemWriteConflictError } from "./WorkspaceFileSystem.ts";
import { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceTabularFileSystemError extends Schema.TaggedErrorClass<WorkspaceTabularFileSystemError>()(
  "WorkspaceTabularFileSystemError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface WorkspaceTabularFileSystemShape {
  readonly readTabularFile: (
    input: ProjectReadTabularFileInput,
  ) => Effect.Effect<
    ProjectReadTabularFileResult,
    WorkspaceTabularFileSystemError | WorkspacePathOutsideRootError
  >;

  readonly readTabularMedia: (
    input: ProjectReadTabularMediaInput,
  ) => Effect.Effect<
    ProjectReadTabularMediaResult,
    WorkspaceTabularFileSystemError | WorkspacePathOutsideRootError
  >;

  readonly writeTabularFile: (
    input: ProjectWriteTabularFileInput,
  ) => Effect.Effect<
    ProjectWriteTabularFileResult,
    | WorkspaceTabularFileSystemError
    | WorkspaceFileSystemWriteConflictError
    | WorkspacePathOutsideRootError
  >;
}

export class WorkspaceTabularFileSystem extends ServiceMap.Service<
  WorkspaceTabularFileSystem,
  WorkspaceTabularFileSystemShape
>()("t3/workspace/Services/WorkspaceTabularFileSystem") {}
