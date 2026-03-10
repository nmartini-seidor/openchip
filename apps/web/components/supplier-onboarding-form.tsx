"use client";

import { CheckCircle2, Circle, Download, LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ibanOrAccountNumber: string;
  ibanInvalid: string;
  ibanValid: string;
  accname: string;
  autoSaveIdle: string;
  autoSaving: string;
  autoSaved: string;
  draftSaveError: string;
  requiredDocsTitle: string;
  requiredDocsSubtitle: string;
  uploadFiles: string;
  uploadingFiles: string;
  templateDownload: string;
  noTemplate: string;
  uploadedFiles: string;
  noFiles: string;
  missingMandatoryTitle: string;
  missingMandatoryHint: string;
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
    bankn?: string;
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
  initialMissingDocumentCodes?: string[];
}

type UploadStatus = "idle" | "uploading" | "error";
type DraftStatus = "idle" | "saving" | "saved" | "error";
type IbanValidationState = "empty" | "account_number" | "valid" | "invalid";

function normalizeIbanInput(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isLikelyIban(value: string): boolean {
  const normalized = normalizeIbanInput(value);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{6,30}$/.test(normalized);
}

function isValidIbanChecksum(value: string): boolean {
  const normalized = normalizeIbanInput(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$/.test(normalized)) {
    return false;
  }

  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numericChunk =
      character >= "A" && character <= "Z"
        ? (character.charCodeAt(0) - 55).toString()
        : character;

    for (const digit of numericChunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder === 1;
}

export function SupplierOnboardingForm({
  token,
  labels,
  countries,
  requirements,
  initialDraft,
  initialMissingDocumentCodes = []
}: SupplierOnboardingFormProps) {
  const [street, setStreet] = useState(initialDraft.address.street ?? "");
  const [city, setCity] = useState(initialDraft.address.city ?? "");
  const [postalCode, setPostalCode] = useState(initialDraft.address.postalCode ?? "");
  const [country, setCountry] = useState(initialDraft.address.country ?? "");
  const [banks, setBanks] = useState(initialDraft.bankAccount.banks ?? "");
  const [bankAccountValue, setBankAccountValue] = useState(
    initialDraft.bankAccount.iban ?? initialDraft.bankAccount.bankn ?? ""
  );
  const [accname, setAccname] = useState(initialDraft.bankAccount.accname ?? "");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [activeRequirementCode, setActiveRequirementCode] = useState<string>(() => {
    const preferredCode = initialMissingDocumentCodes.find((code) =>
      requirements.some((requirement) => requirement.code === code)
    );
    return preferredCode ?? requirements[0]?.code ?? "";
  });
  const [uploadStatusByCode, setUploadStatusByCode] = useState<Record<string, UploadStatus>>({});
  const [filesByCode, setFilesByCode] = useState<Record<string, UploadedDocumentFile[]>>(() => {
    const initial: Record<string, UploadedDocumentFile[]> = {};
    for (const requirement of requirements) {
      initial[requirement.code] = [...requirement.files];
    }
    return initial;
  });
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef<{ payload: SupplierDraftInitialValue; serialized: string } | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftPayload = useMemo(
    () => ({
      address: {
        street,
        city,
        postalCode,
        country
      },
      bankAccount: {
        banks,
        bankn: isLikelyIban(bankAccountValue) ? "" : bankAccountValue.trim(),
        accname,
        iban: isLikelyIban(bankAccountValue) ? normalizeIbanInput(bankAccountValue) : ""
      }
    }),
    [accname, bankAccountValue, banks, city, country, postalCode, street]
  );

  const initialSerializedPayloadRef = useRef(JSON.stringify(draftPayload));
  const lastSavedSerializedPayloadRef = useRef(initialSerializedPayloadRef.current);
  const serializedDraftPayload = useMemo(() => JSON.stringify(draftPayload), [draftPayload]);

  const markSaved = useCallback(() => {
    setDraftStatus("saved");
    if (clearSavedStatusTimerRef.current !== null) {
      clearTimeout(clearSavedStatusTimerRef.current);
    }
    clearSavedStatusTimerRef.current = setTimeout(() => {
      setDraftStatus((current) => (current === "saved" ? "idle" : current));
    }, 1800);
  }, []);

  const handleSaveDraft = useCallback(async (payload: SupplierDraftInitialValue, serialized: string) => {
    if (serialized === lastSavedSerializedPayloadRef.current) {
      markSaved();
      return;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = { payload, serialized };
      return;
    }

    saveInFlightRef.current = true;
    setDraftStatus("saving");
    try {
      const response = await fetch(`/api/supplier/session/${token}/draft`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Draft save failed");
      }

      lastSavedSerializedPayloadRef.current = serialized;
      markSaved();
    } catch {
      setDraftStatus("error");
    } finally {
      saveInFlightRef.current = false;
      const queued = queuedSaveRef.current;
      queuedSaveRef.current = null;
      if (queued !== null) {
        void handleSaveDraft(queued.payload, queued.serialized);
      }
    }
  }, [markSaved, token]);

  const handleUpload = useCallback(
    async (code: string, fileList: FileList | null) => {
      if (fileList === null || fileList.length === 0) {
        return;
      }

      setDraftStatus("saving");
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
        void handleSaveDraft(draftPayload, serializedDraftPayload);
      } catch {
        setUploadStatusByCode((current) => ({ ...current, [code]: "error" }));
        setDraftStatus("error");
      }
    },
    [draftPayload, handleSaveDraft, serializedDraftPayload, token]
  );

  useEffect(() => {
    if (serializedDraftPayload === lastSavedSerializedPayloadRef.current) {
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void handleSaveDraft(draftPayload, serializedDraftPayload);
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [draftPayload, handleSaveDraft, serializedDraftPayload]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (clearSavedStatusTimerRef.current !== null) {
        clearTimeout(clearSavedStatusTimerRef.current);
      }
    };
  }, []);

  const draftStatusText = useMemo(() => {
    if (draftStatus === "saving") {
      return labels.autoSaving;
    }
    if (draftStatus === "saved") {
      return labels.autoSaved;
    }
    if (draftStatus === "error") {
      return labels.draftSaveError;
    }
    return labels.autoSaveIdle;
  }, [draftStatus, labels.autoSaveIdle, labels.autoSaved, labels.autoSaving, labels.draftSaveError]);

  const ibanValidation = useMemo<IbanValidationState>(() => {
    const trimmed = bankAccountValue.trim();
    if (trimmed.length === 0) {
      return "empty";
    }

    if (!isLikelyIban(trimmed)) {
      return "account_number";
    }

    return isValidIbanChecksum(trimmed) ? "valid" : "invalid";
  }, [bankAccountValue]);

  const missingMandatoryRequirements = useMemo(
    () =>
      requirements.filter((requirement) => {
        if (requirement.requirementLevel !== "mandatory") {
          return false;
        }

        const files = filesByCode[requirement.code] ?? [];
        return files.length === 0;
      }),
    [filesByCode, requirements]
  );

  function RequiredAsterisk() {
    return (
      <span aria-hidden="true" className="ml-0.5 text-rose-600">
        *
      </span>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="xl:col-span-2 flex justify-end">
        <div
          data-testid="supplier-autosave-indicator"
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            draftStatus === "saving"
              ? "border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]"
              : draftStatus === "saved"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : draftStatus === "error"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-slate-100 text-slate-600"
          } transition-colors duration-200`}
        >
          {draftStatus === "saving" ? (
            <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : draftStatus === "saved" ? (
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          ) : draftStatus === "error" ? (
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Circle aria-hidden="true" className="h-3 w-3 fill-current" strokeWidth={2} />
          )}
          <span>{draftStatusText}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <label htmlFor="street" className="text-sm font-semibold text-slate-700">
              {labels.street}
              <RequiredAsterisk />
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
              <RequiredAsterisk />
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
              <RequiredAsterisk />
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
              <label htmlFor="bankAccountValue" className="text-sm font-semibold text-slate-700">
                {labels.ibanOrAccountNumber}
                <RequiredAsterisk />
              </label>
              <input
                id="bankAccountValue"
                maxLength={34}
                required
                value={bankAccountValue}
                onChange={(event) => setBankAccountValue(event.target.value)}
                className="oc-input"
              />
              <input
                type="hidden"
                name="iban"
                value={isLikelyIban(bankAccountValue) ? normalizeIbanInput(bankAccountValue) : ""}
              />
              <input
                type="hidden"
                name="bankn"
                value={isLikelyIban(bankAccountValue) ? "" : bankAccountValue.trim()}
              />
              <input type="hidden" name="bankl" value="" />
              <input type="hidden" name="bkont" value="" />
              {ibanValidation === "invalid" ? (
                <p className="text-xs text-rose-600">{labels.ibanInvalid}</p>
              ) : ibanValidation === "valid" ? (
                <p className="text-xs text-emerald-700">{labels.ibanValid}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label htmlFor="accname" className="text-sm font-semibold text-slate-700">
                {labels.accname}
                <RequiredAsterisk />
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

      </div>

      <aside className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{labels.requiredDocsTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{labels.requiredDocsSubtitle}</p>
        </div>
        {missingMandatoryRequirements.length > 0 ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <p className="font-semibold">{labels.missingMandatoryTitle}</p>
            <p className="mt-1">{labels.missingMandatoryHint}</p>
            <ul className="mt-1 list-disc pl-4">
              {missingMandatoryRequirements.map((requirement) => (
                <li key={requirement.code}>
                  {requirement.code} - {requirement.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {requirements.map((requirement) => {
          const isOpen = activeRequirementCode === requirement.code;
          const uploadStatus = uploadStatusByCode[requirement.code] ?? "idle";
          const files = filesByCode[requirement.code] ?? [];
          const missingMandatory = requirement.requirementLevel === "mandatory" && files.length === 0;

          return (
            <section
              key={requirement.code}
              className={`rounded-lg border bg-[var(--surface)] ${
                missingMandatory ? "border-rose-300 bg-rose-50/30" : "border-[var(--border)]"
              }`}
            >
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
                      <Download aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
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
