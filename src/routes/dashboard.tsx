import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDb, type Order, type OrderItem } from "@/lib/db";
import { kes, startOfDay } from "@/lib/format";
import { ManagerOnly } from "@/components/ManagerOnly";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Reports — ShelfOS Manager Dashboard" },
      {
        name: "description",
        content:
          "Daily, weekly, monthly and yearly revenue, gross profit, margins, payment mix and low-stock alerts for your household goods store.",
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

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABEL: Record<Period, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};

const PERIOD_TREND_LABEL: Record<Period, string> = {
  daily: "Revenue by hour (today)",
  weekly: "Revenue by day (last 7 days)",
  monthly: "Revenue by day (last 30 days)",
  yearly: "Revenue by month (last 12 months)",
};

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday start
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1).getTime();
}

function periodRange(p: Period): { from: number; to: number; prevFrom: number; prevTo: number } {
  const now = Date.now();
  if (p === "daily") {
    const from = startOfDay();
    return { from, to: now, prevFrom: from - 86400000, prevTo: from };
  }
  if (p === "weekly") {
    const from = startOfWeek();
    return { from, to: now, prevFrom: from - 7 * 86400000, prevTo: from };
  }
  if (p === "monthly") {
    const from = startOfMonth();
    const d = new Date();
    return { from, to: now, prevFrom: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), prevTo: from };
  }
  const from = startOfYear();
  const d = new Date();
  return { from, to: now, prevFrom: new Date(d.getFullYear() - 1, 0, 1).getTime(), prevTo: from };
}

function DashboardPage() {
  const orders = useLiveQuery(() => getDb().orders.toArray(), [], [] as Order[]);
  const items = useLiveQuery(() => getDb().order_items.toArray(), [], [] as OrderItem[]);
  const products = useLiveQuery(() => getDb().products.toArray(), [], []);
  const [period, setPeriod] = useState<Period>("daily");

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const i of items ?? []) {
      const list = map.get(i.order_id);
      if (list) list.push(i);
      else map.set(i.order_id, [i]);
    }
    return map;
  }, [items]);

  const stats = (from: number, to: number) => {
    const inRange = (orders ?? []).filter((o) => o.created_at >= from && o.created_at < to);
    const lines = inRange.flatMap((o) => itemsByOrder.get(o.local_id) ?? []);
    const revenue = inRange.reduce((s, o) => s + o.total_amount, 0);
    const cogs = lines.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    const units = lines.reduce((s, i) => s + i.quantity, 0);
    return {
      orders: inRange,
      lines,
      revenue,
      cogs,
      profit: revenue - cogs,
      units,
      count: inRange.length,
      avg: inRange.length ? revenue / inRange.length : 0,
      margin: revenue ? ((revenue - cogs) / revenue) * 100 : 0,
    };
  };

  const range = periodRange(period);
  const current = stats(range.from, range.to);
  const previous = stats(range.prevFrom, range.prevTo);

  const delta = (now: number, before: number) =>
    before === 0 ? (now > 0 ? "New" : "—") : `${now >= before ? "+" : ""}${(((now - before) / before) * 100).toFixed(1)}%`;

  const lowStock = (products ?? []).filter((p) => p.stock_quantity <= p.min_stock_alert);
  const stockValue = (products ?? []).reduce((s, p) => s + p.cost_price * p.stock_quantity, 0);
  const retailValue = (products ?? []).reduce((s, p) => s + p.selling_price * p.stock_quantity, 0);

  const trend = useMemo(() => {
    const bucketRevenue = (from: number, to: number) => {
      const list = (orders ?? []).filter((o) => o.created_at >= from && o.created_at < to);
      const lines = list.flatMap((o) => itemsByOrder.get(o.local_id) ?? []);
      const revenue = list.reduce((s, o) => s + o.total_amount, 0);
      const cogs = lines.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
      return { revenue, profit: revenue - cogs, orders: list.length };
    };

    if (period === "daily") {
      const base = startOfDay();
      return Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, "0")}h`,
        ...bucketRevenue(base + h * 3600000, base + (h + 1) * 3600000),
      }));
    }
    if (period === "weekly" || period === "monthly") {
      const days = period === "weekly" ? 7 : 30;
      return Array.from({ length: days }, (_, idx) => {
        const day = new Date();
        day.setDate(day.getDate() - (days - 1 - idx));
        const from = startOfDay(day);
        return {
          label: day.toLocaleDateString("en-GB", period === "weekly" ? { weekday: "short" } : { day: "2-digit", month: "short" }),
          ...bucketRevenue(from, from + 86400000),
        };
      });
    }
    return Array.from({ length: 12 }, (_, idx) => {
      const d = new Date();
      const month = new Date(d.getFullYear(), d.getMonth() - (11 - idx), 1);
      const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      return {
        label: month.toLocaleDateString("en-GB", { month: "short" }),
        ...bucketRevenue(month.getTime(), next.getTime()),
      };
    });
  }, [period, orders, itemsByOrder]);

  const mix = [
    { name: "Cash", value: sumBy(current.orders, "cash"), fill: "var(--color-brand)" },
    { name: "Mobile Money", value: sumBy(current.orders, "mobile_money"), fill: "var(--color-success)" },
    { name: "Card", value: sumBy(current.orders, "card"), fill: "var(--color-warning)" },
  ].filter((m) => m.value > 0);

  const best = Object.values(
    current.lines.reduce<Record<string, { name: string; units: number; revenue: number; profit: number }>>((acc, i) => {
      const prev = acc[i.product_name] ?? { name: i.product_name, units: 0, revenue: 0, profit: 0 };
      acc[i.product_name] = {
        name: i.product_name,
        units: prev.units + i.quantity,
        revenue: prev.revenue + i.quantity * i.unit_price,
        profit: prev.profit + i.quantity * (i.unit_price - i.unit_cost),
      };
      return acc;
    }, {}),
  )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const byCategory = Object.values(
    current.lines.reduce<Record<string, { name: string; revenue: number }>>((acc, i) => {
      const cat = (products ?? []).find((p) => p.id === i.product_id)?.category ?? "Other";
      acc[cat] = { name: cat, revenue: (acc[cat]?.revenue ?? 0) + i.quantity * i.unit_price };
      return acc;
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Business analytics</h1>
          <p className="text-sm text-muted-foreground">{PERIOD_LABEL[period]} performance vs. the previous period.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="h-11">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={kes(current.revenue)} hint={`${delta(current.revenue, previous.revenue)} vs previous`} />
        <Kpi label="Gross profit" value={kes(current.profit)} hint={`${current.margin.toFixed(1)}% margin`} />
        <Kpi label="Sales count" value={String(current.count)} hint={`${delta(current.count, previous.count)} vs previous`} />
        <Kpi label="Average basket" value={kes(current.avg)} hint={`${current.units} units sold`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cost of goods sold" value={kes(current.cogs)} />
        <Kpi label="Stock at cost" value={kes(stockValue)} />
        <Kpi label="Stock at retail" value={kes(retailValue)} />
        <Kpi label="Low stock alerts" value={String(lowStock.length)} hint={lowStock.slice(0, 2).map((p) => p.name).join(", ") || "All healthy"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 font-bold text-navy">{PERIOD_TREND_LABEL[period]}</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {period === "yearly" ? (
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => kes(v)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-brand)" fill="var(--color-brand)" fillOpacity={0.2} />
                <Area type="monotone" dataKey="profit" name="Gross profit" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.2} />
              </AreaChart>
            ) : period === "monthly" ? (
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={2} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => kes(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-brand)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" name="Gross profit" stroke="var(--color-success)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={period === "daily" ? 1 : 0} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => kes(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Gross profit" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 font-bold text-navy">Payment mix — {PERIOD_LABEL[period].toLowerCase()}</h2>
          <div className="h-64">
            {mix.length === 0 ? (
              <p className="pt-10 text-center text-sm text-muted-foreground">No sales recorded in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {mix.map((m) => (
                      <Cell key={m.name} fill={m.fill} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v: number) => kes(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 font-bold text-navy">Revenue by category</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No category sales in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between">
                    <span className="font-medium text-navy">{c.name}</span>
                    <span className="num font-bold">{kes(c.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-brand"
                      style={{ width: `${Math.max(3, (c.revenue / (byCategory[0]?.revenue || 1)) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="mb-3 font-bold text-navy">Top sellers — {PERIOD_LABEL[period].toLowerCase()}</h2>
        {best.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units moved in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Units</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Gross profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {best.map((b) => (
                  <tr key={b.name}>
                    <td className="py-2 font-medium text-navy">{b.name}</td>
                    <td className="num py-2 text-right">{b.units}</td>
                    <td className="num py-2 text-right">{kes(b.revenue)}</td>
                    <td className="num py-2 text-right font-bold">{kes(b.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function sumBy(orders: Order[], method: string) {
  return orders
    .filter((o) => o.payment_method === method)
    .reduce((s, o) => s + o.total_amount, 0);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
