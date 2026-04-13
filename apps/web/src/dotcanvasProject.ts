import type {
  ProjectEntryKind,
  ProjectStatPathInput,
  ProjectStatPathResult,
} from "@t3tools/contracts";
import {
  DOTCANVAS_AGENTS_RELATIVE_PATH,
  DOTCANVAS_BOOTSTRAP_THREAD_TITLE,
  DOTCANVAS_CONTEXT_DIRECTORY,
  DOTCANVAS_MEMORY_RELATIVE_PATH,
  DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH,
  DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH,
  DOTCANVAS_REQUIRED_SCAFFOLD_PATHS,
  DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH,
} from "@t3tools/shared/dotcanvas";
import type { Project, Thread } from "./types";

export {
  DOTCANVAS_AGENTS_RELATIVE_PATH,
  DOTCANVAS_BOOTSTRAP_THREAD_TITLE,
  DOTCANVAS_CONTEXT_DIRECTORY,
  DOTCANVAS_MEMORY_RELATIVE_PATH,
  DOTCANVAS_OPEN_QUESTIONS_RELATIVE_PATH,
  DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH,
  DOTCANVAS_REQUIRED_SCAFFOLD_PATHS,
  DOTCANVAS_WORKSPACE_MAP_RELATIVE_PATH,
};

export function isDotCanvasProject(project: Pick<Project, "kind"> | null | undefined): boolean {
  return project?.kind === "dotcanvas";
}

export function isDotCanvasProjectBootstrapping(
  project: Pick<Project, "kind" | "bootstrapState"> | null | undefined,
): boolean {
  return project?.kind === "dotcanvas" && project.bootstrapState === "bootstrapping";
}

export function isDotCanvasBootstrapThread(input: {
  thread: Pick<Thread, "id"> | null | undefined;
  project: Pick<Project, "kind" | "bootstrapState" | "bootstrapThreadId"> | null | undefined;
}): boolean {
  const { project, thread } = input;
  if (
    thread === null ||
    thread === undefined ||
    project === null ||
    project === undefined ||
    !isDotCanvasProjectBootstrapping(project) ||
    project.bootstrapThreadId === null ||
    project.bootstrapThreadId === undefined
  ) {
    return false;
  }

  return thread.id === project.bootstrapThreadId;
}

export function isDotCanvasScaffoldRequirementSatisfied(input: {
  requirement: (typeof DOTCANVAS_REQUIRED_SCAFFOLD_PATHS)[number];
  stat: ProjectStatPathResult;
}): boolean {
  return (
    input.stat.relativePath === input.requirement.relativePath &&
    input.stat.exists &&
    input.stat.kind === input.requirement.kind
  );
}

export async function readDotCanvasScaffoldReady(input: {
  cwd: string;
  statPath: (input: ProjectStatPathInput) => Promise<ProjectStatPathResult>;
}): Promise<boolean> {
  const stats = await Promise.all(
    DOTCANVAS_REQUIRED_SCAFFOLD_PATHS.map((requirement) =>
      input.statPath({
        cwd: input.cwd,
        relativePath: requirement.relativePath,
      }),
    ),
  );

  return DOTCANVAS_REQUIRED_SCAFFOLD_PATHS.every((requirement, index) => {
    const stat = stats[index];
    return stat ? isDotCanvasScaffoldRequirementSatisfied({ requirement, stat }) : false;
  });
}

export type DotCanvasScaffoldRequirement = {
  relativePath: string;
  kind: ProjectEntryKind;
};
