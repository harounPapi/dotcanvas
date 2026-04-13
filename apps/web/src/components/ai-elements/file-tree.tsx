"use client";

import {
  Folder01Icon as HugeFolderIcon,
  FolderOpenIcon as HugeFolderOpenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronRightIcon, FileIcon } from "lucide-react";
import type { HTMLAttributes, KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

interface FileTreeContextValue {
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  selectedPath?: string | undefined;
  onSelect?: ((path: string) => void) | undefined;
}

const noop = () => undefined;

const FileTreeContext = createContext<FileTreeContextValue>({
  expandedPaths: new Set(),
  togglePath: noop,
});

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  expanded?: Set<string>;
  defaultExpanded?: Set<string>;
  selectedPath?: string | undefined;
  onSelect?: ((path: string) => void) | undefined;
  onExpandedChange?: ((expanded: Set<string>) => void) | undefined;
};

export function FileTree({
  expanded: controlledExpanded,
  defaultExpanded = new Set(),
  selectedPath,
  onSelect,
  onExpandedChange,
  className,
  children,
  ...props
}: FileTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expandedPaths = controlledExpanded ?? internalExpanded;

  const togglePath = useCallback(
    (path: string) => {
      const nextExpanded = new Set(expandedPaths);
      if (nextExpanded.has(path)) {
        nextExpanded.delete(path);
      } else {
        nextExpanded.add(path);
      }
      setInternalExpanded(nextExpanded);
      onExpandedChange?.(nextExpanded);
    },
    [expandedPaths, onExpandedChange],
  );

  const contextValue = useMemo(
    () => ({ expandedPaths, togglePath, selectedPath, onSelect }),
    [expandedPaths, onSelect, selectedPath, togglePath],
  );

  return (
    <FileTreeContext.Provider value={contextValue}>
      <div
        className={cn(
          "rounded-lg border border-transparent bg-transparent font-mono text-sm text-sidebar-foreground",
          className,
        )}
        role="tree"
        {...props}
      >
        <div className="px-1.5 pt-0.5 pb-1.5">{children}</div>
      </div>
    </FileTreeContext.Provider>
  );
}

export type FileTreeIconProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeIcon({ className, children, ...props }: FileTreeIconProps) {
  return (
    <span className={cn("shrink-0", className)} {...props}>
      {children}
    </span>
  );
}

export type FileTreeNameProps = HTMLAttributes<HTMLSpanElement>;

export function FileTreeName({ className, children, ...props }: FileTreeNameProps) {
  return (
    <span className={cn("truncate", className)} {...props}>
      {children}
    </span>
  );
}

export type FileTreeFolderProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
};

export function FileTreeFolder({ path, name, className, children, ...props }: FileTreeFolderProps) {
  const { expandedPaths, onSelect, selectedPath, togglePath } = useContext(FileTreeContext);
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;

  const handleToggle = useCallback(() => {
    togglePath(path);
  }, [path, togglePath]);

  const handleSelect = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  return (
    <Collapsible open={isExpanded} onOpenChange={handleToggle}>
      <div
        aria-expanded={isExpanded}
        className={cn("", className)}
        role="treeitem"
        tabIndex={0}
        {...props}
      >
        <div
          className={cn(
            "flex h-7 w-full items-center gap-1 rounded-lg px-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-within:bg-sidebar-accent focus-within:text-sidebar-accent-foreground",
            isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          <button
            aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
            className="flex shrink-0 cursor-pointer items-center rounded-md border-none bg-transparent p-0 outline-hidden"
            onClick={handleToggle}
            type="button"
          >
            <ChevronRightIcon
              className={cn(
                "size-4 shrink-0 text-sidebar-foreground/55 transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          </button>
          <button
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left outline-hidden"
            onClick={handleSelect}
            type="button"
          >
            <FileTreeIcon>
              {isExpanded ? (
                <HugeiconsIcon className="size-4 text-blue-500" icon={HugeFolderOpenIcon} />
              ) : (
                <HugeiconsIcon className="size-4 text-blue-500" icon={HugeFolderIcon} />
              )}
            </FileTreeIcon>
            <FileTreeName>{name}</FileTreeName>
          </button>
        </div>
        <CollapsibleContent>
          <div className="ml-4 border-sidebar-border/80 border-l pl-2">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export type FileTreeFileProps = HTMLAttributes<HTMLDivElement> & {
  path: string;
  name: string;
  icon?: ReactNode;
};

export function FileTreeFile({
  path,
  name,
  icon,
  className,
  children,
  ...props
}: FileTreeFileProps) {
  const { onSelect, selectedPath } = useContext(FileTreeContext);
  const isSelected = selectedPath === path;

  const handleClick = useCallback(() => {
    onSelect?.(path);
  }, [onSelect, path]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onSelect?.(path);
    },
    [onSelect, path],
  );

  return (
    <div
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="treeitem"
      tabIndex={0}
      {...props}
    >
      {children ?? (
        <>
          <span aria-hidden="true" className="size-4 shrink-0" />
          <FileTreeIcon>
            {icon ?? <FileIcon className="size-4 text-sidebar-foreground/55" />}
          </FileTreeIcon>
          <FileTreeName>{name}</FileTreeName>
        </>
      )}
    </div>
  );
}

export type FileTreeActionsProps = HTMLAttributes<HTMLDivElement>;

const stopPropagation = (event: SyntheticEvent) => {
  event.stopPropagation();
};

export function FileTreeActions({ className, children, ...props }: FileTreeActionsProps) {
  return (
    <div
      className={cn("ml-auto flex items-center gap-1", className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}
