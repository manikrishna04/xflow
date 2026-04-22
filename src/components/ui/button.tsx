import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
  {
    variants: {
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6",
      },
      variant: {
        primary: "bg-primary text-primary-foreground shadow-[0_14px_30px_rgba(16,150,136,0.18)] hover:opacity-95",
        secondary: "bg-[rgba(19,33,68,0.9)] text-white hover:bg-[rgba(19,33,68,0.96)]",
        ghost: "bg-transparent text-foreground hover:bg-black/[0.04]",
        outline: "border border-black/10 bg-white/80 text-foreground hover:bg-white",
        danger: "bg-destructive text-destructive-foreground hover:opacity-95",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ size, variant }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
