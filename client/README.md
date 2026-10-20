# Meris Client (Frontend)

Next.js App Router frontend for Meris (group expense sharing and bill splitting).

## Architecture
- **Framework:** Next.js 16 (App Router + Turbopack)
- **Styling:** Tailwind CSS
- **Design Pattern:** Feature-Sliced Design (FSD) under `src/`
- **Output:** Standalone (`output: 'standalone'` in `next.config.ts`)
- **Telemetry:** OpenTelemetry via `instrumentation.ts`

## Getting Started
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Lint
npm run lint

# Production build
npm run build
```
