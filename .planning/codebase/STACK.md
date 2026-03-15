# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.5+ - All application code (`src/**/*.ts`, `src/**/*.tsx`)

**Secondary:**
- HTML - Self-contained dashboard templates (`src/lib/template-*.html`) rendered client-side with embedded JS
- CSS (Tailwind) - Admin UI styling

## Runtime

**Environment:**
- Node.js (no `.nvmrc` pinned; host runs v25.6.1)
- Cloudflare Workers (production runtime via OpenNext adapter)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js ^14.2.0 (App Router) - Server-side API routes + React admin UI
- React ^18.3.0 - Admin dashboard components
- React DOM ^18.3.0

**Testing:**
- Vitest ^4.0.18 - Unit tests (`src/lib/__tests__/`)

**Build/Dev:**
- TypeScript ^5.5.0 - Type checking, strict mode enabled
- Tailwind CSS ^3.4.0 - Utility-first styling for admin UI
- PostCSS ^8.4.0 + Autoprefixer ^10.4.0 - CSS processing
- tsx ^4.21.0 - Run TypeScript scripts directly (`scripts/`)
- @opennextjs/cloudflare ^1.0.0 - Adapts Next.js for Cloudflare Workers
- Wrangler ^3.0.0 - Cloudflare Workers CLI (deploy, dev)

## Key Dependencies

**Critical:**
- `papaparse` ^5.4.1 - CSV parsing for client list from Google Sheets (`src/app/api/clients/route.ts`). Listed as server component external package in `next.config.js`.
- `lucide-react` ^0.468.0 - Icon library for admin UI components

**Infrastructure:**
- `@opennextjs/cloudflare` ^1.0.0 - Bridges Next.js to Cloudflare Workers runtime. Config at `open-next.config.ts`.
- `wrangler` ^3.0.0 - Cloudflare deploy tool. Config at `wrangler.toml`.

## Configuration

**Environment:**
- `.env.local` - Local environment variables (gitignored)
- `.env.local.example` - Template with required vars: `ANTHROPIC_API_KEY`, `SITE_PASSWORD`
- No `.env` files committed

**Build:**
- `tsconfig.json` - Strict mode, ES2017 target, bundler module resolution, path alias `@/*` -> `./src/*`
- `next.config.js` - Webpack rule to import `.html` files as raw strings (asset/source)
- `tailwind.config.ts` - Custom brand colors (cream, terra, sage, sand, slate) and fonts (DM Sans, Playfair Display)
- `postcss.config.js` - Tailwind + Autoprefixer
- `vitest.config.ts` - Node environment, globals enabled, `@/` alias
- `wrangler.toml` - Three environments: production, staging, dev (separate worker names)
- `open-next.config.ts` - Default Cloudflare config (no custom settings)

**TypeScript Path Aliases:**
- `@/*` maps to `./src/*` (used throughout imports)

**Webpack Customization:**
- `.html` files imported as raw strings via `asset/source` rule (enables template loading at build time)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js dev server |
| `npm run build` | Standard Next.js build |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run validate` | Run `scripts/validate-dashboard.ts` |
| `npm run generate:test` | Run `scripts/generate-test-dashboard.ts` |
| `npm run deploy` | Build for Cloudflare + deploy to production |
| `npm run deploy:staging` | Build + deploy to staging worker |
| `npm run deploy:dev` | Build + deploy to dev worker |
| `npm run cf:build` | Build for Cloudflare only (no deploy) |
| `npm run cf:dev` | Local Wrangler dev server |

## Platform Requirements

**Development:**
- Node.js (no specific version pinned)
- `npm install` to set up dependencies
- `ANTHROPIC_API_KEY` and `SITE_PASSWORD` in `.env.local`

**Production:**
- Cloudflare Workers (serverless edge runtime)
- Three worker environments configured in `wrangler.toml`:
  - `dashboard-generator` (production)
  - `dashboard-generator-staging` (staging)
  - `dashboard-generator-dev` (dev/preview)
- OpenNext adapter bridges Next.js to Workers runtime
- Static assets served via Cloudflare Assets binding
- Compatibility flags: `nodejs_compat_v2`
- Compatibility date: `2024-09-23`

**Deployment Notes:**
- Git push does NOT trigger deploys. Must run `npm run deploy` or `npm run deploy:staging` manually.
- `--dangerouslyUseUnsupportedNextVersion` flag used on staging/dev/promote builds (Next.js version may not be officially supported by OpenNext yet).

---

*Stack analysis: 2026-03-15*
