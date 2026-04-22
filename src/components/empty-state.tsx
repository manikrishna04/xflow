import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/section-card";

export function EmptyState({
  actionHref,
  actionLabel,
  description,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  title: string;
}) {
  return (
    <SectionCard className="border border-dashed border-black/10 bg-white/72">
      <p className="data-kicker">Workspace Ready</p>
      <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/70">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-6 inline-flex">
          <Button>{actionLabel}</Button>
        </Link>
      ) : null}
    </SectionCard>
  );
}
