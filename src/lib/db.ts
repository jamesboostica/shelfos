import Dexie, { type EntityTable } from "dexie";

export type PaymentMethod = "cash" | "mobile_money" | "card";

export interface Product {
  id?: number;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_archived: number; // 0 | 1 (indexable)
}

export interface Order {
  id?: number;
  local_id: string;
  cashier_id: string;
  total_amount: number;
  payment_method: PaymentMethod;
  split_details: {
    tendered?: number | undefined;
    change?: number | undefined;
    reference?: string | undefined;
    tax?: number | undefined;
    subtotal?: number | undefined;
  };
  status: "completed" | "refunded";
  created_at: number;
  synced: number; // 0 | 1
}

export interface OrderItem {
  id?: number;
  order_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface Shift {
  id?: number;
  cashier_id: string;
  opened_at: number;
  closed_at: number | null;
  opening_float: number;
  closing_cash_counted: number | null;
  expected_cash: number | null;
  difference: number | null;
  status: "open" | "closed";
}

export interface SyncQueueRow {
  id?: number;
  entity_type: string;
  payload: unknown;
  status: "pending" | "synced";
  timestamp: number;
}

export class ShelfOSDatabase extends Dexie {
  products!: EntityTable<Product, "id">;
  orders!: EntityTable<Order, "id">;
  order_items!: EntityTable<OrderItem, "id">;
  shifts!: EntityTable<Shift, "id">;
  sync_queue!: EntityTable<SyncQueueRow, "id">;

  constructor() {
    super("shelfos");
    this.version(1).stores({
      products: "++id, name, sku, category, stock_quantity, is_archived",
      orders: "++id, &local_id, cashier_id, created_at, payment_method, status, synced",
      order_items: "++id, order_id, product_id",
      shifts: "++id, cashier_id, status, opened_at",
      sync_queue: "++id, entity_type, status, timestamp",
    });
  }
}

let instance: ShelfOSDatabase | null = null;

export function getDb(): ShelfOSDatabase {
  if (!instance) instance = new ShelfOSDatabase();
  return instance;
}

const SEED_PRODUCTS: Omit<Product, "id">[] = [
  {
    name: "Non-Stick Frying Pan 28cm",
    sku: "KTW-1001",
    category: "Kitchenware",
    selling_price: 2450,
    cost_price: 1620,
    stock_quantity: 18,
    min_stock_alert: 6,
    is_archived: 0,
  },
  {
    name: "12-Piece Ceramic Dinner Set",
    sku: "KTW-1002",
    category: "Kitchenware",
    selling_price: 5900,
    cost_price: 4100,
    stock_quantity: 7,
    min_stock_alert: 4,
    is_archived: 0,
  },
  {
    name: "Stainless Steel Cooking Pot 5L",
    sku: "KTW-1003",
    category: "Kitchenware",
    selling_price: 3200,
    cost_price: 2150,
    stock_quantity: 3,
    min_stock_alert: 5,
    is_archived: 0,
  },
  {
    name: "Glass Water Jug 1.8L",
    sku: "KTW-1004",
    category: "Kitchenware",
    selling_price: 890,
    cost_price: 520,
    stock_quantity: 24,
    min_stock_alert: 8,
    is_archived: 0,
  },
  {
    name: "Microfiber Spin Mop Set",
    sku: "CLN-2001",
    category: "Cleaning",
    selling_price: 1850,
    cost_price: 1180,
    stock_quantity: 12,
    min_stock_alert: 5,
    is_archived: 0,
  },
  {
    name: "Heavy-Duty Floor Brush",
    sku: "CLN-2002",
    category: "Cleaning",
    selling_price: 640,
    cost_price: 380,
    stock_quantity: 0,
    min_stock_alert: 6,
    is_archived: 0,
  },
  {
    name: "Multi-Surface Cleaner 750ml",
    sku: "CLN-2003",
    category: "Cleaning",
    selling_price: 420,
    cost_price: 245,
    stock_quantity: 36,
    min_stock_alert: 12,
    is_archived: 0,
  },
  {
    name: "45L Heavy-Duty Storage Box",
    sku: "STR-3001",
    category: "Storage",
    selling_price: 2100,
    cost_price: 1390,
    stock_quantity: 15,
    min_stock_alert: 5,
    is_archived: 0,
  },
  {
    name: "Plastic Clothes Pegs 24pk",
    sku: "STR-3002",
    category: "Storage",
    selling_price: 180,
    cost_price: 95,
    stock_quantity: 48,
    min_stock_alert: 15,
    is_archived: 0,
  },
  {
    name: "3-Tier Metal Shelf Rack",
    sku: "STR-3003",
    category: "Storage",
    selling_price: 4750,
    cost_price: 3250,
    stock_quantity: 4,
    min_stock_alert: 4,
    is_archived: 0,
  },
  {
    name: "Cotton Table Runner 180cm",
    sku: "DEC-4001",
    category: "Home Decor",
    selling_price: 1250,
    cost_price: 720,
    stock_quantity: 20,
    min_stock_alert: 6,
    is_archived: 0,
  },
  {
    name: "Scented Soy Candle Jar",
    sku: "DEC-4002",
    category: "Home Decor",
    selling_price: 950,
    cost_price: 540,
    stock_quantity: 2,
    min_stock_alert: 6,
    is_archived: 0,
  },
];

export const CATEGORIES = ["Kitchenware", "Cleaning", "Storage", "Home Decor"] as const;

export async function ensureSeeded() {
  const db = getDb();
  const count = await db.products.count();
  if (count === 0) await db.products.bulkAdd(SEED_PRODUCTS as Product[]);
}
