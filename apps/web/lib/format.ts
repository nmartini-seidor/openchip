const CET_TIME_ZONE = "Europe/Madrid";

export function formatDateTime(value: string): string {
  const formatted = new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CET_TIME_ZONE
  });

  return `${formatted} CET`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: CET_TIME_ZONE
  });
}

export function toTitleCase(value: string): string {
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}
