"use client";

import { useMemo, useState } from "react";
import { RequirementPreviewRow, SupplierCategoryDefinition } from "@openchip/shared";
import { SectionCard } from "@/components/section-card";

interface CategoryRequirementsSelectorProps {
  categories: readonly SupplierCategoryDefinition[];
  previewsByCategory: Record<string, RequirementPreviewRow[]>;
}

const levelClassName: Record<string, string> = {
  mandatory: "border-rose-200 bg-rose-50 text-rose-700",
  optional: "border-amber-200 bg-amber-50 text-amber-700",
  not_applicable: "border-slate-200 bg-slate-50 text-slate-600"
};

const levelLabel: Record<string, string> = {
  mandatory: "Mandatory",
  optional: "Optional",
  not_applicable: "N/A"
};

function formatEnumLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function ownerLabel(value: string): string {
  if (value === "contracts_justifications") {
    return "Contracts & Justifications";
  }

  return formatEnumLabel(value);
}

export function CategoryRequirementsSelector({ categories, previewsByCategory }: CategoryRequirementsSelectorProps) {
  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.code === selectedCategoryCode) ?? null,
    [categories, selectedCategoryCode]
  );

  const previewRows = useMemo(() => {
    if (selectedCategoryCode.length === 0) {
      return [];
    }

    return previewsByCategory[selectedCategoryCode] ?? [];
  }, [previewsByCategory, selectedCategoryCode]);

  const mandatoryRows = useMemo(
    () => previewRows.filter((row) => row.requirementLevel === "mandatory"),
    [previewRows]
  );

  const optionalNaRows = useMemo(
    () => previewRows.filter((row) => row.requirementLevel === "optional" || row.requirementLevel === "not_applicable"),
    [previewRows]
  );

  return (
    <div className="contents">
      <div className="grid gap-3 lg:col-span-2">
        <label htmlFor="categoryCode" className="text-sm font-semibold text-slate-700">
          Supplier Category
          <span className="text-red-600" aria-hidden> *</span>
        </label>
        <select
          id="categoryCode"
          name="categoryCode"
          required
          value={selectedCategoryCode}
          onChange={(event) => setSelectedCategoryCode(event.target.value)}
          className="oc-select rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
        >
          <option value="">Select a supplier category</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.code} - {category.label}
            </option>
          ))}
        </select>
        {selectedCategoryCode.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-slate-600">
            Select a category to preview document requirements.
          </p>
        ) : null}
      </div>

      {selectedCategoryCode.length > 0 ? (
        <>
          <SectionCard
            title="Mandatory"
            {...(selectedCategory !== null
              ? { subtitle: `${formatEnumLabel(selectedCategory.funding)} / ${selectedCategory.typeLabel} / ${formatEnumLabel(selectedCategory.location)}` }
              : {})}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Document</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="py-2 pr-3">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {mandatoryRows.map((row) => (
                    <tr key={`${selectedCategoryCode}-${row.code}-m`} className="border-b border-[var(--border)]/70 align-top">
                      <td className="py-2 pr-3 text-slate-700">{row.name}</td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{row.code}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                            levelClassName[row.requirementLevel]
                          }`}
                        >
                          {levelLabel[row.requirementLevel]}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{ownerLabel(row.owner)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          <SectionCard
            title="Optional / N/A"
            {...(selectedCategory !== null
              ? { subtitle: `${formatEnumLabel(selectedCategory.funding)} / ${selectedCategory.typeLabel} / ${formatEnumLabel(selectedCategory.location)}` }
              : {})}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Document</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="py-2 pr-3">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {optionalNaRows.map((row) => (
                    <tr key={`${selectedCategoryCode}-${row.code}-o`} className="border-b border-[var(--border)]/70 align-top">
                      <td className="py-2 pr-3 text-slate-700">{row.name}</td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{row.code}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                            levelClassName[row.requirementLevel]
                          }`}
                        >
                          {levelLabel[row.requirementLevel]}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{ownerLabel(row.owner)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
