# Meris Monorepo Context & Rules for AI Agents

Welcome to **Meris** — an ephemeral, zero-account group expense sharing and bill splitting application designed for proportional cost sharing, multi-bill sessions, and graph debt simplification.

This file serves as the Level 1 persistent context rulebook for AI assistants working in this codebase.

---

## 1. Monorepo Architecture Overview

The repository enforces a strict physical separation between runtimes:

```text
.
├── /api                 # Golang backend application (Go 1.27+)
├── /client              # Next.js App Router frontend application (TS/React)
├── /contracts           # Shared OpenAPI/Swagger YAML specifications
│   └── openapi.yaml     # Single source of truth for API contracts
├── /deployments         # Infrastructure configs (homelab Caddy & compose)
├── Makefile             # Root orchestration (make dev, make build-all, etc.)
├── docker-compose.yml   # Standalone local Docker Compose (API + Client + DB + Redis)
│   └── homelab/         # Per-app compose files for /srv/apps/<meris-api|meris-client> on zoro
├── CONTEXT.md           # Ubiquitous domain vocabulary
└── AGENTS.md            # AI Agent instructions and context rules (this file)
```

---

## 2. Backend Codebase Rules (`/api`)

* **Tech Stack**: Go 1.27+, `net/http` + `chi/v5` router, `pgx/v5` driver, `sqlc` query generator, `goose` programmatic migrations, Redis 8, OpenTelemetry (`otelslog`, `otelchi`, `otelpgx`, `redisotel`).
* **Database & Queries**:
  * Write schema migrations in `api/sql/migrations/` and SQL queries in `api/sql/queries/`.
  * Run `sqlc generate` to update Go database code.
  * **NEVER edit `sqlc` generated Go files directly.**
* **API Contracts**: Handlers must match contract schemas in `contracts/openapi.yaml`.
* **Testing & Quality**:
  * Co-locate unit/integration tests with `*_test.go`.
  * Ensure `go test ./...` passes before completing tasks.

---

## 3. Frontend Codebase Rules (`/client`)

* **Tech Stack**: Next.js App Router (Turbopack, RSC + Client Components), TypeScript, Bun runtime/package manager, Feature-Sliced Design (FSD), OpenTelemetry via `instrumentation.ts`.
* **Architecture (Feature-Sliced Design in `src/`)**:
  * `app/`: Next.js App Router pages, providers, global styles.
  * `widgets/`: Compositional UI components.
  * `features/`: Interactive user actions (e.g. SessionManager, ItemPicker, DebtSettlement).
  * `entities/`: Domain models and passive UI.
  * `shared/`: Reusable primitives, API client, utilities.
* **Type-Safe API**:
  * Generated API types derived from `contracts/openapi.yaml` via `openapi-typescript`.
  * **NEVER edit generated OpenAPI TypeScript interfaces manually.**
* **Quality & Verification**:
  * Run type checking and linting (`bun run lint`).

---

## 4. Development Workflow & Commands

Root orchestration via `Makefile`:

```bash
# Start local development environment
make dev

# Build all applications
make build-all

# Execute backend tests
make test
```

---

## 5. Strict Guardrails

1. **Contract-Driven First**: Any API contract modification MUST start in `contracts/openapi.yaml`.
2. **Never Commit Secrets**: Do not write, expose, or commit `.env` credentials or secrets.
3. **Preserve Generated File Integrity**: Never modify auto-generated code (`sqlc` outputs, generated OpenAPI TS files).
4. **Empirical Verification**: Always verify code changes by running tests/builds (`go test ./...`, `bun run build`).
