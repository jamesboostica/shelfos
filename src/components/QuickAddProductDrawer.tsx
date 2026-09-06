import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORIES, getDb } from "@/lib/db";
import { useShelfOS } from "@/lib/shelfos-store";
import { cn } from "@/lib/utils";

const blank = {
  name: "",
  category: CATEGORIES[0] as string,
  sku: "",
  cost_price: "",
  selling_price: "",
  stock_quantity: "0",
  min_stock_alert: "5",
};

function autoSku(category: string) {
  const prefix = category.slice(0, 3).toUpperCase();
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function QuickAddProductDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { role } = useShelfOS();
  const [form, setForm] = useState({ ...blank });
  const [again, setAgain] = useState(true);

  const set = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !Number(form.selling_price)) {
      toast.error("Item name and selling price are required");
      return;
    }
    await getDb().products.add({
      name: form.name.trim(),
      sku: (form.sku.trim() || autoSku(form.category)).toUpperCase(),
      category: form.category,
      selling_price: Number(form.selling_price) || 0,
      cost_price: Number(form.cost_price) || 0,
      stock_quantity: Number(form.stock_quantity) || 0,
      min_stock_alert: Number(form.min_stock_alert) || 5,
      is_archived: 0,
    });
    toast.success(`${form.name.trim()} added to the catalogue`);
    setForm({ ...blank });
    if (!again) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-brand" /> Add item to shelf
          </SheetTitle>
          <SheetDescription>
            Stock new arrivals without leaving the counter. Items appear in the register instantly.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div>
            <Label className="text-xs text-muted-foreground">Item name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Non-Stick Frying Pan 28cm"
              className="touch-target"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => set("category", c)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-semibold",
                    form.category === c
                      ? "border-brand bg-brand-soft text-accent-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <Input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Or type a new category"
              className="touch-target mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">SKU (auto if blank)</Label>
              <Input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder={autoSku(form.category)}
                className="touch-target num"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Cost price (KES){role !== "manager" && " — hidden"}
              </Label>
              <Input
                inputMode="decimal"
                type={role === "manager" ? "text" : "password"}
                disabled={role !== "manager"}
                value={form.cost_price}
                onChange={(e) => set("cost_price", e.target.value)}
                className="touch-target num"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Selling price (KES)</Label>
              <Input
                inputMode="decimal"
                value={form.selling_price}
                onChange={(e) => set("selling_price", e.target.value)}
                className="touch-target num"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Opening stock</Label>
              <Input
                inputMode="numeric"
                value={form.stock_quantity}
                onChange={(e) => set("stock_quantity", e.target.value)}
                className="touch-target num"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Low-stock alert</Label>
              <Input
                inputMode="numeric"
                value={form.min_stock_alert}
                onChange={(e) => set("min_stock_alert", e.target.value)}
                className="touch-target num"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={again} onCheckedChange={(c) => setAgain(c === true)} />
            Add another item immediately after saving
          </label>

          <Button className="touch-target w-full text-base font-bold" onClick={save}>
            Save item
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
