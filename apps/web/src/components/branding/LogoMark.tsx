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

export const logoMarkPaths = [
  "M44.9,22.85c-.06,13.84-13.72,25.8-29.44,20.95-3.58-1.1,1.77-2.42,3.25-2.83,2.66-.7,5.2-1.81,7.42-3.44,7.4-5.49,11.96-15.4,12.1-24.55.08-1.17,0-2.57.48-3.62.85-1.28,2.23.66,2.81,1.47,2.51,3.81,3.39,8.58,3.38,12.02Z",
  "M35.07,18.14c-1.77,8.15-6.88,16.56-16.85,20.72-.47.2-.71.2-.65.03.01-.14.91-1.03,1.34-1.44,1.86-1.79,5.42-6.66,6.35-9.1,3.93-9.75-2.04-21.03-12.13-23.99-.85-.35-1.3-.69-1.15-1.09.18-.47,1.2-1.28,2.11-1.63C17.01.56,21.4-.4,25.1.17c2.25.35,7.84,1.4,9.42,4.59,2.14,4.31,1.26,10.11.55,13.38Z",
  "M13.87,38.49c-5.36,3.04-7.76.06-10.63-4.26-4.42-7.09-4.33-16.71.33-23.93,1.21-1.79,2.58-3.92,4.75-4.44,3.24-.55,6.85,1.56,9.24,3.54,4.87,4.2,7.57,11.5,5.23,17.68-1.28,3.38-4.57,9.13-8.91,11.4Z",
] as const;

const defaultColors = ["#a273f2", "#8f57ef", "#7c3aed"] as const;

export function LogoMark({ className, size = "md", title, variant = "default" }: LogoMarkProps) {
  const colors =
    variant === "foreground" ? ["currentColor", "currentColor", "currentColor"] : defaultColors;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 45 45"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("shrink-0", sizeClasses[size], className)}
    >
      {title ? <title>{title}</title> : null}
      <g>
        {logoMarkPaths.map((d, index) => (
          <path key={d} fill={colors[index]} d={d} />
        ))}
      </g>
    </svg>
  );
}
