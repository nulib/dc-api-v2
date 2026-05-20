export function formatOaiDate(
  value: Date | string | null | undefined,
): string | null | undefined {
  if (!value) return value as null | undefined;

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }

  const date: Date | null =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : null;

  if (date && !Number.isNaN(date.getTime())) {
    return date.toISOString().replace(/\.\d+Z$/, "Z");
  }

  if (typeof value === "string") {
    return value.replace(/\.\d+(?=Z$)/, "");
  }

  // value is a Date that failed getTime() — shouldn't happen in practice
  return undefined;
}
