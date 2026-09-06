import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb, type Order } from "@/lib/db";
import { amountOnly, dateTime, kes } from "@/lib/format";
import { useShelfOS } from "@/lib/shelfos-store";

export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts & Cash Control — ShelfOS" },
      {
        name: "description",
        content:
          "Open the till with a cash float, count down at close and see the variance against recorded sales.",
      },
      { property: "og:title", content: "Shifts & Cash Control — ShelfOS" },
      {
        property: "og:description",
        content: "Cash float, till count and variance reporting for every register shift.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { shift, role } = useShelfOS();
  const [counted, setCounted] = useState("");

  const orders = useLiveQuery(
    async () => (shift ? getDb().orders.where("created_at").above(shift.opened_at).toArray() : []),
    [shift?.opened_at],
    [],
  );
  const history = useLiveQuery(
    async () => {
      const all = await getDb().shifts.where("status").equals("closed").toArray();
      return all.sort((a, b) => (b.closed_at ?? 0) - (a.closed_at ?? 0)).slice(0, 10);
    },
    [],
    [],
  );

  const sum = (method: string) =>
    (orders ?? [])
      .filter((o) => o.payment_method === method)
      .reduce((s, o) => s + o.total_amount, 0);
  const cashSales = sum("cash");
  const mobileSales = sum("mobile_money");
  const cardSales = sum("card");
  const totalSales = cashSales + mobileSales + cardSales;
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
    await getDb().sync_queue.add({
      entity_type: "shift_close",
      payload: { shift_id: shift.id, expected, counted: Number(counted) || 0, variance },
      status: "pending",
      timestamp: Date.now(),
    });
    toast.success("Shift closed");
    setCounted("");
  };

  const dailySummaryPdf = () => {
    if (!shift) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 18;
    doc.setFont("helvetica", "bold").setFontSize(16);
    doc.text("ShelfOS — Daily Shift Summary", 14, y);
    y += 8;
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(`Cashier: ${shift.cashier_id}`, 14, y);
    y += 5;
    doc.text(`Shift opened: ${dateTime(shift.opened_at)}`, 14, y);
    y += 5;
    doc.text(`Report generated: ${dateTime(Date.now())}`, 14, y);
    y += 8;
    doc.line(14, y, 196, y);
    y += 8;

    const line = (label: string, value: string, bold = false) => {
      doc.setFont(bold ? "helvetica" : "helvetica", bold ? "bold" : "normal");
      doc.text(label, 14, y);
      doc.text(`KES ${value}`, 196, y, { align: "right" });
      y += 6;
    };

    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text("Sales by payment method", 14, y);
    y += 7;
    doc.setFontSize(10);
    line("Cash", amountOnly(cashSales));
    line("Mobile money (M-Pesa)", amountOnly(mobileSales));
    line("Card", amountOnly(cardSales));
    line("Total sales", amountOnly(totalSales), true);
    y += 4;

    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text("Cash drawer reconciliation", 14, y);
    y += 7;
    doc.setFontSize(10);
    line("Opening float", amountOnly(shift.opening_float));
    line("Cash sales", amountOnly(cashSales));
    line("Expected in drawer", amountOnly(expected), true);
    line("Counted in drawer", amountOnly(Number(counted) || 0));
    line("Variance", amountOnly(variance), true);
    y += 4;

    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(`Orders in shift: ${(orders ?? []).length}`, 14, y);
    y += 8;
    doc.setFont("helvetica", "normal").setFontSize(9);
    (orders ?? [])
      .slice()
      .sort((a: Order, b: Order) => a.created_at - b.created_at)
      .forEach((o) => {
        if (y > 280) {
          doc.addPage();
          y = 18;
        }
        doc.text(`${o.local_id}  ${dateTime(o.created_at)}  ${o.payment_method}`, 14, y);
        doc.text(`KES ${amountOnly(o.total_amount)}`, 196, y, { align: "right" });
        y += 5;
      });

    doc.save(`shelfos-shift-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Daily summary downloaded");
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold text-navy">Shift &amp; cash control</h1>

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
            <Row label="Total sales" value={kes(totalSales)} />
            <Row label="Orders" value={String((orders ?? []).length)} />
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
              <p className="mt-1 text-xs text-muted-foreground">
                {variance === 0
                  ? "Drawer balances exactly."
                  : variance < 0
                    ? "Short — less cash than expected."
                    : "Over — more cash than expected."}
              </p>
            </div>
            <Button className="touch-target w-full" disabled={counted === ""} onClick={closeShift}>
              Close shift
            </Button>
            <Button variant="outline" className="touch-target w-full" onClick={dailySummaryPdf}>
              Download daily summary (PDF)
            </Button>
            <Button
              variant="outline"
              className="touch-target w-full"
              onClick={() => window.print()}
            >
              Print daily summary
            </Button>
          </div>
        </div>
      )}

      {role === "manager" && (history ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <h2 className="border-b border-border px-4 py-3 font-bold text-navy">Recent shifts</h2>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3 text-right">Float</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Counted</th>
                <th className="px-4 py-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(history ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-semibold text-navy">{s.cashier_id}</td>
                  <td className="num px-4 py-3 text-muted-foreground">
                    {s.closed_at ? dateTime(s.closed_at) : "—"}
                  </td>
                  <td className="num px-4 py-3 text-right">{kes(s.opening_float)}</td>
                  <td className="num px-4 py-3 text-right">{kes(s.expected_cash ?? 0)}</td>
                  <td className="num px-4 py-3 text-right">{kes(s.closing_cash_counted ?? 0)}</td>
                  <td
                    className={`num px-4 py-3 text-right font-bold ${
                      (s.difference ?? 0) === 0
                        ? "text-success"
                        : (s.difference ?? 0) < 0
                          ? "text-danger"
                          : "text-warning"
                    }`}
                  >
                    {kes(s.difference ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
