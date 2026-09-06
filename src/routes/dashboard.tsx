import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDb } from "@/lib/db";
import { kes, startOfDay } from "@/lib/format";
import { ManagerOnly } from "@/components/ManagerOnly";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Reports — ShelfOS Manager Dashboard" },
      {
        name: "description",
        content: "Daily revenue, gross profit, payment mix and low-stock alerts for your household goods store.",
      },
      { property: "og:title", content: "Reports — ShelfOS Manager Dashboard" },
      { property: "og:description", content: "Revenue, profit and stock insights for physical retail counters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerOnly area="Reports">
      <DashboardPage />
    </ManagerOnly>
  ),
});

function DashboardPage() {
  const orders = useLiveQuery(() => getDb().orders.toArray(), [], []);
  const items = useLiveQuery(() => getDb().order_items.toArray(), [], []);
  const products = useLiveQuery(() => getDb().products.toArray(), [], []);

  const today = startOfDay();
  const todays = (orders ?? []).filter((o) => o.created_at >= today);
  const todayIds = new Set(todays.map((o) => o.local_id));
  const todayItems = (items ?? []).filter((i) => todayIds.has(i.order_id));
  const revenue = todays.reduce((s, o) => s + o.total_amount, 0);
  const cogs = todayItems.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
  const lowStock = (products ?? []).filter((p) => p.stock_quantity <= p.min_stock_alert).length;

  const trend = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - idx));
    const from = startOfDay(day);
    const to = from + 86400000;
    return {
      day: day.toLocaleDateString("en-GB", { weekday: "short" }),
      revenue: (orders ?? []).filter((o) => o.created_at >= from && o.created_at < to).reduce((s, o) => s + o.total_amount, 0),
    };
  });

  const mix = [
    { name: "Cash", value: sumBy(orders ?? [], "cash"), fill: "var(--color-brand)" },
    { name: "Mobile Money", value: sumBy(orders ?? [], "mobile_money"), fill: "var(--color-success)" },
    { name: "Card", value: sumBy(orders ?? [], "card"), fill: "var(--color-warning)" },
  ].filter((m) => m.value > 0);

  const best = Object.values(
    todayItems.reduce<Record<string, { name: string; units: number }>>((acc, i) => {
      acc[i.product_name] = { name: i.product_name, units: (acc[i.product_name]?.units ?? 0) + i.quantity };
      return acc;
    }, {}),
  )
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold text-navy">Today at a glance</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue today" value={kes(revenue)} />
        <Kpi label="Est. gross profit" value={kes(revenue - cogs)} />
        <Kpi label="Orders today" value={String(todays.length)} />
        <Kpi label="Low stock alerts" value={String(lowStock)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 font-bold text-navy">7-day revenue</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => kes(v)} />
                <Bar dataKey="revenue" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 font-bold text-navy">Payment mix</h2>
          <div className="h-64">
            {mix.length === 0 ? (
              <p className="pt-10 text-center text-sm text-muted-foreground">No sales recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {mix.map((m) => (
                      <Cell key={m.name} fill={m.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => kes(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 font-bold text-navy">Top sellers today</h2>
        {best.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units moved yet today.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {best.map((b) => (
              <li key={b.name} className="flex justify-between py-2">
                <span className="font-medium text-navy">{b.name}</span>
                <span className="num font-bold">{b.units} units</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function sumBy(orders: { payment_method: string; total_amount: number }[], method: string) {
  return orders.filter((o) => o.payment_method === method).reduce((s, o) => s + o.total_amount, 0);
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-1 text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}
