import { Schema, ServiceMap } from "effect";
import type { Stream } from "effect";

import type { ProjectWorkspaceChangeEvent, ProjectWorkspaceWatchInput } from "@t3tools/contracts";

export class WorkspaceChangeBroadcasterError extends Schema.TaggedErrorClass<WorkspaceChangeBroadcasterError>()(
  "WorkspaceChangeBroadcasterError",
  {
    cwd: Schema.String,
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface WorkspaceChangeBroadcasterShape {
  readonly streamChanges: (
    input: ProjectWorkspaceWatchInput,
  ) => Stream.Stream<ProjectWorkspaceChangeEvent, WorkspaceChangeBroadcasterError>;
}

export class WorkspaceChangeBroadcaster extends ServiceMap.Service<
  WorkspaceChangeBroadcaster,
  WorkspaceChangeBroadcasterShape
>()("t3/workspace/Services/WorkspaceChangeBroadcaster") {}
