# ShelfOS Retail Hub

1. Brand Identity System

Brand Concept: Clean, industrial utility meets calm digital precision. It feels less like a messy cashier till and more like an effortless operating system for physical retail.

Typography: Inter or Plus Jakarta Sans — high-legibility numerals and clean geometric letterforms for fast scanning under bright shop lighting.

Color Palette:

Primary (Deep Slate / Shelf Navy): #0F172A (Tailwind slate-900) — grounded, professional background for navigation and headers.

Brand Accent (Electric Teal / Retail Cyan): #0EA5E9 (Tailwind sky-500) or #06B6D4 (Tailwind cyan-500) — high-contrast highlight for active buttons, successful sync states, and primary CTAs.

Surface Neutral (Pure White / Off-White): #FFFFFF and #F8FAFC (Tailwind slate-50) — high-contrast canvas for tablet readability.

Status Accents: Emerald #10B981 (Online / Paid), Amber #F59E0B (Offline / Pending Sync), Rose #F43F5E (Low Stock Alert).

2. App Icon Concept (Android APK & PWA)

Visual Motif: A stylized isometric cube/bracket that doubles as a minimalist open shelf and an abstract capital "S".

Base Plate: Rounded squircle with a deep obsidian/slate gradient (#0F172A to #1E293B).

Foreground: Crisp, dual-tone geometric lines in electric cyan and pure white representing stacked modular shelves.

Look & Feel: Distinct on an Android home screen or tablet dock, crisp at small favicon sizes (32×32) and native icon resolutions (1024×1024).
Establish the global brand identity and visual theme for our retail POS and inventory app called "ShelfOS":

1. Brand Direction:

   - App Name: ShelfOS

   - Style: Minimal, data-dense, professional operating system aesthetic for physical retail counters.

   - Primary Surface: Clean off-white (#F8FAFC) with pure white (#FFFFFF) container cards and subtle border outlines (border-slate-200).

   - Brand Dark: Deep Slate (#0F172A) for sidebar navigation and high-priority headers.

   - Primary Accent: Vivid Cyan/Sky (#0EA5E9) for primary action buttons, checkout triggers, and active tabs.

2. Global Header & App Bar Component:

   - Top-left: A custom SVG logo badge for "ShelfOS" (a minimalist dual-layer shelf icon inside a rounded slate square) followed by the bold wordmark "ShelfOS".

   - Top-center: Real-time network sync indicator:

     - When online: Small green pulse dot + "Cloud Synced".

     - When offline: Amber badge + "Offline Mode (X queued)".

   - Top-right: Current active role pill toggle ("Cashier" vs "Manager") and current time clock.

3. Typography & UI Tokens:

   - Font: Inter or Plus Jakarta Sans with tabular figures (font-mono for all prices, currency amounts, and receipt quantities to ensure perfect vertical alignment).

   - Currency display: Format all monetary values explicitly as "KES [Amount]" (e.g., KES 1,450.00).

   - Touch Ergonomics: Set min-height 48px for all interactive buttons and keypad inputs to ensure seamless tablet operation.
Build a production-grade, offline-first Point of Sale (POS) and inventory web application called "ShelfOS" for a physical household goods retail store. The app must be fully responsive for both 10-inch touch tablets and desktop PCs, installable as a PWA, and architected for native Android APK wrapping via Capacitor.

### 1. Technology Stack & Local Database Setup
- Frontend: React, Vite, Tailwind CSS, shadcn/ui components, Lucide icons.
- Styling & Brand:
  - Background: Slate-50 (#F8FAFC), Card Surfaces: Pure White (#FFFFFF), Nav/Headers: Deep Slate (#0F172A), Primary Accent: Sky/Cyan-500 (#0EA5E9).
  - High-touch ergonomically sized buttons (min-height 48px) for tablet screens.
  - Formatted currency: Always display amounts as "KES [Amount]" using monospace tabular figures (font-mono).
- Offline Storage & Database (Dexie.js / IndexedDB):
  - Initialize local IndexedDB tables:
    1. `products`: id, name, sku, category, selling_price, cost_price, stock_quantity, min_stock_alert, is_archived.
    2. `orders`: id, local_id, cashier_id, total_amount, payment_method ('cash' | 'mobile_money' | 'card'), split_details (json), status ('completed' | 'refunded'), created_at, synced (boolean).
    3. `order_items`: id, order_id, product_id, product_name, quantity, unit_price, unit_cost.
    4. `shifts`: id, cashier_id, opened_at, closed_at, opening_float, closing_cash_counted, expected_cash, difference, status ('open' | 'closed').
    5. `sync_queue`: id, entity_type, payload, status ('pending' | 'synced'), timestamp.
  - Seed `products` locally with 12 realistic household goods (e.g., "Non-Stick Frying Pan 28cm", "45L Heavy-Duty Storage Box", "Microfiber Spin Mop Set", "12-Piece Ceramic Dinner Set", "Plastic Clothes Pegs 24pk") across categories: Kitchenware, Cleaning, Storage, Home Decor.

### 2. Header & Role Switching Simulation
- Fixed top bar containing:
  - Left: "ShelfOS" brand logo (minimalist shelf icon inside a slate squircle) and bold text.
  - Center: Live Network Status badge:
    - If `navigator.onLine === true` and queue is empty: Green dot + "Online (Synced)".
    - If offline or pending items exist: Amber badge + "Offline Mode (X orders queued for sync)".
  - Right: Shift status indicator (Active Register / No Open Shift) + Role Switcher pill toggle:
    - **Cashier Mode**
    - **Manager Mode** (protected by a mock 4-digit PIN dialog: default "1234").

### 3. POS Register View (/pos)
- Split screen optimized for landscape tablets and desktop:
  - **Left Section (60% width):**
    - Sticky top search bar with autofocus: Instant filter by product name or SKU.
    - Category pills: "All Items", "Kitchenware", "Cleaning", "Storage", "Decor".
    - Product Grid: Clean product cards displaying Name, Category tag, Selling Price in KES, and Stock Level badge (Green if ample, Amber if below `min_stock_alert`, Red if 0 with tap-disabled).
    - Tapping a card adds it to the active ticket (or increments quantity by 1).
  - **Right Section (40% width): Active Cart & Checkout:**
    - Itemized order list showing Name, Price, Quantity controls (+ / - / Trash icon), and line-item total.
    - Order summary calculation: Subtotal, Tax/VAT (16% inclusive breakdown), Total in KES.
    - Payment Tender Selector: Toggle buttons for "Cash", "Mobile Money" (M-Pesa reference input), and "Card".
    - If Cash: Provide quick-tap cash suggestion chips (+500, +1000, +2000, Exact) and a live "Change Due" calculator.
    - Action Buttons: "Clear Ticket" and "Complete Sale (KES X)".

### 4. Offline Checkout & Receipt Engine
- When "Complete Sale" is triggered:
  1. Deduct sold quantities from the local Dexie `products` table immediately.
  2. Save the sale to Dexie `orders` with `synced: false`.
  3. Automatically prompt the **Receipt Modal**:
     - Branded receipt layout with Store Name ("ShelfOS Retail"), Date/Time, Order ID, Cashier Name, line items, payment method, and standard footer ("Thank you for shopping with us! Household goods exchange within 48 hours with receipt").
     - Action 1: **"Download PDF Receipt"** using jsPDF or html2canvas formatted to 80mm thermal receipt dimensions.
     - Action 2: **"Print"** trigger with clean `@media print` CSS targeting 80mm/58mm thermal rolls.
     - Action 3: **"WhatsApp Share"** button generating a prefilled `https://wa.me/?text=...` receipt summary link.
  4. Reset cart for the next customer.

### 5. Shift & Cash Control (/shifts)
- **Start of Day / Shift Open:** Modal prompting the cashier to enter the opening cash float (e.g., KES 3,000) before accessing the register.
- **End of Day / Shift Close:**
  - Cashier enters physical cash counted in the till drawer.
  - The app tallies system-recorded Cash sales, Mobile Money payments, and Card payments.
  - Computes Variance = Actual Cash Counted - (Opening Float + Cash Sales).
  - Provides a printable/downloadable **Daily Shift Summary Report**.

### 6. Inventory Management View (/inventory)
- Accessible only in Manager Mode (or read-only for Cashier without financial data):
  - Data table displaying: SKU, Item Name, Category, Stock on Hand, Cost Price, Selling Price, Gross Margin %, and Actions.
  - Filter by low-stock items or category.
  - Inline or slide-out drawer to **Add Product** or **Edit Product**.
  - Quick Stock Adjustment dialog: Select product, choose reason ("New Delivery", "Customer Return", "Damaged/Broken"), and input `+` or `-` quantity to adjust instantly.
  - CSV Import & Export: Functional button to export current stock to a `.csv` file and a CSV file uploader to bulk-update stock.

### 7. Analytics & Reports Dashboard (/dashboard - Manager Mode Only)
- KPI Metric Cards:
  - Total Revenue Today (KES)
  - Estimated Gross Profit (Revenue minus Cost of Goods Sold)
  - Total Order Count
  - Low Stock SKU Alerts Count
- Charts & Visuals (using Recharts):
  - Bar/Line Chart: 7-day sales revenue trend.
  - Doughnut/Pie Chart: Payment method breakdown (Cash vs Mobile Money vs Card).
  - Table: Top 5 Best-Selling Household Items by units moved.
- Date filter tabs: "Today", "Last 7 Days", "This Month".

### 8. Role Security Constraints
- If current role is **Cashier**:
  - Automatically redirect to `/pos`.
  - Hide `/dashboard` and remove cost price/margin columns from any visible inventory list.
  - Disable product deletion and base retail price editing.
- Switching to **Manager** requires entering the 4-digit PIN ("1234").

Core Brand Palette

RoleColor NameHex CodeTailwind ClassUsagePrimary BrandDeep Slate#0F172Aslate-900Sidebar navigation, top app bar, primary logo background, and authoritative headings.Active AccentElectric Cyan#0EA5E9sky-500Primary CTAs, "Complete Sale" button, active navigation tabs, and selected state rings.Secondary AccentIce Blue#E0F2FEsky-100Soft highlight backgrounds, category pill active states, and focus states.Base CanvasOff-White / Cloud#F8FAFCslate-50Full-screen app background to reduce eye strain compared to harsh 100% white.Card SurfacePure White#FFFFFFwhiteProduct cards, cart drawer, modals, and data tables.Borders & DividersLight Slate#E2E8F0slate-200Card borders, table dividers, and subtle component outlines.

Status & Feedback Colors

FunctionColorHex CodeTailwind ClassMeaningSuccess / OnlineEmerald#10B981emerald-500Online cloud sync status, payment completed, stock level healthy.Warning / OfflineAmber#F59E0Bamber-500Offline mode active (orders queued), low stock threshold alert.Destructive / ErrorRose#F43F5Erose-500Out of stock (zero inventory), order voided, till discrepancy negative.

CSS / Tailwind Config Snippet (for Lovable)

You can tell Lovable to apply these exact CSS variables to your tailwind.config.js or index.css:

CSS

:root {
  --brand-navy: #0f172a;
  --brand-accent: #0ea5e9;
  --brand-accent-light: #e0f2fe;
  --surface-bg: #f8fafc;
  --surface-card: #ffffff;
  --border-subtle: #e2e8f0;
  --status-success: #10b981;
  --status-warning: #f59e0b;
  --status-danger: #f43f5e;
}

An effective logo for a digital retail POS must be hyper-scalable—remaining crisp as a 32×32 favicon, an Android app launcher icon, and on an 80mm black-and-white thermal paper receipt.




The Design Concept: "The Modular S-Shelf"

        ┌──────────────────┐
        │  TOP SHELF       │  (Electric Cyan #0EA5E9)
    ┌───┴──────────────────┘
    │   
    │   [ Negative Space "S" Flow ]
    │   
    └──────────────────┬───┐
        BOTTOM SHELF   │   │  (Deep Slate #0F172A)
        ───────────────┴───┘


Symbolism: Two interlocking modular storage planes that form an abstract "S" through negative space, symbolizing organized shelf inventory and seamless flow (Operating System).

Grid Balance: Built on an 8px architectural grid inside a squircle container.

1. Standalone SVG Logo Mark (React / Web / PWA)

Drop this standalone vector into components/brand/Logo.tsx or save it as logo.svg:




SVG

2. Full Horizontal Lockup (Header & Navigation)

For your Lovable top bar and desktop dashboard navigation:




TypeScript

export const ShelfOSHeaderLogo = () => (
  <div className="flex items-center gap-3 select-none">
    {/* Scaled Icon */}
    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center p-1.5 shadow-sm">
      <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
        <rect x="52" y="52" width="96" height="18" rx="9" fill="#0EA5E9" />
        <rect x="52" y="52" width="18" height="52" rx="9" fill="#0EA5E9" />
        <rect x="52" y="91" width="76" height="18" rx="9" fill="#FFFFFF" />
        <rect x="130" y="91" width="18" height="57" rx="9" fill="#38BDF8" />
        <rect x="74" y="130" width="74" height="18" rx="9" fill="#38BDF8" />
        <circle cx="140" cy="61" r="7" fill="#38BDF8" />
      </svg>
    </div>

    {/* Typography */}
    <div className="flex items-baseline tracking-tight">
      <span className="font-bold text-xl text-slate-900 tracking-tight">Shelf</span>
      <span className="font-extrabold text-xl text-sky-500 tracking-tight ml-0.5">OS</span>
    </div>
  </div>
);


3. Thermal Receipt Monochrome Adaptation (58mm / 80mm)

Thermal printers cannot print gradients or colors. For printed or downloaded PDF receipts, invert the mark into a high-contrast 1-bit black outline:




    ┌───────────────────────────┐
    │       [■■■■■■■■■■■■]      │
    │       [■■]     [■■]       │
    │       [■■■■■■■■■■]        │
    │            [■■]   [■■]    │
    │        [■■■■■■■■■■■■]     │
    │                           │
    │         ShelfOS           │
    │     RECEIPT #100482       │
    └───────────────────────────┘


Render the icon in solid black (#000000) with no fills or shadows so thermal print heads produce a razor-sharp impression without dithering grain.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shelfos.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8acb28b8-cb26-4632-b7f6-7421f5cf4c72).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
