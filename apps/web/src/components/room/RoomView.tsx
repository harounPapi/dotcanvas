"use client";

import * as Schema from "effect/Schema";
import { PlusIcon } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { getLocalStorageItem, setLocalStorageItem } from "~/hooks/useLocalStorage";
import { basenameOfPath } from "~/vscode-icons";

import { RoomWorkspaceTree } from "./RoomWorkspaceTree";

const ROOM_FOLDER_SIDEBAR_STORAGE_KEY = "room_folder_sidebar_width";
const ROOM_FOLDER_SIDEBAR_DEFAULT_WIDTH_PX = 304;
const ROOM_FOLDER_SIDEBAR_MIN_WIDTH_PX = 240;
const ROOM_FOLDER_SIDEBAR_MAX_WIDTH_PX = 520;
const ROOM_FOLDER_CONTENT_MIN_WIDTH_PX = 320;

function clampRoomSidebarWidth(width: number, containerWidth: number) {
  const maxWidth = Math.min(
    ROOM_FOLDER_SIDEBAR_MAX_WIDTH_PX,
    Math.max(ROOM_FOLDER_SIDEBAR_MIN_WIDTH_PX, containerWidth - ROOM_FOLDER_CONTENT_MIN_WIDTH_PX),
  );

  return Math.min(Math.max(width, ROOM_FOLDER_SIDEBAR_MIN_WIDTH_PX), maxWidth);
}

export function RoomView(props: {
  workspaceRoot: string | undefined;
  visible: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const { resolvedTheme, visible, workspaceRoot } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{
    pointerId: number;
    startWidth: number;
    startX: number;
  } | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [sidebarWidth, setSidebarWidth] = useState(ROOM_FOLDER_SIDEBAR_DEFAULT_WIDTH_PX);
  const sidebarWidthRef = useRef(sidebarWidth);

  const syncSidebarWidth = useCallback((nextWidth: number, options?: { persist?: boolean }) => {
    const containerWidth =
      rootRef.current?.getBoundingClientRect().width ??
      ROOM_FOLDER_SIDEBAR_DEFAULT_WIDTH_PX + ROOM_FOLDER_CONTENT_MIN_WIDTH_PX;
    const clampedWidth = clampRoomSidebarWidth(nextWidth, containerWidth);

    sidebarWidthRef.current = clampedWidth;
    setSidebarWidth((current) => (Math.abs(current - clampedWidth) < 0.5 ? current : clampedWidth));

    if (options?.persist) {
      setLocalStorageItem(ROOM_FOLDER_SIDEBAR_STORAGE_KEY, clampedWidth, Schema.Finite);
    }
  }, []);

  useEffect(() => {
    setSelectedPath(undefined);
  }, [workspaceRoot]);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const storedWidth = getLocalStorageItem(ROOM_FOLDER_SIDEBAR_STORAGE_KEY, Schema.Finite);
    syncSidebarWidth(storedWidth ?? ROOM_FOLDER_SIDEBAR_DEFAULT_WIDTH_PX);
  }, [syncSidebarWidth]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncSidebarWidth(sidebarWidthRef.current);
    });

    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [syncSidebarWidth]);

  useEffect(
    () => () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    },
    [],
  );

  const finishResize = useCallback(() => {
    if (!resizeStateRef.current) {
      return;
    }

    resizeStateRef.current = null;
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    setLocalStorageItem(ROOM_FOLDER_SIDEBAR_STORAGE_KEY, sidebarWidthRef.current, Schema.Finite);
  }, []);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      event.button !== 0 ||
      (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches)
    ) {
      return;
    }

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startWidth: sidebarWidthRef.current,
      startX: event.clientX,
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }

      syncSidebarWidth(resizeState.startWidth + (event.clientX - resizeState.startX));
    },
    [syncSidebarWidth],
  );

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (resizeStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      finishResize();
    },
    [finishResize],
  );

  const handleResizePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (resizeStateRef.current?.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      finishResize();
    },
    [finishResize],
  );

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row"
      style={
        {
          "--room-folder-sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <aside className="relative flex min-h-0 w-full shrink-0 flex-col border-sidebar-border border-b bg-sidebar text-sidebar-foreground lg:w-(--room-folder-sidebar-width) lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="pl-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            ROOM FOLDER
          </span>
          <button
            aria-label="Room folder action"
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
            }}
            type="button"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <RoomWorkspaceTree
            onSelectPathChange={setSelectedPath}
            resolvedTheme={resolvedTheme}
            selectedPath={selectedPath}
            visible={visible}
            workspaceRoot={workspaceRoot}
          />
        </div>
        <button
          aria-label="Resize room folder sidebar"
          className="-translate-x-1/2 absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-col-resize transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:bg-sidebar hover:after:bg-sidebar-border lg:flex"
          onPointerCancel={handleResizePointerCancel}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          title="Drag to resize room folder sidebar"
          type="button"
        />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 items-start px-6 py-4">
          {selectedPath ? (
            <p className="truncate text-xs text-muted-foreground">{basenameOfPath(selectedPath)}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
