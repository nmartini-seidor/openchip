"use client";

import { useCallback, useMemo, useState } from "react";
import type { UploadedDocumentFile } from "@openchip/shared";
import type { CountryOption } from "@/lib/countries";
import { FilterableCountrySelect } from "@/components/filterable-country-select";

interface SupplierRequirementView {
  code: string;
  label: string;
  requirementLevel: "mandatory" | "optional";
  requirementLabel: string;
  templateHref: string | null;
  files: UploadedDocumentFile[];
}

interface SupplierOnboardingFormLabels {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  countryPlaceholder: string;
  bankSectionTitle: string;
  bankSectionSubtitle: string;
  banks: string;
  bankl: string;
  iban: string;
  bankn: string;
  bkont: string;
  accname: string;
  saveDraft: string;
  savingDraft: string;
  draftSaved: string;
  draftSaveError: string;
  requiredDocsTitle: string;
  requiredDocsSubtitle: string;
  uploadFiles: string;
  uploadingFiles: string;
  templateDownload: string;
  noTemplate: string;
  uploadedFiles: string;
  noFiles: string;
}

interface SupplierDraftInitialValue {
  address: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  bankAccount: {
    banks?: string;
    bankl?: string;
    bankn?: string;
    bkont?: string;
    accname?: string;
    iban?: string;
  };
}

interface SupplierOnboardingFormProps {
  token: string;
  labels: SupplierOnboardingFormLabels;
  countries: CountryOption[];
  requirements: SupplierRequirementView[];
  initialDraft: SupplierDraftInitialValue;
}

type UploadStatus = "idle" | "uploading" | "error";
type DraftStatus = "idle" | "saving" | "saved" | "error";

export function SupplierOnboardingForm({
  token,
  labels,
  countries,
  requirements,
  initialDraft
}: SupplierOnboardingFormProps) {
  const [street, setStreet] = useState(initialDraft.address.street ?? "");
  const [city, setCity] = useState(initialDraft.address.city ?? "");
  const [postalCode, setPostalCode] = useState(initialDraft.address.postalCode ?? "");
  const [country, setCountry] = useState(initialDraft.address.country ?? "");
  const [banks, setBanks] = useState(initialDraft.bankAccount.banks ?? "");
  const [bankl, setBankl] = useState(initialDraft.bankAccount.bankl ?? "");
  const [iban, setIban] = useState(initialDraft.bankAccount.iban ?? "");
  const [bankn, setBankn] = useState(initialDraft.bankAccount.bankn ?? "");
  const [bkont, setBkont] = useState(initialDraft.bankAccount.bkont ?? "");
  const [accname, setAccname] = useState(initialDraft.bankAccount.accname ?? "");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [activeRequirementCode, setActiveRequirementCode] = useState<string>(requirements[0]?.code ?? "");
  const [uploadStatusByCode, setUploadStatusByCode] = useState<Record<string, UploadStatus>>({});
  const [filesByCode, setFilesByCode] = useState<Record<string, UploadedDocumentFile[]>>(() => {
    const initial: Record<string, UploadedDocumentFile[]> = {};
    for (const requirement of requirements) {
      initial[requirement.code] = [...requirement.files];
    }
    return initial;
  });

  const handleSaveDraft = useCallback(async () => {
    setDraftStatus("saving");
    try {
      const response = await fetch(`/api/supplier/session/${token}/draft`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          address: {
            street,
            city,
            postalCode,
            country
          },
          bankAccount: {
            banks,
            bankl,
            bankn,
            bkont,
            accname,
            iban
          }
        })
      });

      if (!response.ok) {
        throw new Error("Draft save failed");
      }

      setDraftStatus("saved");
    } catch {
      setDraftStatus("error");
    }
  }, [accname, bankl, bankn, banks, bkont, city, country, iban, postalCode, street, token]);

  const handleUpload = useCallback(
    async (code: string, fileList: FileList | null) => {
      if (fileList === null || fileList.length === 0) {
        return;
      }

      setUploadStatusByCode((current) => ({ ...current, [code]: "uploading" }));
      const payload = new FormData();
      payload.set("code", code);
      for (const file of Array.from(fileList)) {
        payload.append("files", file);
      }

      try {
        const response = await fetch(`/api/supplier/session/${token}/documents`, {
          method: "POST",
          body: payload
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = (await response.json()) as {
          code: string;
          files: UploadedDocumentFile[];
        };

        setFilesByCode((current) => ({
          ...current,
          [data.code]: [...(current[data.code] ?? []), ...data.files]
        }));
        setUploadStatusByCode((current) => ({ ...current, [code]: "idle" }));
      } catch {
        setUploadStatusByCode((current) => ({ ...current, [code]: "error" }));
      }
    },
    [token]
  );

  const draftStatusText = useMemo(() => {
    if (draftStatus === "saving") {
      return labels.savingDraft;
    }
    if (draftStatus === "saved") {
      return labels.draftSaved;
    }
    if (draftStatus === "error") {
      return labels.draftSaveError;
    }
    return "";
  }, [draftStatus, labels.draftSaveError, labels.draftSaved, labels.savingDraft]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <label htmlFor="street" className="text-sm font-semibold text-slate-700">
              {labels.street}
            </label>
            <input
              id="street"
              name="street"
              required
              autoComplete="address-line1"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              className="oc-input"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="city" className="text-sm font-semibold text-slate-700">
              {labels.city}
            </label>
            <input
              id="city"
              name="city"
              required
              autoComplete="address-level2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="oc-input"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="postalCode" className="text-sm font-semibold text-slate-700">
              {labels.postalCode}
            </label>
            <input
              id="postalCode"
              name="postalCode"
              required
              autoComplete="postal-code"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              className="oc-input"
            />
          </div>

          <FilterableCountrySelect
            id="country"
            name="country"
            label={labels.country}
            options={countries}
            placeholder={labels.countryPlaceholder}
            value={country}
            onValueChange={(value) => setCountry(value)}
            required
          />
        </div>

        <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{labels.bankSectionTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{labels.bankSectionSubtitle}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FilterableCountrySelect
              id="banks"
              name="banks"
              label={labels.banks}
              options={countries}
              placeholder={labels.countryPlaceholder}
              value={banks}
              onValueChange={(value) => setBanks(value)}
              required
            />
            <div className="grid gap-2">
              <label htmlFor="bankl" className="text-sm font-semibold text-slate-700">
                {labels.bankl}
              </label>
              <input
                id="bankl"
                name="bankl"
                maxLength={15}
                required
                value={bankl}
                onChange={(event) => setBankl(event.target.value)}
                className="oc-input"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="iban" className="text-sm font-semibold text-slate-700">
                {labels.iban}
              </label>
              <input
                id="iban"
                name="iban"
                maxLength={34}
                value={iban}
                onChange={(event) => setIban(event.target.value)}
                className="oc-input"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="bankn" className="text-sm font-semibold text-slate-700">
                {labels.bankn}
              </label>
              <input
                id="bankn"
                name="bankn"
                maxLength={18}
                value={bankn}
                onChange={(event) => setBankn(event.target.value)}
                className="oc-input"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="bkont" className="text-sm font-semibold text-slate-700">
                {labels.bkont}
              </label>
              <input
                id="bkont"
                name="bkont"
                maxLength={2}
                value={bkont}
                onChange={(event) => setBkont(event.target.value)}
                className="oc-input"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="accname" className="text-sm font-semibold text-slate-700">
                {labels.accname}
              </label>
              <input
                id="accname"
                name="accname"
                maxLength={40}
                required
                value={accname}
                onChange={(event) => setAccname(event.target.value)}
                className="oc-input"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSaveDraft();
            }}
            className="oc-btn oc-btn-secondary"
          >
            {labels.saveDraft}
          </button>
          {draftStatusText.length > 0 ? <p className="text-xs text-slate-600">{draftStatusText}</p> : null}
        </div>
      </div>

      <aside className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{labels.requiredDocsTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{labels.requiredDocsSubtitle}</p>
        </div>
        {requirements.map((requirement) => {
          const isOpen = activeRequirementCode === requirement.code;
          const uploadStatus = uploadStatusByCode[requirement.code] ?? "idle";
          const files = filesByCode[requirement.code] ?? [];

          return (
            <section key={requirement.code} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left"
                onClick={() => {
                  setActiveRequirementCode((current) => (current === requirement.code ? "" : requirement.code));
                }}
              >
                <span className="text-sm font-semibold text-slate-900">
                  {requirement.label} ({requirement.code})
                </span>
                <span
                  className={
                    requirement.requirementLevel === "mandatory"
                      ? "inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                      : "inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                  }
                >
                  {requirement.requirementLabel}
                </span>
              </button>
              {isOpen ? (
                <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
                  {requirement.templateHref !== null ? (
                    <a href={requirement.templateHref} className="oc-btn oc-btn-secondary w-full justify-center">
                      {labels.templateDownload}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">{labels.noTemplate}</p>
                  )}

                  <div className="space-y-2">
                    <label htmlFor={`upload-${requirement.code}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {labels.uploadFiles}
                    </label>
                    <input
                      id={`upload-${requirement.code}`}
                      type="file"
                      multiple
                      className="oc-input text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--cta)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--cta-strong)]"
                      onChange={(event) => {
                        void handleUpload(requirement.code, event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                    />
                    {uploadStatus === "uploading" ? <p className="text-xs text-slate-500">{labels.uploadingFiles}</p> : null}
                    {uploadStatus === "error" ? <p className="text-xs text-rose-600">{labels.draftSaveError}</p> : null}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{labels.uploadedFiles}</p>
                    {files.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-700">
                        {files.map((file) => (
                          <li key={file.id}>
                            <a
                              href={`/api/supplier/session/${token}/documents/${requirement.code}/files/${file.id}`}
                              className="cursor-pointer text-[var(--primary)] hover:text-[var(--primary-strong)] hover:underline"
                            >
                              {file.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">{labels.noFiles}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </aside>
    </div>
  );
}
