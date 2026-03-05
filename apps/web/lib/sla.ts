export type CountdownStatus = "not_started" | "on_track" | "warning" | "overdue" | "completed";

export interface CountdownInfo {
  status: CountdownStatus;
  label: string;
  secondsRemaining: number | null;
}

function pluralize(value: number, unit: string): string {
  return `${value}${unit}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${pluralize(days, "d")} ${pluralize(hours, "h")}`;
  }

  if (hours > 0) {
    return `${pluralize(hours, "h")} ${pluralize(minutes, "m")}`;
  }

  return `${pluralize(minutes, "m")}`;
}

export function getCountdown(deadlineIso: string | null, completedAtIso: string | null): CountdownInfo {
  if (deadlineIso === null) {
    return {
      status: "not_started",
      label: "Not started",
      secondsRemaining: null
    };
  }

  if (completedAtIso !== null) {
    return {
      status: "completed",
      label: "Completed",
      secondsRemaining: 0
    };
  }

  const nowMs = Date.now();
  const deadlineMs = new Date(deadlineIso).getTime();

  if (Number.isNaN(deadlineMs)) {
    return {
      status: "not_started",
      label: "Not started",
      secondsRemaining: null
    };
  }

  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) {
    return {
      status: "overdue",
      label: `Overdue ${formatDuration(Math.abs(diffMs))}`,
      secondsRemaining: Math.floor(diffMs / 1000)
    };
  }

  const warningThresholdMs = 24 * 60 * 60 * 1000;
  return {
    status: diffMs <= warningThresholdMs ? "warning" : "on_track",
    label: `${formatDuration(diffMs)} remaining`,
    secondsRemaining: Math.floor(diffMs / 1000)
  };
}

export function countdownBadgeClass(status: CountdownStatus): string {
  if (status === "completed") {
    return "border-[#bdd4c5] bg-[#edf5ef] text-[var(--success)]";
  }

  if (status === "overdue") {
    return "border-rose-200 bg-rose-50 text-[var(--danger)]";
  }

  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-[var(--warning)]";
  }

  if (status === "on_track") {
    return "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-700";
  }

  return "border-[var(--border)] bg-[var(--surface-muted)] text-slate-500";
}
