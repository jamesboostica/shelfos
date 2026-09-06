import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, PackagePlus, Plus, Search, SplitSquareHorizontal, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptModal } from "@/components/ReceiptModal";
import { RegisterPreloader } from "@/components/pos/RegisterPreloader";
import { QuickAddProductDrawer } from "@/components/QuickAddProductDrawer";
import { getDb, type PaymentMethod, type Product } from "@/lib/db";
import { amountOnly, kes, taxBreakdown } from "@/lib/format";
import type { ReceiptData } from "@/lib/receipt";
import { useShelfOS } from "@/lib/shelfos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Register — ShelfOS Offline POS" },
      {
        name: "description",
        content:
          "Ring up household goods sales offline: touch product grid, cash and M-Pesa tendering, instant thermal receipts in KES.",
      },
      { property: "og:title", content: "Register — ShelfOS Offline POS" },
      {
        property: "og:description",
        content: "Tablet-ready checkout with offline-first order queueing and KES receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PosPage,
});

const CATEGORY_PILLS = ["All Items", "Kitchenware", "Cleaning", "Storage", "Home Decor"];

interface CartLine {
  product_id: number;
  name: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  stock: number;
}

function PosPage() {
  const { shift, ready } = useShelfOS();
  const products = useLiveQuery(() => getDb().products.where("is_archived").equals(0).toArray(), [], []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Items");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState(0);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [float, setFloat] = useState("3000");
  const [addOpen, setAddOpen] = useState(false);
  const [split, setSplit] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const [splitMobile, setSplitMobile] = useState(0);
  const [splitCard, setSplitCard] = useState(0);
  const hydrated = ready && (products?.length ?? 0) > 0;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (category === "All Items" || p.category === category) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [products, query, category]);

  const total = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const { net, tax } = taxBreakdown(total);
  const splitTotal = splitCash + splitMobile + splitCard;
  const covered = split ? splitTotal : method === "cash" ? tendered : total;
  const change = Math.max(0, covered - total);
  const shortfall = Math.max(0, total - splitTotal);

  const addToCart = (p: Product) => {
    if (p.stock_quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock_quantity) {
          toast.warning(`Only ${p.stock_quantity} left of ${p.name}`);
          return prev;
        }
        return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          product_id: p.id!,
          name: p.name,
          unit_price: p.selling_price,
          unit_cost: p.cost_price,
          quantity: 1,
          stock: p.stock_quantity,
        },
      ];
    });
  };

  const setQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) =>
          l.product_id === id
            ? { ...l, quantity: Math.min(l.stock, Math.max(0, l.quantity + delta)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );

  const openShift = async () => {
    const opening = Number(float) || 0;
    await getDb().shifts.add({
      cashier_id: shiftCashier,
      opened_at: Date.now(),
      closed_at: null,
      opening_float: opening,
      closing_cash_counted: null,
      expected_cash: null,
      difference: null,
      status: "open",
    });
    toast.success(`Shift opened with float ${kes(opening)}`);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (split && shortfall > 0.01) {
      toast.error(`${kes(shortfall)} still to be paid on this ticket`);
      return;
    }
    if (!split && method === "cash" && tendered < total) {
      toast.error("Cash tendered is less than the total due");
      return;
    }
    const db = getDb();
    const localId = `SO-${Date.now().toString().slice(-8)}`;
    const createdAt = Date.now();
    const effectiveMethod: PaymentMethod = split
      ? splitCash >= splitMobile && splitCash >= splitCard
        ? "cash"
        : splitMobile >= splitCard
          ? "mobile_money"
          : "card"
      : method;
    const cashPaid = split ? splitCash : method === "cash" ? tendered : 0;

    await db.transaction("rw", db.products, db.orders, db.order_items, db.sync_queue, async () => {
      for (const line of cart) {
        const p = await db.products.get(line.product_id);
        if (p) {
          await db.products.update(line.product_id, {
            stock_quantity: Math.max(0, p.stock_quantity - line.quantity),
          });
        }
      }
      await db.orders.add({
        local_id: localId,
        cashier_id: shiftCashier,
        total_amount: total,
        payment_method: effectiveMethod,
        split_details: {
          subtotal: net,
          tax,
          tendered: cashPaid || undefined,
          change: change || undefined,
          reference: reference || undefined,
          is_split: split || undefined,
          cash: split ? splitCash : method === "cash" ? total : undefined,
          mobile_money: split ? splitMobile : method === "mobile_money" ? total : undefined,
          card: split ? splitCard : method === "card" ? total : undefined,
        },
        status: "completed",
        created_at: createdAt,
        synced: 0,
      });
      await db.order_items.bulkAdd(
        cart.map((l) => ({
          order_id: localId,
          product_id: l.product_id,
          product_name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          unit_cost: l.unit_cost,
        })),
      );
      await db.sync_queue.add({
        entity_type: "order",
        entity_id: localId,
        payload: { local_id: localId, total, items: cart.length },
        status: "pending",
        retry_count: 0,
        timestamp: createdAt,
      });
    });

    setReceipt({
      local_id: localId,
      created_at: createdAt,
      cashier_id: shiftCashier,
      items: cart.map((l) => ({ product_name: l.name, quantity: l.quantity, unit_price: l.unit_price })),
      subtotal: net,
      tax,
      total,
      payment_method: effectiveMethod,
      tendered: cashPaid || undefined,
      change: change || undefined,
      reference: reference || undefined,
    });
    setCart([]);
    setTendered(0);
    setReference("");
    setSplit(false);
    setSplitCash(0);
    setSplitMobile(0);
    setSplitCard(0);
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:h-[calc(100vh-104px)] lg:flex-row lg:p-6">
      {/* Catalogue */}
      <section className="flex min-h-0 flex-col gap-3 lg:w-3/5">
        <div className="sticky top-[104px] z-20 space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan or search by item name or SKU…"
              className="touch-target pl-9 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_PILLS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  category === c
                    ? "border-brand bg-brand-soft text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 gap-3 overflow-y-auto pb-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const out = p.stock_quantity === 0;
            const low = !out && p.stock_quantity <= p.min_stock_alert;
            return (
              <button
                key={p.id}
                disabled={out}
                onClick={() => addToCart(p)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-all",
                  out
                    ? "cursor-not-allowed opacity-60"
                    : "hover:-translate-y-0.5 hover:border-brand active:translate-y-0",
                )}
              >
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {p.category}
                </span>
                <span className="text-sm font-semibold leading-snug text-navy">{p.name}</span>
                <span className="num text-xs text-muted-foreground">{p.sku}</span>
                <div className="mt-auto flex w-full items-end justify-between pt-2">
                  <span className="num text-base font-bold text-navy">{kes(p.selling_price)}</span>
                  <span
                    className={cn(
                      "num rounded-full px-2 py-0.5 text-[11px] font-bold",
                      out
                        ? "bg-danger-soft text-danger"
                        : low
                          ? "bg-warning-soft text-warning"
                          : "bg-success-soft text-success",
                    )}
                  >
                    {out ? "Out of stock" : `${p.stock_quantity} in stock`}
                  </span>
                </div>
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No items match this search.
            </p>
          )}
        </div>
      </section>

      {/* Ticket */}
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-panel lg:w-2/5">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-bold text-navy">Active ticket</h2>
          <span className="num text-xs text-muted-foreground">
            {cart.reduce((s, l) => s + l.quantity, 0)} items
          </span>
        </div>

        <div className="min-h-[120px] flex-1 overflow-y-auto divide-y divide-border">
          {cart.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tap products to start a sale.
            </p>
          )}
          {cart.map((l) => (
            <div key={l.product_id} className="flex items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{l.name}</p>
                <p className="num text-xs text-muted-foreground">{kes(l.unit_price)} each</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => setQty(l.product_id, -1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="num w-8 text-center text-sm font-bold">{l.quantity}</span>
                <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => setQty(l.product_id, 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <span className="num w-24 text-right text-sm font-bold text-navy">
                {amountOnly(l.unit_price * l.quantity)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-danger"
                onClick={() => setQty(l.product_id, -l.quantity)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border bg-background/60 p-4">
          <div className="num space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal (excl. VAT)</span>
              <span>{amountOnly(net)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT 16% (inclusive)</span>
              <span>{amountOnly(tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-navy">
              <span>Total</span>
              <span>{kes(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["cash", "mobile_money", "card"] as PaymentMethod[]).map((m) => (
              <Button
                key={m}
                variant={method === m ? "default" : "outline"}
                className="touch-target text-xs font-semibold"
                onClick={() => setMethod(m)}
              >
                {m === "cash" ? "Cash" : m === "mobile_money" ? "Mobile Money" : "Card"}
              </Button>
            ))}
          </div>

          {method === "mobile_money" && (
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa transaction reference"
              className="touch-target num"
            />
          )}

          {method === "cash" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2000].map((v) => (
                  <Button
                    key={v}
                    variant="outline"
                    className="touch-target num flex-1"
                    onClick={() => setTendered((t) => t + v)}
                  >
                    +{v}
                  </Button>
                ))}
                <Button variant="outline" className="touch-target flex-1" onClick={() => setTendered(total)}>
                  Exact
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Cash tendered</Label>
                  <Input
                    inputMode="decimal"
                    value={tendered || ""}
                    onChange={(e) => setTendered(Number(e.target.value) || 0)}
                    className="touch-target num"
                  />
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <p className="text-xs text-muted-foreground">Change due</p>
                  <p className="num text-lg font-bold text-success">{kes(change)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="touch-target flex-1"
              onClick={() => {
                setCart([]);
                setTendered(0);
              }}
            >
              Clear ticket
            </Button>
            <Button className="touch-target flex-[2] text-base font-bold" disabled={cart.length === 0} onClick={completeSale}>
              Complete Sale ({kes(total)})
            </Button>
          </div>
        </div>
      </aside>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />

      <Dialog open={!shift}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand" /> Open the register
            </DialogTitle>
            <DialogDescription>
              Count the cash in the drawer and enter the opening float before selling.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs text-muted-foreground">Opening float (KES)</Label>
            <Input
              inputMode="decimal"
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="touch-target num text-lg"
            />
          </div>
          <Button className="touch-target w-full" onClick={openShift}>
            Start shift
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const shiftCashier = "Amina W.";
