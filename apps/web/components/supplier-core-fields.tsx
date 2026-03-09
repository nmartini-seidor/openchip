import { VatInput } from "@/components/vat-input";

interface SupplierCoreFieldsProps {
  labels: {
    supplierName: string;
    supplierVat: string;
    supplierContactName: string;
    supplierContactEmail: string;
  };
  initialValues?: {
    supplierName?: string;
    supplierVat?: string;
    supplierContactName?: string;
    supplierContactEmail?: string;
  };
}

export function SupplierCoreFields({ labels, initialValues }: SupplierCoreFieldsProps) {
  return (
    <>
      <div className="grid gap-2 self-start">
        <label htmlFor="supplierName" className="min-h-[1.5rem] text-sm font-semibold text-slate-700">
          {labels.supplierName}
          <span className="text-red-600" aria-hidden>
            {" "}
            *
          </span>
        </label>
        <input
          id="supplierName"
          name="supplierName"
          required
          autoComplete="organization"
          className="oc-input"
          defaultValue={initialValues?.supplierName}
        />
      </div>

      <VatInput
        label={labels.supplierVat}
        inputId="supplierVat"
        inputName="supplierVat"
        {...(initialValues?.supplierVat !== undefined ? { defaultValue: initialValues.supplierVat } : {})}
      />

      <div className="grid gap-2">
        <label htmlFor="supplierContactName" className="text-sm font-semibold text-slate-700">
          {labels.supplierContactName}
          <span className="text-red-600" aria-hidden>
            {" "}
            *
          </span>
        </label>
        <input
          id="supplierContactName"
          name="supplierContactName"
          required
          autoComplete="name"
          className="oc-input"
          defaultValue={initialValues?.supplierContactName}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="supplierContactEmail" className="text-sm font-semibold text-slate-700">
          {labels.supplierContactEmail}
          <span className="text-red-600" aria-hidden>
            {" "}
            *
          </span>
        </label>
        <input
          id="supplierContactEmail"
          name="supplierContactEmail"
          required
          type="email"
          autoComplete="email"
          spellCheck={false}
          inputMode="email"
          className="oc-input"
          defaultValue={initialValues?.supplierContactEmail}
        />
      </div>
    </>
  );
}
