import { cn } from "@/lib/utils";
import { formatStatusLabel } from "@/lib/tradedge/format";

function toneForStatus(status?: string | null) {
  const normalized = (status || "").toLowerCase();

  if (["completed", "paid", "settled", "activated", "active"].includes(normalized)) {
    return "bg-[rgba(34,139,92,0.12)] text-[rgb(34,139,92)]";
  }

  if (
    ["pending", "draft", "verifying", "initialized", "processing", "input_required"].includes(
      normalized,
    )
  ) {
    return "bg-[rgba(242,153,74,0.16)] text-[rgb(170,97,23)]";
  }

  if (["failed", "hold", "cancelled", "rejected", "deactivated"].includes(normalized)) {
    return "bg-[rgba(218,70,70,0.12)] text-[rgb(190,51,51)]";
  }

  return "bg-black/[0.06] text-foreground/70";
}

export function StatusBadge({
  label,
  status,
}: {
  label?: string;
  status?: string | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase",
        toneForStatus(status),
      )}
    >
      {label || formatStatusLabel(status)}
    </span>
  );
}
