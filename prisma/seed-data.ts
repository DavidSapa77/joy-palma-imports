import type { Role, UnitOfMeasure } from "@prisma/client";

/** Demo data for `SEED_DEMO=true`. Prices in cedis here; the seed converts to pesewas. */

export const DEMO_PASSWORD = "Password123!";

export const DEMO_USERS: { name: string; email: string; role: Role }[] = [
  { name: "Kwame Asante", email: "manager@example.com", role: "MANAGER" },
  { name: "Akosua Boateng", email: "sales1@example.com", role: "SALES" },
  { name: "Kofi Owusu", email: "sales2@example.com", role: "SALES" },
  { name: "Efua Darko", email: "viewer@example.com", role: "VIEWER" },
];

export const CATEGORY_NAMES = [
  "Kitchenware",
  "Electronics",
  "Clothing",
  "Beauty",
  "Home Decor",
  "Food Items",
] as const;

export type CategoryName = (typeof CATEGORY_NAMES)[number];

export const CATEGORY_DESCRIPTIONS: Record<CategoryName, string> = {
  Kitchenware: "Pots, pans, utensils and food storage",
  Electronics: "Small appliances, phone accessories and lighting",
  Clothing: "Men's, ladies' and children's wear and accessories",
  Beauty: "Skin care, hair and fragrance",
  "Home Decor": "Furnishings and decorative items",
  "Food Items": "Imported provisions, sold by the bag or carton",
};

/**
 * How a product's stock should look at the end of the demo year:
 * normal  – restocked regularly, healthy stock left
 * low     – restocked, but only a few units left (low-stock alert)
 * out     – sold out (and customers keep asking for it)
 * dead    – one shipment, almost never sells (slow movers report)
 * never   – one shipment, has never sold
 */
export type StockProfile = "normal" | "low" | "out" | "dead" | "never";

export type DemoProduct = {
  name: string;
  category: CategoryName;
  unit: UnitOfMeasure;
  price: number;
  cost: number;
  /** Relative chance of appearing in a sale. */
  popularity: number;
  profile: StockProfile;
  /** Opening shipment for dead/never products. */
  fixedStock?: number;
  /** Dead stock: exact number of single-unit sales spread over the year (popularity 0). */
  yearlySales?: number;
  /** Product-specific monthly multipliers, by month 1–12. */
  season?: Partial<Record<number, number>>;
  lowStockThreshold?: number;
};

// prettier-ignore
export const DEMO_PRODUCTS: DemoProduct[] = [
  // Kitchenware
  { name: "Non-stick frying pan set (3 pcs)", category: "Kitchenware", unit: "SET", price: 350, cost: 215, popularity: 6, profile: "normal" },
  { name: "Stainless steel cooking pot set (5 pcs)", category: "Kitchenware", unit: "SET", price: 680, cost: 430, popularity: 3, profile: "normal" },
  { name: "Plastic food containers (set of 10)", category: "Kitchenware", unit: "SET", price: 85, cost: 48, popularity: 9, profile: "normal" },
  { name: "Kitchen knife set with block", category: "Kitchenware", unit: "SET", price: 150, cost: 88, popularity: 4, profile: "normal" },
  { name: "Ceramic dinner set (24 pcs)", category: "Kitchenware", unit: "SET", price: 890, cost: 560, popularity: 0, profile: "never", fixedStock: 6 },
  // Electronics
  { name: "Electric kettle 1.8L", category: "Electronics", unit: "PIECE", price: 220, cost: 140, popularity: 7, profile: "normal" },
  { name: "Blender 1.5L", category: "Electronics", unit: "PIECE", price: 390, cost: 255, popularity: 4, profile: "normal" },
  { name: "Bluetooth speaker", category: "Electronics", unit: "PIECE", price: 280, cost: 170, popularity: 6, profile: "low" },
  { name: "Power bank 20000mAh", category: "Electronics", unit: "PIECE", price: 190, cost: 115, popularity: 8, profile: "low" },
  { name: "Rechargeable LED lantern", category: "Electronics", unit: "PIECE", price: 120, cost: 70, popularity: 7, profile: "normal" },
  { name: "Extension board (4-way)", category: "Electronics", unit: "PIECE", price: 75, cost: 42, popularity: 8, profile: "normal" },
  { name: 'Standing fan 16"', category: "Electronics", unit: "PIECE", price: 450, cost: 300, popularity: 3, profile: "normal", season: { 2: 2, 3: 2.2, 4: 1.8, 7: 0.5, 8: 0.5 } },
  { name: "USB-C fast charger", category: "Electronics", unit: "PIECE", price: 60, cost: 32, popularity: 10, profile: "normal" },
  { name: 'Smart TV 32"', category: "Electronics", unit: "PIECE", price: 2450, cost: 1850, popularity: 0, profile: "dead", fixedStock: 5, yearlySales: 1 },
  // Clothing
  { name: "Men's African print shirt", category: "Clothing", unit: "PIECE", price: 180, cost: 105, popularity: 6, profile: "normal" },
  { name: "Ladies' maxi dress", category: "Clothing", unit: "PIECE", price: 220, cost: 125, popularity: 6, profile: "out" },
  { name: "Children's party dress", category: "Clothing", unit: "PIECE", price: 140, cost: 80, popularity: 4, profile: "normal" },
  { name: "Men's slim-fit jeans", category: "Clothing", unit: "PIECE", price: 160, cost: 95, popularity: 5, profile: "normal" },
  { name: "Ladies' handbag", category: "Clothing", unit: "PIECE", price: 250, cost: 150, popularity: 4, profile: "normal" },
  { name: "Kids' school shoes", category: "Clothing", unit: "PAIR", price: 130, cost: 75, popularity: 1.5, profile: "normal", season: { 1: 6, 8: 8, 9: 12, 10: 3, 12: 0.5 } },
  // Beauty
  { name: "Shea butter body lotion 400ml", category: "Beauty", unit: "PIECE", price: 65, cost: 34, popularity: 9, profile: "normal" },
  { name: "Braiding hair extensions (pack)", category: "Beauty", unit: "PACK", price: 45, cost: 22, popularity: 10, profile: "normal" },
  { name: "Perfume 100ml", category: "Beauty", unit: "PIECE", price: 320, cost: 190, popularity: 3, profile: "normal" },
  { name: "Lipstick set (6 shades)", category: "Beauty", unit: "SET", price: 90, cost: 50, popularity: 4, profile: "normal" },
  // Home Decor
  { name: "Wall clock", category: "Home Decor", unit: "PIECE", price: 110, cost: 60, popularity: 3, profile: "normal" },
  { name: "Curtains (pair)", category: "Home Decor", unit: "PAIR", price: 240, cost: 140, popularity: 3, profile: "normal" },
  { name: "Throw pillow covers (set of 4)", category: "Home Decor", unit: "SET", price: 80, cost: 42, popularity: 4, profile: "normal" },
  { name: "Floor rug 160×230", category: "Home Decor", unit: "PIECE", price: 520, cost: 340, popularity: 0, profile: "dead", fixedStock: 7, yearlySales: 2 },
  { name: "Artificial flower vase set", category: "Home Decor", unit: "SET", price: 95, cost: 55, popularity: 0, profile: "dead", fixedStock: 14, yearlySales: 3 },
  // Food Items
  { name: "Basmati rice 5kg", category: "Food Items", unit: "PIECE", price: 190, cost: 135, popularity: 8, profile: "normal" },
  { name: "Spaghetti (carton of 20)", category: "Food Items", unit: "CARTON", price: 260, cost: 195, popularity: 5, profile: "low", lowStockThreshold: 3 },
  { name: "Tomato paste (carton of 50 tins)", category: "Food Items", unit: "CARTON", price: 310, cost: 235, popularity: 4, profile: "normal" },
  { name: "Sardines (carton of 50 tins)", category: "Food Items", unit: "CARTON", price: 620, cost: 470, popularity: 3, profile: "normal" },
];

/** Overall shop traffic by month (1–12): busy December, quiet January. */
// prettier-ignore
export const MONTH_TRAFFIC: Record<number, number> = {
  1: 0.7, 2: 0.85, 3: 0.95, 4: 1.05, 5: 0.95, 6: 0.85,
  7: 0.85, 8: 0.95, 9: 1.05, 10: 1.0, 11: 1.15, 12: 1.8,
};

/** Category seasonality by month (1–12); 1 = normal. */
export const CATEGORY_SEASON: Record<CategoryName, Partial<Record<number, number>>> = {
  Clothing: { 12: 3.2, 11: 1.6, 3: 1.4, 4: 1.4, 1: 0.6 },
  Electronics: { 12: 1.8, 11: 1.3, 1: 0.7 },
  Kitchenware: { 12: 1.5, 4: 1.2 },
  Beauty: { 2: 1.7, 5: 1.3, 12: 1.5 },
  "Home Decor": { 12: 1.7, 11: 1.3 },
  "Food Items": { 12: 2, 4: 1.4 },
};

export const SUPPLIERS = [
  "Guangzhou Trading Co. — container GZ-114",
  "Dubai General Goods LLC — air freight",
  "Yiwu Export Ltd — container YW-208",
] as const;

// prettier-ignore
export const CUSTOMER_NAMES = [
  "Abena Mensah", "Yaw Boakye", "Esi Quaye", "Kojo Antwi", "Adwoa Sarpong", "Nana Agyeman",
  "Ama Ofori", "Kwesi Appiah", "Afia Nyarko", "Mohammed Issah", "Selorm Agbeko", "Comfort Tetteh",
];

/** Customer requests for things the shop does not stock: [item name as typed, count]. */
export const UNMET_REQUESTS: [string[], number][] = [
  [["Air fryer", "air fryer", "Air Fryer ", "Air fryer 5L"], 7],
  [["Rice cooker", "rice cooker", "Rice cooker 1.8L"], 5],
  [["Human hair wig", "human hair wig", "Wig (human hair)"], 4],
  [["Gas cooker (4 burner)", "gas cooker 4 burner"], 3],
  [["Baby diapers", "baby diapers"], 3],
  [["School bag", "school bags"], 3],
  [["Ceiling fan"], 2],
  [["Electric iron"], 2],
];
