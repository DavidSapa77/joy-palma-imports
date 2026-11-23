# Joy Palma Imports — Inventory & Sales Intelligence System

[![CI](https://github.com/DavidSapa77/joy-palma-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/DavidSapa77/joy-palma-imports/actions/workflows/ci.yml)

A web app that replaces Joy Palma Imports Limited's physical sales book. Staff record stock and sales; the system does the calculations and shows the owner which products sell the most, which don't, and what customers are asking for — so she imports what actually sells.

## Project documents

| Document                                  | Purpose                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| [PRD](docs/PRD.md)                        | What we're building and why: features, roles, permissions, business rules |
| [Database Model](docs/DATABASE_MODEL.md)  | Tables, Prisma schema, transaction flows, report queries                  |
| [UI/UX Specification](docs/UI_UX_SPEC.md) | Brand, navigation, every screen, states, accessibility                    |
| [Build Plan](docs/PLAN.md)                | Phased task list from setup to deployment                                 |

## Stack

Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (Neon) · Auth.js · Vitest · Playwright · Vercel

## Local setup

### Prerequisites

- **Node.js 22 LTS** (22.12 or newer). The repo has an `.nvmrc`, so with nvm run `nvm use`.
- **pnpm 10.** The exact version is pinned in `package.json`; the easiest way to get it is
  `corepack enable` (Corepack ships with Node 22).
- A free **[Neon](https://neon.tech) PostgreSQL** database.

### 1. Install dependencies

```bash
git clone https://github.com/DavidSapa77/joy-palma-imports.git
cd joy-palma-imports
pnpm install
```

### 2. Create a Neon database

1. Sign in to [console.neon.tech](https://console.neon.tech) and create a project (pick the region closest to Ghana, e.g. **AWS Europe (Frankfurt)**).
2. Create a database (e.g. `joy_palma`), or use the default `neondb`.
3. Open **Connect** and copy two connection strings:
   - the **pooled** string (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** string (turn "Connection pooling" off) → `DIRECT_URL`

   Tip: create a separate Neon branch for development so local work never touches production data.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable              | What to put there                                                        |
| --------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`        | Neon pooled connection string                                            |
| `DIRECT_URL`          | Neon direct connection string (used by migrations)                       |
| `AUTH_SECRET`         | Output of `openssl rand -base64 32`                                      |
| `SEED_OWNER_EMAIL`    | Email for the first Owner account                                        |
| `SEED_OWNER_PASSWORD` | Password for the first Owner account                                     |
| `SEED_DEMO`           | `true` to load demo users, products and 12 months of sales; else `false` |

`.env` is git-ignored — never commit it. Only `.env.example` is tracked.

### 4. Create the database tables and seed data

```bash
pnpm db:migrate   # applies Prisma migrations to the database in DIRECT_URL
pnpm db:seed      # creates settings + the Owner account (and demo data if SEED_DEMO=true)
```

> The Prisma schema, migrations and seed script arrive in Phase 1 of the build plan; until then these commands are placeholders.

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`. A temporary design preview lives at [/styleguide](http://localhost:3000/styleguide).

## Scripts

| Command             | Does                                         |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start the dev server                         |
| `pnpm build`        | Production build                             |
| `pnpm start`        | Run the production build                     |
| `pnpm lint`         | ESLint                                       |
| `pnpm typecheck`    | TypeScript type check (`tsc --noEmit`)       |
| `pnpm test`         | Unit tests (Vitest)                          |
| `pnpm test:e2e`     | End-to-end tests (Playwright)                |
| `pnpm db:migrate`   | Create/apply Prisma migrations (development) |
| `pnpm db:seed`      | Seed the database                            |
| `pnpm db:studio`    | Browse the database in Prisma Studio         |
| `pnpm format`       | Format all files with Prettier               |
| `pnpm format:check` | Check formatting without writing             |

## Continuous integration

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request using Node 22: install → lint → typecheck → unit tests. Keep it green before merging.

## Conventions

- Money is stored as integers in **pesewas** (₵1.00 = 100). Never use floats for money.
- Every mutation is a Server Action: session → `requirePermission()` → Zod → `prisma.$transaction` → audit log → `revalidatePath`.
- Nothing is hard-deleted: sales are voided, products archived, users deactivated.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

See [docs/PLAN.md](docs/PLAN.md) for the full conventions and folder structure.

## Status

Phase 0 (project setup) in progress — see the [Build Plan](docs/PLAN.md).
