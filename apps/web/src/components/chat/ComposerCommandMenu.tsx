import { type CapabilityScope, type ProjectEntry, type ProviderKind } from "@t3tools/contracts";
import { memo, useLayoutEffect, useRef } from "react";
import { type ComposerSlashCommand, type ComposerTriggerKind } from "../../composer-logic";
import { ArrowLeftIcon, BotIcon, PackageIcon, PlugIcon, WrenchIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import {
  Command,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { VscodeEntryIcon } from "./VscodeEntryIcon";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "model";
      provider: ProviderKind;
      model: string;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "capability-skill";
      name: string;
      path: string;
      label: string;
      description: string;
      scope: CapabilityScope;
      enabled: boolean;
      sourceLabel: string;
      typeLabel: "Skill";
      groupLabel: string;
      pluginId?: string;
      pluginName?: string;
    }
  | {
      id: string;
      type: "capability-plugin";
      pluginId: string;
      pluginName: string;
      label: string;
      description: string;
      sourceLabel: string;
      typeLabel: "Plugin";
      groupLabel: string;
      skillsCount: number;
      appsCount: number;
    }
  | {
      id: string;
      type: "capability-app";
      appId: string;
      name: string;
      pluginId: string;
      pluginName: string;
      label: string;
      description: string;
      sourceLabel: string;
      typeLabel: "App";
      groupLabel: string;
    }
  | {
      id: string;
      type: "capability-back";
      label: string;
      description: string;
    };

export const ComposerCommandMenu = memo(function ComposerCommandMenu(props: {
  items: ComposerCommandItem[];
  resolvedTheme: "light" | "dark";
  isLoading: boolean;
  triggerKind: ComposerTriggerKind | null;
  emptyStateText?: string;
  activeItemId: string | null;
  onHighlightedItemChange: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const capabilityItems =
    props.triggerKind === "capability"
      ? props.items.filter(
          (
            item,
          ): item is Extract<
            ComposerCommandItem,
            { type: "capability-skill" | "capability-plugin" | "capability-app" }
          > =>
            item.type === "capability-skill" ||
            item.type === "capability-plugin" ||
            item.type === "capability-app",
        )
      : [];
  const capabilityBackItems =
    props.triggerKind === "capability"
      ? props.items.filter(
          (item): item is Extract<ComposerCommandItem, { type: "capability-back" }> =>
            item.type === "capability-back",
        )
      : [];
  type CapabilityMenuEntry = (typeof capabilityItems)[number];
  const groupedCapabilityItems =
    props.triggerKind === "capability"
      ? capabilityItems.reduce<Array<{ label: string; items: CapabilityMenuEntry[] }>>(
          (groups, item) => {
            const existing = groups.find((group) => group.label === item.groupLabel);
            if (existing) {
              existing.items.push(item);
              return groups;
            }
            groups.push({ label: item.groupLabel, items: [item] });
            return groups;
          },
          [],
        )
      : [];

  useLayoutEffect(() => {
    if (!props.activeItemId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-composer-item-id="${CSS.escape(props.activeItemId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [props.activeItemId]);

  return (
    <Command
      autoHighlight={false}
      mode="none"
      onItemHighlighted={(highlightedValue) => {
        props.onHighlightedItemChange(
          typeof highlightedValue === "string" ? highlightedValue : null,
        );
      }}
    >
      <div
        ref={listRef}
        className="relative overflow-hidden rounded-xl border border-border/80 bg-popover/96 shadow-lg/8 backdrop-blur-xs"
      >
        <CommandList className="max-h-64">
          {props.triggerKind === "capability" ? (
            <>
              {capabilityBackItems.map((item) => (
                <ComposerCommandMenuItem
                  key={item.id}
                  item={item}
                  resolvedTheme={props.resolvedTheme}
                  isActive={props.activeItemId === item.id}
                  onHighlight={props.onHighlightedItemChange}
                  onSelect={props.onSelect}
                />
              ))}
              {capabilityBackItems.length > 0 && groupedCapabilityItems.length > 0 ? (
                <CommandSeparator />
              ) : null}
              {groupedCapabilityItems.map((group) => (
                <CommandGroup key={group.label}>
                  <CommandGroupLabel className="px-2 pb-1 font-medium text-[10px] text-muted-foreground/70 uppercase tracking-[0.16em]">
                    {group.label}
                  </CommandGroupLabel>
                  {group.items.map((item) => (
                    <ComposerCommandMenuItem
                      key={item.id}
                      item={item}
                      resolvedTheme={props.resolvedTheme}
                      isActive={props.activeItemId === item.id}
                      onHighlight={props.onHighlightedItemChange}
                      onSelect={props.onSelect}
                    />
                  ))}
                </CommandGroup>
              ))}
            </>
          ) : (
            props.items.map((item) => (
              <ComposerCommandMenuItem
                key={item.id}
                item={item}
                resolvedTheme={props.resolvedTheme}
                isActive={props.activeItemId === item.id}
                onHighlight={props.onHighlightedItemChange}
                onSelect={props.onSelect}
              />
            ))
          )}
        </CommandList>
        {props.items.length === 0 && (
          <p className="px-3 py-2 text-muted-foreground/70 text-xs">
            {props.isLoading
              ? props.triggerKind === "capability"
                ? "Searching capabilities..."
                : "Searching workspace files..."
              : (props.emptyStateText ??
                (props.triggerKind === "path"
                  ? "No matching files or folders."
                  : props.triggerKind === "capability"
                    ? "No matching capabilities."
                    : "No matching command."))}
          </p>
        )}
      </div>
    </Command>
  );
});

const ComposerCommandMenuItem = memo(function ComposerCommandMenuItem(props: {
  item: ComposerCommandItem;
  resolvedTheme: "light" | "dark";
  isActive: boolean;
  onHighlight: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  return (
    <CommandItem
      value={props.item.id}
      data-composer-item-id={props.item.id}
      className={cn(
        "cursor-pointer select-none gap-2 hover:bg-transparent hover:text-inherit data-highlighted:bg-transparent data-highlighted:text-inherit",
        (props.item.type === "capability-skill" ||
          props.item.type === "capability-plugin" ||
          props.item.type === "capability-app" ||
          props.item.type === "capability-back") &&
          "items-start rounded-lg px-2.5 py-2",
        props.isActive && "bg-accent! text-accent-foreground!",
      )}
      onMouseMove={() => {
        if (!props.isActive) props.onHighlight(props.item.id);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        props.onSelect(props.item);
      }}
    >
      {props.item.type === "path" ? (
        <VscodeEntryIcon
          pathValue={props.item.path}
          kind={props.item.pathKind}
          theme={props.resolvedTheme}
        />
      ) : null}
      {props.item.type === "slash-command" ? (
        <BotIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "model" ? (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          model
        </Badge>
      ) : null}
      {props.item.type === "capability-skill" ? (
        <WrenchIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "capability-plugin" ? (
        <PlugIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "capability-app" ? (
        <PackageIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "capability-back" ? (
        <ArrowLeftIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "capability-skill" ||
      props.item.type === "capability-plugin" ||
      props.item.type === "capability-app" ? (
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-sm">{props.item.label}</span>
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
              {props.item.typeLabel}
            </Badge>
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground/72">
            <span className="shrink-0 font-medium text-muted-foreground/82">
              {props.item.sourceLabel}
            </span>
            {props.item.description.length > 0 ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  •
                </span>
                <span className="truncate">{props.item.description}</span>
              </>
            ) : null}
          </span>
        </span>
      ) : props.item.type === "capability-back" ? (
        <span className="min-w-0 flex-1">
          <span className="truncate font-medium text-sm">{props.item.label}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/72">
            {props.item.description}
          </span>
        </span>
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <span className="truncate">{props.item.label}</span>
          </span>
          <span className="truncate text-muted-foreground/70 text-xs">
            {props.item.description}
          </span>
        </>
      )}
    </CommandItem>
  );
});
