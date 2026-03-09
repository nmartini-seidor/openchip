"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { toast } from "sonner";

const toastMessages: Record<string, { message: string; description?: string; variant?: "success" | "error" }> = {
  invitation_sent: {
    message: "Invitation sent",
    description: "The supplier has been emailed the onboarding link."
  },
  expiration_reminder_sent: {
    message: "Expiration reminder sent",
    description: "The supplier has been emailed a reminder about expiring documents."
  },
  supplier_info_updated: {
    message: "Supplier information updated",
    description: "The case metadata now reflects the latest supplier details."
  },
  supplier_info_update_invalid: {
    message: "Could not update supplier information",
    description: "Please review the required fields.",
    variant: "error"
  },
  supplier_info_update_duplicate_vat: {
    message: "Could not update supplier information",
    description: "Another active onboarding case already uses this VAT / Tax ID.",
    variant: "error"
  },
  supplier_info_update_locked: {
    message: "Supplier information cannot be edited",
    description: "This case has already been finalized.",
    variant: "error"
  },
  supplier_info_update_failed: {
    message: "Could not update supplier information",
    description: "An unexpected error occurred.",
    variant: "error"
  }
};

function CaseToastHandlerInner() {
  const searchParams = useSearchParams();
  const toastType = searchParams.get("toast");

  useEffect(() => {
    if (toastType && toastMessages[toastType]) {
      const { message, description, variant } = toastMessages[toastType];
      const toastId = `case-toast-${toastType}`;
      if (variant === "error") {
        toast.error(message, { id: toastId, description });
      } else {
        toast.success(message, { id: toastId, description });
      }
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
