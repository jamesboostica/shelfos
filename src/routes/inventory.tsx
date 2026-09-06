import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/db";
import { kes } from "@/lib/format";
import { useShelfOS } from "@/lib/shelfos-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — ShelfOS" },
      {
        name: "description",
        content: "Track household goods stock levels, low-stock alerts and shelf pricing offline in KES.",
      },
      { property: "og:title", content: "Inventory — ShelfOS" },
      { property: "og:description", content: "Stock on hand, margins and low-stock alerts for your retail counter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { role } = useShelfOS();
  const products = useLiveQuery(() => getDb().products.where("is_archived").equals(0).toArray(), [], []);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

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
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Stock</th>
              {role === "manager" && <th className="px-4 py-3 text-right">Cost</th>}
              <th className="px-4 py-3 text-right">Price</th>
              {role === "manager" && <th className="px-4 py-3 text-right">Margin</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const margin = ((p.selling_price - p.cost_price) / p.selling_price) * 100;
              const low = p.stock_quantity <= p.min_stock_alert;
              return (
                <tr key={p.id}>
                  <td className="num px-4 py-3 text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td
                    className={cn(
                      "num px-4 py-3 text-right font-bold",
                      p.stock_quantity === 0 ? "text-danger" : low ? "text-warning" : "text-success",
                    )}
                  >
                    {p.stock_quantity}
                  </td>
                  {role === "manager" && <td className="num px-4 py-3 text-right">{kes(p.cost_price)}</td>}
                  <td className="num px-4 py-3 text-right">{kes(p.selling_price)}</td>
                  {role === "manager" && (
                    <td className="num px-4 py-3 text-right">{margin.toFixed(1)}%</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {role !== "manager" && (
        <p className="text-xs text-muted-foreground">
          Cost prices and margins are hidden in Cashier mode.
        </p>
      )}
    </div>
  );
}
