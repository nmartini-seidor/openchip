import {
  documentCodes,
  RequirementLevel,
  RequirementRow,
  supplierCategories,
  SupplierCategory,
  SupplierCategoryCode
} from "@openchip/shared";

function resolveRequirementLevel(category: SupplierCategory, code: (typeof documentCodes)[number]): RequirementLevel {
  const isSubsidized = category.funding === "subsidized";
  const isNonSubsidized = category.funding === "non_subsidized";
  const isInternational = category.location === "international";
  const isNational = category.location === "national";
  const isSubcontractor = category.type === "subcontractor";
  const isStandard = category.type === "standard";
  const isEcommerce = category.type === "ecommerce";
  const isOneTime = category.type === "one_time";

  switch (code) {
    case "FIN-01":
      return "mandatory";
    case "FIN-02":
      if (isOneTime && isNational) {
        return "not_applicable";
      }
      if (isOneTime && isInternational) {
        return "optional";
      }
      return "mandatory";
    case "FIN-03":
      if (isOneTime) {
        return "not_applicable";
      }
      return "optional";
    case "TAX-01":
      if (isInternational && !isSubcontractor) {
        return "mandatory";
      }
      return "not_applicable";
    case "TAX-02":
      return isSubcontractor ? "mandatory" : "not_applicable";
    case "SS-01":
      return isSubcontractor ? "mandatory" : "not_applicable";
    case "TAX-03":
      if (isNational && (isStandard || isSubcontractor)) {
        return "mandatory";
      }
      return "not_applicable";
    case "LEG-01":
      if (isSubsidized) {
        return "mandatory";
      }
      if (isOneTime) {
        return "not_applicable";
      }
      if (isEcommerce) {
        return "mandatory";
      }
      return "optional";
    case "SUB-01":
      return isSubsidized ? "mandatory" : "not_applicable";
    case "SUB-02":
      return isSubsidized ? "mandatory" : "not_applicable";
    case "SUS-01":
      if (isSubsidized) {
        return "mandatory";
      }
      if (isNonSubsidized && !isOneTime) {
        return "optional";
      }
      return "not_applicable";
    case "DPO-01":
      if (isSubsidized) {
        return "mandatory";
      }
      if (isNonSubsidized && !isOneTime) {
        return "optional";
      }
      return "not_applicable";
    case "DPO-02":
      if (isSubsidized) {
        return "mandatory";
      }
      if (isOneTime) {
        return "not_applicable";
      }
      return "optional";
    default:
      return "not_applicable";
  }
}

export function buildRequirementMatrix(): RequirementRow[] {
  const rows: RequirementRow[] = [];

  for (const category of supplierCategories) {
    for (const documentCode of documentCodes) {
      const requirementLevel = resolveRequirementLevel(category, documentCode);
      if (requirementLevel !== "not_applicable") {
        rows.push({
          categoryCode: category.code,
          documentCode,
          requirementLevel
        });
      }
    }
  }

  return rows;
}

const requirementMatrix = buildRequirementMatrix();

export function resolveRequirementsForCategory(categoryCode: SupplierCategoryCode): RequirementRow[] {
  return requirementMatrix.filter((row) => row.categoryCode === categoryCode);
}

export function getRequirementLevel(categoryCode: SupplierCategoryCode, documentCode: (typeof documentCodes)[number]): RequirementLevel {
  const match = requirementMatrix.find(
    (row) => row.categoryCode === categoryCode && row.documentCode === documentCode
  );

  return match?.requirementLevel ?? "not_applicable";
}

export function getRequirementMatrixCount(): number {
  return requirementMatrix.length;
}
