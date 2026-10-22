# Meris

Group expense sharing and bill splitting application designed for proportional cost sharing, multi-bill sessions, and graph debt simplification.

## Architecture
- **Backend:** Go 1.27 (`net/http` + `chi/v5`, `pgx/v5`, `sqlc`, `goose`, OpenTelemetry).
- **Frontend:** Next.js 16 on Bun (App Router, Turbopack, Tailwind CSS, Feature-Sliced Design).
- **Database & Cache:** PostgreSQL 18 & Redis 8.

## Quick Start (Local Development)
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start services with Docker Compose
docker compose up -d

# Or run locally with Go and Bun
make dev
```

## Production Deployment
Configured for automated build & push via GitHub Actions to GHCR and deployed on homelab as two apps, `meris-api` and `meris-client` (compose files in `deployments/homelab/`).

Meris has a single public hostname, `meris.teukumunawark.my.id`. Caddy (`deployments/homelab/caddy/munawar-meris.caddy`) sends `/_api/*` to `meris-api` with the prefix stripped and everything else to `meris-client`. The client image is built in CI with `NEXT_PUBLIC_BACKEND_URL=/_api`, so the browser talks to the API on the same origin and `meris-api` has no public hostname.
