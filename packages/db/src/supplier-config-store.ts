import {
  documentCatalog,
  documentCodes,
  DocumentCode,
  FundingType,
  RequirementLevel,
  RequirementMatrixEntry,
  RequirementMatrixUpdateInput,
  RequirementPreviewRow,
  SupplierCategory,
  SupplierCategoryCode,
  SupplierCategoryCreateInput,
  SupplierCategoryDefinition,
  SupplierCategoryStatusInput,
  SupplierType,
  SupplierTypeCreateInput,
  SupplierTypeDefinition,
  SupplierTypeStatusInput,
  supplierCategories
} from "@openchip/shared";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { buildDefaultRequirementRowsForCategory, defaultSupplierTypeSeeds, getDefaultRequirementLevel } from "./default-supplier-config";

interface CategoryIdentity {
  funding: FundingType;
  typeKey: SupplierType;
  location: "national" | "international";
}

export interface SupplierConfigStore {
  listSupplierTypes(includeInactive?: boolean): Promise<SupplierTypeDefinition[]>;
  createSupplierType(input: SupplierTypeCreateInput, actor: string): Promise<SupplierTypeDefinition>;
  setSupplierTypeStatus(input: SupplierTypeStatusInput, actor: string): Promise<SupplierTypeDefinition>;
  listSupplierCategories(includeInactive?: boolean): Promise<SupplierCategoryDefinition[]>;
  getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null>;
  createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition>;
  setSupplierCategoryStatus(input: SupplierCategoryStatusInput, actor: string): Promise<SupplierCategoryDefinition>;
  listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]>;
  updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry>;
  listRequirementPreviewRows(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]>;
  listRequirementPreviewByCategoryCodes(categoryCodes: readonly SupplierCategoryCode[]): Promise<Record<string, RequirementPreviewRow[]>>;
  resetToDefaults(actor: string): Promise<void>;
}

interface InternalTypeRecord extends SupplierTypeDefinition {
  key: SupplierType;
}

const typeSegmentOverrides: Record<string, string> = {
  subcontractor: "SC",
  standard: "STD",
  ecommerce: "ECOM",
  one_time: "ONE"
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTypeKey(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.length === 0) {
    throw new Error("Type label must contain letters or numbers.");
  }

  return normalized;
}

function buildTypeCodeSegment(typeKey: SupplierType): string {
  const override = typeSegmentOverrides[typeKey];
  if (override !== undefined) {
    return override;
  }

  const compact = typeKey.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (compact.length === 0) {
    return "TYPE";
  }

  if (compact.length >= 4) {
    return compact.slice(0, 4);
  }

  return compact.padEnd(4, "X");
}

function generateCategoryCode(identity: CategoryIdentity, existingCodes: ReadonlySet<string>): SupplierCategoryCode {
  const fundingSegment = identity.funding === "subsidized" ? "SUB" : "NSUB";
  const locationSegment = identity.location === "national" ? "NAT" : "INT";
  const typeSegment = buildTypeCodeSegment(identity.typeKey);
  const baseCode = `${fundingSegment}-${typeSegment}-${locationSegment}`;

  if (!existingCodes.has(baseCode)) {
    return baseCode;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseCode}-${index}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique category code.");
}

function buildLabel(identity: CategoryIdentity, typeLabel: string): string {
  const fundingLabel = identity.funding === "subsidized" ? "Subsidized" : "Non-Subsidized";
  const locationLabel = identity.location === "national" ? "National" : "International";
  return `${fundingLabel} / ${typeLabel} / ${locationLabel}`;
}

function toPreviewRows(entries: readonly RequirementMatrixEntry[]): RequirementPreviewRow[] {
  return documentCatalog.map((documentDefinition) => {
    const match = entries.find((entry) => entry.documentCode === documentDefinition.code);
    return {
      ...documentDefinition,
      requirementLevel: match?.requirementLevel ?? "not_applicable"
    };
  });
}

function buildInitialEntriesForCategory(category: Pick<SupplierCategoryDefinition, "code" | "funding" | "typeKey" | "location">, actor: string): RequirementMatrixEntry[] {
  const timestamp = nowIso();

  return documentCodes.map((documentCode) => ({
    categoryCode: category.code,
    documentCode,
    requirementLevel: getDefaultRequirementLevel({
      funding: category.funding,
      typeKey: category.typeKey,
      location: category.location,
      documentCode
    }),
    updatedAt: timestamp,
    updatedBy: actor
  }));
}

class InMemorySupplierConfigStore implements SupplierConfigStore {
  private readonly types = new Map<string, InternalTypeRecord>();
  private readonly categories = new Map<string, SupplierCategoryDefinition>();
  private readonly matrix = new Map<string, RequirementMatrixEntry>();

  constructor() {
    this.seedDefaults("system.bootstrap");
  }

  private makeMatrixKey(categoryCode: string, documentCode: string): string {
    return `${categoryCode}::${documentCode}`;
  }

  private seedDefaults(actor: string): void {
    this.types.clear();
    this.categories.clear();
    this.matrix.clear();

    const timestamp = nowIso();
    for (const seed of defaultSupplierTypeSeeds) {
      this.types.set(seed.id, {
        id: seed.id,
        key: seed.key,
        label: seed.label,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    const typeByKey = new Map<string, InternalTypeRecord>();
    for (const type of this.types.values()) {
      typeByKey.set(type.key, type);
    }

    for (const category of supplierCategories) {
      const type = typeByKey.get(category.type);
      if (type === undefined) {
        continue;
      }

      const definition: SupplierCategoryDefinition = {
        code: category.code,
        funding: category.funding,
        typeId: type.id,
        typeKey: type.key,
        typeLabel: type.label,
        location: category.location,
        label: category.label,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      this.categories.set(definition.code, definition);

      const rows = buildDefaultRequirementRowsForCategory(category);
      for (const row of rows) {
        this.matrix.set(this.makeMatrixKey(row.categoryCode, row.documentCode), {
          ...row,
          updatedAt: timestamp,
          updatedBy: actor
        });
      }
    }
  }

  async listSupplierTypes(includeInactive = false): Promise<SupplierTypeDefinition[]> {
    return [...this.types.values()]
      .filter((type) => includeInactive || type.active)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  async createSupplierType(input: SupplierTypeCreateInput): Promise<SupplierTypeDefinition> {
    const key = normalizeTypeKey(input.label);
    const duplicate = [...this.types.values()].find((type) => type.key === key);
    if (duplicate !== undefined) {
      throw new Error("Supplier type already exists.");
    }

    const timestamp = nowIso();
    const created: InternalTypeRecord = {
      id: randomUUID(),
      key,
      label: input.label,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.types.set(created.id, created);
    return created;
  }

  async setSupplierTypeStatus(input: SupplierTypeStatusInput): Promise<SupplierTypeDefinition> {
    const existing = this.types.get(input.typeId);
    if (existing === undefined) {
      throw new Error("Supplier type not found.");
    }

    const hasActiveCategory = [...this.categories.values()].some((category) => category.typeId === input.typeId && category.active);
    if (!input.active && hasActiveCategory) {
      throw new Error("Deactivate supplier categories that use this type first.");
    }

    const updated: InternalTypeRecord = {
      ...existing,
      active: input.active,
      updatedAt: nowIso()
    };

    this.types.set(updated.id, updated);
    return updated;
  }

  async listSupplierCategories(includeInactive = false): Promise<SupplierCategoryDefinition[]> {
    return [...this.categories.values()]
      .filter((category) => includeInactive || category.active)
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  async getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null> {
    const category = this.categories.get(categoryCode);
    return category ?? null;
  }

  async createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition> {
    const type = this.types.get(input.typeId);
    if (type === undefined || !type.active) {
      throw new Error("Supplier type not found or inactive.");
    }

    const existingCodes = new Set(this.categories.keys());
    const code = generateCategoryCode(
      {
        funding: input.funding,
        typeKey: type.key,
        location: input.location
      },
      existingCodes
    );

    const timestamp = nowIso();
    const category: SupplierCategoryDefinition = {
      code,
      funding: input.funding,
      typeId: type.id,
      typeKey: type.key,
      typeLabel: type.label,
      location: input.location,
      label: input.label.length > 0 ? input.label : buildLabel({ funding: input.funding, typeKey: type.key, location: input.location }, type.label),
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.categories.set(category.code, category);

    const entries = buildInitialEntriesForCategory(category, actor);
    for (const entry of entries) {
      this.matrix.set(this.makeMatrixKey(entry.categoryCode, entry.documentCode), entry);
    }

    return category;
  }

  async setSupplierCategoryStatus(input: SupplierCategoryStatusInput): Promise<SupplierCategoryDefinition> {
    const existing = this.categories.get(input.categoryCode);
    if (existing === undefined) {
      throw new Error("Supplier category not found.");
    }

    const updated: SupplierCategoryDefinition = {
      ...existing,
      active: input.active,
      updatedAt: nowIso()
    };

    this.categories.set(updated.code, updated);
    return updated;
  }

  async listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]> {
    const entries: RequirementMatrixEntry[] = documentCodes.map((documentCode) => {
      const existing = this.matrix.get(this.makeMatrixKey(categoryCode, documentCode));
      if (existing !== undefined) {
        return existing;
      }

      return {
        categoryCode,
        documentCode,
        requirementLevel: "not_applicable",
        updatedAt: nowIso(),
        updatedBy: "system"
      };
    });

    return entries;
  }

  async updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry> {
    if (!this.categories.has(input.categoryCode)) {
      throw new Error("Supplier category not found.");
    }

    const updated: RequirementMatrixEntry = {
      categoryCode: input.categoryCode,
      documentCode: input.documentCode,
      requirementLevel: input.requirementLevel,
      updatedAt: nowIso(),
      updatedBy: actor
    };

    this.matrix.set(this.makeMatrixKey(updated.categoryCode, updated.documentCode), updated);
    return updated;
  }

  async listRequirementPreviewRows(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]> {
    const entries = await this.listRequirementMatrixEntries(categoryCode);
    return toPreviewRows(entries);
  }

  async listRequirementPreviewByCategoryCodes(categoryCodes: readonly SupplierCategoryCode[]): Promise<Record<string, RequirementPreviewRow[]>> {
    const result: Record<string, RequirementPreviewRow[]> = {};

    for (const categoryCode of categoryCodes) {
      result[categoryCode] = await this.listRequirementPreviewRows(categoryCode);
    }

    return result;
  }

  async resetToDefaults(actor: string): Promise<void> {
    this.seedDefaults(actor);
  }
}

class PostgresSupplierConfigStore implements SupplierConfigStore {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise !== null) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_config_types (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_config_categories (
        code TEXT PRIMARY KEY,
        funding TEXT NOT NULL CHECK (funding IN ('subsidized', 'non_subsidized')),
        type_id TEXT NOT NULL REFERENCES supplier_config_types(id),
        location TEXT NOT NULL CHECK (location IN ('national', 'international')),
        label TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_config_requirements (
        category_code TEXT NOT NULL REFERENCES supplier_config_categories(code),
        document_code TEXT NOT NULL,
        requirement_level TEXT NOT NULL CHECK (requirement_level IN ('mandatory', 'optional', 'not_applicable')),
        updated_at TIMESTAMPTZ NOT NULL,
        updated_by TEXT NOT NULL,
        PRIMARY KEY (category_code, document_code)
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_config_audit_log (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    const existingTypeCountResult = await this.pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM supplier_config_types;`);
    const existingTypeCount = Number(existingTypeCountResult.rows[0]?.count ?? "0");

    if (existingTypeCount === 0) {
      await this.seedDefaults("system.bootstrap");
    }
  }

  private async audit(eventType: string, actor: string, payload: Record<string, string>): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO supplier_config_audit_log (id, event_type, actor, payload, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      `,
      [randomUUID(), eventType, actor, JSON.stringify(payload), nowIso()]
    );
  }

  private async seedDefaults(actor: string): Promise<void> {
    const timestamp = nowIso();

    for (const seed of defaultSupplierTypeSeeds) {
      await this.pool.query(
        `
        INSERT INTO supplier_config_types (id, key, label, active, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, $4, $4)
        `,
        [seed.id, seed.key, seed.label, timestamp]
      );
    }

    const typeByKeyResult = await this.pool.query<{ id: string; key: string; label: string }>(
      `SELECT id, key, label FROM supplier_config_types;`
    );

    const typeByKey = new Map<string, { id: string; key: string; label: string }>();
    for (const row of typeByKeyResult.rows) {
      typeByKey.set(row.key, row);
    }

    for (const category of supplierCategories) {
      const type = typeByKey.get(category.type);
      if (type === undefined) {
        continue;
      }

      await this.pool.query(
        `
        INSERT INTO supplier_config_categories
          (code, funding, type_id, location, label, active, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, TRUE, $6, $6)
        `,
        [category.code, category.funding, type.id, category.location, category.label, timestamp]
      );

      const rows = buildDefaultRequirementRowsForCategory(category);
      for (const row of rows) {
        await this.pool.query(
          `
          INSERT INTO supplier_config_requirements
            (category_code, document_code, requirement_level, updated_at, updated_by)
          VALUES
            ($1, $2, $3, $4, $5)
          `,
          [row.categoryCode, row.documentCode, row.requirementLevel, timestamp, actor]
        );
      }
    }

    await this.audit("config_seeded", actor, { source: "docx-default" });
  }

  async listSupplierTypes(includeInactive = false): Promise<SupplierTypeDefinition[]> {
    await this.ensureInitialized();

    const result = await this.pool.query<{
      id: string;
      key: string;
      label: string;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, key, label, active, created_at, updated_at
      FROM supplier_config_types
      WHERE ($1::boolean OR active = TRUE)
      ORDER BY label ASC
      `,
      [includeInactive]
    );

    return result.rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async createSupplierType(input: SupplierTypeCreateInput, actor: string): Promise<SupplierTypeDefinition> {
    await this.ensureInitialized();

    const key = normalizeTypeKey(input.label);
    const duplicate = await this.pool.query<{ id: string }>(`SELECT id FROM supplier_config_types WHERE key = $1 LIMIT 1`, [key]);
    if (duplicate.rows.length > 0) {
      throw new Error("Supplier type already exists.");
    }

    const timestamp = nowIso();
    const id = randomUUID();

    await this.pool.query(
      `
      INSERT INTO supplier_config_types (id, key, label, active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, $4, $4)
      `,
      [id, key, input.label, timestamp]
    );

    await this.audit("supplier_type_created", actor, { typeId: id, key });

    return {
      id,
      key,
      label: input.label,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  async setSupplierTypeStatus(input: SupplierTypeStatusInput, actor: string): Promise<SupplierTypeDefinition> {
    await this.ensureInitialized();

    if (!input.active) {
      const activeCategories = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM supplier_config_categories WHERE type_id = $1 AND active = TRUE`,
        [input.typeId]
      );

      if (Number(activeCategories.rows[0]?.count ?? "0") > 0) {
        throw new Error("Deactivate supplier categories that use this type first.");
      }
    }

    const timestamp = nowIso();
    const result = await this.pool.query<{
      id: string;
      key: string;
      label: string;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      UPDATE supplier_config_types
      SET active = $2,
          updated_at = $3
      WHERE id = $1
      RETURNING id, key, label, active, created_at, updated_at
      `,
      [input.typeId, input.active, timestamp]
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("Supplier type not found.");
    }

    await this.audit("supplier_type_status_changed", actor, {
      typeId: row.id,
      active: row.active ? "true" : "false"
    });

    return {
      id: row.id,
      key: row.key,
      label: row.label,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listSupplierCategories(includeInactive = false): Promise<SupplierCategoryDefinition[]> {
    await this.ensureInitialized();

    const result = await this.pool.query<{
      code: string;
      funding: FundingType;
      type_id: string;
      type_key: string;
      type_label: string;
      location: "national" | "international";
      label: string;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT c.code,
             c.funding,
             c.type_id,
             t.key AS type_key,
             t.label AS type_label,
             c.location,
             c.label,
             c.active,
             c.created_at,
             c.updated_at
      FROM supplier_config_categories c
      INNER JOIN supplier_config_types t ON t.id = c.type_id
      WHERE ($1::boolean OR c.active = TRUE)
      ORDER BY c.label ASC
      `,
      [includeInactive]
    );

    return result.rows.map((row) => ({
      code: row.code,
      funding: row.funding,
      typeId: row.type_id,
      typeKey: row.type_key,
      typeLabel: row.type_label,
      location: row.location,
      label: row.label,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async getSupplierCategory(categoryCode: SupplierCategoryCode): Promise<SupplierCategoryDefinition | null> {
    await this.ensureInitialized();

    const result = await this.pool.query<{
      code: string;
      funding: FundingType;
      type_id: string;
      type_key: string;
      type_label: string;
      location: "national" | "international";
      label: string;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT c.code,
             c.funding,
             c.type_id,
             t.key AS type_key,
             t.label AS type_label,
             c.location,
             c.label,
             c.active,
             c.created_at,
             c.updated_at
      FROM supplier_config_categories c
      INNER JOIN supplier_config_types t ON t.id = c.type_id
      WHERE c.code = $1
      LIMIT 1
      `,
      [categoryCode]
    );

    const row = result.rows[0];
    if (row === undefined) {
      return null;
    }

    return {
      code: row.code,
      funding: row.funding,
      typeId: row.type_id,
      typeKey: row.type_key,
      typeLabel: row.type_label,
      location: row.location,
      label: row.label,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createSupplierCategory(input: SupplierCategoryCreateInput, actor: string): Promise<SupplierCategoryDefinition> {
    await this.ensureInitialized();

    const typeResult = await this.pool.query<{ id: string; key: string; label: string; active: boolean }>(
      `SELECT id, key, label, active FROM supplier_config_types WHERE id = $1 LIMIT 1`,
      [input.typeId]
    );

    const type = typeResult.rows[0];
    if (type === undefined || !type.active) {
      throw new Error("Supplier type not found or inactive.");
    }

    const existingCodesResult = await this.pool.query<{ code: string }>(`SELECT code FROM supplier_config_categories`);
    const existingCodes = new Set(existingCodesResult.rows.map((row) => row.code));

    const code = generateCategoryCode(
      {
        funding: input.funding,
        typeKey: type.key,
        location: input.location
      },
      existingCodes
    );

    const timestamp = nowIso();
    const label = input.label.length > 0 ? input.label : buildLabel({ funding: input.funding, typeKey: type.key, location: input.location }, type.label);

    await this.pool.query(
      `
      INSERT INTO supplier_config_categories
        (code, funding, type_id, location, label, active, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, TRUE, $6, $6)
      `,
      [code, input.funding, type.id, input.location, label, timestamp]
    );

    const category: SupplierCategoryDefinition = {
      code,
      funding: input.funding,
      typeId: type.id,
      typeKey: type.key,
      typeLabel: type.label,
      location: input.location,
      label,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const entries = buildInitialEntriesForCategory(category, actor);
    for (const entry of entries) {
      await this.pool.query(
        `
        INSERT INTO supplier_config_requirements
          (category_code, document_code, requirement_level, updated_at, updated_by)
        VALUES
          ($1, $2, $3, $4, $5)
        `,
        [entry.categoryCode, entry.documentCode, entry.requirementLevel, entry.updatedAt, entry.updatedBy]
      );
    }

    await this.audit("supplier_category_created", actor, {
      categoryCode: category.code,
      typeId: category.typeId,
      funding: category.funding,
      location: category.location
    });

    return category;
  }

  async setSupplierCategoryStatus(input: SupplierCategoryStatusInput, actor: string): Promise<SupplierCategoryDefinition> {
    await this.ensureInitialized();

    const timestamp = nowIso();
    const result = await this.pool.query<{
      code: string;
      funding: FundingType;
      type_id: string;
      type_key: string;
      type_label: string;
      location: "national" | "international";
      label: string;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      UPDATE supplier_config_categories c
      SET active = $2,
          updated_at = $3
      FROM supplier_config_types t
      WHERE c.type_id = t.id
        AND c.code = $1
      RETURNING c.code,
                c.funding,
                c.type_id,
                t.key AS type_key,
                t.label AS type_label,
                c.location,
                c.label,
                c.active,
                c.created_at,
                c.updated_at
      `,
      [input.categoryCode, input.active, timestamp]
    );

    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("Supplier category not found.");
    }

    await this.audit("supplier_category_status_changed", actor, {
      categoryCode: row.code,
      active: row.active ? "true" : "false"
    });

    return {
      code: row.code,
      funding: row.funding,
      typeId: row.type_id,
      typeKey: row.type_key,
      typeLabel: row.type_label,
      location: row.location,
      label: row.label,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listRequirementMatrixEntries(categoryCode: SupplierCategoryCode): Promise<RequirementMatrixEntry[]> {
    await this.ensureInitialized();

    const result = await this.pool.query<{
      category_code: string;
      document_code: DocumentCode;
      requirement_level: RequirementLevel;
      updated_at: string;
      updated_by: string;
    }>(
      `
      SELECT category_code, document_code, requirement_level, updated_at, updated_by
      FROM supplier_config_requirements
      WHERE category_code = $1
      ORDER BY document_code ASC
      `,
      [categoryCode]
    );

    const byDocumentCode = new Map<DocumentCode, RequirementMatrixEntry>();
    for (const row of result.rows) {
      byDocumentCode.set(row.document_code, {
        categoryCode: row.category_code,
        documentCode: row.document_code,
        requirementLevel: row.requirement_level,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      });
    }

    return documentCodes.map((documentCode) => {
      const existing = byDocumentCode.get(documentCode);
      if (existing !== undefined) {
        return existing;
      }

      return {
        categoryCode,
        documentCode,
        requirementLevel: "not_applicable",
        updatedAt: nowIso(),
        updatedBy: "system"
      };
    });
  }

  async updateRequirementMatrixEntry(input: RequirementMatrixUpdateInput, actor: string): Promise<RequirementMatrixEntry> {
    await this.ensureInitialized();

    const category = await this.getSupplierCategory(input.categoryCode);
    if (category === null) {
      throw new Error("Supplier category not found.");
    }

    const timestamp = nowIso();

    await this.pool.query(
      `
      INSERT INTO supplier_config_requirements
        (category_code, document_code, requirement_level, updated_at, updated_by)
      VALUES
        ($1, $2, $3, $4, $5)
      ON CONFLICT (category_code, document_code)
      DO UPDATE SET
        requirement_level = EXCLUDED.requirement_level,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
      `,
      [input.categoryCode, input.documentCode, input.requirementLevel, timestamp, actor]
    );

    await this.audit("requirement_matrix_updated", actor, {
      categoryCode: input.categoryCode,
      documentCode: input.documentCode,
      requirementLevel: input.requirementLevel
    });

    return {
      categoryCode: input.categoryCode,
      documentCode: input.documentCode,
      requirementLevel: input.requirementLevel,
      updatedAt: timestamp,
      updatedBy: actor
    };
  }

  async listRequirementPreviewRows(categoryCode: SupplierCategoryCode): Promise<RequirementPreviewRow[]> {
    const entries = await this.listRequirementMatrixEntries(categoryCode);
    return toPreviewRows(entries);
  }

  async listRequirementPreviewByCategoryCodes(categoryCodes: readonly SupplierCategoryCode[]): Promise<Record<string, RequirementPreviewRow[]>> {
    const result: Record<string, RequirementPreviewRow[]> = {};

    for (const categoryCode of categoryCodes) {
      result[categoryCode] = await this.listRequirementPreviewRows(categoryCode);
    }

    return result;
  }

  async resetToDefaults(actor: string): Promise<void> {
    await this.ensureInitialized();

    await this.pool.query(`DELETE FROM supplier_config_requirements;`);
    await this.pool.query(`DELETE FROM supplier_config_categories;`);
    await this.pool.query(`DELETE FROM supplier_config_types;`);

    await this.seedDefaults(actor);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __openchipSupplierConfigStore: SupplierConfigStore | undefined;
}

export function getSupplierConfigStore(): SupplierConfigStore {
  if (globalThis.__openchipSupplierConfigStore !== undefined) {
    return globalThis.__openchipSupplierConfigStore;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl !== undefined && databaseUrl.length > 0) {
    const pool = new Pool({
      connectionString: databaseUrl
    });

    globalThis.__openchipSupplierConfigStore = new PostgresSupplierConfigStore(pool);
    return globalThis.__openchipSupplierConfigStore;
  }

  globalThis.__openchipSupplierConfigStore = new InMemorySupplierConfigStore();
  return globalThis.__openchipSupplierConfigStore;
}
