import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-2 block text-sm font-medium text-foreground/80", className)}
      {...props}
    />
  );
}
