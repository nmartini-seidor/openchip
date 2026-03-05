# Openchip Supplier Onboarding v2 Plan (Next.js + Tailwind + Skill-Aligned)

## Summary
Rebuild the implementation as an end-to-end product on Next.js App Router, Tailwind CSS, and Supabase. The platform centralizes supplier onboarding from internal initiation to supplier creation in SAP, with document validation, compliance tracking, auditability, and DocuWare archival metadata.

The plan is aligned to:
- `frontend-design`: deliberate enterprise visual direction (non-generic UI).
- `ui-ux-pro-max`: design-system, accessibility, responsive UX, and stack rules.
- `vercel-react-best-practices`: Next.js performance patterns and React architecture.

## Implementation Changes
- Architecture and packages:
  - Monorepo with `pnpm` and Turborepo.
  - `apps/web`: Next.js App Router UI and route handlers.
  - `packages/db`: Supabase schema, migrations, seeders, typed access.
  - `packages/workflow`: state machine, requirement matrix engine, compliance rules.
  - `packages/integrations`: SAP and DocuWare adapters, event outbox clients.
  - `packages/shared`: domain types, enums, schemas, i18n keys.
- Next.js and React approach:
  - Server Components by default.
  - Server Actions for write operations (create case, invite, validate, submit transitions).
  - Suspense boundaries for long internal views and progressive rendering.
  - Avoid waterfalls via parallel async orchestration (`Promise.all` where independent).
  - Minimize client bundles with dynamic imports for heavy/optional UI panels.
- Auth and access:
  - Internal users authenticated with SSO-ready Supabase auth boundary.
  - Supplier users via expiring signed invitation token sessions.
  - Role model: `finance`, `purchasing`, `requester`, `contracts_justifications`, `compliance`, `sustainability`, `admin`.
- Core data model (Supabase/Postgres + Storage):
  - Main entities: `suppliers`, `onboarding_cases`, `supplier_categories`, `document_catalog`, `document_requirements`, `document_submissions`, `document_validations`, `compliance_status`, `status_history`, `integration_events`, `audit_logs`.
  - VAT uniqueness and duplicate pre-check before SAP creation.
  - Storage buckets:
    - `supplier-documents` (uploaded evidence and signed forms).
    - `internal-templates` (Openchip-provided internal forms/templates).
- Workflow/state machine:
  - Mandatory statuses:
    - `onboarding_initiated`
    - `invitation_sent`
    - `portal_accessed`
    - `response_in_progress`
    - `submission_completed`
    - `validation_completed_pending_supplier_creation`
    - `supplier_created_in_sap`
  - Validation outcomes:
    - `approve`
    - `reject`
    - `approve_provisionally`
  - Versioned resubmission on reject.
  - Cancellation flow with reason and full audit trace.
- Supplier categorization and requirements:
  - Support all 12 supplier categories (`funding` x `type` x `location`).
  - Support all documented document codes (`FIN-01` to `DPO-02`).
  - Seed and enforce the 97-line requirement matrix with `mandatory`, `optional`, `not_applicable`.
- Compliance and expiry:
  - Supplier compliance register tracks per-document status, approver, validation date, validity interval, and PO block impact.
  - Daily expiry job:
    - T-30 reminder task and optional supplier reminder email.
    - Mandatory expired document triggers supplier PO block state.
    - Automatic unblock once updated and validated.
- Integrations:
  - SAP adapter contracts:
    - supplier creation
    - compliance block
    - compliance unblock
  - DocuWare archival contract with metadata:
    - `supplier_name`
    - `supplier_vat`
    - `document_code`
    - `validation_status`
    - `validation_date`
    - `expiry_date`
  - Event outbox/webhooks for case state changes and compliance events.
- UI system (Next.js + Tailwind):
  - Visual direction: enterprise trust and authority (high-contrast, audit-oriented, non-marketing noise).
  - Primary surfaces:
    - Internal onboarding dashboard
    - Case creation/initiation wizard (manual or SAP-trigger context)
    - Validation queue by department owner
    - Supplier secure portal for profile + document upload
    - Compliance and expiries board
    - Case timeline/audit view
  - Accessibility and UX quality defaults:
    - WCAG contrast targets (minimum 4.5:1 for body text)
    - Visible keyboard focus states
    - Labelled form controls and `aria-live` validation errors
    - Reduced motion support (`prefers-reduced-motion`)
    - Touch targets >= 44x44 and no hover-only critical interactions
  - Localization:
    - EN and ES in v1 with key-based translations and no hardcoded copy.

## Public Interfaces and Contracts
- Case and invitation:
  - `POST /api/onboarding/cases`
  - `POST /api/onboarding/cases/:id/invite`
- Supplier secure session:
  - `GET /api/supplier/session/:token`
  - `POST /api/supplier/session/:token/upload`
- Validation and completion:
  - `POST /api/onboarding/cases/:id/validate`
  - `POST /api/onboarding/cases/:id/complete-validation`
- SAP handoff:
  - `POST /api/onboarding/cases/:id/sap-create`
- Event schema (stable v1):
  - `event_type`, `case_id`, `supplier_vat`, `timestamp`, `actor`, `payload`, `delivery_status`
- Shared domain enums:
  - supplier category code set (12)
  - document code set (`FIN-01` to `DPO-02`)
  - requirement levels
  - case/document statuses
  - validation decisions

## Test Plan
- Unit tests:
  - requirement matrix resolver for all category combinations
  - state machine transitions including cancellation
  - compliance block/unblock rule engine
- Integration tests:
  - complete lifecycle from initiation to SAP-ready
  - token security (expiry, replay, unauthorized access)
  - SAP and DocuWare adapter contract verification
- Data tests:
  - integrity checks for seeded categories, document catalog, and 97 requirement mappings
  - VAT uniqueness and duplicate guardrails
- E2E tests (Playwright):
  - internal initiation and invitation
  - supplier upload and submission
  - validator reject/resubmit/provisional/approve flow
  - expiry-triggered reminder and block/unblock UX behavior

## Delivery Harness Pattern (Long-Running Agent)
- Execution model follows Anthropic's long-running harness approach:
  - initializer phase creates and maintains machine-readable feature tracking
  - coding phase runs short, repeatable implementation sessions that always read state and update progress
  - harness loop continues until all features are marked complete and verified
- Required tracking artifacts:
  - `feature_list.json`: feature inventory with status (`pending`, `in_progress`, `completed`), dependencies, and verification checklist
  - `claude-progress.md`: human-readable running log with latest decisions, blockers, and next action
  - `task-report.json` (optional): per-session output with files changed, tests run, and pass/fail summary
- Session contract for each coding iteration:
  - Read `AGENTS.md`, `feature_list.json`, and `claude-progress.md`
  - Select next unlocked feature(s) and execute bounded changes
  - Run relevant checks (`test`, `lint`, `typecheck`, targeted E2E if affected)
  - Update tracking artifacts before ending the session
- Completion gate:
  - all features marked `completed`
  - verification checklist passed for each feature
  - no unresolved blockers in `claude-progress.md`
  - final summary generated from tracking artifacts

## Assumptions and Defaults
- Scope is end-to-end, not frontend-only.
- Supabase remains the default backend, auth, and storage platform.
- SAP and DocuWare integrations are adapter-first with mock/live switch capability.
- Supplier creation in SAP supports manual control and optional automated path gated by technical feasibility.
- EN and ES are both included in v1.
