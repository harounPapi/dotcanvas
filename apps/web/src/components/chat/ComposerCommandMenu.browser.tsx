import "../../index.css";

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ComposerCommandMenu, type ComposerCommandItem } from "./ComposerCommandMenu";

async function mountMenu(items: ComposerCommandItem[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const screen = await render(
    <ComposerCommandMenu
      items={items}
      resolvedTheme="light"
      isLoading={false}
      triggerKind="capability"
      activeItemId={items[0]?.id ?? null}
      onHighlightedItemChange={vi.fn()}
      onSelect={vi.fn()}
    />,
    { container: host },
  );

  return {
    [Symbol.asyncDispose]: async () => {
      await screen.unmount();
      host.remove();
    },
    cleanup: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

describe("ComposerCommandMenu capability groups", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows grouped skills and plugins with title-first capability rows", async () => {
    await using _mounted = await mountMenu([
      {
        id: "skill:obsidian",
        type: "capability-skill",
        name: "obsidian-cli",
        path: "/Users/harounbaccar/.codex/skills/obsidian-cli/SKILL.md",
        label: "obsidian-cli",
        description: "Run and orchestrate Obsidian CLI operations across vaults.",
        scope: "user",
        enabled: true,
        sourceLabel: "Global skill",
        typeLabel: "Skill",
        groupLabel: "Skills",
      },
      {
        id: "plugin:github",
        type: "capability-plugin",
        pluginId: "github@openai-curated",
        pluginName: "github",
        label: "GitHub",
        description: "4 skills · 1 app · Inspect repositories and triage pull requests.",
        sourceLabel: "Installed plugin",
        typeLabel: "Plugin",
        groupLabel: "Plugins",
        skillsCount: 4,
        appsCount: 1,
      },
    ]);

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("Skills");
      expect(text).toContain("Plugins");
      expect(text).toContain("obsidian-cli");
      expect(text).toContain("Global skill");
      expect(text).toContain("GitHub");
      expect(text).toContain("Installed plugin");
      expect(text).toContain("Skill");
      expect(text).toContain("Plugin");
    });
  });

  it("shows a back row and separate plugin skill/app groups in bundle view", async () => {
    await using _mounted = await mountMenu([
      {
        id: "capability-back:github",
        type: "capability-back",
        label: "Back to all capabilities",
        description: "Return to skills and plugins",
      },
      {
        id: "skill:github:review",
        type: "capability-skill",
        name: "github:gh-address-comments",
        path: "/Users/harounbaccar/.codex/plugins/github/skills/gh-address-comments/SKILL.md",
        label: "gh-address-comments",
        description: "Address actionable GitHub pull request review feedback.",
        scope: "plugin",
        enabled: true,
        sourceLabel: "From GitHub plugin",
        typeLabel: "Skill",
        groupLabel: "Plugin Skills",
        pluginId: "github@openai-curated",
        pluginName: "github",
      },
      {
        id: "app:github",
        type: "capability-app",
        appId: "github",
        name: "GitHub app",
        pluginId: "github@openai-curated",
        pluginName: "github",
        label: "GitHub app",
        description: "Connected GitHub app",
        sourceLabel: "From GitHub plugin",
        typeLabel: "App",
        groupLabel: "Plugin Apps",
      },
    ]);

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("Back to all capabilities");
      expect(text).toContain("Return to skills and plugins");
      expect(text).toContain("Plugin Skills");
      expect(text).toContain("Plugin Apps");
      expect(text).toContain("gh-address-comments");
      expect(text).toContain("GitHub app");
      expect(text).toContain("From GitHub plugin");
      expect(text.indexOf("Back to all capabilities")).toBeLessThan(text.indexOf("Plugin Skills"));
    });
  });
});
