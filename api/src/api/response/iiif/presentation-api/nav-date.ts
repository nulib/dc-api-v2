const ISO_DATE = /^-?\d{4,}-\d{2}-\d{2}$/;

/**
 * A resource's `navDate` (Presentation 3 §3.3.1): the earliest calendar date the work's
 * Date Created covers, as the xsd:dateTime the spec requires. Meadow indexes that date as
 * `date_created_start`, already widened from EDTF (`196X` gives 1960-01-01), so only the
 * time suffix is added here. Works with no bounded date get no navDate. Used for a work's
 * Manifest and for the Manifest references in a Collection (Cookbook 0230).
 */
export function buildNavDate(source: {
  date_created_start?: string | null;
}): string | null {
  const start = source.date_created_start;
  if (typeof start !== "string" || !ISO_DATE.test(start)) return null;
  return `${start}T00:00:00Z`;
}
