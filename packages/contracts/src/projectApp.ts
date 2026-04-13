import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

type ProjectAppDefinition = {
  readonly id: string;
  readonly label: string;
  readonly command: string;
};

export const PROJECT_APPS = [
  { id: "obsidian", label: "Obsidian", command: "obsidian" },
] as const satisfies ReadonlyArray<ProjectAppDefinition>;

export const ProjectAppId = Schema.Literals(PROJECT_APPS.map((app) => app.id));
export type ProjectAppId = typeof ProjectAppId.Type;

export const OpenInProjectAppInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  app: ProjectAppId,
});
export type OpenInProjectAppInput = typeof OpenInProjectAppInput.Type;
