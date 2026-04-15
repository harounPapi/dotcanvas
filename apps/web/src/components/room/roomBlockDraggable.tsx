"use client";

import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
import { GripVerticalIcon } from "lucide-react";
import { type RenderNodeWrapper, usePluginOption, type PlateElementProps } from "platejs/react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { KEYS } from "platejs";

const ROOM_UNDRAGGABLE_TYPES = new Set<string>([KEYS.codeLine, KEYS.td, KEYS.th, KEYS.tr]);

export const RoomBlockDraggable: RenderNodeWrapper = (props) => {
  const elementType = (props.element as { type?: string }).type ?? "";

  if (props.path.length !== 1 || ROOM_UNDRAGGABLE_TYPES.has(elementType)) {
    return;
  }

  return (wrapperProps) => <RoomDraggableBlock {...wrapperProps} />;
};

function RoomDraggableBlock(props: PlateElementProps) {
  const { children, element } = props;
  const id =
    typeof (element as { id?: string }).id === "string"
      ? (element as { id?: string }).id
      : undefined;
  const { handleRef, isDragging, nodeRef } = useDraggable({ element });
  const { dropLine } = useDropLine(id ? { id } : undefined);
  const isDndActive = usePluginOption(DndPlugin, "isDragging");

  return (
    <TooltipProvider>
      <div
        ref={nodeRef}
        className={cn("group/room-block relative", isDragging ? "opacity-55" : undefined)}
        data-room-block-id={id}
      >
        <div
          className={cn(
            "pointer-events-none absolute top-1 left-0 z-20 -translate-x-full pr-2",
            "hidden sm:block",
          )}
          contentEditable={false}
        >
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-1 rounded-md p-0.5",
              "opacity-0 transition-opacity group-hover/room-block:opacity-100 focus-within:opacity-100",
              isDragging || isDndActive ? "opacity-100" : undefined,
            )}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Drag room block"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    ref={handleRef as any}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <GripVerticalIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipPopup side="left">Drag block</TooltipPopup>
            </Tooltip>
          </div>
        </div>

        {dropLine ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-primary/70",
              dropLine === "top" ? "top-0" : "bottom-0",
            )}
          />
        ) : null}

        {children}
      </div>
    </TooltipProvider>
  );
}
