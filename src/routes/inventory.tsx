import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIES, getDb, type Product } from "@/lib/db";
import { kes } from "@/lib/format";
import { useShelfOS } from "@/lib/shelfos-store";
import { ManagerOnly } from "@/components/ManagerOnly";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — ShelfOS" },
      {
        name: "description",
        content:
          "Track household goods stock levels, low-stock alerts and shelf pricing offline in KES.",
      },
      { property: "og:title", content: "Inventory — ShelfOS" },
      {
        property: "og:description",
        content: "Stock on hand, margins and low-stock alerts for your retail counter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerOnly area="Inventory">
      <InventoryPage />
    </ManagerOnly>
  ),
});

type Draft = {
  id?: number | undefined;
  name: string;
  sku: string;
  category: string;
  selling_price: string;
  cost_price: string;
  stock_quantity: string;
  min_stock_alert: string;
};

const emptyDraft: Draft = {
  name: "",
  sku: "",
  category: CATEGORIES[0],
  selling_price: "",
  cost_price: "",
  stock_quantity: "",
  min_stock_alert: "",
};

function InventoryPage() {
  const { role } = useShelfOS();
  const products = useLiveQuery(
    () => getDb().products.where("is_archived").equals(0).toArray(),
    [],
    [],
  );
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adjust, setAdjust] = useState<{ product: Product; delta: string; reason: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () =>
      (products ?? []).filter(
        (p) =>
          (!lowOnly || p.stock_quantity <= p.min_stock_alert) &&
          (query.trim() === "" ||
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku.toLowerCase().includes(query.toLowerCase())),
      ),
    [products, query, lowOnly],
  );

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.sku.trim()) {
      toast.error("Item name and SKU are required");
      return;
    }
    const record = {
      name: draft.name.trim(),
      sku: draft.sku.trim().toUpperCase(),
      category: draft.category,
      selling_price: Number(draft.selling_price) || 0,
      cost_price: Number(draft.cost_price) || 0,
      stock_quantity: Number(draft.stock_quantity) || 0,
      min_stock_alert: Number(draft.min_stock_alert) || 0,
      is_archived: 0,
    };
    const db = getDb();
    if (draft.id) {
      await db.products.update(draft.id, record);
      await db.sync_queue.add({
        entity_type: "product_update",
        payload: { id: draft.id, ...record },
        status: "pending",
        timestamp: Date.now(),
      });
      toast.success("Item updated");
    } else {
      const id = await db.products.add(record as Product);
      await db.sync_queue.add({
        entity_type: "product_create",
        payload: { id, ...record },
        status: "pending",
        timestamp: Date.now(),
      });
      toast.success("Item added");
    }
    setDraft(null);
  };

  const saveAdjustment = async () => {
    if (!adjust?.product.id) return;
    const delta = Number(adjust.delta);
    if (!delta) {
      toast.error("Enter a non-zero quantity");
      return;
    }
    const next = Math.max(0, adjust.product.stock_quantity + delta);
    const db = getDb();
    await db.products.update(adjust.product.id, { stock_quantity: next });
    await db.sync_queue.add({
      entity_type: "stock_adjustment",
      payload: {
        product_id: adjust.product.id,
        delta,
        reason: adjust.reason || "Manual adjustment",
        new_quantity: next,
      },
      status: "pending",
      timestamp: Date.now(),
    });
    toast.success(`${adjust.product.name} set to ${next} units`);
    setAdjust(null);
  };

  const exportCsv = () => {
    const header = [
      "sku",
      "name",
      "category",
      "subcategory",
      "cost_price",
      "selling_price",
      "stock_quantity",
      "min_stock_alert",
    ];
    const lines = (products ?? []).map((p) =>
      [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.subcategory ?? "",
        p.cost_price,
        p.selling_price,
        p.stock_quantity,
        p.min_stock_alert,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shelfos-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const [head, ...body] = text.trim().split(/\r?\n/);
    if (!head) return;
    const cols = head.split(",").map((c) => c.trim().toLowerCase());
    const idx = (key: string) => cols.indexOf(key);
    const db = getDb();
    let created = 0;
    let updated = 0;

    for (const line of body) {
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) =>
        c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim(),
      );
      if (!cells) continue;
      const sku = (cells[idx("sku")] ?? "").toUpperCase();
      if (!sku) continue;
      const record = {
        name: cells[idx("name")] ?? sku,
        sku,
        category: cells[idx("category")] || CATEGORIES[0],
        subcategory: cells[idx("subcategory")] || undefined,
        cost_price: Number(cells[idx("cost_price")]) || 0,
        selling_price: Number(cells[idx("selling_price")]) || 0,
        stock_quantity: Number(cells[idx("stock_quantity")]) || 0,
        min_stock_alert: Number(cells[idx("min_stock_alert")]) || 0,
        is_archived: 0,
      };
      const existing = await db.products.where("sku").equals(sku).first();
      if (existing?.id) {
        await db.products.update(existing.id, record);
        updated += 1;
      } else {
        await db.products.add(record as Product);
        created += 1;
      }
    }
    toast.success(`Import complete: ${created} added, ${updated} updated`);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-navy">Inventory</h1>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item or SKU…"
          className="touch-target max-w-xs"
        />
        <Button
          variant={lowOnly ? "default" : "outline"}
          className="touch-target"
          onClick={() => setLowOnly((v) => !v)}
        >
          Low stock only
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="touch-target" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            className="touch-target"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
              e.target.value = "";
            }}
          />
          <Button className="touch-target" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="mr-2 h-4 w-4" /> Add item
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const margin = p.selling_price
                ? ((p.selling_price - p.cost_price) / p.selling_price) * 100
                : 0;
              const low = p.stock_quantity <= p.min_stock_alert;
              return (
                <tr key={p.id}>
                  <td className="num px-4 py-3 text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.category}
                    {p.subcategory && (
                      <span className="block text-xs text-muted-foreground/70">{p.subcategory}</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "num px-4 py-3 text-right font-bold",
                      p.stock_quantity === 0 ? "text-danger" : low ? "text-warning" : "text-success",
                    )}
                  >
                    {p.stock_quantity}
                  </td>
                  <td className="num px-4 py-3 text-right">{kes(p.cost_price)}</td>
                  <td className="num px-4 py-3 text-right">{kes(p.selling_price)}</td>
                  <td className="num px-4 py-3 text-right">{margin.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="touch-target"
                        onClick={() => setAdjust({ product: p, delta: "", reason: "" })}
                      >
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="touch-target"
                        onClick={() =>
                          setDraft({
                            id: p.id,
                            name: p.name,
                            sku: p.sku,
                            category: p.category,
                            selling_price: String(p.selling_price),
                            cost_price: String(p.cost_price),
                            stock_quantity: String(p.stock_quantity),
                            min_stock_alert: String(p.min_stock_alert),
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No items match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Item name" className="sm:col-span-2">
                <Input
                  className="touch-target"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="SKU">
                <Input
                  className="touch-target num"
                  value={draft.sku}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <select
                  className="touch-target w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cost price (KES)">
                <Input
                  inputMode="decimal"
                  className="touch-target num"
                  value={draft.cost_price}
                  onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
                />
              </Field>
              <Field label="Selling price (KES)">
                <Input
                  inputMode="decimal"
                  className="touch-target num"
                  value={draft.selling_price}
                  onChange={(e) => setDraft({ ...draft, selling_price: e.target.value })}
                />
              </Field>
              <Field label="Stock on hand">
                <Input
                  inputMode="numeric"
                  className="touch-target num"
                  value={draft.stock_quantity}
                  onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
                />
              </Field>
              <Field label="Low-stock alert at">
                <Input
                  inputMode="numeric"
                  className="touch-target num"
                  value={draft.min_stock_alert}
                  onChange={(e) => setDraft({ ...draft, min_stock_alert: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="touch-target" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button className="touch-target" onClick={saveDraft}>
              Save item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjust !== null} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock adjustment</DialogTitle>
          </DialogHeader>
          {adjust && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {adjust.product.name} — currently{" "}
                <span className="num font-bold text-navy">{adjust.product.stock_quantity}</span>{" "}
                units.
              </p>
              <Field label="Change in units (use -3 to remove)">
                <Input
                  inputMode="numeric"
                  className="touch-target num text-lg"
                  value={adjust.delta}
                  onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })}
                />
              </Field>
              <Field label="Reason">
                <Input
                  className="touch-target"
                  placeholder="Delivery, damage, stock count…"
                  value={adjust.reason}
                  onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="touch-target" onClick={() => setAdjust(null)}>
              Cancel
            </Button>
            <Button className="touch-target" onClick={saveAdjustment}>
              Apply adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
