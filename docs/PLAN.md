# Build Plan

**Product:** Joy Palma Imports — Inventory & Sales Intelligence System
**Document version:** 1.0

This plan breaks the build into phases. Each phase ends in something that runs, is committed to GitHub, and can be demoed. Follow phases in order; tasks inside a phase can be reordered.

Reference documents: [PRD](./PRD.md) · [Database Model](./DATABASE_MODEL.md) · [UI/UX Spec](./UI_UX_SPEC.md)

---

## Tech stack (fixed)
Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · lucide-react · Recharts · Prisma · PostgreSQL (local PostgreSQL 17 in development, Neon in production) · Auth.js v5 (credentials) · bcryptjs · Zod · React Hook Form · TanStack Table · date-fns + date-fns-tz · Vitest · Playwright · pnpm · Vercel.

## Folder structure

```
joy-palma-imports/
├── docs/                    PRD, DATABASE_MODEL, UI_UX_SPEC, PLAN
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (app)/
│   │   │   ├── layout.tsx         app shell
│   │   │   ├── dashboard/
│   │   │   ├── sales/  sales/new/  sales/[id]/
│   │   │   ├── products/  products/[id]/  products/new/
│   │   │   ├── stock/in/  stock/adjustments/  stock/movements/
│   │   │   ├── requests/
│   │   │   ├── reports/<report>/
│   │   │   └── admin/users/ admin/categories/ admin/settings/ admin/audit/
│   │   └── api/auth/[...nextauth]/
│   ├── components/  ui/ (shadcn)  layout/  sales/  products/  reports/  charts/
│   ├── lib/
│   │   ├── auth.ts            Auth.js config
│   │   ├── db.ts              Prisma client
│   │   ├── permissions.ts     role → permission map + can()/requirePermission()
│   │   ├── money.ts           pesewas ↔ display helpers
│   │   ├── dates.ts           business time zone helpers, period ranges
│   │   ├── audit.ts
│   │   ├── counters.ts        receipt/SKU/ref numbers
│   │   └── validators/        Zod schemas
│   ├── server/
│   │   ├── actions/           Server Actions (products, sales, stock, requests, users, settings)
│   │   ├── services/          transactional business logic (sale, void, stock-in, adjustment, price change) shared by actions and the seed
│   │   └── queries/           read queries & reports
│   └── middleware.ts          route protection
├── tests/  unit/  e2e/
├── .env.example
└── README.md
```

## Conventions
- All mutations are **Server Actions** that: (1) get session, (2) `requirePermission()`, (3) validate with Zod, (4) run in `prisma.$transaction`, (5) write audit log, (6) `revalidatePath`.
- Money in pesewas everywhere in code; convert only at the UI edge via `lib/money.ts`.
- Never accept price/cost/total from the client for a sale.
- Commit after every task: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.

---

## Phase 0 — Project setup (½ day)
- [ ] 0.1 Create Next.js app with TypeScript, Tailwind, ESLint, `src/` dir, pnpm.
- [ ] 0.2 Add Prettier, strict tsconfig, path alias `@/`.
- [ ] 0.3 Install & init shadcn/ui; add base components; set theme tokens from UI spec §2.1; Inter font.
- [ ] 0.4 `.env.example` (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`, `SEED_DEMO`).
- [ ] 0.5 README with setup steps.
- [ ] 0.6 GitHub Actions CI: install, lint, typecheck, unit tests.
**Done when:** `pnpm dev` shows a placeholder page, CI is green.

## Phase 1 — Database (1 day)
- [ ] 1.1 Add Prisma; paste schema from DATABASE_MODEL §5.
- [ ] 1.2 Initial migration + CHECK constraints migration.
- [ ] 1.3 `lib/db.ts` singleton.
- [ ] 1.4 `lib/money.ts`, `lib/dates.ts`, `lib/counters.ts` + unit tests.
- [ ] 1.5 Seed: owner + settings; demo data behind `SEED_DEMO=true` (12 months, seasonal).
**Done when:** `pnpm db:migrate && pnpm db:seed` works on the local PostgreSQL database; tests pass.

## Phase 2 — Auth, roles & app shell (1–1.5 days)
- [ ] 2.1 Auth.js credentials provider, bcrypt verify, session includes `id`, `role`, `name`; reject inactive users.
- [ ] 2.2 Login page + rate limiting (5 attempts / 15 min per email+IP) + audit `LOGIN`/`LOGIN_FAILED`.
- [ ] 2.3 Forced "set new password" flow when `mustChangePassword`.
- [ ] 2.4 `lib/permissions.ts` implementing PRD §4.1 matrix; `can(role, perm)`, `requirePermission()`; unit tests for every cell.
- [ ] 2.5 `middleware.ts` protecting `(app)` routes; role-gated route guard for admin/reports/stock.
- [ ] 2.6 App shell: sidebar (desktop), bottom nav + drawer (mobile), top bar, user menu; nav items filtered by role.
**Done when:** each seeded role logs in and sees only its allowed nav.

## Phase 3 — Admin: users, categories, settings (1 day)
- [ ] 3.1 Users list, create (temp password shown once), edit role, reset password, deactivate/reactivate; guards for last Owner.
- [ ] 3.2 Categories CRUD (archive instead of delete).
- [ ] 3.3 Settings page (business profile, currency, time zone, low-stock default, receipt footer); settings cached & used by money/date helpers.
- [ ] 3.4 `lib/audit.ts` helper used by all actions.

## Phase 4 — Products (1.5 days)
- [ ] 4.1 Products list (DataTable, search, filters, stock badges, mobile cards, CSV export).
- [ ] 4.2 Create/edit form with Zod; SKU auto-generation; price field rules (Owner changes; Manager initial only).
- [ ] 4.3 Change price dialog (Owner) → PriceHistory + audit.
- [ ] 4.4 Archive/restore.
- [ ] 4.5 Product detail page with stat cards and tabs (sales chart, movements, price history, requests).
- [ ] 4.6 Image upload (Vercel Blob or Supabase storage) — optional; fallback placeholder.

## Phase 5 — Stock (1.5 days)
- [ ] 5.1 Stock-In form (multi-line, inline new product, update cost option) → transaction per DATABASE_MODEL §6.3.
- [ ] 5.2 Stock-In history & detail.
- [ ] 5.3 Stock adjustment dialog → §6.4.
- [ ] 5.4 Movement ledger page (filter by product/type/date) with running balance.
- [ ] 5.5 `rebuildStock(productId)` admin utility + test that ledger sum = cached quantity.

## Phase 6 — Sales (2 days) ⭐ core
- [ ] 6.1 `createSale` server action per §6.1 with row locking; unit/integration tests: totals, discount rules, oversell rejected, price taken from DB not client, concurrent sale race.
- [ ] 6.2 New Sale screen per UI spec §4.4 (search combobox, quick-add chips, qty stepper, live totals, payment method, customer, success dialog, keyboard shortcuts, double-submit protection).
- [ ] 6.3 Back-dating for Owner/Manager only.
- [ ] 6.4 Sales history with filters and totals footer; Sales role sees own sales today.
- [ ] 6.5 Sale detail + printable receipt (`@media print`, 80 mm).
- [ ] 6.6 Void sale (reason required) per §6.2.

## Phase 7 — Customer requests (½ day)
- [ ] 7.1 Quick "Log request" dialog (product match or free text; in-stock hint).
- [ ] 7.2 Requests list grouped by item; status changes for Owner/Manager.

## Phase 8 — Dashboard & reports (2.5 days) ⭐ core
- [ ] 8.1 `lib/dates.ts` period presets → UTC ranges in business TZ; tests.
- [ ] 8.2 Report queries in `server/queries/reports.ts` (best sellers, monthly summary, slow movers, sell-through, seasonality, categories, most requested, restock score, staff activity) with tests against seed data.
- [ ] 8.3 Dashboard (KPI cards with previous-period comparison, revenue trend, top sellers, low stock, most requested, not selling, recent sales); Sales-role simplified dashboard.
- [ ] 8.4 Reports hub + each report page (period picker, chart, table, CSV export, print).
- [ ] 8.5 Hide cost/profit for roles without permission (server-side, not just UI).

## Phase 9 — Audit log & polish (1 day)
- [ ] 9.1 Audit log page with filters and readable summaries / diff view.
- [ ] 9.2 Empty, loading, error states everywhere; toasts; confirmations.
- [ ] 9.3 Accessibility pass (labels, focus, contrast, keyboard).
- [ ] 9.4 Mobile pass at 360 px on every screen.
- [ ] 9.5 Favicon, app metadata, PWA manifest (installable icon on phone).

## Phase 10 — Testing & hardening (1 day)
- [ ] 10.1 Playwright E2E: login per role; owner creates product → receives stock → sales staff sells → stock reduced → manager voids → stock restored → report shows correct numbers; sales staff cannot reach price/stock/admin URLs or actions.
- [ ] 10.2 Security review: every server action calls `requirePermission`; no client-supplied prices; headers (CSP, HSTS) ; rate limit.
- [ ] 10.3 Performance check with 50k sale items of seed data; add indexes if needed.

## Phase 11 — Deployment & handover (½ day)
- [ ] 11.1 Neon production DB: switch DATABASE_URL/DIRECT_URL to Neon (pooled / direct strings); Vercel project linked to GitHub; env vars set; `prisma migrate deploy` in build; production env must have `SEED_DEMO="false"` (demo accounts must never exist there).
- [ ] 11.2 Seed production Owner account with `SEED_DEMO="false"`, so demo accounts and demo data never exist in production.
- [ ] 11.3 Custom domain (optional) + HTTPS.
- [ ] 11.4 Backups confirmed (Neon PITR).
- [ ] 11.5 User guide (`docs/USER_GUIDE.md`): one page per role with screenshots.
- [ ] 11.6 Handover: owner login, how to add staff, how to read Best Sellers & Restock Suggestions.

## Phase 12 — Public website (1 day) — *not started; build only when the client sends the content*
- [ ] 12.1 Public landing page at `/` for Joy Palma Imports: about the business, product categories, contact (phone, **WhatsApp** link, email, **location** / map), and a **"Staff login"** button to `/login`.
- [ ] 12.2 No public sign-up anywhere; accounts are still created only by the Owner (Admin → Users).
- [ ] 12.3 Signed-in users who open `/` go straight to `/dashboard` (today `/` always redirects to `/dashboard`; middleware must then allow `/` for signed-out visitors).
- [ ] 12.4 All text, photos and contact details come from the client; nothing is invented. Mobile-first, fast on 3G, basic SEO (title, description, Open Graph).

---

## Timeline summary
| Phase | Est. days |
|---|---|
| 0 Setup | 0.5 |
| 1 Database | 1 |
| 2 Auth & shell | 1.5 |
| 3 Admin | 1 |
| 4 Products | 1.5 |
| 5 Stock | 1.5 |
| 6 Sales | 2 |
| 7 Requests | 0.5 |
| 8 Dashboard & reports | 2.5 |
| 9 Polish | 1 |
| 10 Testing | 1 |
| 11 Deploy | 0.5 |
| **Total (v1 app)** | **≈ 14.5 working days** |
| 12 Public website (later, needs client content) | 1 |

## Definition of done (every task)
- Types pass, lint passes, relevant tests written and passing.
- Permission enforced on the server.
- Works at 360 px and 1280 px.
- Committed and pushed to GitHub with a clear message.

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Staff keep using the book | Make sale entry faster than writing; owner reviews dashboard daily |
| Slow internet in shop | Lightweight pages, skeletons, no heavy images on sale screen |
| Concurrent sales oversell | Row locks in transaction + DB CHECK constraint |
| Wrong historical data from book | Back-dating restricted to Owner/Manager; audit log |
| Repo is public while in development | Never commit `.env`; secrets only in Vercel; switch repo to private before handover |
