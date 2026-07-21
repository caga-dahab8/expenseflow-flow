import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryHex } from "@/components/category-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinor } from "@/lib/financial-data";
import { defaultReportRange, useReportData, type ReportData } from "@/lib/reports-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ExpenseFlow" },
      { name: "description", content: "Live insights into workspace spending patterns." },
    ],
  }),
  component: AnalyticsPage,
});

function Heatmap({
  data,
  currency,
  end,
}: {
  data: ReportData["daily"];
  currency: string;
  end: string;
}) {
  const values = new Map(data.map((item) => [item.key, item.amountMinor]));
  const endDate = new Date(`${end}T12:00:00Z`);
  const endDay = (endDate.getUTCDay() + 6) % 7;
  const firstMonday = new Date(endDate);
  firstMonday.setUTCDate(firstMonday.getUTCDate() - endDay - 19 * 7);
  const cells = Array.from({ length: 140 }, (_, index) => {
    const date = new Date(firstMonday);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { key, value: values.get(key) ?? 0 };
  });
  const max = Math.max(1, ...cells.map((item) => item.value));
  const money = (value: number) => formatMoneyMinor(value, currency);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid flex-1 grid-flow-col auto-cols-fr gap-1">
        {Array.from({ length: 20 }, (_, week) => (
          <div key={week} className="grid grid-rows-7 gap-1">
            {cells.slice(week * 7, week * 7 + 7).map((item) => (
              <div
                key={item.key}
                className="aspect-square rounded-[3px]"
                style={{
                  backgroundColor: `rgba(37, 99, 235, ${item.value ? 0.12 + (item.value / max) * 0.88 : 0.06})`,
                }}
                title={`${item.key}: ${money(item.value)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const range = defaultReportRange();
  const report = useReportData(range);
  const data = report.data;

  if (report.isPending || !data)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  if (report.isError)
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="font-medium text-destructive">Analytics could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{report.error.message}</p>
          <Button className="mt-4" onClick={() => report.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  const money = (value: number) => formatMoneyMinor(value, data.currency);
  const compactMoney = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: data.currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value / 100);
  const topCategory = data.categories[0];
  const biggestExpense = data.topExpenses[0];
  const monthly = data.monthly.map((item) => ({
    ...item,
    label: new Date(`${item.key}-01T12:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Live insights from the last twelve months of workspace expenses."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Top category</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: categoryHex[topCategory?.color ?? "slate"] ?? categoryHex.slate,
                }}
              />
              <span className="text-lg font-semibold">
                {topCategory?.name ?? "No spending yet"}
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold">{money(topCategory?.totalMinor ?? 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {topCategory?.transactionCount ?? 0} transactions
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Average daily spending
            </p>
            <p className="mt-3 text-2xl font-semibold">{money(data.summary.averageDailyMinor)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across the selected twelve-month window
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Largest expense
            </p>
            <p className="mt-3 truncate text-lg font-semibold">
              {biggestExpense?.title ?? "No spending yet"}
            </p>
            <p className="mt-1 text-2xl font-semibold">{money(biggestExpense?.amountMinor ?? 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {biggestExpense?.category.name ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Monthly spending trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="analytics-expenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(220 90% 56%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(220 90% 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={compactMoney}
                />
                <RTooltip formatter={(value: number) => money(value)} />
                <Area
                  type="monotone"
                  dataKey="amountMinor"
                  name="Spending"
                  stroke="hsl(220 90% 56%)"
                  fill="url(#analytics-expenses)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Category share</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data.categories.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="totalMinor"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.categories.map((item) => (
                      <Cell key={item.id} fill={categoryHex[item.color] ?? categoryHex.slate} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(value: number) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No expenses yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Spending by weekday</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weekdays}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={compactMoney} />
              <RTooltip formatter={(value: number) => money(value)} />
              <Bar
                dataKey="amountMinor"
                name="Spending"
                fill="hsl(220 90% 56%)"
                radius={[7, 7, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Spending heatmap</CardTitle>
          <p className="text-xs text-muted-foreground">Last 20 weeks of daily activity</p>
        </CardHeader>
        <CardContent>
          <Heatmap data={data.daily} currency={data.currency} end={range.end} />
          <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span>Less</span>
            {[0.1, 0.25, 0.45, 0.7, 0.95].map((opacity) => (
              <span
                key={opacity}
                className="h-3 w-3 rounded-[3px]"
                style={{ backgroundColor: `rgba(37, 99, 235, ${opacity})` }}
              />
            ))}
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
