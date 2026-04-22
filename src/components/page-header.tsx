import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  actions?: React.ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        {eyebrow ? <p className="data-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 text-4xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/72">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
