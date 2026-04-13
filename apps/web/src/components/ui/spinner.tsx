import { Loader2Icon, type AppIconProps } from "~/components/ui/icons";
import { cn } from "~/lib/utils";

function Spinner({ className, ...props }: AppIconProps) {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
