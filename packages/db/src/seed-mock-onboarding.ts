import { randomUUID } from "node:crypto";
import type { SupplierCategoryCode, UploadedDocumentFile } from "@openchip/shared";
import { getOnboardingRepository } from "./repository";

interface MockCaseSpec {
  label: string;
  categoryCode: SupplierCategoryCode;
  finalizeInSap: boolean;
}

const mockCaseSpecs: readonly MockCaseSpec[] = [
  {
    label: "Mock Subsidized Standard National",
    categoryCode: "SUB-STD-NAT",
    finalizeInSap: true
  },
  {
    label: "Mock Non-Subsidized Standard National",
    categoryCode: "NSUB-STD-NAT",
    finalizeInSap: false
  }
];

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomSuffix(length = 8): string {
  return randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfBuffer(lines: readonly string[]): Buffer {
  const safeLines = lines.map((line) => escapePdfText(line));
  const stream = [
    "BT",
    "/F1 12 Tf",
    "16 TL",
    "72 780 Td",
    ...safeLines.map((line, index) => (index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    "ET"
  ].join("\n");

  const objects: Record<number, string> = {
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    2: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    4: `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  };

  let document = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectId = 1; objectId <= 5; objectId += 1) {
    offsets[objectId] = Buffer.byteLength(document, "utf8");
    const objectContent = objects[objectId];
    if (objectContent === undefined) {
      throw new Error(`Missing PDF object ${objectId}`);
    }
    document += `${objectId} 0 obj\n${objectContent}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(document, "utf8");
  document += "xref\n";
  document += "0 6\n";
  document += "0000000000 65535 f \n";
  for (let objectId = 1; objectId <= 5; objectId += 1) {
    const offset = offsets[objectId];
    if (offset === undefined) {
      throw new Error(`Missing xref offset for object ${objectId}`);
    }
    document += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  document += "trailer\n";
  document += "<< /Size 6 /Root 1 0 R >>\n";
  document += "startxref\n";
  document += `${xrefOffset}\n`;
  document += "%%EOF\n";

  return Buffer.from(document, "utf8");
}

function encodeStoragePath(storagePath: string): string {
  return storagePath
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function ensureStorageBucket(): Promise<{
  storageUrl: string;
  bucket: string;
  serviceKey: string;
}> {
  const storageUrlRaw = process.env.SUPABASE_STORAGE_URL?.trim();
  const serviceKey = process.env.SUPABASE_STORAGE_SERVICE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "openchip-documents";

  if (!storageUrlRaw || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_STORAGE_URL or SUPABASE_STORAGE_SERVICE_KEY. Required to upload mock PDFs."
    );
  }

  const storageUrl = storageUrlRaw.replace(/\/+$/, "");
  const response = await fetch(`${storageUrl}/bucket`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ name: bucket, public: false })
  });

  if (!response.ok) {
    const bodyText = await response.text();
    if (!/already exists|duplicate|exists/i.test(bodyText)) {
      throw new Error(`Unable to ensure bucket "${bucket}": ${response.status} ${bodyText}`);
    }
  }

  return { storageUrl, bucket, serviceKey };
}

async function uploadPdf(
  options: {
    storageUrl: string;
    bucket: string;
    serviceKey: string;
    storagePath: string;
    bytes: Buffer;
  }
): Promise<void> {
  const { storageUrl, bucket, serviceKey, storagePath, bytes } = options;
  const targetUrl = `${storageUrl}/object/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath)}`;
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": "application/pdf",
      "x-upsert": "true"
    },
    body: arrayBuffer
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Failed to upload "${storagePath}": ${response.status} ${bodyText}`);
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log("Usage: pnpm --filter @openchip/db seed:mock [--no-reset]");
    console.log("  --no-reset   Keep existing cases and append mock seeded cases.");
    return;
  }

  const shouldReset = !args.has("--no-reset");
  const repository = getOnboardingRepository();

  if (shouldReset) {
    await repository.resetStore();
    console.log("Store reset complete.");
  }

  const storage = await ensureStorageBucket();
  const actor = "mock.seed";
  const createdCases: string[] = [];
  let uploadedFilesCount = 0;
  let uploadedTemplateFilesCount = 0;

  const mandatoryDocumentCodes = new Set<string>();
  const activeCategories = await repository.listSupplierCategories(false);
  for (const category of activeCategories) {
    const requirements = await repository.getRequirementPreview(category.code);
    for (const requirement of requirements) {
      if (requirement.requirementLevel === "mandatory") {
        mandatoryDocumentCodes.add(requirement.code);
      }
    }
  }

  for (const code of [...mandatoryDocumentCodes].sort((left, right) => left.localeCompare(right))) {
    const storagePath = `portal-templates/${code}/mock-template-${randomSuffix(10)}.pdf`;
    const bytes = buildPdfBuffer([
      "Openchip Supplier Document Template",
      `Document Code: ${code}`,
      "Purpose: Mock template for mandatory onboarding requirements",
      `Generated: ${nowIso()}`,
      `Template ID: ${randomSuffix(12)}`
    ]);

    await uploadPdf({
      ...storage,
      storagePath,
      bytes
    });

    await repository.setDocumentTemplatePath(
      {
        code,
        templateStoragePath: storagePath
      },
      actor
    );
    uploadedTemplateFilesCount += 1;
  }

  for (const spec of mockCaseSpecs) {
    const suffix = randomSuffix();
    const supplierName = `${spec.label} ${suffix}`;
    const supplierVat = `MOCK${suffix.slice(0, 6)}`;
    const supplierContactName = `Contact ${suffix.slice(0, 4)}`;
    const supplierContactEmail = `mock.${suffix.toLowerCase()}@example.local`;

    const onboardingCase = await repository.createCase(
      {
        supplierName,
        supplierVat,
        supplierContactName,
        supplierContactEmail,
        requester: "Finance User",
        categoryCode: spec.categoryCode
      },
      actor
    );
    createdCases.push(onboardingCase.id);

    const invitedCase = await repository.sendInvitation(onboardingCase.id, actor);
    if (invitedCase.invitationToken === null) {
      throw new Error(`Invitation token missing for case ${onboardingCase.id}`);
    }

    const requirements = (await repository.getRequirementPreview(spec.categoryCode)).filter(
      (requirement) => requirement.requirementLevel === "mandatory"
    );
    if (requirements.length === 0) {
      throw new Error(`No mandatory requirements found for category ${spec.categoryCode}`);
    }

    const uploadedDocuments: { code: string; files: UploadedDocumentFile[] }[] = [];

    for (const requirement of requirements) {
      const fileId = randomUUID();
      const fileName = `${requirement.code.toLowerCase()}-${suffix}.pdf`;
      const storagePath = `mock-seed/${onboardingCase.id}/${requirement.code}/${fileId}.pdf`;
      const bytes = buildPdfBuffer([
        "Openchip Supplier Onboarding",
        `Case: ${onboardingCase.id}`,
        `Category: ${spec.categoryCode}`,
        `Requirement: ${requirement.code}`,
        `Generated: ${nowIso()}`,
        `Random: ${randomSuffix(10)}`
      ]);

      await uploadPdf({
        ...storage,
        storagePath,
        bytes
      });

      uploadedDocuments.push({
        code: requirement.code,
        files: [
          {
            id: fileId,
            fileName,
            mimeType: "application/pdf",
            sizeBytes: bytes.length,
            storagePath,
            uploadedAt: nowIso(),
            uploadedBy: actor
          }
        ]
      });
      uploadedFilesCount += 1;
    }

    await repository.submitSupplierResponse(
      {
        token: invitedCase.invitationToken,
        supplierIdentity: {
          supplierName,
          supplierVat,
          supplierContactName
        },
        identityConfirmed: true,
        address: {
          street: "Carrer de la Marina 1",
          city: "Barcelona",
          postalCode: "08005",
          country: "ES"
        },
        bankAccount: {
          bkvid: "0001",
          banks: "ES",
          bankl: "",
          bankn: null,
          bkont: null,
          accname: supplierName,
          bkValidFrom: todayDate(),
          bkValidTo: "9999-12-31",
          iban: "ES9121000418450200051332"
        },
        uploadedDocuments
      },
      actor
    );

    if (spec.finalizeInSap) {
      await repository.approveAllMandatoryDocuments(onboardingCase.id, "mock.compliance");
      await repository.completeValidation(onboardingCase.id, "mock.compliance");
      await repository.createSupplierInSap(onboardingCase.id, "mock.finance");
    }
  }

  console.log(`Mock cases created: ${createdCases.length}`);
  console.log(`Mandatory document templates uploaded: ${uploadedTemplateFilesCount}`);
  console.log(`Mandatory PDF documents uploaded: ${uploadedFilesCount}`);
  console.log(`Case IDs: ${createdCases.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
