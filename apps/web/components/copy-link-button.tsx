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
      data-link-value={value}
      onClick={async () => {
        await copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className={[
        "oc-btn oc-btn-secondary oc-btn-compact",
        className ?? ""
      ].join(" ")}
    >
      {icon}
      {copied ? successLabel : label}
    </button>
  );
}
