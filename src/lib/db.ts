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
  { name: "Non-Stick Frying Pan 28cm", sku: "KTW-1001", category: "Kitchenware", subcategory: "Cookware", selling_price: 2450, cost_price: 1620, stock_quantity: 18, min_stock_alert: 6, is_archived: 0 },
  { name: "Aluminium Sufuria Set 4pc", sku: "KTW-1002", category: "Kitchenware", subcategory: "Cookware", selling_price: 3400, cost_price: 2250, stock_quantity: 14, min_stock_alert: 5, is_archived: 0 },
  { name: "Stainless Steel Sufuria 5L", sku: "KTW-1003", category: "Kitchenware", subcategory: "Cookware", selling_price: 3200, cost_price: 2150, stock_quantity: 9, min_stock_alert: 5, is_archived: 0 },
  { name: "Pressure Cooker 6L", sku: "KTW-1004", category: "Kitchenware", subcategory: "Cookware", selling_price: 7900, cost_price: 5600, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Non-Stick Baking Tray 35cm", sku: "KTW-1005", category: "Kitchenware", subcategory: "Cookware", selling_price: 1150, cost_price: 690, stock_quantity: 16, min_stock_alert: 6, is_archived: 0 },
  { name: "Cast Iron Skillet 26cm", sku: "KTW-1006", category: "Kitchenware", subcategory: "Cookware", selling_price: 4300, cost_price: 2950, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Chef Knife 8-inch", sku: "KTW-1101", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 1450, cost_price: 860, stock_quantity: 20, min_stock_alert: 6, is_archived: 0 },
  { name: "Bamboo Chopping Board", sku: "KTW-1102", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 980, cost_price: 540, stock_quantity: 22, min_stock_alert: 8, is_archived: 0 },
  { name: "Stainless Steel Grater", sku: "KTW-1103", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 520, cost_price: 290, stock_quantity: 26, min_stock_alert: 10, is_archived: 0 },
  { name: "Vegetable Peeler", sku: "KTW-1104", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 180, cost_price: 85, stock_quantity: 40, min_stock_alert: 15, is_archived: 0 },
  { name: "Measuring Jug 1L", sku: "KTW-1105", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 340, cost_price: 180, stock_quantity: 24, min_stock_alert: 10, is_archived: 0 },
  { name: "Manual Food Chopper", sku: "KTW-1106", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 1280, cost_price: 760, stock_quantity: 11, min_stock_alert: 5, is_archived: 0 },
  { name: "Fine Mesh Strainer Set 3pc", sku: "KTW-1107", category: "Kitchenware", subcategory: "Food Preparation", selling_price: 690, cost_price: 390, stock_quantity: 15, min_stock_alert: 6, is_archived: 0 },
  { name: "Glass Tumblers 6pk", sku: "KTW-1201", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 1150, cost_price: 640, stock_quantity: 18, min_stock_alert: 6, is_archived: 0 },
  { name: "Stainless Water Bottle 750ml", sku: "KTW-1202", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 890, cost_price: 470, stock_quantity: 30, min_stock_alert: 10, is_archived: 0 },
  { name: "Vacuum Flask 1.8L", sku: "KTW-1203", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 2250, cost_price: 1450, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Ceramic Coffee Mug 350ml", sku: "KTW-1204", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 320, cost_price: 150, stock_quantity: 45, min_stock_alert: 15, is_archived: 0 },
  { name: "Glass Pitcher Jug 1.8L", sku: "KTW-1205", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 890, cost_price: 520, stock_quantity: 21, min_stock_alert: 8, is_archived: 0 },
  { name: "Porcelain Tea Set 12pc", sku: "KTW-1206", category: "Kitchenware", subcategory: "Drinkware & Mugs", selling_price: 3600, cost_price: 2400, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "12-Piece Ceramic Dinner Set", sku: "KTW-1301", category: "Kitchenware", subcategory: "Dinnerware & Cutlery", selling_price: 5900, cost_price: 4100, stock_quantity: 7, min_stock_alert: 4, is_archived: 0 },
  { name: "Ceramic Soup Bowls 6pk", sku: "KTW-1302", category: "Kitchenware", subcategory: "Dinnerware & Cutlery", selling_price: 1750, cost_price: 1050, stock_quantity: 13, min_stock_alert: 5, is_archived: 0 },
  { name: "Oval Serving Platter", sku: "KTW-1303", category: "Kitchenware", subcategory: "Dinnerware & Cutlery", selling_price: 1250, cost_price: 690, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Cutlery Set 24pc", sku: "KTW-1304", category: "Kitchenware", subcategory: "Dinnerware & Cutlery", selling_price: 2100, cost_price: 1290, stock_quantity: 9, min_stock_alert: 4, is_archived: 0 },
  { name: "Serving Spoon Set 3pc", sku: "KTW-1305", category: "Kitchenware", subcategory: "Dinnerware & Cutlery", selling_price: 540, cost_price: 280, stock_quantity: 24, min_stock_alert: 8, is_archived: 0 },
  { name: "Electric Kettle 1.7L", sku: "KTW-1401", category: "Kitchenware", subcategory: "Small Appliances", selling_price: 2650, cost_price: 1780, stock_quantity: 15, min_stock_alert: 5, is_archived: 0 },
  { name: "Hand Blender 400W", sku: "KTW-1402", category: "Kitchenware", subcategory: "Small Appliances", selling_price: 3450, cost_price: 2350, stock_quantity: 7, min_stock_alert: 3, is_archived: 0 },
  { name: "Sandwich Maker", sku: "KTW-1403", category: "Kitchenware", subcategory: "Small Appliances", selling_price: 3900, cost_price: 2700, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "2-Slice Toaster", sku: "KTW-1404", category: "Kitchenware", subcategory: "Small Appliances", selling_price: 3200, cost_price: 2200, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Airtight Glass Jar 1L", sku: "FDS-2001", category: "Food Storage", subcategory: "Dry Food Storage", selling_price: 640, cost_price: 340, stock_quantity: 28, min_stock_alert: 10, is_archived: 0 },
  { name: "Plastic Pantry Bin 6L", sku: "FDS-2002", category: "Food Storage", subcategory: "Dry Food Storage", selling_price: 520, cost_price: 280, stock_quantity: 24, min_stock_alert: 8, is_archived: 0 },
  { name: "Rotating Spice Rack 12pc", sku: "FDS-2003", category: "Food Storage", subcategory: "Dry Food Storage", selling_price: 1850, cost_price: 1150, stock_quantity: 8, min_stock_alert: 4, is_archived: 0 },
  { name: "Cereal Dispenser 3L", sku: "FDS-2004", category: "Food Storage", subcategory: "Dry Food Storage", selling_price: 1250, cost_price: 720, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Food Container Set 10pc", sku: "FDS-2101", category: "Food Storage", subcategory: "Fresh Storage & Prep", selling_price: 1650, cost_price: 980, stock_quantity: 17, min_stock_alert: 6, is_archived: 0 },
  { name: "Lunch Box 2-Compartment", sku: "FDS-2102", category: "Food Storage", subcategory: "Fresh Storage & Prep", selling_price: 690, cost_price: 380, stock_quantity: 26, min_stock_alert: 10, is_archived: 0 },
  { name: "Thermal Food Flask 1L", sku: "FDS-2103", category: "Food Storage", subcategory: "Fresh Storage & Prep", selling_price: 1950, cost_price: 1250, stock_quantity: 9, min_stock_alert: 4, is_archived: 0 },
  { name: "2-Tier Dish Drying Rack", sku: "FDS-2201", category: "Food Storage", subcategory: "Racks & Organizers", selling_price: 2450, cost_price: 1600, stock_quantity: 11, min_stock_alert: 4, is_archived: 0 },
  { name: "Cutlery Holder Caddy", sku: "FDS-2202", category: "Food Storage", subcategory: "Racks & Organizers", selling_price: 480, cost_price: 240, stock_quantity: 22, min_stock_alert: 8, is_archived: 0 },
  { name: "Under-Sink Organizer", sku: "FDS-2203", category: "Food Storage", subcategory: "Racks & Organizers", selling_price: 1750, cost_price: 1050, stock_quantity: 7, min_stock_alert: 4, is_archived: 0 },
  { name: "Pot Lid Rack", sku: "FDS-2204", category: "Food Storage", subcategory: "Racks & Organizers", selling_price: 890, cost_price: 470, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Microfiber Spin Mop Set", sku: "CLN-3001", category: "Cleaning & Laundry", subcategory: "Floor Cleaning", selling_price: 1850, cost_price: 1180, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Mop Bucket 12L", sku: "CLN-3002", category: "Cleaning & Laundry", subcategory: "Floor Cleaning", selling_price: 950, cost_price: 540, stock_quantity: 14, min_stock_alert: 5, is_archived: 0 },
  { name: "Broom & Dustpan Set", sku: "CLN-3003", category: "Cleaning & Laundry", subcategory: "Floor Cleaning", selling_price: 640, cost_price: 340, stock_quantity: 20, min_stock_alert: 8, is_archived: 0 },
  { name: "Floor Squeegee 45cm", sku: "CLN-3004", category: "Cleaning & Laundry", subcategory: "Floor Cleaning", selling_price: 720, cost_price: 390, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Heavy-Duty Scrub Brush", sku: "CLN-3005", category: "Cleaning & Laundry", subcategory: "Floor Cleaning", selling_price: 380, cost_price: 190, stock_quantity: 0, min_stock_alert: 6, is_archived: 0 },
  { name: "Microfiber Cloths 5pk", sku: "CLN-3101", category: "Cleaning & Laundry", subcategory: "Surface Cleaning", selling_price: 450, cost_price: 230, stock_quantity: 34, min_stock_alert: 12, is_archived: 0 },
  { name: "Scouring Pads 6pk", sku: "CLN-3102", category: "Cleaning & Laundry", subcategory: "Surface Cleaning", selling_price: 220, cost_price: 105, stock_quantity: 48, min_stock_alert: 15, is_archived: 0 },
  { name: "Kitchen Sponges 8pk", sku: "CLN-3103", category: "Cleaning & Laundry", subcategory: "Surface Cleaning", selling_price: 260, cost_price: 120, stock_quantity: 42, min_stock_alert: 15, is_archived: 0 },
  { name: "Trigger Spray Bottle 750ml", sku: "CLN-3104", category: "Cleaning & Laundry", subcategory: "Surface Cleaning", selling_price: 290, cost_price: 140, stock_quantity: 30, min_stock_alert: 10, is_archived: 0 },
  { name: "Rubber Gloves Pair", sku: "CLN-3105", category: "Cleaning & Laundry", subcategory: "Surface Cleaning", selling_price: 250, cost_price: 115, stock_quantity: 36, min_stock_alert: 12, is_archived: 0 },
  { name: "Heavy-Duty Laundry Basket 50L", sku: "CLN-3201", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 1350, cost_price: 820, stock_quantity: 13, min_stock_alert: 5, is_archived: 0 },
  { name: "Folding Drying Rack", sku: "CLN-3202", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 2650, cost_price: 1750, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Clothes Hangers 10pk", sku: "CLN-3203", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 480, cost_price: 230, stock_quantity: 28, min_stock_alert: 10, is_archived: 0 },
  { name: "Plastic Clothes Pegs 24pk", sku: "CLN-3204", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 180, cost_price: 95, stock_quantity: 48, min_stock_alert: 15, is_archived: 0 },
  { name: "Ironing Board", sku: "CLN-3205", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 3400, cost_price: 2350, stock_quantity: 4, min_stock_alert: 3, is_archived: 0 },
  { name: "Plastic Wash Basin 25L", sku: "CLN-3206", category: "Cleaning & Laundry", subcategory: "Laundry Essentials", selling_price: 690, cost_price: 370, stock_quantity: 16, min_stock_alert: 6, is_archived: 0 },
  { name: "Pedal Trash Bin 20L", sku: "CLN-3301", category: "Cleaning & Laundry", subcategory: "Waste Management", selling_price: 1650, cost_price: 1020, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Kitchen Step Can 30L", sku: "CLN-3302", category: "Cleaning & Laundry", subcategory: "Waste Management", selling_price: 2250, cost_price: 1450, stock_quantity: 7, min_stock_alert: 3, is_archived: 0 },
  { name: "Bathroom Wastebasket 8L", sku: "CLN-3303", category: "Cleaning & Laundry", subcategory: "Waste Management", selling_price: 520, cost_price: 260, stock_quantity: 18, min_stock_alert: 6, is_archived: 0 },
  { name: "Bin Liners 30pk", sku: "CLN-3304", category: "Cleaning & Laundry", subcategory: "Waste Management", selling_price: 320, cost_price: 150, stock_quantity: 40, min_stock_alert: 15, is_archived: 0 },
  { name: "Stackable Storage Box 45L", sku: "HST-4001", category: "Home Storage", subcategory: "Heavy Storage", selling_price: 2100, cost_price: 1390, stock_quantity: 15, min_stock_alert: 5, is_archived: 0 },
  { name: "Stackable Storage Box 80L", sku: "HST-4002", category: "Home Storage", subcategory: "Heavy Storage", selling_price: 3250, cost_price: 2200, stock_quantity: 8, min_stock_alert: 4, is_archived: 0 },
  { name: "Under-Bed Container 30L", sku: "HST-4003", category: "Home Storage", subcategory: "Heavy Storage", selling_price: 1750, cost_price: 1100, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Clear Storage Tote 60L", sku: "HST-4004", category: "Home Storage", subcategory: "Heavy Storage", selling_price: 2650, cost_price: 1750, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "5-Tier Shoe Rack", sku: "HST-4101", category: "Home Storage", subcategory: "Closet & Bedroom", selling_price: 2450, cost_price: 1600, stock_quantity: 9, min_stock_alert: 4, is_archived: 0 },
  { name: "Fabric Wardrobe Organizer", sku: "HST-4102", category: "Home Storage", subcategory: "Closet & Bedroom", selling_price: 3900, cost_price: 2650, stock_quantity: 5, min_stock_alert: 3, is_archived: 0 },
  { name: "Velvet Non-Slip Hangers 20pk", sku: "HST-4103", category: "Home Storage", subcategory: "Closet & Bedroom", selling_price: 1250, cost_price: 720, stock_quantity: 14, min_stock_alert: 5, is_archived: 0 },
  { name: "Vacuum Storage Bags 4pk", sku: "HST-4104", category: "Home Storage", subcategory: "Closet & Bedroom", selling_price: 1450, cost_price: 880, stock_quantity: 11, min_stock_alert: 5, is_archived: 0 },
  { name: "2-Step Folding Stool", sku: "HST-4201", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 1950, cost_price: 1250, stock_quantity: 8, min_stock_alert: 4, is_archived: 0 },
  { name: "Extension Cord 4-Way 3m", sku: "HST-4202", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 1350, cost_price: 850, stock_quantity: 16, min_stock_alert: 6, is_archived: 0 },
  { name: "LED Rechargeable Flashlight", sku: "HST-4203", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 890, cost_price: 470, stock_quantity: 22, min_stock_alert: 8, is_archived: 0 },
  { name: "Multi-Plug Travel Adapter", sku: "HST-4204", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 650, cost_price: 320, stock_quantity: 19, min_stock_alert: 8, is_archived: 0 },
  { name: "Adhesive Wall Hooks 6pk", sku: "HST-4205", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 380, cost_price: 180, stock_quantity: 35, min_stock_alert: 12, is_archived: 0 },
  { name: "3-Tier Metal Shelf Rack", sku: "HST-4206", category: "Home Storage", subcategory: "Utility Hardware", selling_price: 4750, cost_price: 3250, stock_quantity: 4, min_stock_alert: 4, is_archived: 0 },
  { name: "Soap Dispenser 350ml", sku: "BTH-5001", category: "Bathroom", subcategory: "Bath Accessories", selling_price: 590, cost_price: 300, stock_quantity: 24, min_stock_alert: 8, is_archived: 0 },
  { name: "Toothbrush Holder", sku: "BTH-5002", category: "Bathroom", subcategory: "Bath Accessories", selling_price: 420, cost_price: 200, stock_quantity: 26, min_stock_alert: 10, is_archived: 0 },
  { name: "Ceramic Soap Dish", sku: "BTH-5003", category: "Bathroom", subcategory: "Bath Accessories", selling_price: 340, cost_price: 160, stock_quantity: 22, min_stock_alert: 8, is_archived: 0 },
  { name: "Toilet Brush & Caddy Set", sku: "BTH-5004", category: "Bathroom", subcategory: "Bath Accessories", selling_price: 760, cost_price: 410, stock_quantity: 15, min_stock_alert: 6, is_archived: 0 },
  { name: "Anti-Slip Bathroom Mat", sku: "BTH-5101", category: "Bathroom", subcategory: "Fixtures & Mats", selling_price: 980, cost_price: 560, stock_quantity: 18, min_stock_alert: 6, is_archived: 0 },
  { name: "Shower Curtain & Rings Set", sku: "BTH-5102", category: "Bathroom", subcategory: "Fixtures & Mats", selling_price: 1450, cost_price: 890, stock_quantity: 12, min_stock_alert: 5, is_archived: 0 },
  { name: "Suction Corner Shelf", sku: "BTH-5103", category: "Bathroom", subcategory: "Fixtures & Mats", selling_price: 890, cost_price: 490, stock_quantity: 14, min_stock_alert: 6, is_archived: 0 },
  { name: "Cotton Hand Towel", sku: "BTH-5201", category: "Bathroom", subcategory: "Textiles", selling_price: 450, cost_price: 220, stock_quantity: 32, min_stock_alert: 12, is_archived: 0 },
  { name: "Cotton Bath Towel", sku: "BTH-5202", category: "Bathroom", subcategory: "Textiles", selling_price: 1250, cost_price: 750, stock_quantity: 20, min_stock_alert: 8, is_archived: 0 },
  { name: "Microfiber Washcloths 4pk", sku: "BTH-5203", category: "Bathroom", subcategory: "Textiles", selling_price: 520, cost_price: 260, stock_quantity: 25, min_stock_alert: 10, is_archived: 0 },
  { name: "Coir Door Mat 60x40cm", sku: "LVD-6001", category: "Living & Decor", subcategory: "Floor & Window", selling_price: 890, cost_price: 470, stock_quantity: 20, min_stock_alert: 8, is_archived: 0 },
  { name: "Entry Runner Rug 150cm", sku: "LVD-6002", category: "Living & Decor", subcategory: "Floor & Window", selling_price: 2450, cost_price: 1600, stock_quantity: 7, min_stock_alert: 3, is_archived: 0 },
  { name: "Extendable Curtain Rod", sku: "LVD-6003", category: "Living & Decor", subcategory: "Floor & Window", selling_price: 1250, cost_price: 720, stock_quantity: 13, min_stock_alert: 5, is_archived: 0 },
  { name: "Curtain Tiebacks Pair", sku: "LVD-6004", category: "Living & Decor", subcategory: "Floor & Window", selling_price: 380, cost_price: 180, stock_quantity: 24, min_stock_alert: 8, is_archived: 0 },
  { name: "Scented Soy Candle Jar", sku: "LVD-6101", category: "Living & Decor", subcategory: "Aromas & Lighting", selling_price: 950, cost_price: 540, stock_quantity: 2, min_stock_alert: 6, is_archived: 0 },
  { name: "Ultrasonic Oil Diffuser", sku: "LVD-6102", category: "Living & Decor", subcategory: "Aromas & Lighting", selling_price: 2650, cost_price: 1780, stock_quantity: 6, min_stock_alert: 3, is_archived: 0 },
  { name: "Brass Incense Holder", sku: "LVD-6103", category: "Living & Decor", subcategory: "Aromas & Lighting", selling_price: 450, cost_price: 220, stock_quantity: 18, min_stock_alert: 6, is_archived: 0 },
  { name: "Silent Wall Clock 30cm", sku: "LVD-6201", category: "Living & Decor", subcategory: "Decorative Accents", selling_price: 1450, cost_price: 880, stock_quantity: 11, min_stock_alert: 4, is_archived: 0 },
  { name: "Synthetic Display Plant", sku: "LVD-6202", category: "Living & Decor", subcategory: "Decorative Accents", selling_price: 1650, cost_price: 980, stock_quantity: 9, min_stock_alert: 4, is_archived: 0 },
  { name: "Photo Frame A4", sku: "LVD-6203", category: "Living & Decor", subcategory: "Decorative Accents", selling_price: 690, cost_price: 350, stock_quantity: 20, min_stock_alert: 8, is_archived: 0 },
  { name: "Glass Flower Vase 25cm", sku: "LVD-6204", category: "Living & Decor", subcategory: "Decorative Accents", selling_price: 1150, cost_price: 650, stock_quantity: 10, min_stock_alert: 4, is_archived: 0 },
  { name: "Cotton Table Runner 180cm", sku: "LVD-6205", category: "Living & Decor", subcategory: "Decorative Accents", selling_price: 1250, cost_price: 720, stock_quantity: 20, min_stock_alert: 6, is_archived: 0 },
];

export const CATEGORIES = [
  "Kitchenware",
  "Food Storage",
  "Cleaning & Laundry",
  "Home Storage",
  "Bathroom",
  "Living & Decor",
] as const;

/** Bump when SEED_PRODUCTS changes so existing tills refresh their catalogue. */
const CATALOG_VERSION = "2";

export async function ensureSeeded() {
  const db = getDb();
  const count = await db.products.count();
  const version = typeof localStorage !== "undefined" ? localStorage.getItem("shelfos:catalog") : CATALOG_VERSION;

  if (count === 0) {
    await db.products.bulkAdd(SEED_PRODUCTS as Product[]);
  } else if (version !== CATALOG_VERSION) {
    // Refresh the demo catalogue in place: keep stock counts for SKUs the
    // till already knows, add the new lines, and re-file old categories.
    const existing = await db.products.toArray();
    const bySku = new Map(existing.map((p) => [p.sku, p]));
    for (const seedRow of SEED_PRODUCTS) {
      const current = bySku.get(seedRow.sku);
      if (current?.id) {
        await db.products.update(current.id, {
          category: seedRow.category,
          subcategory: seedRow.subcategory,
          name: seedRow.name,
        });
      } else {
        await db.products.add(seedRow as Product);
      }
    }
    const seedSkus = new Set(SEED_PRODUCTS.map((p) => p.sku));
    for (const p of existing) {
      if (!seedSkus.has(p.sku) && p.id && !CATEGORIES.includes(p.category as (typeof CATEGORIES)[number])) {
        await db.products.update(p.id, { category: "Home Storage" });
      }
    }
  }

  if (typeof localStorage !== "undefined") localStorage.setItem("shelfos:catalog", CATALOG_VERSION);
}
