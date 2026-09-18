import Dexie, { type EntityTable } from "dexie";

export type PaymentMethod = "cash" | "mobile_money" | "card";

export interface Product {
  id?: number;
  name: string;
  sku: string;
  category: string;
  subcategory?: string | undefined;
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
    cash?: number | undefined;
    mobile_money?: number | undefined;
    card?: number | undefined;
    is_split?: boolean | undefined;
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
  entity_type: "order" | "stock_adjustment" | "shift" | string;
  entity_id?: string;
  payload: unknown;
  status: "pending" | "synced" | "failed";
  retry_count?: number;
  /** Epoch ms; the row waits until this moment before the next upload attempt. */
  next_attempt_at?: number;
  last_error?: string;
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
    // v2 indexes the retry schedule so a queue holding days of offline work can
    // be drained oldest-first without scanning every row.
    this.version(2).stores({
      sync_queue: "++id, entity_type, status, timestamp, next_attempt_at, [status+timestamp]",
    });
  }
}

let instance: ShelfOSDatabase | null = null;

export function getDb(): ShelfOSDatabase {
  if (!instance) instance = new ShelfOSDatabase();
  return instance;
}

const SEED_PRODUCTS: Omit<Product, "id">[] = [
  { name: "Earrings", sku: "FSH-1001", category: "Fashion & Accessories", selling_price: 50, cost_price: 35, stock_quantity: 20, min_stock_alert: 5, is_archived: 0 },
  { name: "Edge Brush", sku: "BPC-1001", category: "Beauty & Personal Care", selling_price: 100, cost_price: 70, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Pocket Mirror", sku: "BPC-1002", category: "Beauty & Personal Care", selling_price: 100, cost_price: 50, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Lip glosser", sku: "BPC-1003", category: "Beauty & Personal Care", selling_price: 80, cost_price: 30, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Push back", sku: "FSH-1002", category: "Fashion & Accessories", selling_price: 120, cost_price: 80, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Lip Oil", sku: "BPC-1004", category: "Beauty & Personal Care", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Magnetic", sku: "FSH-1003", category: "Fashion & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 9, min_stock_alert: 5, is_archived: 0 },
  { name: "Gold Chain", sku: "FSH-1004", category: "Fashion & Accessories", selling_price: 180, cost_price: 120, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Plain Chain", sku: "FSH-1005", category: "Fashion & Accessories", selling_price: 100, cost_price: 50, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Plants", sku: "HMD-1001", category: "Home & Decor", selling_price: 1280, cost_price: 850, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Succulents", sku: "HMD-1002", category: "Home & Decor", selling_price: 500, cost_price: 330, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Small bunches", sku: "GEN-1001", category: "General Merchandise", selling_price: 220, cost_price: 150, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Vases", sku: "HMD-1003", category: "Home & Decor", selling_price: 250, cost_price: 200, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Purple blossom", sku: "HMD-1004", category: "Home & Decor", selling_price: 680, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Vase", sku: "HMD-1005", category: "Home & Decor", selling_price: 520, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Plants (V2)", sku: "HMD-1006", category: "Home & Decor", selling_price: 1500, cost_price: 1000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Silver Vases", sku: "HMD-1007", category: "Home & Decor", selling_price: 520, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Bonsai", sku: "HMD-1008", category: "Home & Decor", selling_price: 600, cost_price: 400, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Pampors", sku: "HMD-1009", category: "Home & Decor", selling_price: 820, cost_price: 550, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Table flowers", sku: "HMD-1010", category: "Home & Decor", selling_price: 600, cost_price: 400, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Stones", sku: "HMD-1011", category: "Home & Decor", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Walking stick", sku: "HMD-1012", category: "Home & Decor", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Bonsai (V2)", sku: "HMD-1013", category: "Home & Decor", selling_price: 500, cost_price: 330, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Hanky", sku: "FSH-1006", category: "Fashion & Accessories", selling_price: 570, cost_price: 380, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Wallets", sku: "FSH-1007", category: "Fashion & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Trucker hats", sku: "FSH-1008", category: "Fashion & Accessories", selling_price: 200, cost_price: 130, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Hair Caps", sku: "FSH-1009", category: "Fashion & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Canvas Modo", sku: "FSH-1010", category: "Fashion & Accessories", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Vitron 43\" Smart", sku: "ELC-1001", category: "TV & Electronics", selling_price: 26500, cost_price: 19000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Vitron\" 32\" Smart", sku: "ELC-1002", category: "TV & Electronics", selling_price: 14900, cost_price: 10800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Vitron\" 24\" Digital", sku: "ELC-1003", category: "TV & Electronics", selling_price: 12500, cost_price: 8400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Vitron\" 32\" Digital", sku: "ELC-1004", category: "TV & Electronics", selling_price: 13800, cost_price: 10800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons 32\" Smart", sku: "ELC-1005", category: "TV & Electronics", selling_price: 13700, cost_price: 9500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons\" 32\" Digital", sku: "ELC-1006", category: "TV & Electronics", selling_price: 12900, cost_price: 8500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons\" 24\" Digital", sku: "ELC-1007", category: "TV & Electronics", selling_price: 8500, cost_price: 5400, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons\" 22\" Digital", sku: "ELC-1008", category: "TV & Electronics", selling_price: 8500, cost_price: 4400, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Aitel 22\" Digital", sku: "ELC-1009", category: "TV & Electronics", selling_price: 6800, cost_price: 4600, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Jeflon aerial", sku: "ELC-1010", category: "TV & Electronics", selling_price: 1150, cost_price: 800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Startimes Aerial", sku: "ELC-1011", category: "TV & Electronics", selling_price: 1600, cost_price: 800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "GOTV ORG", sku: "ELC-1012", category: "TV & Electronics", selling_price: 1750, cost_price: 1250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "GOTV ORG Small", sku: "ELC-1013", category: "TV & Electronics", selling_price: 800, cost_price: 300, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Wiremesh aerial", sku: "ELC-1014", category: "TV & Electronics", selling_price: 1150, cost_price: 800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "S.D-P14 Speaker", sku: "ELC-1015", category: "TV & Electronics", selling_price: 1650, cost_price: 950, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "F.D-229 Speaker", sku: "ELC-1016", category: "TV & Electronics", selling_price: 1750, cost_price: 950, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "ST-936 Speaker", sku: "ELC-1017", category: "TV & Electronics", selling_price: 1650, cost_price: 950, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "ST-811 V Speaker", sku: "ELC-1018", category: "TV & Electronics", selling_price: 650, cost_price: 380, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "ST-H29", sku: "ELC-1019", category: "TV & Electronics", selling_price: 2650, cost_price: 1500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Sonar decoder", sku: "ELC-1020", category: "TV & Electronics", selling_price: 1850, cost_price: 1100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Kamisafe Torch KM-8916A", sku: "ELC-1021", category: "TV & Electronics", selling_price: 430, cost_price: 270, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Kamisafe Torch Km-H0bu", sku: "ELC-1022", category: "TV & Electronics", selling_price: 470, cost_price: 320, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Caston Torch ST-8818", sku: "ELC-1023", category: "TV & Electronics", selling_price: 230, cost_price: 100, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Tv mount CH207", sku: "ELC-1024", category: "TV & Electronics", selling_price: 1200, cost_price: 550, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tv Mount PM 1004", sku: "ELC-1025", category: "TV & Electronics", selling_price: 600, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Tv Mount SH 45 F", sku: "ELC-1026", category: "TV & Electronics", selling_price: 600, cost_price: 350, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Fridge Guard", sku: "ELC-1027", category: "TV & Electronics", selling_price: 1250, cost_price: 320, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Fridge Guard (V2)", sku: "ELC-1028", category: "TV & Electronics", selling_price: 1250, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "4way Ailyons extension", sku: "ELC-1029", category: "TV & Electronics", selling_price: 480, cost_price: 180, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "5way \" \"", sku: "GEN-1002", category: "General Merchandise", selling_price: 580, cost_price: 220, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "4 way powerking extension", sku: "ELC-1030", category: "TV & Electronics", selling_price: 550, cost_price: 270, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "5way powerking extension", sku: "ELC-1031", category: "TV & Electronics", selling_price: 650, cost_price: 320, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Winro 216", sku: "PHN-1001", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking 5627i", sku: "PHN-1002", category: "Phones & Accessories", selling_price: 1080, cost_price: 720, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking Ok125", sku: "PHN-1003", category: "Phones & Accessories", selling_price: 1130, cost_price: 750, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking Ok121", sku: "PHN-1004", category: "Phones & Accessories", selling_price: 1130, cost_price: 750, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking 124", sku: "PHN-1005", category: "Phones & Accessories", selling_price: 1130, cost_price: 750, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Nomojo N200", sku: "PHN-1006", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Villanoil V110", sku: "PHN-1007", category: "Phones & Accessories", selling_price: 1080, cost_price: 720, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tecno T101", sku: "PHN-1008", category: "Phones & Accessories", selling_price: 1450, cost_price: 970, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Itel 2160", sku: "PHN-1009", category: "Phones & Accessories", selling_price: 1330, cost_price: 890, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Itel 2163", sku: "PHN-1010", category: "Phones & Accessories", selling_price: 1200, cost_price: 800, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Itel 2165", sku: "PHN-1011", category: "Phones & Accessories", selling_price: 1180, cost_price: 790, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "X.Oda Mint", sku: "PHN-1012", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking Ok2166i", sku: "PHN-1013", category: "Phones & Accessories", selling_price: 1100, cost_price: 730, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oking Ok5166", sku: "PHN-1014", category: "Phones & Accessories", selling_price: 1150, cost_price: 770, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Klintro W101", sku: "PHN-1015", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Lesia L182", sku: "PHN-1016", category: "Phones & Accessories", selling_price: 1100, cost_price: 730, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Lesia L176", sku: "PHN-1017", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Lesia Prime Mini", sku: "PHN-1018", category: "Phones & Accessories", selling_price: 1030, cost_price: 690, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "4gb flash Advance", sku: "PHN-1019", category: "Phones & Accessories", selling_price: 420, cost_price: 280, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "8gb flash Advance", sku: "PHN-1020", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "16gb flash Advance", sku: "PHN-1021", category: "Phones & Accessories", selling_price: 500, cost_price: 380, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "32gb Advance", sku: "GEN-1003", category: "General Merchandise", selling_price: 750, cost_price: 550, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "2gb Memory Card", sku: "PHN-1022", category: "Phones & Accessories", selling_price: 350, cost_price: 240, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "4gb Memory Card", sku: "PHN-1023", category: "Phones & Accessories", selling_price: 350, cost_price: 260, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "8gb Memory Card", sku: "PHN-1024", category: "Phones & Accessories", selling_price: 450, cost_price: 320, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "16gb Memory Card", sku: "PHN-1025", category: "Phones & Accessories", selling_price: 500, cost_price: 370, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "32gb Mem Card boost", sku: "PHN-1026", category: "Phones & Accessories", selling_price: 750, cost_price: 520, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Neon Ray Rocktop", sku: "PHN-1027", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ray 2 Rocktop", sku: "PHN-1028", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "2059 Rocktop", sku: "PHN-1029", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "24ET Rocktop", sku: "PHN-1030", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ray pro Rocktop", sku: "PHN-1031", category: "Phones & Accessories", selling_price: 500, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Aldeepo Neon Smarta", sku: "PHN-1032", category: "Phones & Accessories", selling_price: 600, cost_price: 400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "15Hi Rocktop", sku: "PHN-1033", category: "Phones & Accessories", selling_price: 450, cost_price: 330, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "HD 11D1 Rocktop", sku: "PHN-1034", category: "Phones & Accessories", selling_price: 450, cost_price: 330, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Giraffe 5C", sku: "PHN-1035", category: "Phones & Accessories", selling_price: 250, cost_price: 130, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Itel 5C DPG", sku: "PHN-1036", category: "Phones & Accessories", selling_price: 250, cost_price: 150, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Villaontel 5C", sku: "PHN-1037", category: "Phones & Accessories", selling_price: 250, cost_price: 150, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Super energy Bl-5c", sku: "PHN-1038", category: "Phones & Accessories", selling_price: 350, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "SE-08 Superenergy", sku: "GEN-1004", category: "General Merchandise", selling_price: 250, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Amaya Charger", sku: "PHN-1039", category: "Phones & Accessories", selling_price: 200, cost_price: 120, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "ABS 2pin Charger", sku: "PHN-1040", category: "Phones & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "8600 Charger", sku: "PHN-1041", category: "Phones & Accessories", selling_price: 150, cost_price: 70, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "AD-036 Micro", sku: "GEN-1005", category: "General Merchandise", selling_price: 250, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Amaya Charger AD026", sku: "PHN-1042", category: "Phones & Accessories", selling_price: 250, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Ponex Type C plug", sku: "PHN-1043", category: "Phones & Accessories", selling_price: 250, cost_price: 130, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "117 pools", sku: "PHN-1044", category: "Phones & Accessories", selling_price: 350, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "ST-887", sku: "ELC-1032", category: "TV & Electronics", selling_price: 350, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "C-C cable Samsung", sku: "PHN-1045", category: "Phones & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Official belt", sku: "FSH-1011", category: "Fashion & Accessories", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "2 sided belt", sku: "FSH-1012", category: "Fashion & Accessories", selling_price: 500, cost_price: 200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Stretchy belt", sku: "FSH-1013", category: "Fashion & Accessories", selling_price: 300, cost_price: 110, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "G.G belt", sku: "FSH-1014", category: "Fashion & Accessories", selling_price: 300, cost_price: 110, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Smooth belt", sku: "FSH-1015", category: "Fashion & Accessories", selling_price: 300, cost_price: 110, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Mix Cap", sku: "FSH-1016", category: "Fashion & Accessories", selling_price: 300, cost_price: 200, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Tocebd AAA", sku: "GEN-1006", category: "General Merchandise", selling_price: 330, cost_price: 220, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Kehong 5 Watts", sku: "GEN-1007", category: "General Merchandise", selling_price: 40, cost_price: 27, stock_quantity: 40, min_stock_alert: 10, is_archived: 0 },
  { name: "Black shining 264", sku: "GEN-1008", category: "General Merchandise", selling_price: 120, cost_price: 45, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Tricycle 264", sku: "GEN-1009", category: "General Merchandise", selling_price: 120, cost_price: 45, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Yongli 264", sku: "GEN-1010", category: "General Merchandise", selling_price: 120, cost_price: 45, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Black heater", sku: "GEN-1011", category: "General Merchandise", selling_price: 300, cost_price: 170, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Green heater", sku: "GEN-1012", category: "General Merchandise", selling_price: 250, cost_price: 140, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oraimo Charger Micro-G", sku: "PHN-1046", category: "Phones & Accessories", selling_price: 400, cost_price: 240, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oraimo Charger Type C", sku: "PHN-1047", category: "Phones & Accessories", selling_price: 400, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Excellent Charger (c) 4x", sku: "PHN-1048", category: "Phones & Accessories", selling_price: 600, cost_price: 450, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Excellent Charger Microx", sku: "PHN-1049", category: "Phones & Accessories", selling_price: 600, cost_price: 420, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Excellent Normal plug", sku: "PHN-1050", category: "Phones & Accessories", selling_price: 200, cost_price: 120, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oraimo micro cable", sku: "PHN-1051", category: "Phones & Accessories", selling_price: 150, cost_price: 90, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Oraimo Type C cable", sku: "PHN-1052", category: "Phones & Accessories", selling_price: 250, cost_price: 140, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Tecno BL-5C", sku: "PHN-1053", category: "Phones & Accessories", selling_price: 100, cost_price: 50, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "5C copy Oraimo", sku: "PHN-1054", category: "Phones & Accessories", selling_price: 100, cost_price: 50, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "5C copy Itel", sku: "PHN-1055", category: "Phones & Accessories", selling_price: 100, cost_price: 50, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "2gb flash Hp", sku: "PHN-1056", category: "Phones & Accessories", selling_price: 350, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "4gb flash Hp", sku: "PHN-1057", category: "Phones & Accessories", selling_price: 350, cost_price: 280, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "8gb flash Hp", sku: "PHN-1058", category: "Phones & Accessories", selling_price: 520, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "16gb flash Hp", sku: "PHN-1059", category: "Phones & Accessories", selling_price: 570, cost_price: 380, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "32gb flash Hp", sku: "PHN-1060", category: "Phones & Accessories", selling_price: 820, cost_price: 550, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "4way Itel extension", sku: "ELC-1033", category: "TV & Electronics", selling_price: 750, cost_price: 320, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "4way Joly extension", sku: "ELC-1034", category: "TV & Electronics", selling_price: 850, cost_price: 350, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "5way Itel extension", sku: "ELC-1035", category: "TV & Electronics", selling_price: 1050, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 3601", sku: "ELC-1036", category: "TV & Electronics", selling_price: 6800, cost_price: 4000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 3613", sku: "ELC-1037", category: "TV & Electronics", selling_price: 6800, cost_price: 4000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2401", sku: "ELC-1038", category: "TV & Electronics", selling_price: 3800, cost_price: 2200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2403", sku: "ELC-1039", category: "TV & Electronics", selling_price: 3800, cost_price: 2200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2409", sku: "ELC-1040", category: "TV & Electronics", selling_price: 3800, cost_price: 2200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2402", sku: "ELC-1041", category: "TV & Electronics", selling_price: 3800, cost_price: 2200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2405", sku: "ELC-1042", category: "TV & Electronics", selling_price: 4400, cost_price: 2600, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Woofer 2406", sku: "ELC-1043", category: "TV & Electronics", selling_price: 3800, cost_price: 2200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Vitron Woofer V643", sku: "ELC-1044", category: "TV & Electronics", selling_price: 6300, cost_price: 4200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Premier woofer Pm 3505", sku: "ELC-1045", category: "TV & Electronics", selling_price: 6500, cost_price: 4000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "B Hair Dryer (Nunix)", sku: "BPC-1005", category: "Beauty & Personal Care", selling_price: 2300, cost_price: 1530, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Hair clippers", sku: "BPC-1006", category: "Beauty & Personal Care", selling_price: 1300, cost_price: 870, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Synix electric kettle", sku: "KTW-1001", category: "Kitchenware", selling_price: 1700, cost_price: 1130, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Sonar electrical kettle", sku: "KTW-1002", category: "Kitchenware", selling_price: 1300, cost_price: 870, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "45W Samsung adapters", sku: "PHN-1061", category: "Phones & Accessories", selling_price: 900, cost_price: 600, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "25W Samsung adapter", sku: "PHN-1062", category: "Phones & Accessories", selling_price: 690, cost_price: 460, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Pro 3", sku: "GEN-1013", category: "General Merchandise", selling_price: 520, cost_price: 350, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "YL404 Neckband", sku: "PHN-1063", category: "Phones & Accessories", selling_price: 900, cost_price: 600, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Oraimo Cables", sku: "PHN-1064", category: "Phones & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "RXD Earphones", sku: "PHN-1065", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Oraimo Cables (V2)", sku: "PHN-1066", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Stereo Earphones", sku: "PHN-1067", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Silicone A56", sku: "PHN-1068", category: "Phones & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicon A55", sku: "PHN-1069", category: "Phones & Accessories", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone A05", sku: "PHN-1070", category: "Phones & Accessories", selling_price: 550, cost_price: 370, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicon A15", sku: "PHN-1071", category: "Phones & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone A55", sku: "PHN-1072", category: "Phones & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "A3x Silicone", sku: "PHN-1073", category: "Phones & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone 14C", sku: "PHN-1074", category: "Phones & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone X", sku: "PHN-1075", category: "Phones & Accessories", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone 13", sku: "PHN-1076", category: "Phones & Accessories", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicon 64", sku: "PHN-1077", category: "Phones & Accessories", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicon 21", sku: "PHN-1078", category: "Phones & Accessories", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Privacy 11, X, 11pro, 12, 13", sku: "PHN-1079", category: "Phones & Accessories", selling_price: 500, cost_price: 100, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal hot 8", sku: "PHN-1080", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A3X", sku: "PHN-1081", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal 14C", sku: "PHN-1082", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A15", sku: "PHN-1083", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A05s", sku: "PHN-1084", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A06", sku: "PHN-1085", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A05", sku: "PHN-1086", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal A16", sku: "PHN-1087", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal Smart 8", sku: "PHN-1088", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal Camon 20", sku: "PHN-1089", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal Camon 19", sku: "PHN-1090", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Normal Camon 18", sku: "PHN-1091", category: "Phones & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Studs", sku: "FSH-1017", category: "Fashion & Accessories", selling_price: 30, cost_price: 20, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Anklets", sku: "FSH-1018", category: "Fashion & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Davis short", sku: "GEN-1014", category: "General Merchandise", selling_price: 50, cost_price: 35, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Eye liner", sku: "BPC-1007", category: "Beauty & Personal Care", selling_price: 80, cost_price: 50, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Nose Ring", sku: "FSH-1019", category: "Fashion & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Minck lashes", sku: "BPC-1008", category: "Beauty & Personal Care", selling_price: 90, cost_price: 60, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "indivi lashes", sku: "BPC-1009", category: "Beauty & Personal Care", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Bull ring", sku: "FSH-1020", category: "Fashion & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Staine less", sku: "GEN-1015", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Eyeshow smls", sku: "BPC-1010", category: "Beauty & Personal Care", selling_price: 100, cost_price: 70, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Pearl Bracelets", sku: "FSH-1021", category: "Fashion & Accessories", selling_price: 40, cost_price: 30, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Charm \" \"", sku: "GEN-1016", category: "General Merchandise", selling_price: 80, cost_price: 50, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Brochunes", sku: "FSH-1022", category: "Fashion & Accessories", selling_price: 80, cost_price: 50, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Gunia bag", sku: "HMD-1014", category: "Home & Decor", selling_price: 220, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Gunia bag (V2)", sku: "HMD-1015", category: "Home & Decor", selling_price: 160, cost_price: 110, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Gunia bag (V3)", sku: "HMD-1016", category: "Home & Decor", selling_price: 140, cost_price: 90, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Gunia bag (V4)", sku: "HMD-1017", category: "Home & Decor", selling_price: 180, cost_price: 120, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Half Caps", sku: "FSH-1023", category: "Fashion & Accessories", selling_price: 300, cost_price: 150, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Stardy", sku: "FSH-1024", category: "Fashion & Accessories", selling_price: 300, cost_price: 200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Caps", sku: "FSH-1025", category: "Fashion & Accessories", selling_price: 300, cost_price: 180, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Caps (V2)", sku: "FSH-1026", category: "Fashion & Accessories", selling_price: 300, cost_price: 200, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Famah", sku: "FSH-1027", category: "Fashion & Accessories", selling_price: 200, cost_price: 130, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Shiny Shower Cap", sku: "FSH-1028", category: "Fashion & Accessories", selling_price: 140, cost_price: 90, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Mangoya Scarf", sku: "FSH-1029", category: "Fashion & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Hanky (V2)", sku: "FSH-1030", category: "Fashion & Accessories", selling_price: 420, cost_price: 280, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Face towels", sku: "HMD-1018", category: "Home & Decor", selling_price: 250, cost_price: 160, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Umbrella Zip", sku: "HMD-1019", category: "Home & Decor", selling_price: 600, cost_price: 450, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Umbrella torch", sku: "ELC-1046", category: "TV & Electronics", selling_price: 1120, cost_price: 800, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "3folds umbrella", sku: "HMD-1020", category: "Home & Decor", selling_price: 550, cost_price: 330, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "2folds umbrella", sku: "HMD-1021", category: "Home & Decor", selling_price: 600, cost_price: 380, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Blue Knife", sku: "KTW-1003", category: "Kitchenware", selling_price: 450, cost_price: 150, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Mable chopping board", sku: "KTW-1004", category: "Kitchenware", selling_price: 390, cost_price: 260, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Corn Greter", sku: "KTW-1005", category: "Kitchenware", selling_price: 550, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Mwiko set", sku: "KTW-1006", category: "Kitchenware", selling_price: 350, cost_price: 220, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Garlic Press", sku: "KTW-1007", category: "Kitchenware", selling_price: 600, cost_price: 400, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Long teaspoon", sku: "KTW-1008", category: "Kitchenware", selling_price: 950, cost_price: 630, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Silver servitte holder", sku: "KTW-1009", category: "Kitchenware", selling_price: 200, cost_price: 130, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Salt shaker", sku: "KTW-1010", category: "Kitchenware", selling_price: 250, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Salt shaker short", sku: "KTW-1011", category: "Kitchenware", selling_price: 450, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "2204 bowl", sku: "KTW-1012", category: "Kitchenware", selling_price: 500, cost_price: 250, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "P-2220", sku: "GEN-1017", category: "General Merchandise", selling_price: 900, cost_price: 600, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "P2201 plate black", sku: "KTW-1013", category: "Kitchenware", selling_price: 1350, cost_price: 900, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "EC7040 whiskey glass", sku: "KTW-1014", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Golden Tea mug", sku: "KTW-1015", category: "Kitchenware", selling_price: 900, cost_price: 600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "1308 glass", sku: "KTW-1016", category: "Kitchenware", selling_price: 750, cost_price: 500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Wine glass", sku: "KTW-1017", category: "Kitchenware", selling_price: 900, cost_price: 600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "6857 glass", sku: "KTW-1018", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "DMC018 whiskey glass", sku: "KTW-1019", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Bosch Regina", sku: "KTW-1020", category: "Kitchenware", selling_price: 9750, cost_price: 6500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Signature 1 to 5", sku: "GEN-1018", category: "General Merchandise", selling_price: 5250, cost_price: 3500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ndovu 1-8", sku: "GEN-1019", category: "General Merchandise", selling_price: 4800, cost_price: 3200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Belly pot 1-8", sku: "KTW-1021", category: "Kitchenware", selling_price: 4950, cost_price: 3300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sugar dish Artistic Container", sku: "KTW-1022", category: "Kitchenware", selling_price: 750, cost_price: 500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sugar dish Big", sku: "KTW-1023", category: "Kitchenware", selling_price: 450, cost_price: 300, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Tc Tornado", sku: "GEN-1020", category: "General Merchandise", selling_price: 6900, cost_price: 4600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Delli spice glass jars", sku: "KTW-1024", category: "Kitchenware", selling_price: 520, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Rock spice containers", sku: "KTW-1025", category: "Kitchenware", selling_price: 220, cost_price: 150, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Redberry Mug", sku: "KTW-1026", category: "Kitchenware", selling_price: 1350, cost_price: 900, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Black Mug", sku: "KTW-1027", category: "Kitchenware", selling_price: 600, cost_price: 400, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Gold Mug", sku: "KTW-1028", category: "Kitchenware", selling_price: 900, cost_price: 600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "2300 Mug", sku: "KTW-1029", category: "Kitchenware", selling_price: 750, cost_price: 500, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Mug 450", sku: "KTW-1030", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Dinner plate", sku: "KTW-1031", category: "Kitchenware", selling_price: 200, cost_price: 130, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Kinoy", sku: "GEN-1021", category: "General Merchandise", selling_price: 340, cost_price: 230, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Feng knife", sku: "KTW-1032", category: "Kitchenware", selling_price: 990, cost_price: 660, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Lumi cup", sku: "KTW-1033", category: "Kitchenware", selling_price: 1120, cost_price: 750, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Heavy serving spoon", sku: "KTW-1034", category: "Kitchenware", selling_price: 270, cost_price: 180, stock_quantity: 25, min_stock_alert: 10, is_archived: 0 },
  { name: "Teddy Bear", sku: "HMD-1022", category: "Home & Decor", selling_price: 450, cost_price: 300, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "P.spring Bottle", sku: "KTW-1035", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Moody cup", sku: "KTW-1036", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Cake mould", sku: "KTW-1037", category: "Kitchenware", selling_price: 1120, cost_price: 750, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "08/04/26 V-1526H", sku: "GEN-1022", category: "General Merchandise", selling_price: 1280, cost_price: 850, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sling 801S", sku: "FSH-1031", category: "Fashion & Accessories", selling_price: 980, cost_price: 650, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "BW-B002L", sku: "GEN-1023", category: "General Merchandise", selling_price: 1350, cost_price: 900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "1206-1", sku: "GEN-1024", category: "General Merchandise", selling_price: 1120, cost_price: 750, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Carton Rider", sku: "GEN-1025", category: "General Merchandise", selling_price: 380, cost_price: 250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Carton D03", sku: "GEN-1026", category: "General Merchandise", selling_price: 360, cost_price: 240, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Tote Bag kids", sku: "FSH-1032", category: "Fashion & Accessories", selling_price: 380, cost_price: 250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tote Bag kids M", sku: "FSH-1033", category: "Fashion & Accessories", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "PS-1", sku: "GEN-1027", category: "General Merchandise", selling_price: 80, cost_price: 50, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "LLB-2", sku: "GEN-1028", category: "General Merchandise", selling_price: 900, cost_price: 600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "V713", sku: "GEN-1029", category: "General Merchandise", selling_price: 750, cost_price: 500, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "X144 Sling bag", sku: "FSH-1034", category: "Fashion & Accessories", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Cups", sku: "KTW-1038", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Luminac cups", sku: "KTW-1039", category: "Kitchenware", selling_price: 1200, cost_price: 800, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Lunch box", sku: "KTW-1040", category: "Kitchenware", selling_price: 520, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Leather hotpots", sku: "KTW-1041", category: "Kitchenware", selling_price: 4350, cost_price: 2900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sewing sufuria", sku: "KTW-1042", category: "Kitchenware", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Gold hotpot", sku: "KTW-1043", category: "Kitchenware", selling_price: 4500, cost_price: 3000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Pinnacle hotpot", sku: "KTW-1044", category: "Kitchenware", selling_price: 4800, cost_price: 3200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Redberry Cutlery Set", sku: "KTW-1045", category: "Kitchenware", selling_price: 1350, cost_price: 900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Canvas White", sku: "FSH-1035", category: "Fashion & Accessories", selling_price: 600, cost_price: 400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "9639 Ring plate", sku: "KTW-1046", category: "Kitchenware", selling_price: 220, cost_price: 150, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "8628 Ring bowl", sku: "KTW-1047", category: "Kitchenware", selling_price: 120, cost_price: 80, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Gold Spoon holder", sku: "KTW-1048", category: "Kitchenware", selling_price: 1120, cost_price: 750, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "10L pressure Cooker", sku: "KTW-1049", category: "Kitchenware", selling_price: 12750, cost_price: 8500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "5L pressure Cooker", sku: "KTW-1050", category: "Kitchenware", selling_price: 4050, cost_price: 2700, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "7.5 pressure Cooker", sku: "KTW-1051", category: "Kitchenware", selling_price: 4350, cost_price: 2900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "7022 3.2 steel", sku: "GEN-1030", category: "General Merchandise", selling_price: 1200, cost_price: 800, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "White Flask", sku: "KTW-1052", category: "Kitchenware", selling_price: 2100, cost_price: 1400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Black flask", sku: "KTW-1053", category: "Kitchenware", selling_price: 1950, cost_price: 1300, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "VFP 097", sku: "GEN-1031", category: "General Merchandise", selling_price: 980, cost_price: 650, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "264c checked", sku: "GEN-1032", category: "General Merchandise", selling_price: 420, cost_price: 280, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "090 1litre flask", sku: "KTW-1054", category: "Kitchenware", selling_price: 520, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "6413 hom glass", sku: "KTW-1055", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "VFP-064", sku: "GEN-1033", category: "General Merchandise", selling_price: 600, cost_price: 400, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "3.0 Always", sku: "GEN-1034", category: "General Merchandise", selling_price: 1880, cost_price: 1250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Flask 3L Sunda", sku: "KTW-1056", category: "Kitchenware", selling_price: 1280, cost_price: 850, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "AmL 1.8L", sku: "GEN-1035", category: "General Merchandise", selling_price: 680, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "1420 Tea URN", sku: "KTW-1057", category: "Kitchenware", selling_price: 2850, cost_price: 1900, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "8488 Tea URN single tap", sku: "KTW-1058", category: "Kitchenware", selling_price: 2850, cost_price: 1900, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Pan Chopo light", sku: "KTW-1059", category: "Kitchenware", selling_price: 570, cost_price: 380, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "DT-4001 tray", sku: "KTW-1060", category: "Kitchenware", selling_price: 400, cost_price: 270, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "3 Pcs Tray", sku: "KTW-1061", category: "Kitchenware", selling_price: 1500, cost_price: 1000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Redberry tall max", sku: "KTW-1062", category: "Kitchenware", selling_price: 4800, cost_price: 3200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Diamond glass dish", sku: "KTW-1063", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Bella hotpot", sku: "KTW-1064", category: "Kitchenware", selling_price: 5100, cost_price: 3400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Golden hanger", sku: "GEN-1036", category: "General Merchandise", selling_price: 450, cost_price: 300, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Jp sufurias", sku: "KTW-1065", category: "Kitchenware", selling_price: 4350, cost_price: 2900, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "kettle", sku: "KTW-1066", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Teapot", sku: "KTW-1067", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "0.45aml flask", sku: "KTW-1068", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Greatstar pan", sku: "KTW-1069", category: "Kitchenware", selling_price: 750, cost_price: 500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Bamboo chopping board", sku: "KTW-1070", category: "Kitchenware", selling_price: 480, cost_price: 320, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Mwiko set (V2)", sku: "KTW-1071", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "KZH Heavy", sku: "GEN-1037", category: "General Merchandise", selling_price: 140, cost_price: 90, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Heavy fork", sku: "GEN-1038", category: "General Merchandise", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Long Teaspoon (V2)", sku: "KTW-1072", category: "Kitchenware", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Salt shaker pot", sku: "KTW-1073", category: "Kitchenware", selling_price: 180, cost_price: 120, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Comig plate", sku: "KTW-1074", category: "Kitchenware", selling_price: 120, cost_price: 80, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "ST plate", sku: "KTW-1075", category: "Kitchenware", selling_price: 200, cost_price: 130, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Dotted plate", sku: "KTW-1076", category: "Kitchenware", selling_price: 1500, cost_price: 1000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Laundry Bin", sku: "GEN-1039", category: "General Merchandise", selling_price: 550, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "flowered Mug", sku: "KTW-1077", category: "Kitchenware", selling_price: 390, cost_price: 260, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Mug 777", sku: "KTW-1078", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Zebra Mug", sku: "KTW-1079", category: "Kitchenware", selling_price: 900, cost_price: 600, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Klow Mug", sku: "KTW-1080", category: "Kitchenware", selling_price: 1200, cost_price: 800, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "squre bins", sku: "GEN-1040", category: "General Merchandise", selling_price: 180, cost_price: 120, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Round bin", sku: "GEN-1041", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Fruit Bin", sku: "GEN-1042", category: "General Merchandise", selling_price: 90, cost_price: 60, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Dust pan", sku: "KTW-1081", category: "Kitchenware", selling_price: 60, cost_price: 40, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Dust bin", sku: "GEN-1043", category: "General Merchandise", selling_price: 140, cost_price: 90, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Jumbo jug", sku: "KTW-1082", category: "Kitchenware", selling_price: 240, cost_price: 160, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Jugs", sku: "KTW-1083", category: "Kitchenware", selling_price: 100, cost_price: 65, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Baby Potty", sku: "KTW-1084", category: "Kitchenware", selling_price: 210, cost_price: 140, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Adix Bowl", sku: "KTW-1085", category: "Kitchenware", selling_price: 340, cost_price: 230, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "K/stand 3'", sku: "GEN-1044", category: "General Merchandise", selling_price: 600, cost_price: 400, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Open laundry", sku: "GEN-1045", category: "General Merchandise", selling_price: 600, cost_price: 400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "H' basket", sku: "HMD-1023", category: "Home & Decor", selling_price: 270, cost_price: 180, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Multipurpose", sku: "GEN-1046", category: "General Merchandise", selling_price: 50, cost_price: 35, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Hand Splish", sku: "GEN-1047", category: "General Merchandise", selling_price: 120, cost_price: 80, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Leif S/ dish", sku: "KTW-1086", category: "Kitchenware", selling_price: 270, cost_price: 180, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Ak 44 Nunix 1068", sku: "GEN-1048", category: "General Merchandise", selling_price: 2850, cost_price: 1900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Milton hotpot", sku: "KTW-1087", category: "Kitchenware", selling_price: 5500, cost_price: 3500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Cup & Gold h/set", sku: "KTW-1088", category: "Kitchenware", selling_price: 2000, cost_price: 1200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "J-7 1.8L", sku: "GEN-1049", category: "General Merchandise", selling_price: 520, cost_price: 350, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Gold Bowl", sku: "KTW-1089", category: "Kitchenware", selling_price: 820, cost_price: 550, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Z188", sku: "GEN-1050", category: "General Merchandise", selling_price: 12300, cost_price: 8200, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Classy Blue mug", sku: "KTW-1090", category: "Kitchenware", selling_price: 1200, cost_price: 800, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Plate holder silver", sku: "KTW-1091", category: "Kitchenware", selling_price: 450, cost_price: 280, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Nunix dishrack", sku: "KTW-1092", category: "Kitchenware", selling_price: 1280, cost_price: 850, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Cup holder silver", sku: "KTW-1093", category: "Kitchenware", selling_price: 450, cost_price: 280, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Microwave", sku: "GEN-1051", category: "General Merchandise", selling_price: 8500, cost_price: 6000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Macro 6A", sku: "GEN-1052", category: "General Merchandise", selling_price: 2250, cost_price: 1500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "B3", sku: "GEN-1053", category: "General Merchandise", selling_price: 3300, cost_price: 2200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Cup holder gold", sku: "KTW-1094", category: "Kitchenware", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Halfe diecast Pkt", sku: "GEN-1054", category: "General Merchandise", selling_price: 270, cost_price: 180, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Diecast packet small", sku: "GEN-1055", category: "General Merchandise", selling_price: 380, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Cube 4x4 Original", sku: "GEN-1056", category: "General Merchandise", selling_price: 220, cost_price: 150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Cube Original 3x3", sku: "GEN-1057", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Big crane truck", sku: "GEN-1058", category: "General Merchandise", selling_price: 980, cost_price: 650, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Eggs chicken", sku: "GEN-1059", category: "General Merchandise", selling_price: 520, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ambulance Manual", sku: "GEN-1060", category: "General Merchandise", selling_price: 220, cost_price: 150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "City Bus Police", sku: "GEN-1061", category: "General Merchandise", selling_price: 300, cost_price: 200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Water Gun small", sku: "GEN-1062", category: "General Merchandise", selling_price: 210, cost_price: 140, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Water Gun", sku: "GEN-1063", category: "General Merchandise", selling_price: 100, cost_price: 70, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Children Glasses", sku: "KTW-1095", category: "Kitchenware", selling_price: 40, cost_price: 30, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Tuby football big", sku: "GEN-1064", category: "General Merchandise", selling_price: 380, cost_price: 250, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Tubeless Ball", sku: "GEN-1065", category: "General Merchandise", selling_price: 300, cost_price: 200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Trumpet", sku: "GEN-1066", category: "General Merchandise", selling_price: 40, cost_price: 30, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "whistle", sku: "GEN-1067", category: "General Merchandise", selling_price: 180, cost_price: 120, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Wedding doll big", sku: "HMD-1024", category: "Home & Decor", selling_price: 300, cost_price: 200, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Wedding doll small", sku: "HMD-1025", category: "Home & Decor", selling_price: 150, cost_price: 100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Robot Yellow", sku: "GEN-1068", category: "General Merchandise", selling_price: 820, cost_price: 550, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Kitchen pink small", sku: "GEN-1069", category: "General Merchandise", selling_price: 380, cost_price: 250, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Small princes", sku: "GEN-1070", category: "General Merchandise", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Drum boy", sku: "GEN-1071", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Rainpow tower small", sku: "GEN-1072", category: "General Merchandise", selling_price: 300, cost_price: 200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Rain Bow tower", sku: "GEN-1073", category: "General Merchandise", selling_price: 520, cost_price: 350, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Skipping rope", sku: "GEN-1074", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Glow Butterfly", sku: "GEN-1075", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 252, min_stock_alert: 10, is_archived: 0 },
  { name: "Glow in the dark small", sku: "GEN-1076", category: "General Merchandise", selling_price: 80, cost_price: 50, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Yellow truck", sku: "GEN-1077", category: "General Merchandise", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Moppet", sku: "GEN-1078", category: "General Merchandise", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "3 in one shaker", sku: "GEN-1079", category: "General Merchandise", selling_price: 80, cost_price: 50, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Small remote car wire", sku: "GEN-1080", category: "General Merchandise", selling_price: 270, cost_price: 180, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "School block", sku: "GEN-1081", category: "General Merchandise", selling_price: 680, cost_price: 450, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Hangers", sku: "GEN-1082", category: "General Merchandise", selling_price: 330, cost_price: 220, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Concept car", sku: "GEN-1083", category: "General Merchandise", selling_price: 500, cost_price: 330, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "3D Police car", sku: "GEN-1084", category: "General Merchandise", selling_price: 520, cost_price: 350, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Skipping Wooden", sku: "GEN-1085", category: "General Merchandise", selling_price: 90, cost_price: 60, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Basketball medium", sku: "HMD-1026", category: "Home & Decor", selling_price: 380, cost_price: 250, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Flashing Ball", sku: "PHN-1092", category: "Phones & Accessories", selling_price: 100, cost_price: 70, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Tennis Ball", sku: "GEN-1086", category: "General Merchandise", selling_price: 200, cost_price: 130, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Bouncing Ball", sku: "GEN-1087", category: "General Merchandise", selling_price: 90, cost_price: 60, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "RC cars Mcqueen", sku: "GEN-1088", category: "General Merchandise", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Beach ball Smart", sku: "GEN-1089", category: "General Merchandise", selling_price: 90, cost_price: 60, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Beach ball", sku: "GEN-1090", category: "General Merchandise", selling_price: 80, cost_price: 50, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Small line ball", sku: "GEN-1091", category: "General Merchandise", selling_price: 30, cost_price: 20, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Lazer torch", sku: "ELC-1047", category: "TV & Electronics", selling_price: 90, cost_price: 60, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Duster", sku: "GEN-1092", category: "General Merchandise", selling_price: 450, cost_price: 300, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Big fun piano", sku: "HMD-1027", category: "Home & Decor", selling_price: 1350, cost_price: 900, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Spray train", sku: "GEN-1093", category: "General Merchandise", selling_price: 1200, cost_price: 800, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Bandana", sku: "GEN-1094", category: "General Merchandise", selling_price: 450, cost_price: 300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "OMG", sku: "GEN-1095", category: "General Merchandise", selling_price: 120, cost_price: 80, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Double chafing dish", sku: "KTW-1096", category: "Kitchenware", selling_price: 6750, cost_price: 4500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tree Mug morning", sku: "KTW-1097", category: "Kitchenware", selling_price: 3000, cost_price: 2000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sandwith Maker", sku: "KTW-1098", category: "Kitchenware", selling_price: 3000, cost_price: 2000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Table mats gold", sku: "KTW-1099", category: "Kitchenware", selling_price: 600, cost_price: 400, stock_quantity: 36, min_stock_alert: 10, is_archived: 0 },
  { name: "Lunch box small", sku: "KTW-1100", category: "Kitchenware", selling_price: 1200, cost_price: 800, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Fk-305 Kettle", sku: "KTW-1101", category: "Kitchenware", selling_price: 3000, cost_price: 2000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Electromate, deep fryer single", sku: "KTW-1102", category: "Kitchenware", selling_price: 4200, cost_price: 2800, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Salad bowl", sku: "KTW-1103", category: "Kitchenware", selling_price: 750, cost_price: 500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Boxers", sku: "FSH-1036", category: "Fashion & Accessories", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Boxers (V2)", sku: "FSH-1037", category: "Fashion & Accessories", selling_price: 600, cost_price: 400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Simless pants", sku: "KTW-1104", category: "Kitchenware", selling_price: 2400, cost_price: 1600, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Point cotton", sku: "FSH-1038", category: "Fashion & Accessories", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Simless cotton", sku: "FSH-1039", category: "Fashion & Accessories", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Less point", sku: "GEN-1096", category: "General Merchandise", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Door mat", sku: "HMD-1028", category: "Home & Decor", selling_price: 300, cost_price: 200, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Fluffy door mat", sku: "HMD-1029", category: "Home & Decor", selling_price: 900, cost_price: 600, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Bathroom absorbant mat", sku: "HMD-1030", category: "Home & Decor", selling_price: 450, cost_price: 300, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "doll", sku: "HMD-1031", category: "Home & Decor", selling_price: 400, cost_price: 270, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Doll (V2)", sku: "HMD-1032", category: "Home & Decor", selling_price: 220, cost_price: 150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Water bubble", sku: "HMD-1033", category: "Home & Decor", selling_price: 100, cost_price: 70, stock_quantity: 8, min_stock_alert: 5, is_archived: 0 },
  { name: "Whisk", sku: "KTW-1105", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon holder big", sku: "KTW-1106", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon holder m", sku: "KTW-1107", category: "Kitchenware", selling_price: 90, cost_price: 60, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Storage Organise", sku: "HMD-1034", category: "Home & Decor", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Sink pump", sku: "HMD-1035", category: "Home & Decor", selling_price: 180, cost_price: 120, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Wine glass (V2)", sku: "KTW-1108", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Tongli", sku: "KTW-1109", category: "Kitchenware", selling_price: 100, cost_price: 70, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tongli (V2)", sku: "KTW-1110", category: "Kitchenware", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tongli B", sku: "KTW-1111", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Chirps wire", sku: "GEN-1097", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Chirps Wire (V2)", sku: "GEN-1098", category: "General Merchandise", selling_price: 100, cost_price: 70, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Kitchen towel", sku: "KTW-1112", category: "Kitchenware", selling_price: 220, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Mashers Stainless", sku: "KTW-1113", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieves Set", sku: "KTW-1114", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieves set black", sku: "KTW-1115", category: "Kitchenware", selling_price: 380, cost_price: 250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieves set medium", sku: "KTW-1116", category: "Kitchenware", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Silicone Masher", sku: "PHN-1093", category: "Phones & Accessories", selling_price: 220, cost_price: 150, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Egg spoon Silicone", sku: "PHN-1094", category: "Phones & Accessories", selling_price: 180, cost_price: 120, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Whisk Stainless", sku: "KTW-1117", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon set", sku: "KTW-1118", category: "Kitchenware", selling_price: 220, cost_price: 150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Measuring cups", sku: "KTW-1119", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Baby spoon mix", sku: "KTW-1120", category: "Kitchenware", selling_price: 180, cost_price: 120, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon holder plastic", sku: "KTW-1121", category: "Kitchenware", selling_price: 520, cost_price: 350, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Travelling 902", sku: "GEN-1099", category: "General Merchandise", selling_price: 900, cost_price: 600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "D560", sku: "GEN-1100", category: "General Merchandise", selling_price: 900, cost_price: 600, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "D4348", sku: "GEN-1101", category: "General Merchandise", selling_price: 1350, cost_price: 900, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Big fun piano (V2)", sku: "HMD-1036", category: "Home & Decor", selling_price: 1950, cost_price: 1300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Big fun 37 keys", sku: "HMD-1037", category: "Home & Decor", selling_price: 1800, cost_price: 1200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Yellow Duck", sku: "HMD-1038", category: "Home & Decor", selling_price: 300, cost_price: 200, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Hooks Metalic Small", sku: "HMD-1039", category: "Home & Decor", selling_price: 120, cost_price: 80, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Floater Size 50", sku: "HMD-1040", category: "Home & Decor", selling_price: 100, cost_price: 70, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Floater Size 60", sku: "HMD-1041", category: "Home & Decor", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Floater Size 80", sku: "HMD-1042", category: "Home & Decor", selling_price: 220, cost_price: 150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Small ball pump", sku: "HMD-1043", category: "Home & Decor", selling_price: 240, cost_price: 160, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Plastic Spoon holder", sku: "KTW-1122", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon holders", sku: "KTW-1123", category: "Kitchenware", selling_price: 180, cost_price: 120, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Baby feeder", sku: "KTW-1124", category: "Kitchenware", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Basket bamboo", sku: "HMD-1044", category: "Home & Decor", selling_price: 750, cost_price: 500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Bathing gloves", sku: "BPC-1011", category: "Beauty & Personal Care", selling_price: 320, cost_price: 210, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Corner shelve", sku: "HMD-1045", category: "Home & Decor", selling_price: 1800, cost_price: 1200, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Air fryer", sku: "KTW-1125", category: "Kitchenware", selling_price: 5250, cost_price: 3500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "2 layer stainles dishrack", sku: "KTW-1126", category: "Kitchenware", selling_price: 1280, cost_price: 850, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Glass jug", sku: "KTW-1127", category: "Kitchenware", selling_price: 420, cost_price: 280, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Marbled Pot, mug pink", sku: "KTW-1128", category: "Kitchenware", selling_price: 1800, cost_price: 1200, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Wooden Mwiko Set", sku: "KTW-1129", category: "Kitchenware", selling_price: 1200, cost_price: 800, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "6K 1810", sku: "GEN-1102", category: "General Merchandise", selling_price: 7500, cost_price: 5000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Feeder feeding bottle", sku: "KTW-1130", category: "Kitchenware", selling_price: 600, cost_price: 400, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Spoon holder b", sku: "KTW-1131", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Tonga small", sku: "KTW-1132", category: "Kitchenware", selling_price: 100, cost_price: 70, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tonga medium", sku: "KTW-1133", category: "Kitchenware", selling_price: 120, cost_price: 80, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Tong Bign", sku: "KTW-1134", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Chirps Wire (b)", sku: "GEN-1103", category: "General Merchandise", selling_price: 150, cost_price: 100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Chirps Wire (sm)", sku: "GEN-1104", category: "General Merchandise", selling_price: 100, cost_price: 70, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieves straight", sku: "KTW-1135", category: "Kitchenware", selling_price: 180, cost_price: 120, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Kitchen towels", sku: "KTW-1136", category: "Kitchenware", selling_price: 220, cost_price: 150, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieves Set (V2)", sku: "KTW-1137", category: "Kitchenware", selling_price: 420, cost_price: 280, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Sieve set medium", sku: "KTW-1138", category: "Kitchenware", selling_price: 300, cost_price: 200, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Eggs spoon silicon", sku: "PHN-1095", category: "Phones & Accessories", selling_price: 180, cost_price: 120, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Toilet brushes", sku: "BPC-1012", category: "Beauty & Personal Care", selling_price: 300, cost_price: 200, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Measuring", sku: "FSH-1040", category: "Fashion & Accessories", selling_price: 150, cost_price: 100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Jikokoa", sku: "KTW-1139", category: "Kitchenware", selling_price: 3900, cost_price: 2600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "521 flask", sku: "KTW-1140", category: "Kitchenware", selling_price: 680, cost_price: 450, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Travel pot", sku: "KTW-1141", category: "Kitchenware", selling_price: 3150, cost_price: 2100, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Black Plate", sku: "KTW-1142", category: "Kitchenware", selling_price: 1280, cost_price: 850, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "0880 pot", sku: "KTW-1143", category: "Kitchenware", selling_price: 3000, cost_price: 2000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Chaffing dish redberry double", sku: "KTW-1144", category: "Kitchenware", selling_price: 7500, cost_price: 5000, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Lemon squzer", sku: "KTW-1145", category: "Kitchenware", selling_price: 200, cost_price: 130, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Wall Hook", sku: "HMD-1046", category: "Home & Decor", selling_price: 120, cost_price: 80, stock_quantity: 10, min_stock_alert: 5, is_archived: 0 },
  { name: "Electric Pressure cooker", sku: "KTW-1146", category: "Kitchenware", selling_price: 6750, cost_price: 4500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Dish plate", sku: "KTW-1147", category: "Kitchenware", selling_price: 1720, cost_price: 1150, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Thomas brush", sku: "BPC-1013", category: "Beauty & Personal Care", selling_price: 150, cost_price: 100, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Silicone spoon set", sku: "PHN-1096", category: "Phones & Accessories", selling_price: 1280, cost_price: 850, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Handpan lunch pot", sku: "KTW-1148", category: "Kitchenware", selling_price: 1880, cost_price: 1250, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Breakfast Maker", sku: "KTW-1149", category: "Kitchenware", selling_price: 6450, cost_price: 4300, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Little-ding gold flask", sku: "KTW-1150", category: "Kitchenware", selling_price: 2250, cost_price: 1500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Afk-103", sku: "GEN-1105", category: "General Merchandise", selling_price: 2700, cost_price: 1800, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "DPP-1903", sku: "GEN-1106", category: "General Merchandise", selling_price: 1650, cost_price: 1100, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Stanley Marble", sku: "GEN-1107", category: "General Merchandise", selling_price: 1120, cost_price: 750, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Smoothie cup", sku: "KTW-1151", category: "Kitchenware", selling_price: 180, cost_price: 120, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "Champagne glass", sku: "KTW-1152", category: "Kitchenware", selling_price: 1800, cost_price: 1200, stock_quantity: 3, min_stock_alert: 3, is_archived: 0 },
  { name: "1068 Blender", sku: "KTW-1153", category: "Kitchenware", selling_price: 3000, cost_price: 2000, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Ailyons Wall fan", sku: "ELC-1048", category: "TV & Electronics", selling_price: 2550, cost_price: 1700, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "AK-100 blender Nunix", sku: "KTW-1154", category: "Kitchenware", selling_price: 2250, cost_price: 1500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "VB-301 Commercial blender", sku: "KTW-1155", category: "Kitchenware", selling_price: 3750, cost_price: 2500, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "RN-1040 Blender", sku: "KTW-1156", category: "Kitchenware", selling_price: 2100, cost_price: 1400, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Kzh spoon", sku: "KTW-1157", category: "Kitchenware", selling_price: 150, cost_price: 100, stock_quantity: 1, min_stock_alert: 3, is_archived: 0 },
  { name: "Drawer Organizer", sku: "HMD-1047", category: "Home & Decor", selling_price: 1500, cost_price: 1000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Bosch Sufuria Regina", sku: "KTW-1158", category: "Kitchenware", selling_price: 10500, cost_price: 7000, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Kal 10pcs Cookware set", sku: "KTW-1159", category: "Kitchenware", selling_price: 6450, cost_price: 4300, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "Luminarc mug plan", sku: "KTW-1160", category: "Kitchenware", selling_price: 2400, cost_price: 1600, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
  { name: "3 layer dishrack black", sku: "KTW-1161", category: "Kitchenware", selling_price: 2250, cost_price: 1500, stock_quantity: 2, min_stock_alert: 3, is_archived: 0 },
];

export const CATEGORIES = [
  "Kitchenware",
  "Phones & Accessories",
  "TV & Electronics",
  "Home & Decor",
  "Fashion & Accessories",
  "Beauty & Personal Care",
  "General Merchandise",
] as const;

/** Bump when SEED_PRODUCTS changes so existing tills refresh their catalogue. */
const CATALOG_VERSION = "3";

let seedPromise: Promise<void> | null = null;

/** Seeding runs once per page load, no matter how many callers ask. */
export function ensureSeeded(): Promise<void> {
  seedPromise ??= runSeed();
  return seedPromise;
}

async function runSeed() {
  const db = getDb();
  const count = await db.products.count();
  const version = typeof localStorage !== "undefined" ? localStorage.getItem("shelfos:catalog") : CATALOG_VERSION;

  if (count === 0) {
    await db.products.bulkAdd(SEED_PRODUCTS as Product[]);
  } else if (version !== CATALOG_VERSION) {
    // The catalogue was replaced with the store's own stock list: clear the old
    // lines and load the new ones, keeping counted stock for SKUs we still sell.
    const existing = await db.products.toArray();
    const bySku = new Map(existing.map((p) => [p.sku, p]));
    await db.products.clear();
    await db.products.bulkAdd(
      SEED_PRODUCTS.map((seedRow) => {
        const known = bySku.get(seedRow.sku);
        return { ...seedRow, stock_quantity: known ? known.stock_quantity : seedRow.stock_quantity } as Product;
      }),
    );
  }

  if (typeof localStorage !== "undefined") localStorage.setItem("shelfos:catalog", CATALOG_VERSION);
}
