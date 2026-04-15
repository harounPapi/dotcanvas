"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useEditorRef } from "platejs/react";

import { cn } from "~/lib/utils";

import { getRoomBlockActionGroups } from "./roomBlockActions";

type RoomContextState = {
  blockId: string;
  x: number;
  y: number;
};

function findBlockPathById(editor: any, blockId: string): number[] | undefined {
  for (const entry of editor.api.nodes({
    at: [],
    match: (node: unknown) =>
      typeof node === "object" &&
      node !== null &&
      "id" in node &&
      (node as { id?: string }).id === blockId,
    mode: "lowest",
  }) as Iterable<[unknown, number[]]>) {
    return entry[1];
  }

  return undefined;
}

export function RoomBlockContextMenu(props: {
  contextState: RoomContextState | null;
  onClose: () => void;
}) {
  const { contextState, onClose } = props;
  const editor = useEditorRef() as any;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!contextState) {
      return;
    }

    const handlePointerDown = () => {
      startTransition(() => {
        onClose();
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        startTransition(() => {
          onClose();
        });
      }
    };

    const handleScroll = () => {
      startTransition(() => {
        onClose();
      });
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [contextState, onClose]);

  const targetPath = useMemo(() => {
    if (!contextState) {
      return undefined;
    }

    return findBlockPathById(editor, contextState.blockId);
  }, [contextState, editor]);

  const actionGroups = useMemo(() => {
    if (!targetPath) {
      return [];
    }

    return getRoomBlockActionGroups(editor, targetPath).map((group) =>
      group.map((action) => ({
        ...action,
        onSelect: () => {
          action.onSelect();
          editor.tf.focus();
          onClose();
        },
      })),
    );
  }, [editor, onClose, targetPath]);

  if (!mounted || !contextState || !targetPath || actionGroups.length === 0) {
    return null;
  }

  const x = Math.min(contextState.x, window.innerWidth - 240);
  const y = Math.min(contextState.y, window.innerHeight - 320);

  return (
    <div
      className="fixed z-50 min-w-[220px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg/5"
      data-room-block-context-menu="true"
      role="menu"
      style={{ left: Math.max(8, x), top: Math.max(8, y) }}
    >
      {actionGroups.map((group) => (
        <div
          className={cn("py-1", group !== actionGroups.at(-1) ? "border-b" : undefined)}
          key={group.map((action) => action.label).join(":")}
        >
          {group.map((action) => (
            <button
              className={cn(
                "flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                action.variant === "destructive" ? "text-destructive-foreground" : undefined,
              )}
              key={action.label}
              onClick={action.onSelect}
              type="button"
            >
              <action.icon className="size-4" />
              {action.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
