import { cn } from "@/lib/utils";

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("panel-surface rounded-[28px] p-6", className)}>{children}</section>;
}
