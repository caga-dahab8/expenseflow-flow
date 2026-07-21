import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import {
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
import { toast } from "sonner";
import { categoryHex } from "@/components/category-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoneyMinor } from "@/lib/financial-data";
import {
  defaultReportRange,
  downloadReportCsv,
  useReportData,
  type ReportRange,
} from "@/lib/reports-data";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — ExpenseFlow" },
      { name: "description", content: "Live workspace spending and budget reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [range, setRange] = useState<ReportRange>(defaultReportRange);
  const [exporting, setExporting] = useState(false);
  const report = useReportData(range);
  const data = report.data;

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReportCsv(range);
      toast.success("CSV report downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report download failed");
    } finally {
      setExporting(false);
    }
  }

  if (report.isPending || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (report.isError) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="font-medium text-destructive">Report data could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{report.error.message}</p>
          <Button className="mt-4" onClick={() => report.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const money = (value: number) => formatMoneyMinor(value, data.currency);
  const compactMoney = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: data.currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value / 100);
  const monthly = data.monthly.map((item) => ({
    ...item,
    label: new Date(`${item.key}-01T12:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }));
  const totalBudget = data.budgets.reduce((sum, item) => sum + item.amountMinor, 0);
  const totalBudgetSpent = data.budgets.reduce((sum, item) => sum + item.spentMinor, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Live spending reports for the active workspace."
        actions={
          <Button onClick={exportCsv} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Export CSV
          </Button>
        }
      />

      <Card className="rounded-xl">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <label className="grid gap-1.5 text-sm font-medium">
            From
            <Input
              type="date"
              value={range.start}
              max={range.end}
              onChange={(event) =>
                setRange((current) => ({ ...current, start: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            To
            <Input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
            />
          </label>
          <p className="pb-2 text-xs text-muted-foreground">
            All totals below use this date range.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total spending", money(data.summary.totalMinor), ReceiptText],
          ["Transactions", data.summary.transactionCount.toLocaleString(), TrendingUp],
          ["Average expense", money(data.summary.averageMinor), ReceiptText],
          ["Budget remaining", money(totalBudget - totalBudgetSpent), Wallet],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)} className="rounded-xl">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {String(label)}
                </p>
                <p className="mt-2 text-2xl font-semibold">{String(value)}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">Monthly trend</TabsTrigger>
          <TabsTrigger value="weekday">By weekday</TabsTrigger>
          <TabsTrigger value="category">By category</TabsTrigger>
          <TabsTrigger value="budget">Budget vs actual</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Monthly spending</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={compactMoney}
                  />
                  <RTooltip formatter={(value: number) => money(value)} />
                  <Line
                    type="monotone"
                    dataKey="amountMinor"
                    name="Spending"
                    stroke="hsl(220 90% 56%)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekday" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Spending by weekday</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekdays}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={compactMoney}
                  />
                  <RTooltip formatter={(value: number) => money(value)} />
                  <Bar
                    dataKey="amountMinor"
                    name="Spending"
                    fill="hsl(220 90% 56%)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Spending by category</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="totalMinor"
                      nameKey="name"
                      outerRadius={110}
                      strokeWidth={0}
                    >
                      {data.categories.map((item) => (
                        <Cell key={item.id} fill={categoryHex[item.color] ?? categoryHex.slate} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(value: number) => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 self-center">
                {data.categories.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">
                      {item.name}{" "}
                      <span className="text-muted-foreground">({item.transactionCount})</span>
                    </span>
                    <span className="font-medium">{money(item.totalMinor)}</span>
                  </div>
                ))}
                {!data.categories.length && (
                  <p className="text-sm text-muted-foreground">No expenses in this range.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {data.budgets.map((budget) => {
              const percentage = budget.amountMinor
                ? Math.round((budget.spentMinor / budget.amountMinor) * 100)
                : 0;
              return (
                <Card key={budget.id} className="rounded-xl">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{budget.name}</p>
                        <p className="text-xs text-muted-foreground">{budget.category.name}</p>
                      </div>
                      <span
                        className={
                          percentage > 100 ? "font-semibold text-destructive" : "font-semibold"
                        }
                      >
                        {percentage}%
                      </span>
                    </div>
                    <Progress value={Math.min(percentage, 100)} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{money(budget.spentMinor)} spent</span>
                      <span>{money(budget.amountMinor)} budget</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!data.budgets.length && (
              <Card className="md:col-span-2">
                <CardContent className="py-16 text-center text-muted-foreground">
                  No active budgets overlap this range.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Largest expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.title}</TableCell>
                  <TableCell>{expense.category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(expense.transactionDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {money(expense.amountMinor)}
                  </TableCell>
                </TableRow>
              ))}
              {!data.topExpenses.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No expenses in this range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
