function formatOaiDate(value) {
  if (!value) return value;

  if (typeof value === "string") {
    // Preserve day-level granularity values as-is.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }

  const date =
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

  return value;
}

module.exports = { formatOaiDate };
