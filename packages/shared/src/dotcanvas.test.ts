import { describe, expect, it } from "vitest";
import {
  DOTCANVAS_AGENTS_RELATIVE_PATH,
  DOTCANVAS_BOOTSTRAP_MARKER_RELATIVE_PATH,
  DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH,
  DOTCANVAS_REQUIRED_SCAFFOLD_PATHS,
  buildDotCanvasAgentsTemplate,
  buildDotCanvasBootstrapMarkerContents,
  buildDotCanvasBootstrapDeveloperInstructions,
  buildDotCanvasBootstrapFiles,
  parseDotCanvasBootstrapMarkerContents,
} from "./dotcanvas";

describe("dotcanvas shared scaffold", () => {
  it("creates the required bootstrap files", () => {
    const files = buildDotCanvasBootstrapFiles({ projectTitle: "Alpha" });

    expect(files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining(DOTCANVAS_REQUIRED_SCAFFOLD_PATHS.map((entry) => entry.relativePath)),
    );
  });

  it("renders a strong AGENTS template rooted in .context memory", () => {
    const template = buildDotCanvasAgentsTemplate({ projectTitle: "Alpha" });

    expect(template).toContain("project operator");
    expect(template).toContain("workspace root is the real project workspace");
    expect(template).toContain("`.context/` is the canonical memory layer");
    expect(template).toContain("The project room is the main object");
    expect(template).toContain("`idea/`");
    expect(template).toContain(DOTCANVAS_PROJECT_OVERVIEW_RELATIVE_PATH);
  });

  it("renders bootstrap developer instructions that require plan-before-reorg", () => {
    const instructions = buildDotCanvasBootstrapDeveloperInstructions({
      projectTitle: "Alpha",
    });

    expect(instructions).toContain("Do not broadly reorganize the workspace");
    expect(instructions).toContain("<proposed_plan>");
    expect(instructions).toContain("root workspace");
    expect(instructions).toContain("questionnaire");
    expect(instructions).toContain("`idea/`");
  });

  it("includes AGENTS.md in the bootstrap scaffold", () => {
    const files = buildDotCanvasBootstrapFiles({ projectTitle: "Alpha" });

    expect(files.find((file) => file.relativePath === DOTCANVAS_AGENTS_RELATIVE_PATH)).toBeTruthy();
  });

  it("includes a bootstrap marker file that starts locked", () => {
    const files = buildDotCanvasBootstrapFiles({ projectTitle: "Alpha" });
    const marker = files.find(
      (file) => file.relativePath === DOTCANVAS_BOOTSTRAP_MARKER_RELATIVE_PATH,
    );

    expect(marker).toBeTruthy();
    expect(marker?.contents).toContain("bootstraped=false");
    expect(parseDotCanvasBootstrapMarkerContents(marker?.contents ?? "")).toBe(false);
  });

  it("parses bootstrap markers from either spelling", () => {
    expect(
      parseDotCanvasBootstrapMarkerContents(
        buildDotCanvasBootstrapMarkerContents({ bootstrapped: true }),
      ),
    ).toBe(true);
    expect(parseDotCanvasBootstrapMarkerContents("bootstrapped=true\n")).toBe(true);
    expect(parseDotCanvasBootstrapMarkerContents('{"bootstraped":true}')).toBe(true);
    expect(parseDotCanvasBootstrapMarkerContents("bootstraped=false\n")).toBe(false);
  });
});
