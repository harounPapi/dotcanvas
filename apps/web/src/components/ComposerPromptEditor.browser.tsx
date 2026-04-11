import "../index.css";

import type { ComposerCapabilityMention } from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ComposerPromptEditor } from "./ComposerPromptEditor";

const OBSIDIAN_SKILL_MENTION: ComposerCapabilityMention = {
  kind: "skill",
  token: "$obsidian-cli",
  label: "obsidian-cli",
  name: "obsidian-cli",
  path: "/Users/test/.codex/skills/obsidian-cli/SKILL.md",
};

async function mountEditor() {
  const host = document.createElement("div");
  document.body.append(host);
  const screen = await render(
    <ComposerPromptEditor
      value="Use $obsidian-cli please"
      cursor={5}
      terminalContexts={[]}
      capabilityMentions={[OBSIDIAN_SKILL_MENTION]}
      disabled={false}
      placeholder="Ask anything"
      onRemoveTerminalContext={vi.fn()}
      onChange={vi.fn()}
      onPaste={vi.fn()}
    />,
    { container: host },
  );

  return {
    [Symbol.asyncDispose]: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

describe("ComposerPromptEditor capability chips", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders selected skill mentions as inline chips with their skill path metadata", async () => {
    await using _mounted = await mountEditor();

    await vi.waitFor(() => {
      const chip = document.querySelector<HTMLElement>(
        `[data-capability-path="${OBSIDIAN_SKILL_MENTION.path}"]`,
      );
      expect(chip).not.toBeNull();
      expect(chip?.textContent ?? "").toContain("$");
      expect(chip?.textContent ?? "").toContain("obsidian-cli");
      expect(chip?.getAttribute("title")).toBe(OBSIDIAN_SKILL_MENTION.path);
    });
  });
});
