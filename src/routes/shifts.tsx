import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { dateTime, kes } from "@/lib/format";
import { useShelfOS } from "@/lib/shelfos-store";

export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts & Cash Control — ShelfOS" },
      {
        name: "description",
        content: "Open the till with a cash float, count down at close and see the variance against recorded sales.",
      },
      { property: "og:title", content: "Shifts & Cash Control — ShelfOS" },
      { property: "og:description", content: "Cash float, till count and variance reporting for every register shift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { shift } = useShelfOS();
  const [counted, setCounted] = useState("");

  const orders = useLiveQuery(
    async () => (shift ? getDb().orders.where("created_at").above(shift.opened_at).toArray() : []),
    [shift?.opened_at],
    [],
  );

  const sum = (method: string) =>
    (orders ?? []).filter((o) => o.payment_method === method).reduce((s, o) => s + o.total_amount, 0);
  const cashSales = sum("cash");
  const mobileSales = sum("mobile_money");
  const cardSales = sum("card");
  const expected = (shift?.opening_float ?? 0) + cashSales;
  const variance = (Number(counted) || 0) - expected;

  const closeShift = async () => {
    if (!shift?.id) return;
    await getDb().shifts.update(shift.id, {
      closed_at: Date.now(),
      closing_cash_counted: Number(counted) || 0,
      expected_cash: expected,
      difference: variance,
      status: "closed",
    });
    toast.success("Shift closed");
    setCounted("");
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold text-navy">Shift & cash control</h1>

      {!shift ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
          No open shift. Head to the Register to open the till with a cash float.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-bold text-navy">Current shift</h2>
            <Row label="Cashier" value={shift.cashier_id} />
            <Row label="Opened" value={dateTime(shift.opened_at)} />
            <Row label="Opening float" value={kes(shift.opening_float)} />
            <Row label="Cash sales" value={kes(cashSales)} />
            <Row label="Mobile money" value={kes(mobileSales)} />
            <Row label="Card" value={kes(cardSales)} />
            <Row label="Expected in drawer" value={kes(expected)} />
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-bold text-navy">Close the till</h2>
            <div>
              <Label className="text-xs text-muted-foreground">Cash counted in drawer (KES)</Label>
              <Input
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                className="touch-target num text-lg"
              />
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Variance</p>
              <p
                className={`num text-2xl font-bold ${
                  variance === 0 ? "text-success" : variance < 0 ? "text-danger" : "text-warning"
                }`}
              >
                {kes(variance)}
              </p>
            </div>
            <Button className="touch-target w-full" disabled={counted === ""} onClick={closeShift}>
              Close shift
            </Button>
            <Button variant="outline" className="touch-target w-full" onClick={() => window.print()}>
              Print daily summary
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold text-navy">{value}</span>
    </div>
  );
}
