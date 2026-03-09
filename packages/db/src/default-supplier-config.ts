import {
  DocumentCode,
  documentCodes,
  FundingType,
  LocationType,
  RequirementLevel,
  RequirementRow,
  supplierCategories,
  SupplierCategory,
  SupplierType
} from "@openchip/shared";

export interface SupplierTypeSeed {
  id: string;
  key: SupplierType;
  label: string;
}

export const defaultSupplierTypeSeeds: readonly SupplierTypeSeed[] = [
  { id: "supplier-type-subcontractor", key: "subcontractor", label: "Subcontractor" },
  { id: "supplier-type-standard", key: "standard", label: "Standard" },
  { id: "supplier-type-ecommerce", key: "ecommerce", label: "E-Commerce" },
  { id: "supplier-type-one-time", key: "one_time", label: "One-Time Supplier" }
] as const;

interface NonSubsidizedColumns {
  standardInternational: RequirementLevel;
  standardNational: RequirementLevel;
  oneTimeInternational: RequirementLevel;
  oneTimeNational: RequirementLevel;
  ecommerce: RequirementLevel;
}

interface SubsidizedColumns {
  standardInternational: RequirementLevel;
  subcontractorInternational: RequirementLevel;
  standardNational: RequirementLevel;
  subcontractorNational: RequirementLevel;
}

const nonSubsidizedMatrix: Record<string, NonSubsidizedColumns> = {
  "FIN-01": {
    standardInternational: "mandatory",
    standardNational: "mandatory",
    oneTimeInternational: "mandatory",
    oneTimeNational: "mandatory",
    ecommerce: "mandatory"
  },
  "FIN-02": {
    standardInternational: "mandatory",
    standardNational: "mandatory",
    oneTimeInternational: "mandatory",
    oneTimeNational: "mandatory",
    ecommerce: "optional"
  },
  "FIN-03": {
    standardInternational: "optional",
    standardNational: "optional",
    oneTimeInternational: "optional",
    oneTimeNational: "optional",
    ecommerce: "optional"
  },
  "TAX-01": {
    standardInternational: "mandatory",
    standardNational: "not_applicable",
    oneTimeInternational: "mandatory",
    oneTimeNational: "not_applicable",
    ecommerce: "mandatory"
  },
  "TAX-02": {
    standardInternational: "not_applicable",
    standardNational: "optional",
    oneTimeInternational: "not_applicable",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "SS-01": {
    standardInternational: "not_applicable",
    standardNational: "optional",
    oneTimeInternational: "not_applicable",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "TAX-03": {
    standardInternational: "not_applicable",
    standardNational: "optional",
    oneTimeInternational: "not_applicable",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "LEG-01": {
    standardInternational: "mandatory",
    standardNational: "mandatory",
    oneTimeInternational: "optional",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "SUB-01": {
    standardInternational: "not_applicable",
    standardNational: "not_applicable",
    oneTimeInternational: "not_applicable",
    oneTimeNational: "not_applicable",
    ecommerce: "not_applicable"
  },
  "SUB-02": {
    standardInternational: "not_applicable",
    standardNational: "not_applicable",
    oneTimeInternational: "not_applicable",
    oneTimeNational: "not_applicable",
    ecommerce: "not_applicable"
  },
  "SUS-01": {
    standardInternational: "optional",
    standardNational: "optional",
    oneTimeInternational: "optional",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "DPO-01": {
    standardInternational: "optional",
    standardNational: "optional",
    oneTimeInternational: "optional",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  },
  "DPO-02": {
    standardInternational: "optional",
    standardNational: "optional",
    oneTimeInternational: "optional",
    oneTimeNational: "optional",
    ecommerce: "not_applicable"
  }
};

const subsidizedMatrix: Record<string, SubsidizedColumns> = {
  "FIN-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "FIN-02": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "FIN-03": {
    standardInternational: "optional",
    subcontractorInternational: "optional",
    standardNational: "optional",
    subcontractorNational: "optional"
  },
  "TAX-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "not_applicable",
    subcontractorNational: "not_applicable"
  },
  "TAX-02": {
    standardInternational: "not_applicable",
    subcontractorInternational: "mandatory",
    standardNational: "not_applicable",
    subcontractorNational: "mandatory"
  },
  "SS-01": {
    standardInternational: "not_applicable",
    subcontractorInternational: "mandatory",
    standardNational: "not_applicable",
    subcontractorNational: "mandatory"
  },
  "TAX-03": {
    standardInternational: "not_applicable",
    subcontractorInternational: "not_applicable",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "LEG-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "SUB-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "SUB-02": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "SUS-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "DPO-01": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  },
  "DPO-02": {
    standardInternational: "mandatory",
    subcontractorInternational: "mandatory",
    standardNational: "mandatory",
    subcontractorNational: "mandatory"
  }
};

interface RequirementLookupInput {
  funding: FundingType;
  typeKey: SupplierType;
  location: LocationType;
  documentCode: DocumentCode;
}

export function getDefaultRequirementLevel(input: RequirementLookupInput): RequirementLevel {
  if (input.funding === "subsidized") {
    const values = subsidizedMatrix[input.documentCode];
    if (values === undefined) {
      return "not_applicable";
    }
    if (input.location === "international" && input.typeKey === "subcontractor") {
      return values.subcontractorInternational;
    }

    if (input.location === "national" && input.typeKey === "subcontractor") {
      return values.subcontractorNational;
    }

    if (input.location === "international") {
      return values.standardInternational;
    }

    return values.standardNational;
  }

  const values = nonSubsidizedMatrix[input.documentCode];
  if (values === undefined) {
    return "not_applicable";
  }

  if (input.typeKey === "ecommerce") {
    return values.ecommerce;
  }

  if (input.typeKey === "one_time") {
    return input.location === "international" ? values.oneTimeInternational : values.oneTimeNational;
  }

  // Explicit product decision: NSUB subcontractor mirrors NSUB standard.
  if (input.location === "international") {
    return values.standardInternational;
  }

  return values.standardNational;
}

export function buildDefaultRequirementRowsForCategory(category: Pick<SupplierCategory, "code" | "funding" | "type" | "location">): RequirementRow[] {
  return documentCodes.map((documentCode) => ({
    categoryCode: category.code,
    documentCode,
    requirementLevel: getDefaultRequirementLevel({
      funding: category.funding,
      typeKey: category.type,
      location: category.location,
      documentCode
    })
  }));
}

export function buildDefaultRequirementMatrixRows(): RequirementRow[] {
  const rows: RequirementRow[] = [];

  for (const category of supplierCategories) {
    rows.push(...buildDefaultRequirementRowsForCategory(category));
  }

  return rows;
}
