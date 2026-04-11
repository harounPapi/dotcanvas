import { cn } from "~/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "compact";
}

const sizeConfig = {
  sm: { gap: "gap-2", icon: "sm" as const, text: "text-lg" },
  md: { gap: "gap-3", icon: "md" as const, text: "text-2xl" },
  lg: { gap: "gap-4", icon: "lg" as const, text: "text-3xl" },
  xl: { gap: "gap-5", icon: "xl" as const, text: "text-[42px]" },
} as const;

const logoWordmarkStyle = {
  fontFamily: '"Nunito", "DM Sans", ui-sans-serif, system-ui, sans-serif',
  letterSpacing: "0.06em",
};

export function Logo({ className, size = "md", variant = "full" }: LogoProps) {
  const config = sizeConfig[size];

  if (variant === "compact") {
    return <LogoMark size={config.icon} title="DotCanvas" {...(className ? { className } : {})} />;
  }

  return (
    <div className={cn("flex min-w-0 items-center", config.gap, className)}>
      <LogoMark size={config.icon} title="DotCanvas" />
      <div
        className={cn("flex whitespace-nowrap leading-none text-foreground", config.text)}
        style={logoWordmarkStyle}
      >
        <span className="font-extrabold">DOT</span>
        <span className="font-light">CANVAS</span>
      </div>
    </div>
  );
}
