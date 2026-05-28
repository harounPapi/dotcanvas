import { describe, expect, it } from "vitest";
import {
  ASSIST_AGENTS_RELATIVE_PATH,
  ASSIST_BOOTSTRAP_MARKER_RELATIVE_PATH,
  ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH,
  ASSIST_REQUIRED_SCAFFOLD_PATHS,
  buildAssistAgentsTemplate,
  buildAssistBootstrapMarkerContents,
  buildAssistBootstrapDeveloperInstructions,
  buildAssistBootstrapFiles,
  parseAssistBootstrapMarkerContents,
} from "./assist";

describe("assist shared scaffold", () => {
  it("creates the required bootstrap files", () => {
    const files = buildAssistBootstrapFiles({ projectTitle: "Alpha" });

    expect(files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining(ASSIST_REQUIRED_SCAFFOLD_PATHS.map((entry) => entry.relativePath)),
    );
  });

  it("renders a strong AGENTS template rooted in .context memory", () => {
    const template = buildAssistAgentsTemplate({ projectTitle: "Alpha" });

    expect(template).toContain("project operator");
    expect(template).toContain("workspace root is the real project workspace");
    expect(template).toContain("`.context/` is the canonical memory layer");
    expect(template).toContain("The project room is the main object");
    expect(template).toContain("`idea/`");
    expect(template).toContain(ASSIST_PROJECT_OVERVIEW_RELATIVE_PATH);
  });

  it("renders bootstrap developer instructions that require plan-before-reorg", () => {
    const instructions = buildAssistBootstrapDeveloperInstructions({
      projectTitle: "Alpha",
    });

    expect(instructions).toContain("Do not broadly reorganize the workspace");
    expect(instructions).toContain("<proposed_plan>");
    expect(instructions).toContain("root workspace");
    expect(instructions).toContain("questionnaire");
    expect(instructions).toContain("`idea/`");
  });

  it("includes AGENTS.md in the bootstrap scaffold", () => {
    const files = buildAssistBootstrapFiles({ projectTitle: "Alpha" });

    expect(files.find((file) => file.relativePath === ASSIST_AGENTS_RELATIVE_PATH)).toBeTruthy();
  });

  it("includes a bootstrap marker file that starts locked", () => {
    const files = buildAssistBootstrapFiles({ projectTitle: "Alpha" });
    const marker = files.find(
      (file) => file.relativePath === ASSIST_BOOTSTRAP_MARKER_RELATIVE_PATH,
    );

    expect(marker).toBeTruthy();
    expect(marker?.contents).toContain("bootstraped=false");
    expect(parseAssistBootstrapMarkerContents(marker?.contents ?? "")).toBe(false);
  });

  it("parses bootstrap markers from either spelling", () => {
    expect(
      parseAssistBootstrapMarkerContents(
        buildAssistBootstrapMarkerContents({ bootstrapped: true }),
      ),
    ).toBe(true);
    expect(parseAssistBootstrapMarkerContents("bootstrapped=true\n")).toBe(true);
    expect(parseAssistBootstrapMarkerContents('{"bootstraped":true}')).toBe(true);
    expect(parseAssistBootstrapMarkerContents("bootstraped=false\n")).toBe(false);
  });
});
