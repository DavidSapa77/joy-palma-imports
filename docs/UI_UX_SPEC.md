# UI/UX Specification

**Product:** Joy Palma Imports — Inventory & Sales Intelligence System
**Document version:** 1.0

---

## 1. Design goals

1. **Simple enough for a shop attendant, polished enough for an owner abroad.** Recording a sale should feel like using a calculator; the dashboard should feel like a modern business app.
2. **Answers first.** The owner's main question — *what sells?* — is answered on the first screen she sees.
3. **Mobile-first.** Many staff will use a phone at the counter. Every screen works at 360 px wide.
4. **Show only what the role can do.** Buttons a user can't use are hidden, not greyed out (exception: price field shown read-only to staff so they can see it).
5. **Forgiving.** Clear confirmation for destructive actions, friendly errors, no data lost on a slow connection.

## 2. Brand & visual language

### 2.1 Colour palette
| Token | Hex | Use |
|---|---|---|
| `primary` | `#0F4C5C` (deep teal) | Primary buttons, active nav, headings accent |
| `primary-foreground` | `#FFFFFF` | Text on primary |
| `accent` | `#E09F3E` (warm gold) | Highlights, "top seller" badges, chart series 2 |
| `success` | `#2E7D32` | Completed, in stock, profit up |
| `warning` | `#ED8936` | Low stock |
| `danger` | `#C53030` | Out of stock, void, errors |
| `background` | `#F7F8FA` | App background |
| `surface` | `#FFFFFF` | Cards, tables |
| `border` | `#E3E6EA` | Dividers |
| `text` | `#1A202C` | Body text |
| `muted` | `#6B7280` | Secondary text, labels |

Dark mode: optional for v1.1; tokens are defined so it can be added.

### 2.2 Typography
- Font: **Inter** (fallback: system-ui). Numbers use `font-variant-numeric: tabular-nums` so money columns align.
- Scale: Page title 24/32 semibold · Section title 18/28 semibold · Body 14/20 · Small/labels 12/16 · KPI figures 28/36 bold.

### 2.3 Spacing, shape, elevation
- 4 px base grid; card padding 16 (mobile) / 24 (desktop).
- Radius: 8 px cards & inputs, 6 px buttons, full for badges.
- Shadows: single soft shadow on cards (`0 1px 3px rgba(0,0,0,.06)`).

### 2.4 Components (shadcn/ui)
Button, Input, Select, Combobox (product search), Dialog, Sheet (mobile drawer), Table/DataTable (sort, filter, paginate), Card, Badge, Tabs, Toast, DatePicker / DateRangePicker, Tooltip, Skeleton, Avatar, DropdownMenu, AlertDialog (confirm).

### 2.5 Iconography
lucide-react, 20 px in nav, 16 px inline.

### 2.6 Money & dates
- Money: `₵1,250.00` — symbol from settings, 2 decimals, thousands separator. Input fields accept `1250` or `1,250.50`.
- Dates: `22 Nov 2026`, times `14:05`. Relative ("2 hours ago") only in activity feeds.

## 3. Information architecture

```
Login
└── App shell (sidebar on desktop, bottom nav + drawer on mobile)
    ├── Dashboard
    ├── New Sale            ← primary action, always one tap away
    ├── Sales               (history, receipt view, void)
    ├── Products            (list, detail, create/edit)
    ├── Stock
    │   ├── Stock-In        (receive shipment)
    │   ├── Adjustments
    │   └── Movement history
    ├── Requests            (customer requests / unmet demand)
    ├── Reports
    │   ├── Best Sellers
    │   ├── Slow Movers
    │   ├── Monthly Summary
    │   ├── Seasonality
    │   ├── Categories
    │   ├── Most Requested
    │   ├── Restock Suggestions
    │   └── Staff Activity
    └── Admin (Owner)
        ├── Users
        ├── Categories
        ├── Settings
        └── Audit Log
```

### 3.1 Navigation by role
| Item | Owner | Manager | Sales | Viewer |
|---|:-:|:-:|:-:|:-:|
| Dashboard | full | full | simplified (today's own sales, low stock) | full (read-only) |
| New Sale | ✅ | ✅ | ✅ | — |
| Sales | ✅ | ✅ | own today | ✅ |
| Products | ✅ edit | ✅ edit (no price) | view | view |
| Stock | ✅ | ✅ | — | view |
| Requests | ✅ | ✅ | ✅ log | view |
| Reports | ✅ | ✅ | — | ✅ |
| Admin | ✅ | Audit Log only | — | — |

**Mobile bottom nav (Sales role):** Home · **+ Sale** (raised centre button) · Products · Requests · Menu.
**Mobile bottom nav (Owner/Manager):** Home · + Sale · Products · Reports · Menu.

## 4. Screen specifications

### 4.1 Login
- Centred card on soft teal gradient; logo + "Joy Palma Imports".
- Fields: Email, Password (show/hide toggle). "Sign in" button full width.
- Errors: generic "Email or password is incorrect" (don't reveal which). After 5 failures: "Too many attempts, try again in 15 minutes."
- If `mustChangePassword`, redirect to **Set new password** screen.

### 4.2 App shell
- **Desktop (≥1024px):** left sidebar 240 px (collapsible to 72 px icons), top bar with page title, global product search (⌘K), "New Sale" button, user menu (name, role badge, change password, sign out).
- **Mobile:** top bar (title + avatar), bottom nav, drawer for other sections.
- Business name and logo from Settings in sidebar header.

### 4.3 Dashboard (Owner/Manager/Viewer)
Layout (desktop, 12-col grid):

```
┌──────────────────────────────────────────────────────────────┐
│ Good morning, Joy        Period: [Today ▾ This month ▾ ...]  │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ Revenue  │ Sales    │ Items    │ Gross profit                 │
│ ₵12,450  │ 38       │ 112      │ ₵3,980  (32%)                │
│ ▲ 12% vs │ ▲ 5%     │ ▼ 3%     │ ▲ 8%                         │
├──────────┴──────────┴──────────┴──────────────────────────────┤
│ Revenue trend (line/area chart, 30 days | 12 months toggle)   │
├───────────────────────────────┬──────────────────────────────┤
│ 🏆 Top sellers this month      │ ⚠ Low stock (n)              │
│ 1 Product A  · 84 units · ₵…  │ Product X — 2 left [Restock] │
│ 2 …  (bar per row)            │ …                            │
│ [View full report →]          │ [View all →]                 │
├───────────────────────────────┼──────────────────────────────┤
│ 🔎 Most requested (not stocked)│ 💤 Not selling (30+ days)    │
│ "Rice cooker" — asked 9×      │ Product Y · 40 in stock      │
├───────────────────────────────┴──────────────────────────────┤
│ Recent sales (last 5) …                                       │
└──────────────────────────────────────────────────────────────┘
```
- KPI cards show comparison vs the previous equivalent period.
- Gross profit hidden for Sales role.
- Mobile: cards stack in single column; KPI cards in a 2×2 grid.

**Sales-role dashboard:** big "+ New Sale" button, "My sales today" (count + total), low-stock list, quick "Log a request" button.

### 4.4 New Sale (most important screen)
Goal: a sale in ≤ 30 seconds.

**Desktop:** two columns — left: product search & cart; right: summary & payment.
**Mobile:** single column; summary sticky at bottom with total and "Complete sale".

Elements:
1. **Date/time** — shows "Now · 22 Nov 2026 09:14". Owner/Manager see a small "Change" link to back-date.
2. **Product search** — combobox; type name or SKU; results show name, SKU, price, stock badge (`12 in stock` green, `2 left` orange, `Out of stock` red & disabled). Recently/frequently sold products shown as quick-add chips under the search.
3. **Cart lines** — each row: product name, unit price (read-only), **quantity stepper** (− [ 3 ] +, also typeable), line total (auto), remove ✕.
   - Quantity can't exceed stock: input caps and shows "Only 5 available".
   - Line total updates instantly: `₵45.00 × 3 = ₵135.00`.
4. **Summary** — Subtotal, Discount (Owner/Manager only; amount or %), **Total** (large, bold).
5. **Payment method** — segmented buttons: Cash · MoMo · Bank · Card.
6. **Customer (optional)** — collapsible: name, phone.
7. **Complete sale** — primary button, disabled until ≥ 1 line. Shows spinner; prevents double-submit.
8. **Success** — dialog/sheet: ✅ "Sale recorded — Receipt R-2026-000123 · ₵135.00" with buttons **Print receipt**, **Share** (WhatsApp/copy link — v1.1), **New sale** (focus returns to search).

Errors: if stock changed meanwhile ("Only 1 Product A left now"), highlight the row and keep the cart.

Keyboard (desktop): `/` focus search, `Enter` add highlighted product, `+`/`-` adjust qty, `Ctrl+Enter` complete.

### 4.5 Sales history
- DataTable: Receipt #, Date/time, Items (count), Total, Payment, Sold by, Status badge.
- Filters: date range, staff, payment method, status, search receipt # / customer.
- Footer row: count and total of filtered (non-voided) sales.
- Row click → **Sale detail** (receipt layout): lines, totals, who/when, customer, buttons Print, **Void** (Owner/Manager; AlertDialog with required reason). Voided sales show red "VOID" stamp + reason.

### 4.6 Receipt (print view)
A6/80mm-thermal-friendly layout: logo, business name, address, phone; receipt #, date, served by; table of items (qty × price = total); subtotal, discount, total; payment method; footer message. Uses `@media print`.

### 4.7 Products list
- Toolbar: search, category filter, stock filter (All / In stock / Low / Out / Archived), "+ Add product" (Owner/Manager), Export CSV.
- Desktop table: Image thumb, Name + SKU, Category, Unit, Price, Cost (Owner/Manager/Viewer), In stock (badge colour-coded), Sold (30 days), Actions (⋯).
- Mobile: card list — name, price, stock badge; tap for detail.

### 4.8 Product detail
- Header: name, SKU, category, archive status, Edit button.
- Stat cards: In stock, Price, Cost & margin (role-permitting), Units sold (30d), Days of stock left, Last sold.
- Tabs: **Sales** (chart of units/month for 12 months + recent lines) · **Stock movements** (ledger with running balance) · **Price history** · **Requests**.
- Actions (Owner/Manager): Receive stock, Adjust stock, Archive/Restore. Owner: Change price (dialog shows old → new, note).

### 4.9 Product form (create/edit)
Fields: Name*, SKU (auto, editable), Category (select + "new"), Unit*, Selling price* (Owner and Manager can set it when **creating** a product; on **edit** it is editable by the Owner only and read-only for the Manager — later changes go through the Owner's Change price dialog), Cost price, Low-stock threshold, Description, Image upload.
Initial quantity is **not** on this form — after creating, user is prompted "Receive initial stock now?" → Stock-In.

### 4.10 Stock-In (receive shipment)
- Header fields: Date (default today), Supplier / shipment ref, Note.
- Lines table: Product (search, or "+ New product" inline sheet), Quantity, Unit cost, Line cost (auto). "Update product cost price to this cost" checkbox (default on).
- Footer: total units, total cost. "Save stock-in" → toast + go to stock-in detail.
- Stock-In history list: Ref, date, supplier, # lines, total cost, received by.

### 4.11 Stock adjustment
Dialog from product or Stock page: product, current stock (read-only), change (+/−) or "set counted quantity", reason (select), note (required if Other). Shows "New stock will be: 18".

### 4.12 Requests (unmet demand)
- **Log request** (quick dialog, Sales can use): "What did the customer ask for?" — combobox that matches existing products *or* accepts free text; quantity (optional); note. One-tap save. Banner when chosen product is in stock: "This item is in stock (12) — record a sale instead?"
- List: Item, times requested, last requested, qty wanted, linked product, status. Grouped by item name (case-insensitive). Owner/Manager can mark Fulfilled/Dismissed.

### 4.13 Reports hub
- Landing grid of report cards with icon, title, one-line description.
- Every report page: **period picker** (This week, This month, Last month, This quarter, This year, Last 12 months, Custom), category filter where relevant, **Export CSV**, **Print**.

| Report | Visual | Table columns |
|---|---|---|
| Best Sellers | Horizontal bar chart top 10; toggle *By quantity / By revenue / By profit* | Rank, Product, Units, Revenue, Profit (before discounts), Margin %, Share of revenue % |
| Slow Movers | — | Product, In stock, Units sold (period), Last sold, Days since, Stock value at cost |
| Monthly Summary | Grouped bar (revenue vs cost) + profit line | Month, Sales, Units, Revenue, Discounts, COGS, Gross profit (after discounts), Margin |
| Seasonality | Heatmap: products (rows) × months (cols), colour = units sold | Same, numeric |
| Categories | Donut / bar | Category, Units, Revenue, Profit (before discounts), % |
| Most Requested | Bar chart | Item, Requests, Qty wanted, In catalogue?, Status |
| Restock Suggestions | Score bar per row | Product, Score, Units sold (60d), Stock left, Days left, Open requests, Suggested action ("Import more", "Hold", "Stop importing") |
| Staff Activity | Bar | Staff, Sales, Revenue, Voids |

Each chart has an accessible table alternative and tooltips with exact values.

**Profit labelling:** discounts are applied to the whole sale, not to lines. Any per-product or per-category profit (Best Sellers, Categories, product detail margin) is computed from line totals and must be labelled **"before discounts"**. Sale-level figures (Monthly Summary, dashboard Gross profit KPI) use the sale total and must be labelled **"after discounts"**. Show the label in the column header and in chart tooltips.

### 4.14 Admin — Users
Table: Name, Email, Role badge, Status, Last login. Actions: Add user (name, email, role, temporary password generated & shown once), Edit role, Reset password, Deactivate/Reactivate. Owner cannot deactivate themselves or remove the last Owner.

### 4.15 Admin — Settings
Sections: Business profile (name, logo, address, phone, email), Regional (currency code & symbol, time zone), Inventory (default low-stock threshold), Receipt (footer text, preview).

### 4.16 Admin — Audit Log
Filterable list: When, Who, Action, Entity, summary ("Changed price of Product A from ₵40.00 to ₵45.00"). Expand for before/after JSON diff.

## 5. States & feedback
- **Loading:** skeletons for tables/cards; buttons show spinner and disable.
- **Empty states:** friendly illustration/icon + one-line explanation + primary action (e.g. "No products yet — Add your first product").
- **Success:** toast bottom-right (desktop) / top (mobile), 4 s.
- **Errors:** inline under fields for validation; toast for server errors with "Try again". Never lose form data on error.
- **Confirmations:** AlertDialog for void, archive, deactivate, stock adjustment.
- **Offline:** banner "You're offline — changes can't be saved right now." (no offline queue in v1).

## 6. Accessibility
- WCAG 2.1 AA contrast; focus rings visible; all inputs labelled; charts have data-table fallback; touch targets ≥ 44 px; works with keyboard only.

## 7. Responsive breakpoints
| Name | Width | Layout |
|---|---|---|
| sm | < 640 | single column, bottom nav, cards instead of tables |
| md | 640–1023 | two-column forms, drawer nav |
| lg | ≥ 1024 | sidebar, multi-column dashboard |
| xl | ≥ 1280 | max content width 1280 px, centred |

## 8. Microcopy guidelines
- Plain, friendly, short. "Sale recorded" not "Transaction successfully persisted".
- Use the business's words: "Receive stock", "Customer asked for", "Best sellers".
- Money always with currency symbol.

## 9. Related documents
- [PRD](./PRD.md) · [Database Model](./DATABASE_MODEL.md) · [Build Plan](./PLAN.md)
