"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { toast } from "sonner";

const toastMessages: Record<string, { message: string; description?: string }> = {
  invitation_sent: {
    message: "Invitation sent",
    description: "The supplier has been emailed the onboarding link."
  },
  expiration_reminder_sent: {
    message: "Expiration reminder sent",
    description: "The supplier has been emailed a reminder about expiring documents."
  }
};

function CaseToastHandlerInner() {
  const searchParams = useSearchParams();
  const toastType = searchParams.get("toast");

  useEffect(() => {
    if (toastType && toastMessages[toastType]) {
      const { message, description } = toastMessages[toastType];
      toast.success(message, { description });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toastType]);

  return null;
}

export function CaseToastHandler() {
  return (
    <Suspense fallback={null}>
      <CaseToastHandlerInner />
    </Suspense>
  );
}
