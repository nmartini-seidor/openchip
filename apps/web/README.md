# Openchip Web App

## Run

```bash
pnpm --filter @openchip/web dev --port 3000
```

Required env vars:

- `APP_BASE_URL` (default `http://localhost:3000`)
- `SAP_INTEGRATION_API_KEY` (required for SAP inbound endpoint auth)

## SAP Inbound Integration

Endpoint:

- `POST /api/v1/integrations/cases`

Headers:

- `X-API-Key: <SAP_INTEGRATION_API_KEY>`

Behavior:

- Creates onboarding case from SAP Purchase Request with supplier = `New Supplier`.
- Idempotent by `sapSystem + sapPrId`.

## API Contract (Swagger/OpenAPI)

- OpenAPI JSON: `GET /api/openapi.json`
- Swagger UI: `GET /api/docs`

## Credentials and Access

### Services (Docker Compose)

- Web: `http://localhost:3000`
- Postgres: `localhost:5432`
- Mailpit UI: `http://localhost:8025`
- SMTP: `localhost:1025`

### Internal App Login Users (seeded)

The app uses mock login by email (no password).

- `admin@openchip.local` (admin)
- `finance@openchip.local` (finance)
- `purchasing@openchip.local` (purchasing)
- `requester@openchip.local` (requester)
- `compliance@openchip.local` (compliance)

### SAP Integration Auth

- Header: `X-API-Key: local-sap-integration-key`
- Env var: `SAP_INTEGRATION_API_KEY=local-sap-integration-key`
- Endpoint: `POST /api/v1/integrations/cases`

### Database Credentials

- Host: `localhost`
- Port: `5432`
- Database: `openchip`
- User: `openchip`
- Password: `openchip`
- URL: `postgresql://openchip:openchip@localhost:5432/openchip`

### Mail / SMTP

- SMTP Host: `localhost`
- SMTP Port: `1025`
- From: `onboarding@openchip.local`
- Mailpit API base: `http://localhost:8025`
