import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentCode, UploadedDocumentFile } from "@openchip/shared";

const localUploadsRoot = path.join(process.cwd(), "output", "supplier-uploads");

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, "_");
}

function toStoragePath(caseId: string, code: DocumentCode, storedName: string): string {
  return path.posix.join("supplier-uploads", caseId, code, storedName);
}

function toAbsoluteLocalPath(storagePath: string): string {
  const normalizedStoragePath = storagePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(path.join(process.cwd(), "output", normalizedStoragePath));
  const allowedRoot = path.resolve(path.join(process.cwd(), "output", "supplier-uploads"));

  if (!absolutePath.startsWith(allowedRoot)) {
    throw new Error("Invalid storage path.");
  }

  return absolutePath;
}

function getStorageUrl(): string | null {
  const value = process.env.SUPABASE_STORAGE_URL;
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "openchip-documents";
}

function getStorageServiceKey(): string | null {
  const value = process.env.SUPABASE_STORAGE_SERVICE_KEY;
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function isSupabaseStorageEnabled(): boolean {
  return getStorageUrl() !== null && getStorageServiceKey() !== null;
}

function encodeStoragePath(storagePath: string): string {
  return storagePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function createSupabaseHeaders(extraHeaders: Record<string, string> = {}): Headers {
  const serviceKey = getStorageServiceKey();
  if (serviceKey === null) {
    throw new Error("SUPABASE_STORAGE_SERVICE_KEY is not configured.");
  }

  const headers = new Headers({
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`
  });

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return headers;
}

let bucketEnsurePromise: Promise<void> | null = null;

async function ensureSupabaseBucket(): Promise<void> {
  if (bucketEnsurePromise !== null) {
    return bucketEnsurePromise;
  }

  bucketEnsurePromise = (async () => {
    const storageUrl = getStorageUrl();
    if (storageUrl === null) {
      throw new Error("SUPABASE_STORAGE_URL is not configured.");
    }

    const bucket = getStorageBucket();
    const createResponse = await fetch(`${storageUrl}/bucket`, {
      method: "POST",
      headers: createSupabaseHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ name: bucket, public: false }),
      cache: "no-store"
    });

    if (createResponse.ok) {
      return;
    }

    const payload = await createResponse.text();
    if (createResponse.status === 409 || payload.toLowerCase().includes("already")) {
      return;
    }

    throw new Error(`Unable to create Supabase bucket "${bucket}". Status ${createResponse.status}.`);
  })();

  try {
    await bucketEnsurePromise;
  } catch (error) {
    bucketEnsurePromise = null;
    throw error;
  }
}

export interface SaveSupplierDocumentInput {
  caseId: string;
  code: DocumentCode;
  uploadedBy: string;
  file: File;
}

async function saveToSupabaseStorage(input: SaveSupplierDocumentInput): Promise<UploadedDocumentFile> {
  const storageUrl = getStorageUrl();
  if (storageUrl === null) {
    throw new Error("SUPABASE_STORAGE_URL is not configured.");
  }

  await ensureSupabaseBucket();

  const fileId = randomUUID();
  const sanitizedName = sanitizeFileName(input.file.name);
  const extension = path.extname(sanitizedName);
  const baseName = path.basename(sanitizedName, extension).slice(0, 80);
  const storedName = `${fileId}-${baseName}${extension}`;
  const relativeStoragePath = toStoragePath(input.caseId, input.code, storedName);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const bucket = getStorageBucket();

  const response = await fetch(`${storageUrl}/object/${encodeURIComponent(bucket)}/${encodeStoragePath(relativeStoragePath)}`, {
    method: "POST",
    headers: createSupabaseHeaders({
      "content-type": input.file.type.length > 0 ? input.file.type : "application/octet-stream"
    }),
    body: bytes,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase upload failed with status ${response.status}.`);
  }

  return {
    id: fileId,
    fileName: input.file.name,
    mimeType: input.file.type.length > 0 ? input.file.type : "application/octet-stream",
    sizeBytes: bytes.byteLength,
    storagePath: relativeStoragePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy
  };
}

async function saveToLocalStorage(input: SaveSupplierDocumentInput): Promise<UploadedDocumentFile> {
  const fileId = randomUUID();
  const sanitizedName = sanitizeFileName(input.file.name);
  const extension = path.extname(sanitizedName);
  const baseName = path.basename(sanitizedName, extension).slice(0, 80);
  const storedName = `${fileId}-${baseName}${extension}`;
  const relativeStoragePath = toStoragePath(input.caseId, input.code, storedName);
  const absolutePath = path.join(localUploadsRoot, input.caseId, input.code, storedName);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await input.file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    id: fileId,
    fileName: input.file.name,
    mimeType: input.file.type.length > 0 ? input.file.type : "application/octet-stream",
    sizeBytes: bytes.byteLength,
    storagePath: relativeStoragePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy
  };
}

export async function saveSupplierDocument(input: SaveSupplierDocumentInput): Promise<UploadedDocumentFile> {
  if (isSupabaseStorageEnabled()) {
    return saveToSupabaseStorage(input);
  }

  return saveToLocalStorage(input);
}

async function readFromSupabaseStorage(storagePath: string): Promise<Buffer> {
  const storageUrl = getStorageUrl();
  if (storageUrl === null) {
    throw new Error("SUPABASE_STORAGE_URL is not configured.");
  }

  const bucket = getStorageBucket();
  const response = await fetch(
    `${storageUrl}/object/authenticated/${encodeURIComponent(bucket)}/${encodeStoragePath(storagePath.replace(/^\/+/, ""))}`,
    {
      method: "GET",
      headers: createSupabaseHeaders(),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase file download failed with status ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function readFromLocalStorage(storagePath: string): Promise<Buffer> {
  const absolutePath = toAbsoluteLocalPath(storagePath);
  return readFile(absolutePath);
}

export async function readStoredSupplierDocument(storagePath: string): Promise<Buffer> {
  if (isSupabaseStorageEnabled()) {
    return readFromSupabaseStorage(storagePath);
  }

  return readFromLocalStorage(storagePath);
}
