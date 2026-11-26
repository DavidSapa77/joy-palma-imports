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

Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (local in development, Neon in production) · Auth.js · Vitest · Playwright · Vercel

## Local setup

### Prerequisites

- **Node.js 22 LTS** (22.12 or newer). The repo has an `.nvmrc`, so with nvm run `nvm use`.
- **pnpm 10.** The exact version is pinned in `package.json`; the easiest way to get it is
  `corepack enable` (Corepack ships with Node 22).
- **PostgreSQL 17** installed locally for development (production uses Neon, see [Production database](#production-database-neon--phase-11)).

### 1. Install dependencies

```bash
git clone https://github.com/DavidSapa77/joy-palma-imports.git
cd joy-palma-imports
pnpm install
```

### 2. Install PostgreSQL and create the databases

Development uses a **local PostgreSQL 17** server. On Windows (Windows will show an admin prompt):

```powershell
winget install PostgreSQL.PostgreSQL.17
```

The installer sets a password for the `postgres` superuser, so keep it safe. PostgreSQL then runs as the Windows service `postgresql-x64-17` on port 5432, and `psql` lives in `C:\Program Files\PostgreSQL\17\bin`. On macOS use [Postgres.app](https://postgresapp.com) or `brew install postgresql@17`; on Linux use your package manager.

Create an app user and two databases:

```bash
psql -h localhost -U postgres -c "CREATE ROLE joy_palma LOGIN CREATEDB PASSWORD 'choose-a-password';"
psql -h localhost -U postgres -c "CREATE DATABASE joy_palma_dev OWNER joy_palma;"
psql -h localhost -U postgres -c "CREATE DATABASE joy_palma_test OWNER joy_palma;"
```

`CREATEDB` is needed because `prisma migrate dev` creates a temporary shadow database. `joy_palma_test` is reserved for integration tests.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable              | What to put there                                                              |
| --------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`        | `postgresql://joy_palma:<password>@localhost:5432/joy_palma_dev?schema=public` |
| `DIRECT_URL`          | Same as `DATABASE_URL` locally (used by Prisma Migrate)                        |
| `TEST_DATABASE_URL`   | Same, but with the `joy_palma_test` database                                   |
| `AUTH_SECRET`         | Output of `openssl rand -base64 32`                                            |
| `SEED_OWNER_EMAIL`    | Email for the first Owner account                                              |
| `SEED_OWNER_PASSWORD` | Password for the first Owner account                                           |
| `SEED_DEMO`           | `true` to load demo users, products and 12 months of sales; else `false`       |

`.env` is git-ignored — never commit it. Only `.env.example` is tracked.

### 4. Create the database tables and seed data

```bash
pnpm db:migrate   # applies Prisma migrations to the database in DIRECT_URL
pnpm db:seed      # creates settings + the Owner account (and demo data if SEED_DEMO=true)
```

> The seed script arrives in Task 1.5; until then `pnpm db:seed` is a placeholder. `pnpm install` runs `prisma generate` automatically.

### 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`. A temporary design preview lives at [/styleguide](http://localhost:3000/styleguide).

## Production database (Neon) — Phase 11

Development runs on the local PostgreSQL database above. At deployment (Phase 11) we create a [Neon](https://neon.tech) project (region closest to Ghana, e.g. AWS Europe (Frankfurt)) and switch the two connection strings in Vercel's environment variables:

- `DATABASE_URL` → Neon **pooled** string (host contains `-pooler`), used by the app at runtime
- `DIRECT_URL` → Neon **direct** string, used by `prisma migrate deploy`

No code changes are needed, only the connection strings.

## Scripts

| Command                 | Does                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `pnpm dev`              | Start the dev server                                              |
| `pnpm build`            | Production build                                                  |
| `pnpm start`            | Run the production build                                          |
| `pnpm lint`             | ESLint                                                            |
| `pnpm typecheck`        | TypeScript type check (`tsc --noEmit`)                            |
| `pnpm test`             | Unit tests (Vitest)                                               |
| `pnpm test:integration` | Integration tests against `TEST_DATABASE_URL` (migrates it first) |
| `pnpm test:e2e`         | End-to-end tests (Playwright)                                     |
| `pnpm db:migrate`       | Create/apply Prisma migrations (development)                      |
| `pnpm db:seed`          | Seed the database                                                 |
| `pnpm db:generate`      | Regenerate the Prisma Client                                      |
| `pnpm db:studio`        | Browse the database in Prisma Studio                              |
| `pnpm format`           | Format all files with Prettier                                    |
| `pnpm format:check`     | Check formatting without writing                                  |

## Continuous integration

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request using Node 22: install → lint → typecheck → unit tests, plus a second job that runs the integration tests against a throwaway PostgreSQL 17 service. Keep it green before merging.

## Conventions

- Money is stored as integers in **pesewas** (₵1.00 = 100). Never use floats for money.
- Every mutation is a Server Action: session → `requirePermission()` → Zod → `prisma.$transaction` → audit log → `revalidatePath`.
- Nothing is hard-deleted: sales are voided, products archived, users deactivated.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

See [docs/PLAN.md](docs/PLAN.md) for the full conventions and folder structure.

## Status

Phase 0 done; Phase 1 (database) in progress — see the [Build Plan](docs/PLAN.md).
