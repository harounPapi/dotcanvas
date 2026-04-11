import { describe, expect, it } from "vitest";

import { splitPromptIntoComposerSegments } from "./composer-editor-mentions";
import { INLINE_TERMINAL_CONTEXT_PLACEHOLDER } from "./lib/terminalContext";
import type { ComposerCapabilityMention } from "@t3tools/contracts";

const OBSIDIAN_SKILL_MENTION: ComposerCapabilityMention = {
  kind: "skill",
  token: "$obsidian-cli",
  label: "obsidian-cli",
  name: "obsidian-cli",
  path: "/Users/test/.codex/skills/obsidian-cli/SKILL.md",
};

describe("splitPromptIntoComposerSegments", () => {
  it("splits mention tokens followed by whitespace into mention segments", () => {
    expect(splitPromptIntoComposerSegments("Inspect @AGENTS.md please")).toEqual([
      { type: "text", text: "Inspect " },
      { type: "mention", path: "AGENTS.md" },
      { type: "text", text: " please" },
    ]);
  });

  it("does not convert an incomplete trailing mention token", () => {
    expect(splitPromptIntoComposerSegments("Inspect @AGENTS.md")).toEqual([
      { type: "text", text: "Inspect @AGENTS.md" },
    ]);
  });

  it("keeps newlines around mention tokens", () => {
    expect(splitPromptIntoComposerSegments("one\n@src/index.ts \ntwo")).toEqual([
      { type: "text", text: "one\n" },
      { type: "mention", path: "src/index.ts" },
      { type: "text", text: " \ntwo" },
    ]);
  });

  it("keeps inline terminal context placeholders at their prompt positions", () => {
    expect(
      splitPromptIntoComposerSegments(
        `Inspect ${INLINE_TERMINAL_CONTEXT_PLACEHOLDER}@AGENTS.md please`,
      ),
    ).toEqual([
      { type: "text", text: "Inspect " },
      { type: "terminal-context", context: null },
      { type: "mention", path: "AGENTS.md" },
      { type: "text", text: " please" },
    ]);
  });

  it("splits selected skill tokens into capability mention segments", () => {
    expect(
      splitPromptIntoComposerSegments("Use $obsidian-cli please", [], [OBSIDIAN_SKILL_MENTION]),
    ).toEqual([
      { type: "text", text: "Use " },
      { type: "capability-mention", mention: OBSIDIAN_SKILL_MENTION },
      { type: "text", text: " please" },
    ]);
  });

  it("keeps incomplete trailing skill tokens as plain text while editing", () => {
    expect(
      splitPromptIntoComposerSegments("Use $obsidian-cli", [], [OBSIDIAN_SKILL_MENTION]),
    ).toEqual([{ type: "text", text: "Use $obsidian-cli" }]);
  });
});
