import { StatusHistoryEntry } from "@openchip/shared";
import { formatDateTime, toTitleCase } from "@/lib/format";

export function StatusTimeline({ history }: { history: readonly StatusHistoryEntry[] }) {
  return (
    <ol className="space-y-2">
      {history.map((entry) => (
        <li key={`${entry.changedAt}-${entry.status}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{toTitleCase(entry.status)}</p>
            <time className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</time>
          </div>
          <p className="mt-1 text-xs text-slate-600">Actor: {entry.actor}</p>
          <p className="mt-1 text-xs text-slate-700">{entry.note}</p>
        </li>
      ))}
    </ol>
  );
}
