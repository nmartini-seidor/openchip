"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

interface SupplierOtpRequestButtonProps {
  hasRequested: boolean;
  initialCooldownSeconds: number;
  requestLabel: string;
  resendLabel: string;
  pendingLabel: string;
  cooldownLabelTemplate: string;
  className?: string;
}

function SupplierOtpRequestButtonInner({
  hasRequested,
  initialCooldownSeconds,
  requestLabel,
  resendLabel,
  pendingLabel,
  cooldownLabelTemplate,
  className
}: SupplierOtpRequestButtonProps) {
  const { pending } = useFormStatus();
  const [remainingSeconds, setRemainingSeconds] = useState(initialCooldownSeconds);

  useEffect(() => {
    setRemainingSeconds(initialCooldownSeconds);
  }, [initialCooldownSeconds]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  if (pending) {
    return (
      <button type="submit" disabled className={className}>
        {pendingLabel}
      </button>
    );
  }

  if (remainingSeconds > 0) {
    return (
      <button type="submit" disabled className={className}>
        {cooldownLabelTemplate.replace("{seconds}", `${remainingSeconds}`)}
      </button>
    );
  }

  return (
    <button type="submit" className={className}>
      {hasRequested ? resendLabel : requestLabel}
    </button>
  );
}

export function SupplierOtpRequestButton(props: SupplierOtpRequestButtonProps) {
  return <SupplierOtpRequestButtonInner {...props} />;
}
