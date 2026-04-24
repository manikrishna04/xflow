import { cn } from "@/lib/utils";

export function SectionCard({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("panel-surface rounded-[28px] p-6", className)} {...props}>
      {children}
    </section>
  );
}
