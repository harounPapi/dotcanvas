"use client";

import type { VariantProps } from "class-variance-authority";
import type { PlateContentProps, PlateViewProps } from "platejs/react";
import type * as React from "react";

import { cva } from "class-variance-authority";
import { PlateContainer, PlateContent, PlateView } from "platejs/react";

import { cn } from "~/lib/utils";

const editorContainerVariants = cva(
  "relative w-full cursor-text select-text overflow-y-auto focus-visible:outline-none [&_.slate-selection-area]:z-50 [&_.slate-selection-area]:border [&_.slate-selection-area]:border-primary/25 [&_.slate-selection-area]:bg-primary/10",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "h-full",
        room: "h-full",
      },
    },
  },
);

export function EditorContainer({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof editorContainerVariants>) {
  return (
    <PlateContainer className={cn(editorContainerVariants({ variant }), className)} {...props} />
  );
}

const editorVariants = cva(
  "group/editor relative w-full cursor-text select-text overflow-x-hidden whitespace-pre-wrap break-words rounded-md outline-none [&_strong]:font-bold",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
      },
      focused: {
        true: "ring-2 ring-ring ring-offset-2",
      },
      variant: {
        default: "size-full px-16 pt-4 pb-72 text-base sm:px-[max(64px,calc(50%-350px))]",
        none: "",
        room: "size-full px-4 pt-3 pb-24 text-[15px] leading-7 sm:px-5",
      },
    },
  },
);

export type EditorProps = PlateContentProps & VariantProps<typeof editorVariants>;

export const Editor = ({
  className,
  disabled,
  focused,
  variant,
  ref,
  ...props
}: EditorProps & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <PlateContent
    ref={ref}
    className={cn(editorVariants({ disabled, focused, variant }), className)}
    disableDefaultStyles
    {...(typeof disabled === "boolean" ? { disabled } : {})}
    {...props}
  />
);

Editor.displayName = "Editor";

export function EditorView({
  className,
  variant,
  ...props
}: PlateViewProps & VariantProps<typeof editorVariants>) {
  return <PlateView {...props} className={cn(editorVariants({ variant }), className)} />;
}

EditorView.displayName = "EditorView";
