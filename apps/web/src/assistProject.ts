import type {
  ProjectEntryKind,
  ProjectStatPathInput,
  ProjectStatPathResult,
} from "@t3tools/contracts";
import {
  ASSIST_AGENTS_RELATIVE_PATH,
  ASSIST_BOOTSTRAP_THREAD_TITLE,
  ASSIST_CONTEXT_DIRECTORY,
  ASSIST_MEMORY_RELATIVE_PATH,
  ASSIST_OPEN_QUESTIONS_RELATIVE_PATH,
  ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH,
  ASSIST_REQUIRED_SCAFFOLD_PATHS,
  ASSIST_WORKSPACE_MAP_RELATIVE_PATH,
} from "@t3tools/shared/assist";
import type { Project, Thread } from "./types";

export {
  ASSIST_AGENTS_RELATIVE_PATH,
  ASSIST_BOOTSTRAP_THREAD_TITLE,
  ASSIST_CONTEXT_DIRECTORY,
  ASSIST_MEMORY_RELATIVE_PATH,
  ASSIST_OPEN_QUESTIONS_RELATIVE_PATH,
  ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH,
  ASSIST_REQUIRED_SCAFFOLD_PATHS,
  ASSIST_WORKSPACE_MAP_RELATIVE_PATH,
};

export function isAssistProject(project: Pick<Project, "kind"> | null | undefined): boolean {
  return project?.kind === "assist";
}

export function isAssistProjectBootstrapping(
  project: Pick<Project, "kind" | "bootstrapState"> | null | undefined,
): boolean {
  return project?.kind === "assist" && project.bootstrapState === "bootstrapping";
}

export function isAssistBootstrapThread(input: {
  thread: Pick<Thread, "id"> | null | undefined;
  project: Pick<Project, "kind" | "bootstrapState" | "bootstrapThreadId"> | null | undefined;
}): boolean {
  const { project, thread } = input;
  if (
    thread === null ||
    thread === undefined ||
    project === null ||
    project === undefined ||
    !isAssistProjectBootstrapping(project) ||
    project.bootstrapThreadId === null ||
    project.bootstrapThreadId === undefined
  ) {
    return false;
  }

  return thread.id === project.bootstrapThreadId;
}

export function isAssistScaffoldRequirementSatisfied(input: {
  requirement: (typeof ASSIST_REQUIRED_SCAFFOLD_PATHS)[number];
  stat: ProjectStatPathResult;
}): boolean {
  return (
    input.stat.relativePath === input.requirement.relativePath &&
    input.stat.exists &&
    input.stat.kind === input.requirement.kind
  );
}

export async function readAssistScaffoldReady(input: {
  cwd: string;
  statPath: (input: ProjectStatPathInput) => Promise<ProjectStatPathResult>;
}): Promise<boolean> {
  const stats = await Promise.all(
    ASSIST_REQUIRED_SCAFFOLD_PATHS.map((requirement) =>
      input.statPath({
        cwd: input.cwd,
        relativePath: requirement.relativePath,
      }),
    ),
  );

  return ASSIST_REQUIRED_SCAFFOLD_PATHS.every((requirement, index) => {
    const stat = stats[index];
    return stat ? isAssistScaffoldRequirementSatisfied({ requirement, stat }) : false;
  });
}

export type AssistScaffoldRequirement = {
  relativePath: string;
  kind: ProjectEntryKind;
};
