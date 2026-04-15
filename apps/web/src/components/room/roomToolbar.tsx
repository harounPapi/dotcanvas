"use client";

import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";

import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  RoomDropdownMenuLabel,
  RoomDropdownMenuRadioGroup,
  RoomDropdownMenuSeparator,
} from "./roomRadixMenu";

export const RoomToolbar = React.forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(function RoomToolbar({ className, ...props }, ref) {
  return (
    <ToolbarPrimitive.Root
      className={cn("relative flex select-none items-center", className)}
      ref={ref}
      {...props}
    />
  );
});

export function RoomToolbarToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.ToolbarToggleGroup>) {
  return (
    <ToolbarPrimitive.ToolbarToggleGroup
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export const roomToolbarButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-[color,box-shadow] hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-accent aria-checked:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "sm",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 min-w-9 px-2",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-1.5",
      },
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
    },
  },
);

export const roomDropdownArrowVariants = cva(
  "inline-flex items-center justify-center rounded-r-md font-medium text-foreground text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    defaultVariants: {
      size: "sm",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 w-6",
        lg: "h-10 w-8",
        sm: "h-8 w-4",
      },
      variant: {
        default:
          "bg-transparent hover:bg-muted hover:text-muted-foreground aria-checked:bg-accent aria-checked:text-accent-foreground",
        outline:
          "border border-input border-l-0 bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
    },
  },
);

type RoomToolbarButtonProps = {
  children: React.ReactNode;
  className?: string;
  isDropdown?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  pressed?: boolean;
  size?: VariantProps<typeof roomToolbarButtonVariants>["size"];
  tooltip?: React.ReactNode;
  type?: React.ButtonHTMLAttributes<HTMLButtonElement>["type"];
  variant?: VariantProps<typeof roomToolbarButtonVariants>["variant"];
} & Omit<
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>,
  "children" | "className" | "onClick" | "onMouseDown" | "type" | "value"
>;

function renderTooltip(
  element: React.ReactElement<Record<string, unknown>>,
  tooltip: React.ReactNode,
) {
  if (!tooltip) {
    return element;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={element} />
      <TooltipPopup side="top" sideOffset={6}>
        {tooltip}
      </TooltipPopup>
    </Tooltip>
  );
}

export function RoomToolbarButton(props: RoomToolbarButtonProps) {
  const {
    children,
    className,
    isDropdown = false,
    onClick,
    onMouseDown,
    pressed,
    size = "sm",
    tooltip,
    type = "button",
    variant,
    disabled,
    ...rest
  } = props;

  const content = isDropdown ? (
    <>
      <div className="flex flex-1 items-center gap-2 whitespace-nowrap">{children}</div>
      <div>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon />
      </div>
    </>
  ) : (
    children
  );

  if (typeof pressed === "boolean") {
    return renderTooltip(
      (
        <RoomToolbarToggleGroup
          {...(disabled !== undefined ? { disabled } : {})}
          type="single"
          value="single"
        >
          <ToolbarPrimitive.ToggleItem
            className={cn(
              roomToolbarButtonVariants({
                size,
                variant,
              }),
              isDropdown ? "justify-between gap-1 pr-1" : undefined,
              className,
            )}
            onClick={onClick}
            onMouseDown={onMouseDown}
            value={pressed ? "single" : ""}
            {...(disabled !== undefined ? { disabled } : {})}
            {...rest}
          >
            {content}
          </ToolbarPrimitive.ToggleItem>
        </RoomToolbarToggleGroup>
      ) as React.ReactElement<Record<string, unknown>>,
      tooltip,
    );
  }

  return renderTooltip(
    (
      <ToolbarPrimitive.Button
        className={cn(
          roomToolbarButtonVariants({
            size,
            variant,
          }),
          isDropdown ? "justify-between gap-1 pr-1" : undefined,
          className,
        )}
        {...(disabled !== undefined ? { disabled } : {})}
        onClick={onClick}
        onMouseDown={onMouseDown}
        type={type}
        {...rest}
      >
        {content}
      </ToolbarPrimitive.Button>
    ) as React.ReactElement<Record<string, unknown>>,
    tooltip,
  );
}

export function RoomToolbarGroup({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("group/toolbar-group relative hidden has-[button]:flex", className)}>
      <div className="flex items-center">{children}</div>
      <div className="group-last/toolbar-group:hidden! mx-1.5 py-0.5">
        <Separator orientation="vertical" />
      </div>
    </div>
  );
}

export function RoomToolbarSplitButton({
  children,
  className,
  pressed = false,
}: React.ComponentProps<"div"> & { pressed?: boolean }) {
  return (
    <div
      className={cn("group flex gap-0 px-0", className)}
      data-pressed={pressed ? "true" : undefined}
    >
      {children}
    </div>
  );
}

export function RoomToolbarSplitButtonPrimary({
  children,
  className,
  size = "sm",
  variant,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof roomToolbarButtonVariants>) {
  return (
    <button
      className={cn(
        roomToolbarButtonVariants({
          size,
          variant,
        }),
        "rounded-r-none group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function RoomToolbarSplitButtonSecondary({
  className,
  size = "sm",
  variant,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof roomDropdownArrowVariants>) {
  return (
    <button
      className={cn(
        roomDropdownArrowVariants({
          size,
          variant,
        }),
        "rounded-l-none group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
        className,
      )}
      type="button"
      {...props}
    >
      <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon />
    </button>
  );
}

export function RoomToolbarMenuGroup({
  children,
  className,
  label,
  onValueChange,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  onValueChange?: (value: string) => void;
  value?: string;
}) {
  const content = (
    <>
      {label ? (
        <RoomDropdownMenuLabel className="select-none font-semibold text-muted-foreground text-xs">
          {label}
        </RoomDropdownMenuLabel>
      ) : null}
      {children}
    </>
  );

  return (
    <>
      <RoomDropdownMenuSeparator
        className={cn(
          "hidden mb-0 shrink-0 peer-has-[[role=menuitem]]/menu-group:block peer-has-[[role=menuitemradio]]/menu-group:block",
        )}
      />
      {typeof onValueChange === "function" ? (
        <RoomDropdownMenuRadioGroup
          className={cn(
            "peer/menu-group group/menu-group my-1.5 hidden has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block",
            className,
          )}
          onValueChange={onValueChange}
          {...(value !== undefined ? { value } : {})}
        >
          {content}
        </RoomDropdownMenuRadioGroup>
      ) : (
        <div
          className={cn(
            "peer/menu-group group/menu-group my-1.5 hidden has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block",
            className,
          )}
        >
          {content}
        </div>
      )}
    </>
  );
}
