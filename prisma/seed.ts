/**
 * Database seed — `pnpm db:seed` (runs via the "prisma.seed" entry in package.json).
 *
 * Always: the Setting row and the Owner account (SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD).
 * SEED_DEMO=true: demo users, categories, products, stock-ins, ~400 sales over the
 * last 12 months, voids, adjustments, price changes and customer requests.
 *
 * Demo stock and sales go through the same services the app uses
 * (src/server/services), so stock movements, counters and price/cost snapshots
 * are exactly what real usage would produce.
 *
 * Safe to run repeatedly: settings/users/categories are upserted, and the demo
 * inventory is only created when the database has no products, stock-ins or
 * sales yet (all in one transaction — it either fully exists or not at all).
 */
import { existsSync } from "node:fs";

import { PrismaClient, type PaymentMethod, type Prisma } from "@prisma/client";

import { getPeriodRange, startOfBusinessDay, toBusinessDate, type CivilDate } from "@/lib/dates";
import { formatMoney, toPesewas } from "@/lib/money";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { InventoryError } from "@/server/services/errors";
import { changeSellingPrice, createProduct } from "@/server/services/products";
import { recordSale, voidSale } from "@/server/services/sales";
import { adjustStock, findStockMismatches } from "@/server/services/stock";
import { receiveStock } from "@/server/services/stock-in";

import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_NAMES,
  CATEGORY_SEASON,
  CUSTOMER_NAMES,
  DEMO_PASSWORD,
  DEMO_PRODUCTS,
  DEMO_USERS,
  MONTH_TRAFFIC,
  SUPPLIERS,
  UNMET_REQUESTS,
  type DemoProduct,
} from "./seed-data";

if (existsSync(".env")) process.loadEnvFile(".env"); // `prisma db seed` already loads it; direct `tsx` runs don't

const prisma = new PrismaClient();

const TARGET_SALES = 400;
const VOID_COUNT = 6;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Deterministic randomness (same data every run for the same "now")
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rand = mulberry32(20_261_126);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1]!;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

// ---------------------------------------------------------------------------
// Always: settings + owner
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. Fill it in .env before seeding.`);
  return value;
}

async function seedSettings() {
  // update: {} — never overwrite settings the Owner has changed in the app.
  return prisma.setting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

async function seedOwner() {
  const email = requireEnv("SEED_OWNER_EMAIL").toLowerCase();
  const password = requireEnv("SEED_OWNER_PASSWORD");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Keep the password: the Owner may have changed it in the app since the first seed.
    const owner = await prisma.user.update({
      where: { id: existing.id },
      data: { role: "OWNER", isActive: true },
    });
    console.log("✓ Owner account already exists (password left unchanged)");
    return owner;
  }

  const owner = await prisma.user.create({
    data: {
      name: process.env.SEED_OWNER_NAME?.trim() || "Joy Palma",
      email,
      passwordHash: await hashPassword(password),
      role: "OWNER",
      mustChangePassword: false,
    },
  });
  console.log("✓ Owner account created");
  return owner;
}

// ---------------------------------------------------------------------------
// Demo: users + categories (idempotent upserts)
// ---------------------------------------------------------------------------

async function seedDemoUsers() {
  let passwordHash: string | undefined;
  const users = new Map<string, { id: string }>();
  for (const demo of DEMO_USERS) {
    let user = await prisma.user.findUnique({ where: { email: demo.email } });
    if (!user) {
      passwordHash ??= await hashPassword(DEMO_PASSWORD);
      user = await prisma.user.create({
        data: { ...demo, passwordHash, mustChangePassword: false },
      });
    }
    users.set(demo.email, user);
  }
  console.log(`✓ Demo users ready (${DEMO_USERS.length})`);
  return {
    manager: users.get("manager@example.com")!,
    sales1: users.get("sales1@example.com")!,
    sales2: users.get("sales2@example.com")!,
  };
}

async function seedCategories() {
  const ids = new Map<string, string>();
  for (const name of CATEGORY_NAMES) {
    const category = await prisma.category.upsert({
      where: { name },
      create: { name, description: CATEGORY_DESCRIPTIONS[name] },
      update: {},
    });
    ids.set(name, category.id);
  }
  console.log(`✓ Categories ready (${CATEGORY_NAMES.length})`);
  return ids;
}

// ---------------------------------------------------------------------------
// Demo: inventory, sales and requests (one transaction, only into an empty DB)
// ---------------------------------------------------------------------------

type People = { ownerId: string; managerId: string; sales1Id: string; sales2Id: string };

type PlannedLine = { product: DemoProduct; quantity: number };
type PlannedSale = {
  soldAt: Date;
  lines: PlannedLine[];
  soldById: string;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  discountPercent: number;
  saleId?: string;
};

type DemoEvent =
  | { at: Date; order: 0; kind: "stockIn"; index: number }
  | { at: Date; order: 1; kind: "adjust"; run: (tx: Tx) => Promise<unknown> }
  | { at: Date; order: 1; kind: "price"; run: (tx: Tx) => Promise<unknown> }
  | { at: Date; order: 2; kind: "sale"; sale: PlannedSale }
  | { at: Date; order: 3; kind: "void"; sale: PlannedSale; reason: string; voidedById: string }
  | { at: Date; order: 4; kind: "request"; data: Prisma.CustomerRequestUncheckedCreateInput };

function monthOf(start: CivilDate, offset: number) {
  const m0 = start.month - 1 + offset;
  const year = start.year + Math.floor(m0 / 12);
  const month = (m0 % 12) + 1;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, days };
}

function phoneNumber() {
  return `0${pick(["24", "54", "55", "20", "50", "27"])}${String(randInt(0, 9_999_999)).padStart(7, "0")}`;
}

/** Plans ~400 sales over the 12 months, weighted by traffic and seasonality. */
function planSales(windowStart: CivilDate, now: Date, timeZone: string, people: People) {
  const months = Array.from({ length: 12 }, (_, i) => monthOf(windowStart, i));

  // Eligible trading slots per day: 08:00–18:30, never in the future.
  const monthDays = months.map(({ year, month, days }) =>
    Array.from({ length: days }, (_, d) => {
      const start = startOfBusinessDay({ year, month, day: d + 1 }, timeZone).getTime();
      const open = start + 8 * HOUR;
      const close = Math.min(start + 18.5 * HOUR, now.getTime() - 10 * 60_000);
      const weekday = new Date(start).getUTCDay();
      const weight = weekday === 0 ? 0.35 : weekday === 6 ? 1.3 : 1;
      return { open, close, weight };
    }).filter((d) => d.close > d.open + HOUR),
  );

  const monthWeights = months.map(
    ({ month, days }, i) => MONTH_TRAFFIC[month]! * (monthDays[i]!.length / days),
  );
  const weightSum = monthWeights.reduce((a, b) => a + b, 0);

  const sellers = [
    { id: people.sales1Id, weight: 45, canDiscount: false },
    { id: people.sales2Id, weight: 35, canDiscount: false },
    { id: people.managerId, weight: 15, canDiscount: true },
    { id: people.ownerId, weight: 5, canDiscount: true },
  ];
  const payments: [PaymentMethod, number][] = [
    ["CASH", 55],
    ["MOBILE_MONEY", 35],
    ["BANK_TRANSFER", 5],
    ["CARD", 5],
  ];

  const sales: PlannedSale[] = [];
  months.forEach(({ month }, i) => {
    const count = Math.round((TARGET_SALES * monthWeights[i]!) / weightSum);
    const days = monthDays[i]!;
    if (days.length === 0) return;
    const productWeight = (p: DemoProduct) =>
      p.popularity * (CATEGORY_SEASON[p.category][month] ?? 1) * (p.season?.[month] ?? 1);

    for (let n = 0; n < count; n++) {
      const day = pickWeighted(days, (d) => d.weight);
      const soldAt = new Date(day.open + Math.floor(rand() * (day.close - day.open)));
      const lineCount = pickWeighted([1, 2, 3, 4], (c) => [55, 30, 12, 3][c - 1]!);
      const lines: PlannedLine[] = [];
      for (let l = 0; l < lineCount; l++) {
        const candidates = DEMO_PRODUCTS.filter(
          (p) => productWeight(p) > 0 && !lines.some((x) => x.product === p),
        );
        const product = pickWeighted(candidates, productWeight);
        const bulky = product.unit === "PIECE" || product.unit === "SET" || product.unit === "PAIR";
        const quantity = bulky ? (chance(0.82) ? 1 : 2) : randInt(1, 3);
        lines.push({ product, quantity });
      }
      sales.push(makeSale(soldAt, lines));
    }
  });

  // Dead stock: a fixed handful of single-unit sales spread across the year.
  for (const product of DEMO_PRODUCTS) {
    const n = product.yearlySales ?? 0;
    for (let k = 0; k < n; k++) {
      const days = monthDays[Math.min(11, Math.floor(((k + 0.5) / n) * 12))]!;
      if (days.length === 0) continue;
      const day = pick(days);
      const soldAt = new Date(day.open + Math.floor(rand() * (day.close - day.open)));
      sales.push(makeSale(soldAt, [{ product, quantity: 1 }]));
    }
  }

  function makeSale(soldAt: Date, lines: PlannedLine[]): PlannedSale {
    const seller = pickWeighted(sellers, (s) => s.weight);
    const withCustomer = chance(0.3);
    return {
      soldAt,
      lines,
      soldById: seller.id,
      paymentMethod: pickWeighted(payments, ([, w]) => w)[0],
      customerName: withCustomer ? pick(CUSTOMER_NAMES) : undefined,
      customerPhone: withCustomer && chance(0.7) ? phoneNumber() : undefined,
      discountPercent: seller.canDiscount && chance(0.25) ? randInt(3, 8) : 0,
    };
  }

  return sales.sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());
}

async function seedDemoInventory(tx: Tx, people: People, categoryIds: Map<string, string>) {
  const settings = await tx.setting.findUniqueOrThrow({ where: { id: 1 } });
  const timeZone = settings.timeZone;
  const now = new Date();
  const window = getPeriodRange("last12Months", timeZone, { now });
  const windowStart = toBusinessDate(window.start, timeZone);

  // Shipments: before the window, early April, early September.
  const at = (offset: number, day: number, hour: number) => {
    const { year, month } = monthOf(windowStart, offset);
    return new Date(startOfBusinessDay({ year, month, day }, timeZone).getTime() + hour * HOUR);
  };
  const stockInDates = [
    new Date(window.start.getTime() - 12 * DAY + 10 * HOUR),
    at(4, 3, 9.5),
    at(9, 6, 9.5),
  ];

  const sales = planSales(windowStart, now, timeZone, people);

  // Size each shipment to cover the planned demand until the next one.
  const segmentOf = (date: Date) => stockInDates.filter((d) => d <= date).length - 1;
  const demand = new Map<DemoProduct, number[]>(DEMO_PRODUCTS.map((p) => [p, [0, 0, 0]]));
  for (const sale of sales) {
    const segment = segmentOf(sale.soldAt);
    for (const line of sale.lines) {
      const perSegment = demand.get(line.product)!;
      perSegment[segment] = (perSegment[segment] ?? 0) + line.quantity;
    }
  }
  const shipmentQuantity = (p: DemoProduct, segment: number): number => {
    if (p.profile === "dead" || p.profile === "never")
      return segment === 0 ? (p.fixedStock ?? 5) : 0;
    const needed = demand.get(p)![segment]!;
    if (p.profile === "out") return needed;
    if (p.profile === "low") return segment === 2 ? needed + randInt(1, 2) : needed;
    return segment === 2 ? needed + randInt(6, 20) : needed + randInt(2, 5);
  };

  // Products (created before the first shipment).
  const productIds = new Map<DemoProduct, string>();
  const prices = new Map<DemoProduct, number>();
  for (const p of DEMO_PRODUCTS) {
    const product = await createProduct(tx, {
      name: p.name,
      categoryId: categoryIds.get(p.category)!,
      unit: p.unit,
      sellingPrice: toPesewas(p.price),
      costPrice: toPesewas(p.cost),
      lowStockThreshold: p.lowStockThreshold ?? null,
      createdById: people.ownerId,
    });
    await tx.product.update({
      where: { id: product.id },
      data: { createdAt: new Date(stockInDates[0]!.getTime() - DAY) },
    });
    productIds.set(p, product.id);
    prices.set(p, product.sellingPrice);
  }
  const productByName = (name: string) => DEMO_PRODUCTS.find((p) => p.name === name)!;

  const events: DemoEvent[] = [];
  stockInDates.forEach((date, index) =>
    events.push({ at: date, order: 0, kind: "stockIn", index }),
  );
  for (const sale of sales) events.push({ at: sale.soldAt, order: 2, kind: "sale", sale });

  // A few voided sales (same day, shortly after).
  const voidReasons = [
    "Customer returned item the same day",
    "Wrong product entered",
    "Duplicate entry",
    "Customer changed mind before leaving",
  ];
  // Only sales of regularly stocked products, so sold-out / low-stock items stay that way.
  const voidable = sales.filter((s) => s.lines.every((l) => l.product.profile === "normal"));
  for (let v = 0; v < VOID_COUNT; v++) {
    const sale = voidable[Math.floor(((v + 0.5) / VOID_COUNT) * (voidable.length - 5))]!;
    const voidAt = new Date(
      Math.min(sale.soldAt.getTime() + randInt(15, 120) * 60_000, now.getTime() - 60_000),
    );
    events.push({
      at: voidAt,
      order: 3,
      kind: "void",
      sale,
      reason: pick(voidReasons),
      voidedById: people.managerId,
    });
  }

  // Adjustments shortly after the April shipment.
  const adjustments: [string, number, "DAMAGED" | "LOST" | "RECOUNT", string | null][] = [
    ["Electric kettle 1.8L", -1, "DAMAGED", "Dropped while unpacking"],
    ["Wall clock", -1, "LOST", null],
    ["Plastic food containers (set of 10)", 1, "RECOUNT", "Found an extra set during stock count"],
  ];
  adjustments.forEach(([name, quantityChange, reason, note], i) =>
    events.push({
      at: new Date(stockInDates[1]!.getTime() + DAY + i * HOUR),
      order: 1,
      kind: "adjust",
      run: (t) =>
        adjustStock(t, {
          productId: productIds.get(productByName(name))!,
          quantityChange,
          reason,
          note,
          adjustedById: people.managerId,
          adjustedAt: new Date(stockInDates[1]!.getTime() + DAY + i * HOUR),
        }),
    }),
  );

  // Owner raises two prices the day after the September shipment.
  const priceChanges: [string, number][] = [
    ["Bluetooth speaker", 300],
    ["Basmati rice 5kg", 215],
  ];
  priceChanges.forEach(([name, cedis]) => {
    const when = new Date(stockInDates[2]!.getTime() + DAY);
    const product = productByName(name);
    events.push({
      at: when,
      order: 1,
      kind: "price",
      run: async (t) => {
        await changeSellingPrice(t, {
          productId: productIds.get(product)!,
          newSellingPrice: toPesewas(cedis),
          changedById: people.ownerId,
          changedAt: when,
          note: "Higher cost on the new shipment",
        });
        prices.set(product, toPesewas(cedis));
      },
    });
  });

  // Customer requests: unmet items plus sold-out / low-stock products.
  const loggers = [people.sales1Id, people.sales2Id, people.managerId];
  const span = now.getTime() - window.start.getTime();
  const notes = [
    "Customer will come back next week",
    "Asked twice this month",
    "Wants it before Christmas",
    null,
    null,
    null,
  ];
  const requestStatus = (when: Date) => {
    const old = now.getTime() - when.getTime() > 90 * DAY;
    if (old && chance(0.35)) return "FULFILLED" as const;
    if (chance(0.1)) return "DISMISSED" as const;
    return "OPEN" as const;
  };
  for (const [variants, count] of UNMET_REQUESTS) {
    for (let i = 0; i < count; i++) {
      const when = new Date(window.start.getTime() + rand() * (span - HOUR));
      events.push({
        at: when,
        order: 4,
        kind: "request",
        data: {
          itemName: variants[i % variants.length]!,
          quantityWanted: chance(0.6) ? randInt(1, 5) : null,
          note: pick(notes),
          status: requestStatus(when),
          requestedAt: when,
          loggedById: pick(loggers),
        },
      });
    }
  }
  const productRequests: [string, number][] = [
    ["Ladies' maxi dress", 7],
    ["Power bank 20000mAh", 2],
    ["Bluetooth speaker", 2],
  ];
  for (const [name, count] of productRequests) {
    const product = productByName(name);
    for (let i = 0; i < count; i++) {
      const when = new Date(now.getTime() - rand() * 45 * DAY);
      events.push({
        at: when,
        order: 4,
        kind: "request",
        data: {
          productId: productIds.get(product)!,
          itemName: product.name,
          quantityWanted: chance(0.6) ? randInt(1, 3) : null,
          note: pick(notes),
          status: "OPEN",
          requestedAt: when,
          loggedById: pick(loggers),
        },
      });
    }
  }

  // Replay everything in time order, through the app's services.
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);
  let recorded = 0;
  let droppedLines = 0;
  for (const event of events) {
    switch (event.kind) {
      case "stockIn": {
        const items = DEMO_PRODUCTS.map((p) => ({ p, quantity: shipmentQuantity(p, event.index) }))
          .filter(({ quantity }) => quantity > 0)
          .map(({ p, quantity }) => ({
            productId: productIds.get(p)!,
            quantity,
            // September shipment: imported costs up ~8% (rounded to 50 pesewas).
            unitCost:
              event.index === 2 && (p.category === "Food Items" || p.category === "Electronics")
                ? Math.round((toPesewas(p.cost) * 108) / 5000) * 50
                : toPesewas(p.cost),
          }));
        await receiveStock(tx, {
          items,
          updateCostPrice: true,
          receivedById: people.managerId,
          receivedAt: event.at,
          supplier: SUPPLIERS[event.index]!,
          timeZone,
        });
        break;
      }
      case "adjust":
      case "price":
        await event.run(tx);
        break;
      case "sale": {
        const { sale } = event;
        let lines = sale.lines;
        while (lines.length > 0) {
          const subtotal = lines.reduce((sum, l) => sum + prices.get(l.product)! * l.quantity, 0);
          const discount = Math.floor((subtotal * sale.discountPercent) / 100 / 500) * 500;
          try {
            const created = await recordSale(tx, {
              items: lines.map((l) => ({
                productId: productIds.get(l.product)!,
                quantity: l.quantity,
              })),
              discount,
              paymentMethod: sale.paymentMethod,
              customerName: sale.customerName,
              customerPhone: sale.customerPhone,
              soldById: sale.soldById,
              soldAt: sale.soldAt,
              timeZone,
            });
            sale.saleId = created.id;
            recorded++;
            break;
          } catch (error) {
            // The app would refuse to oversell; drop that line like a cashier would.
            if (!(error instanceof InventoryError) || error.code !== "INSUFFICIENT_STOCK")
              throw error;
            lines = lines.filter((l) => productIds.get(l.product) !== error.productId);
            droppedLines++;
          }
        }
        break;
      }
      case "void":
        if (event.sale.saleId) {
          await voidSale(tx, {
            saleId: event.sale.saleId,
            reason: event.reason,
            voidedById: event.voidedById,
            voidedAt: event.at,
          });
        }
        break;
      case "request":
        await tx.customerRequest.create({ data: event.data });
        break;
    }
  }
  console.log(
    `✓ Demo inventory created (${DEMO_PRODUCTS.length} products, ${recorded} sales` +
      (droppedLines ? `, ${droppedLines} out-of-stock lines skipped` : "") +
      ")",
  );
}

// ---------------------------------------------------------------------------
// Checks & summary
// ---------------------------------------------------------------------------

async function verifyStockLedger() {
  const mismatches = await findStockMismatches(prisma);
  if (mismatches.length > 0) {
    console.error("✗ Stock ledger mismatch:");
    for (const m of mismatches) {
      console.error(
        `  ${m.name}: quantityInStock=${m.quantityInStock}, movements sum=${m.ledgerTotal}`,
      );
    }
    throw new Error("Stock check failed: quantityInStock does not equal the sum of StockMovements");
  }
  const products = await prisma.product.count();
  console.log(
    `✓ Stock check passed: quantityInStock = Σ StockMovements for all ${products} products`,
  );
}

async function printSummary(symbol: string) {
  const [products, users, categories, stockIns, completed, voided, requests] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.category.count(),
    prisma.stockIn.count(),
    prisma.sale.aggregate({
      where: { status: "COMPLETED" },
      _count: true,
      _sum: { total: true, totalCost: true, discount: true },
      _min: { soldAt: true },
      _max: { soldAt: true },
    }),
    prisma.sale.count({ where: { status: "VOIDED" } }),
    prisma.customerRequest.count(),
  ]);
  const revenue = completed._sum.total ?? 0;
  const cost = completed._sum.totalCost ?? 0;
  const money = (p: number) => formatMoney(p, { symbol });
  console.log("\nDatabase totals");
  console.log(`  Users             ${users}`);
  console.log(`  Categories        ${categories}`);
  console.log(`  Products          ${products}`);
  console.log(`  Stock-ins         ${stockIns}`);
  console.log(`  Sales (completed) ${completed._count}`);
  console.log(`  Sales (voided)    ${voided}`);
  console.log(
    `  Revenue           ${money(revenue)}  (after ${money(completed._sum.discount ?? 0)} discounts)`,
  );
  console.log(`  Gross profit      ${money(revenue - cost)}`);
  console.log(`  Customer requests ${requests}`);
  if (completed._min.soldAt && completed._max.soldAt) {
    console.log(
      `  Sales period      ${completed._min.soldAt.toISOString().slice(0, 10)} → ${completed._max.soldAt.toISOString().slice(0, 10)}`,
    );
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const settings = await seedSettings();
  console.log("✓ Settings ready");
  const owner = await seedOwner();

  if (process.env.SEED_DEMO?.trim().toLowerCase() === "true") {
    const { manager, sales1, sales2 } = await seedDemoUsers();
    const categoryIds = await seedCategories();
    const [products, stockIns, sales] = await Promise.all([
      prisma.product.count(),
      prisma.stockIn.count(),
      prisma.sale.count(),
    ]);
    if (products + stockIns + sales > 0) {
      console.log("• Products/sales already exist — demo inventory skipped (no duplicates)");
    } else {
      const people = {
        ownerId: owner.id,
        managerId: manager.id,
        sales1Id: sales1.id,
        sales2Id: sales2.id,
      };
      await prisma.$transaction((tx) => seedDemoInventory(tx, people, categoryIds), {
        timeout: 600_000,
        maxWait: 30_000,
      });
    }
  } else {
    console.log("• SEED_DEMO is not true — demo data skipped");
  }

  await verifyStockLedger();
  await printSummary(settings.currencySymbol);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
