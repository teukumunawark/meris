# Meris

Group expense sharing and bill splitting application designed for proportional cost sharing, multi-bill sessions, and graph debt simplification.

## Architecture
- **Backend:** Go 1.27 (`net/http` + `chi/v5`, `pgx/v5`, `sqlc`, `goose`, OpenTelemetry).
- **Frontend:** Next.js 16 (App Router, Turbopack, Tailwind CSS, Feature-Sliced Design).
- **Database & Cache:** PostgreSQL 18 & Redis 8.

## Quick Start (Local Development)
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start services with Docker Compose
docker compose up -d

# Or run locally with Go and Node.js
make dev
```

## Production Deployment
Configured for automated build & push via GitHub Actions to GHCR and deployed on homelab (`docker-compose.prod.yml`).
