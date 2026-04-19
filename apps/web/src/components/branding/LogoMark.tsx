import {
  BRAND_MARK_DEFAULT_COLORS,
  BRAND_MARK_PATHS,
  BRAND_MARK_VIEW_BOX,
} from "@t3tools/shared/branding";

import { cn } from "~/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  title?: string;
  variant?: "default" | "foreground";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
} as const;

export function LogoMark({ className, size = "md", title, variant = "default" }: LogoMarkProps) {
  const colors =
    variant === "foreground"
      ? ["currentColor", "currentColor", "currentColor"]
      : BRAND_MARK_DEFAULT_COLORS;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={BRAND_MARK_VIEW_BOX}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("shrink-0", sizeClasses[size], className)}
    >
      {title ? <title>{title}</title> : null}
      <g>
        {BRAND_MARK_PATHS.map((d, index) => (
          <path key={d} fill={colors[index]} d={d} />
        ))}
      </g>
    </svg>
  );
}
