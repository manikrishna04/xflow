export function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(value?: string | number | null) {
  if (!value) {
    return "Not synced yet";
  }

  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value?: string | number | null) {
  if (!value) {
    return "Unknown";
  }

  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function formatStatusLabel(status?: string | null) {
  if (!status) {
    return "Not started";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
