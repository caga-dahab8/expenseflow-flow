import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  categoryTotals,
  currentMonthExpenses,
  expenses,
  formatCurrency,
  heatmapData,
  monthlySeries,
} from "@/lib/mock-data";
import { categoryHex } from "@/components/category-badge";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ExpenseFlow" },
      { name: "description", content: "Deep insights into your spending patterns." },
    ],
  }),
  component: AnalyticsPage,
});

function Heatmap() {
  const data = heatmapData();
  const max = Math.max(...data.map((d) => d.value));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground">
        {days.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid flex-1 grid-flow-col auto-cols-fr gap-1">
        {Array.from({ length: 20 }).map((_, w) => (
          <div key={w} className="grid grid-rows-7 gap-1">
            {Array.from({ length: 7 }).map((_, d) => {
              const v = data.find((x) => x.week === w && x.day === d)?.value ?? 0;
              const op = 0.08 + (v / max) * 0.92;
              return (
                <div
                  key={d}
                  className="aspect-square rounded-[3px]"
                  style={{ backgroundColor: `rgba(37, 99, 235, ${op})` }}
                  title={formatCurrency(v)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const totals = categoryTotals().sort((a, b) => b.total - a.total);
  const top = totals[0];
  const daysSpan = 180;
  const avgDaily = expenses.reduce((s, e) => s + e.amount, 0) / daysSpan;
  const monthTotal = currentMonthExpenses().reduce((s, e) => s + e.amount, 0);
  const lastMonth = monthlySeries[new Date().getMonth() - 1 < 0 ? 11 : new Date().getMonth() - 1].expenses;
  const delta = monthTotal - lastMonth;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Understand where your money goes and how it changes over time."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Top category</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryHex[top.color] }} />
              <div className="text-lg font-semibold">{top.name}</div>
            </div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(top.total)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{top.count} transactions</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Average daily expense</div>
            <div className="mt-3 text-2xl font-semibold">{formatCurrency(avgDaily)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Based on last 180 days of activity</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly comparison</div>
            <div className="mt-3 text-2xl font-semibold">{formatCurrency(monthTotal)}</div>
            <p className={`mt-1 text-xs ${delta >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {delta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(delta))} vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Income vs expenses</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(220 90% 56%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(220 90% 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="income" stroke="hsl(160 84% 39%)" fill="url(#inc)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="hsl(220 90% 56%)" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Category share</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totals} dataKey="total" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2} strokeWidth={0}>
                  {totals.map((c) => (<Cell key={c.id} fill={categoryHex[c.color]} />))}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Monthly comparison</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="expenses" fill="hsl(220 90% 56%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Savings trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries.map((m) => ({ ...m, net: m.income - m.expenses }))}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="net" stroke="hsl(160 84% 39%)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Spending heatmap</CardTitle>
          <p className="text-xs text-muted-foreground">Last 20 weeks of daily activity</p>
        </CardHeader>
        <CardContent>
          <Heatmap />
          <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span>Less</span>
            {[0.1, 0.25, 0.45, 0.7, 0.95].map((op) => (
              <span key={op} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `rgba(37, 99, 235, ${op})` }} />
            ))}
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
