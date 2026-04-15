/**
 * WorkspaceFileSystem - Effect service contract for workspace file mutations.
 *
 * Owns workspace-root-relative file write operations and their associated
 * safety checks and cache invalidation hooks.
 *
 * @module WorkspaceFileSystem
 */
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type {
  ProjectCreateDirectoryInput,
  ProjectCreateDirectoryResult,
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectStatPathInput,
  ProjectStatPathResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "@t3tools/contracts";
import { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceFileSystemError extends Schema.TaggedErrorClass<WorkspaceFileSystemError>()(
  "WorkspaceFileSystemError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export class WorkspaceFileSystemWriteConflictError extends Schema.TaggedErrorClass<WorkspaceFileSystemWriteConflictError>()(
  "WorkspaceFileSystemWriteConflictError",
  {
    cwd: Schema.String,
    relativePath: Schema.String,
    expectedMtimeMs: Schema.Int,
    actualMtimeMs: Schema.optional(Schema.Int),
  },
) {
  override get message(): string {
    return "Workspace file was modified on disk.";
  }
}

/**
 * WorkspaceFileSystemShape - Service API for workspace-relative file operations.
 */
export interface WorkspaceFileSystemShape {
  /**
   * Create a new child directory under an existing parent path.
   *
   * Rejects invalid names, existing targets, and missing/non-directory parents.
   */
  readonly createDirectory: (
    input: ProjectCreateDirectoryInput,
  ) => Effect.Effect<ProjectCreateDirectoryResult, WorkspaceFileSystemError>;

  /**
   * Read whether a path exists within the workspace root and, when present,
   * whether it is a file or directory.
   */
  readonly statPath: (
    input: ProjectStatPathInput,
  ) => Effect.Effect<
    ProjectStatPathResult,
    WorkspaceFileSystemError | WorkspacePathOutsideRootError
  >;

  /**
   * Read a text file relative to the workspace root.
   */
  readonly readFile: (
    input: ProjectReadFileInput,
  ) => Effect.Effect<
    ProjectReadFileResult,
    WorkspaceFileSystemError | WorkspacePathOutsideRootError
  >;

  /**
   * Write a file relative to the workspace root.
   *
   * Creates parent directories as needed and rejects paths that escape the
   * workspace root.
   */
  readonly writeFile: (
    input: ProjectWriteFileInput,
  ) => Effect.Effect<
    ProjectWriteFileResult,
    WorkspaceFileSystemError | WorkspaceFileSystemWriteConflictError | WorkspacePathOutsideRootError
  >;
}

/**
 * WorkspaceFileSystem - Service tag for workspace file operations.
 */
export class WorkspaceFileSystem extends ServiceMap.Service<
  WorkspaceFileSystem,
  WorkspaceFileSystemShape
>()("t3/workspace/Services/WorkspaceFileSystem") {}
