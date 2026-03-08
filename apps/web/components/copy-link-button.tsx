"use client";

import { type ReactNode, useState } from "react";

interface CopyLinkButtonProps {
  value: string;
  label: string;
  successLabel: string;
  className?: string;
  icon?: ReactNode;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CopyLinkButton({ value, label, successLabel, className, icon }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className={[
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[var(--surface-muted)]",
        className ?? ""
      ].join(" ")}
    >
      {icon}
      {copied ? successLabel : label}
    </button>
  );
}
