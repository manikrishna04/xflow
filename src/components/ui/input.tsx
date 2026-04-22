import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-black/10 bg-white/80 px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition placeholder:text-black/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
