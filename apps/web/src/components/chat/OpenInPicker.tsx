import {
  type EditorId,
  type ProjectAppId,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { memo, useCallback, useEffect, useMemo } from "react";
import { isOpenFavoriteEditorShortcut, shortcutLabelForCommand } from "../../keybindings";
import {
  resolveAndPersistPreferredProjectOpenTarget,
  usePreferredProjectOpenTarget,
} from "../../projectOpenPreferences";
import { ChevronDownIcon, FolderClosedIcon, type AppIconComponent } from "~/components/ui/icons";
import { Button } from "../ui/button";
import { Group, GroupSeparator } from "../ui/group";
import { Menu, MenuItem, MenuPopup, MenuShortcut, MenuTrigger } from "../ui/menu";
import {
  AntigravityIcon,
  CursorIcon,
  Icon,
  ObsidianIcon,
  TraeIcon,
  IntelliJIdeaIcon,
  VisualStudioCode,
  Zed,
} from "../Icons";
import { isMacPlatform, isWindowsPlatform } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";

type OpenTargetOption = {
  label: string;
  Icon: Icon | AppIconComponent;
  value: EditorId | ProjectAppId;
  kind: "editor" | "project-app";
};

const resolveOptions = (
  platform: string,
  availableEditors: ReadonlyArray<EditorId>,
  availableProjectApps: ReadonlyArray<ProjectAppId>,
) => {
  const baseOptions: ReadonlyArray<OpenTargetOption> = [
    {
      label: "Cursor",
      Icon: CursorIcon,
      value: "cursor",
      kind: "editor",
    },
    {
      label: "Trae",
      Icon: TraeIcon,
      value: "trae",
      kind: "editor",
    },
    {
      label: "VS Code",
      Icon: VisualStudioCode,
      value: "vscode",
      kind: "editor",
    },
    {
      label: "VS Code Insiders",
      Icon: VisualStudioCode,
      value: "vscode-insiders",
      kind: "editor",
    },
    {
      label: "VSCodium",
      Icon: VisualStudioCode,
      value: "vscodium",
      kind: "editor",
    },
    {
      label: "Zed",
      Icon: Zed,
      value: "zed",
      kind: "editor",
    },
    {
      label: "Antigravity",
      Icon: AntigravityIcon,
      value: "antigravity",
      kind: "editor",
    },
    {
      label: "IntelliJ IDEA",
      Icon: IntelliJIdeaIcon,
      value: "idea",
      kind: "editor",
    },
    {
      label: isMacPlatform(platform)
        ? "Finder"
        : isWindowsPlatform(platform)
          ? "Explorer"
          : "Files",
      Icon: FolderClosedIcon,
      value: "file-manager",
      kind: "editor",
    },
    {
      label: "Obsidian",
      Icon: ObsidianIcon,
      value: "obsidian",
      kind: "project-app",
    },
  ];
  return baseOptions.filter((option) =>
    option.kind === "editor"
      ? availableEditors.includes(option.value as EditorId)
      : availableProjectApps.includes(option.value as ProjectAppId),
  );
};

export const OpenInPicker = memo(function OpenInPicker({
  keybindings,
  availableEditors,
  availableProjectApps,
  openInCwd,
}: {
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  availableProjectApps: ReadonlyArray<ProjectAppId>;
  openInCwd: string | null;
}) {
  const [preferredTarget, setPreferredTarget] = usePreferredProjectOpenTarget(
    availableEditors,
    availableProjectApps,
  );
  const options = useMemo(
    () => resolveOptions(navigator.platform, availableEditors, availableProjectApps),
    [availableEditors, availableProjectApps],
  );
  const primaryOption = options.find(({ value }) => value === preferredTarget) ?? null;

  const openTarget = useCallback(
    (targetId: EditorId | ProjectAppId | null) => {
      const api = readNativeApi();
      if (!api || !openInCwd) return;
      const target = targetId ?? preferredTarget;
      if (!target) return;

      if (target === "obsidian") {
        void api.shell.openInProjectApp(openInCwd, target);
      } else {
        void api.shell.openInEditor(openInCwd, target);
      }
      setPreferredTarget(target);
    },
    [openInCwd, preferredTarget, setPreferredTarget],
  );

  const openFavoriteEditorShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "editor.openFavorite"),
    [keybindings],
  );

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const api = readNativeApi();
      if (!isOpenFavoriteEditorShortcut(e, keybindings)) return;
      if (!api || !openInCwd) return;
      const target = resolveAndPersistPreferredProjectOpenTarget(
        availableEditors,
        availableProjectApps,
      );
      if (!target) return;

      e.preventDefault();
      if (target === "obsidian") {
        void api.shell.openInProjectApp(openInCwd, target);
      } else {
        void api.shell.openInEditor(openInCwd, target);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [availableEditors, availableProjectApps, keybindings, openInCwd]);

  return (
    <Group aria-label="Subscription actions">
      <Button
        size="xs"
        variant="outline"
        disabled={!preferredTarget || !openInCwd}
        onClick={() => openTarget(preferredTarget)}
      >
        {primaryOption?.Icon && <primaryOption.Icon aria-hidden="true" className="size-3.5" />}
        <span className="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5">
          Open
        </span>
      </Button>
      <GroupSeparator className="hidden @3xl/header-actions:block" />
      <Menu>
        <MenuTrigger render={<Button aria-label="Copy options" size="icon-xs" variant="outline" />}>
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </MenuTrigger>
        <MenuPopup align="end">
          {options.length === 0 && <MenuItem disabled>No installed editors found</MenuItem>}
          {options.map(({ label, Icon, value }) => (
            <MenuItem key={value} onClick={() => openTarget(value)}>
              <Icon aria-hidden="true" className="text-muted-foreground" />
              {label}
              {value === preferredTarget && openFavoriteEditorShortcutLabel && (
                <MenuShortcut>{openFavoriteEditorShortcutLabel}</MenuShortcut>
              )}
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </Group>
  );
});
