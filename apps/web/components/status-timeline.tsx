import { getTranslations } from "next-intl/server";
import { ActionHistoryEntry, StatusHistoryEntry } from "@openchip/shared";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type TimelineEntry =
  | { type: "status"; entry: StatusHistoryEntry }
  | { type: "action"; entry: ActionHistoryEntry };

export async function StatusTimeline({
  history,
  actionHistory = []
}: {
  history: readonly StatusHistoryEntry[];
  actionHistory?: readonly ActionHistoryEntry[];
}) {
  const t = await getTranslations("StatusTimeline");
  const entries: TimelineEntry[] = [
    ...history.map((entry) => ({ type: "status" as const, entry })),
    ...actionHistory.map((entry) => ({ type: "action" as const, entry }))
  ];
  const sorted = entries.sort((a, b) => {
    const aTime = new Date(a.entry.changedAt).getTime();
    const bTime = new Date(b.entry.changedAt).getTime();
    return bTime - aTime;
  });

  return (
    <div className="max-h-[26rem] overflow-y-auto pr-1">
      <ol className="space-y-2">
        {sorted.map((item) =>
          item.type === "status" ? (
            <li
              key={`status-${item.entry.changedAt}-${item.entry.status}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={item.entry.status} />
                <time className="text-xs text-slate-500">{formatDateTime(item.entry.changedAt)}</time>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {t("actor")}: {item.entry.actor}
              </p>
              <p className="mt-1 text-xs text-slate-700">{item.entry.note}</p>
            </li>
          ) : (
            <li
              key={`action-${item.entry.changedAt}-${item.entry.actionType}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex rounded-md border border-[var(--border-strong)] bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                  {t(`action.${item.entry.actionType}`)}
                </span>
                <time className="text-xs text-slate-500">{formatDateTime(item.entry.changedAt)}</time>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {t("actor")}: {item.entry.actor}
              </p>
              <p className="mt-1 text-xs text-slate-700">{item.entry.note}</p>
            </li>
          )
        )}
      </ol>
    </div>
  );
}
