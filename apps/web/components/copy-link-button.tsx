"use client";

import { useState } from "react";

interface CopyLinkButtonProps {
  value: string;
  label: string;
  successLabel: string;
}

export function CopyLinkButton({ value, label, successLabel }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)]"
    >
      {copied ? successLabel : label}
    </button>
  );
}
