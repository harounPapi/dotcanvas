import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type {
  ProjectReadDocumentFileInput,
  ProjectReadDocumentFileResult,
} from "@t3tools/contracts";

import { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceDocumentFileSystemError extends Schema.TaggedErrorClass<WorkspaceDocumentFileSystemError>()(
  "WorkspaceDocumentFileSystemError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface WorkspaceDocumentFileSystemShape {
  readonly readDocumentFile: (
    input: ProjectReadDocumentFileInput,
  ) => Effect.Effect<
    ProjectReadDocumentFileResult,
    WorkspaceDocumentFileSystemError | WorkspacePathOutsideRootError
  >;
}

export class WorkspaceDocumentFileSystem extends ServiceMap.Service<
  WorkspaceDocumentFileSystem,
  WorkspaceDocumentFileSystemShape
>()("t3/workspace/Services/WorkspaceDocumentFileSystem") {}
