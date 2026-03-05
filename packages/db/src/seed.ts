import { buildRequirementMatrix } from "@openchip/workflow";
import { documentCatalog, supplierCategories } from "@openchip/shared";

function main(): void {
  const requirementMatrix = buildRequirementMatrix();

  console.log("Master data ready");
  console.log(`Supplier categories: ${supplierCategories.length}`);
  console.log(`Document catalog entries: ${documentCatalog.length}`);
  console.log(`Requirement matrix rows: ${requirementMatrix.length}`);
}

main();
