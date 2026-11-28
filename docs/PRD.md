# Product Requirements Document (PRD)

**Product:** Joy Palma Imports — Inventory & Sales Intelligence System
**Client:** Joy Palma Imports Limited (Ghana operations, owner based in the United States)
**Document version:** 1.0
**Status:** Approved for build

---

## 1. Background

Joy Palma Imports Limited imports a wide variety of goods into Ghana and resells them locally for profit. The business does not specialise in one product line; it brings in many different items per shipment.

Today every product, stock count, sale and calculation is recorded by hand in a physical book. This causes three problems:

1. **No visibility into what sells.** The owner cannot easily tell which products move fast and which sit on the shelf, so money is tied up importing goods that customers don't buy.
2. **Manual arithmetic.** Sale totals, daily and monthly takings are calculated by hand, which is slow and error-prone.
3. **No remote oversight.** The owner lives in the United States and cannot see what is happening in the Ghana shop in real time.

## 2. Product vision

A simple, professional, web-based system that replaces the physical book. Staff record stock and sales on any device; the system does every calculation automatically and turns the records into clear answers to the owner's key question:

> **"Which products should I import more of, and which should I stop buying?"**

## 3. Goals and success metrics

| Goal | Success metric |
|---|---|
| Replace the physical book | 100% of sales and stock-ins recorded in the system within 30 days of launch |
| Eliminate manual calculation | Zero hand-calculated totals; every sale total and report computed by the system |
| Identify best-selling products | Owner can see top 10 products by quantity and by revenue for any period in ≤ 2 clicks |
| Capture unmet demand | Staff log customer requests for out-of-stock / not-carried items; owner sees most-requested items |
| Monthly financial record | Owner sees revenue, cost, and gross profit per month, per product |
| Protect data integrity | Prices and stock can only be changed by authorised roles; every change is in the audit log |
| Remote access | Owner can log in securely from the US on phone or laptop |

## 4. Users and roles

The system will be used by roughly 4–10 people, each with their own login. Access is controlled by role.

| Role | Who | Summary |
|---|---|---|
| **Owner (Admin)** | The business owner | Full access: users, prices, products, stock, sales, reports, settings, audit log |
| **Manager** | Trusted shop lead | Manage products and stock, record and void sales, view all reports. Can set a product's initial selling price but not change it later. Cannot manage users, cannot change settings |
| **Sales Staff** | Shop attendants | Record sales and customer requests, view product list and stock levels. Cannot change prices, edit products, adjust stock, void sales, or see profit/cost figures |
| **Viewer** (optional) | Accountant / partner | Read-only access to reports and records |

### 4.1 Permission matrix

| Action | Owner | Manager | Sales Staff | Viewer |
|---|:-:|:-:|:-:|:-:|
| Log in / change own password | ✅ | ✅ | ✅ | ✅ |
| View products & stock levels | ✅ | ✅ | ✅ | ✅ |
| Create / edit product details (name, category, SKU) | ✅ | ✅ | ❌ | ❌ |
| **Set initial selling price** (when creating a product) | ✅ | ✅ | ❌ | ❌ |
| **Change selling price** of an existing product | ✅ | ❌ | ❌ | ❌ |
| View cost price | ✅ | ✅ | ❌ | ✅ |
| Set cost price when creating a product | ✅ | ✅ (required) | ❌ | ❌ |
| Update cost price via stock-in ("update cost" option) | ✅ | ✅ | ❌ | ❌ |
| Edit cost price of an existing product directly | ✅ | ❌ | ❌ | ❌ |
| Archive a product | ✅ | ✅ | ❌ | ❌ |
| View stock history (stock-ins, adjustments, movement ledger) | ✅ | ✅ | ❌ | ✅ (read-only) |
| Record stock-in (new shipment) | ✅ | ✅ | ❌ | ❌ |
| Manual stock adjustment (damage, loss, recount) | ✅ | ✅ | ❌ | ❌ |
| **Record a sale** | ✅ | ✅ | ✅ | ❌ |
| Change price on a sale line | ❌ (price comes from product) | ❌ | ❌ | ❌ |
| Apply a discount on a sale | ✅ | ✅ | ❌ | ❌ |
| Back-date a sale | ✅ | ✅ | ❌ (today only) | ❌ |
| Void a sale | ✅ | ✅ | ❌ | ❌ |
| Log a customer request | ✅ | ✅ | ✅ | ❌ |
| View sales history | ✅ (all) | ✅ (all) | ✅ (own, today) | ✅ (all) |
| View revenue reports | ✅ | ✅ | ❌ | ✅ |
| View profit / cost reports | ✅ | ✅ | ❌ | ✅ |
| Export reports (CSV / PDF) | ✅ | ✅ | ❌ | ✅ |
| View Staff Activity report | ✅ | ✅ | ❌ | ❌ |
| Manage users & roles | ✅ | ❌ | ❌ | ❌ |
| Business settings (currency, name, low-stock threshold) | ✅ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ |

**Principle:** sales staff can *record what happened* but cannot *change the rules* (prices, stock, history).

**Selling price:** a Manager may set the selling price only once, when creating a product (permission `product.price.setInitial`). Changing the price afterwards is Owner-only (`product.price.change`) and is recorded in price history.

**Stock history:** Viewers can open the Stock pages (stock-in history, adjustments, movement ledger) read-only (`stock.view`); they cannot receive or adjust stock. Sales Staff see stock levels on products only.

**Implementation:** the matrix is encoded in `src/lib/permissions.ts` (one permission key per row) and pinned cell by cell in `tests/unit/permissions.test.tsx`. Where this matrix was ambiguous, the stricter reading was chosen:
- *Cost price* (owner decision): Owner and Manager set the cost price when creating a product (`product.cost.setInitial`; required when a Manager creates one). A stock-in by an Owner or Manager may update the product's cost price to the shipment's unit cost (`stock.in.updateCost`, the "Update product cost price" option), recorded in price history and the audit log. Editing the cost price of an existing product directly stays Owner-only (`product.cost.change`).
- *Categories:* Owner only (`category.manage`) — UI spec §3.1 places Categories under Admin, where the Manager sees only the Audit Log.
- *Requests list:* Owner, Manager and Viewer can view it (`request.view`); Sales Staff log requests but don't browse the list. Changing request status (`request.manage`) is Owner/Manager.
- *Sales history:* Sales Staff get `sale.viewOwnToday` only.
- *Staff Activity report* (owner decision, F8 "Owner/Manager"): needs `report.staff` (Owner, Manager); the route `/reports/staff-activity` is guarded by it. Viewers see every other report.
- Users who still have to change their password are refused every action until they do.

## 5. Scope

### 5.1 In scope (v1)

**F1 — Authentication & user management**
- Email + password login, one account per person.
- Owner creates users, assigns roles, deactivates users (never hard-deletes, to preserve history).
- Password reset by Owner; users can change their own password.
- Sessions expire after inactivity (default 12 hours).

**F2 — Product catalogue**
- Fields: name, SKU/code (auto-generated, editable), category, unit of measure (piece, carton, pack, kg…), selling price per unit, cost price per unit, low-stock threshold, optional image and description.
- Current quantity in stock is shown but **never edited directly** — it changes only through stock-ins, sales, voids and adjustments.
- Products can be archived (hidden from sale screens) but not deleted once they have history.
- Categories managed by Owner/Manager.

**F3 — Stock-in (receiving imported goods)**
- Record a shipment/batch: date (defaults to today), supplier/shipment reference (optional), and one or more lines of product + quantity + cost per unit.
- Stock-in increases product quantity automatically.
- Option to create a new product directly from the stock-in screen.

**F4 — Sales recording**
- Date and time set automatically to now (Owner/Manager may back-date for entries copied from the old book).
- Add one or more products; for each, enter **quantity**. The system fills in the **unit price from the product record** and calculates **line total = unit price × quantity** and **sale total = sum of lines − discount**.
- Shows available quantity while selling; prevents selling more than is in stock.
- Optional: customer name/phone, payment method (Cash, Mobile Money, Bank Transfer, Card).
- On save, stock is reduced automatically and a receipt number is issued.
- Printable / shareable receipt.
- Voiding (Owner/Manager only) requires a reason, returns stock, and keeps the original record marked as void.

**F5 — Customer requests (unmet demand)**
- Staff log when a customer asks for something the shop doesn't have: either an existing product that is out of stock, or a free-text item the shop does not carry.
- Fields: date (auto), product or free-text item name, quantity wanted (optional), note.
- Feeds the "Most requested" report so the owner knows what to import next.

**F6 — Stock adjustments**
- Owner/Manager can adjust stock for damage, loss, theft, or recount, with a mandatory reason.

**F7 — Dashboard**
- Today / this month at a glance: revenue, number of sales, items sold, gross profit (role-permitting).
- Top 5 selling products this month.
- Low-stock alerts.
- Most-requested items not in stock.
- Revenue trend chart (last 30 days, last 12 months).

**F8 — Reports & insights**
- **Best sellers:** ranked by quantity sold and by revenue for a chosen period (this week, this month, last month, this quarter, this year, custom range).
- **Slow movers / dead stock:** products with high stock and few or no sales in the period; days since last sale.
- **Sell-through rate:** units sold ÷ units received in the period.
- **Monthly summary:** revenue, cost of goods sold, gross profit, margin %, per month and per product. Per-month totals are **after discounts**; per-product profit is **before discounts** (discounts apply to the whole sale) — the UI labels each figure accordingly.
- **Category performance.**
- **Seasonality:** month-by-month sales per product over the year, so seasonal patterns are visible.
- **Most requested:** customer requests ranked by count.
- **Restock suggestions:** products ranked by a simple score combining sales velocity, stock remaining (days of stock left) and request count.
- **Staff activity:** sales recorded per staff member (Owner/Manager).
- Export any report as CSV; print/PDF view.

**F9 — Audit log**
- Every create/update/void/delete of products, prices, stock, sales and users is recorded with who, what, when, old value and new value.

**F10 — Settings**
- Business name, logo, address, phone (shown on receipts).
- Currency (default **GHS ₵**; display-only setting, the system is single-currency).
- Default low-stock threshold.
- Time zone (default Africa/Accra).

### 5.2 Out of scope (v1)
- Online store / customer-facing ordering.
- Multiple shop branches (data model is designed so this can be added later).
- Multi-currency conversion and import duty/shipping cost allocation.
- Credit sales / debtor tracking.
- Barcode scanner hardware integration (SKU search works; scanner support can come later).
- Native mobile apps (the web app is mobile-responsive).

## 6. Key business rules

1. **Price lock:** the unit price on a sale line is copied from the product at the moment of sale and stored on the sale. Later price changes never alter past sales.
2. **Cost lock:** the cost per unit is also stored on each sale line at the time of sale, so historical profit stays accurate.
3. **Stock integrity:** product quantity = sum of stock-ins − sum of (non-voided) sales + sum of adjustments. Quantity can never go below zero.
4. **No silent deletes:** sales are voided, products archived, users deactivated. History is permanent.
5. **Automatic dates:** every record gets the current date/time automatically; only Owner/Manager can set an earlier date.
6. **Money precision:** all money stored as integers in the smallest unit (pesewas) to avoid rounding errors.
7. **Price changes** are recorded in a price history table.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Usability | A new sales attendant can record a sale within 5 minutes of first training. A sale takes ≤ 30 seconds. |
| Devices | Fully responsive: phone (360px+), tablet, desktop. |
| Performance | Pages load in < 2 s on a 3G/4G connection in Ghana; reports for a year of data in < 3 s. |
| Security | HTTPS only, hashed passwords (bcrypt/argon2), role checks enforced **on the server** for every action, rate-limited login. |
| Reliability | Daily automated database backups; 99.5% uptime target. |
| Data | All timestamps stored in UTC, displayed in business time zone. |
| Look & feel | Clean, modern, professional; consistent with the UI/UX specification. |
| Maintainability | TypeScript throughout, automated tests for calculation and permission logic. |

## 8. Recommended technology

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | One codebase for UI and API, easy hosting |
| UI | Tailwind CSS + shadcn/ui, Recharts for charts, lucide-react icons | Professional look quickly |
| Database | PostgreSQL (local in development; Neon or Supabase free tier in production) | Reliable, relational, good for reports |
| ORM | Prisma | Type-safe schema & migrations |
| Auth | Auth.js (NextAuth) credentials provider | Email/password with roles |
| Validation | Zod | Shared client/server validation |
| Hosting | Vercel | Simple deploys from GitHub |
| Testing | Vitest + Playwright | Unit + end-to-end |

## 9. Release plan
- **v1.0 (MVP):** F1–F10 as above.
- **v1.1:** barcode scanning, WhatsApp receipt sharing, email monthly report to owner.
- **v2.0:** multiple branches, credit sales, landed-cost (shipping + duty) allocation per shipment.

## 10. Open questions
1. Should Sales Staff see each other's sales for the day? (Default: own sales only.)
2. Are discounts used in practice? (Default: allowed for Owner/Manager only.)
3. Will historical data from the physical book be entered? (Back-dating is supported for this.)
4. Is a printed receipt needed, or is a digital/WhatsApp receipt enough?

## 11. Related documents
- [Database Model](./DATABASE_MODEL.md)
- [UI/UX Specification](./UI_UX_SPEC.md)
- [Build Plan](./PLAN.md)
