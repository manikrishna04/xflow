export function StatCard({
  hint,
  label,
  value,
}: {
  hint: string;
  label: string;
  value: string;
}) {
  return (
    <article className="panel-surface rounded-[26px] p-5">
      <p className="data-kicker">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-foreground/65">{hint}</p>
    </article>
  );
}
