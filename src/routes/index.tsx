import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseModal } from "@/components/expense-modal";
import { CategoryBadge, StatusBadge, categoryHex } from "@/components/category-badge";
import {
  categories,
  categoryTotals,
  currentMonthExpenses,
  expenses,
  formatCurrency,
  getCategory,
  monthlySeries,
  todayExpenses,
  totalBudget,
  weekdaySeries,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExpenseFlow" },
      {
        name: "description",
        content: "See spending, budgets and top categories at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${
                  positive
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                }`}
              >
                {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {delta}
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [open, setOpen] = useState(false);
  const totals = categoryTotals().sort((a, b) => b.total - a.total);
  const monthTotal = currentMonthExpenses().reduce((s, e) => s + e.amount, 0);
  const todayTotal = todayExpenses().reduce((s, e) => s + e.amount, 0);
  const allTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(0, totalBudget - monthTotal);
  const recent = expenses.slice(0, 6);

  return (
    <>
      <PageHeader
        title="Welcome back, Amelia"
        description="Here's what's happening with your finances today."
        actions={
          <>
            <Button variant="outline">
              <Sparkles className="mr-1.5 h-4 w-4" /> AI insights
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total expenses" value={formatCurrency(allTotal)} delta="8.2%" icon={DollarSign} />
        <StatCard label="This month" value={formatCurrency(monthTotal)} delta="3.4%" icon={TrendingUp} positive />
        <StatCard label="Today" value={formatCurrency(todayTotal || 84.5)} delta="1.2%" icon={Receipt} positive />
        <StatCard label="Remaining budget" value={formatCurrency(remaining)} delta="4.7%" icon={Wallet} positive />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Monthly expenses</CardTitle>
              <p className="text-xs text-muted-foreground">Spending trend across the year</p>
            </div>
            <span className="text-sm font-semibold text-primary">{formatCurrency(monthTotal)}</span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="expArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(220 90% 56%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(220 90% 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="expenses" stroke="hsl(220 90% 56%)" fill="url(#expArea)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
            <p className="text-xs text-muted-foreground">Spend distribution this year</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={totals}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {totals.map((c) => (
                    <Cell key={c.id} fill={categoryHex[c.color]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Weekly spending trend</CardTitle>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdaySeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} fill="hsl(220 90% 56%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Top categories</CardTitle>
            <p className="text-xs text-muted-foreground">Biggest spend this year</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {totals.slice(0, 5).map((c) => {
              const pct = Math.min(100, Math.round((c.total / (totals[0]?.total || 1)) * 100));
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: categoryHex[c.color] }}
                      />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <span className="text-muted-foreground">{formatCurrency(c.total)}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent transactions</CardTitle>
            <p className="text-xs text-muted-foreground">Your latest activity</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href="/expenses">View all →</a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell><CategoryBadge category={getCategory(e.categoryId)} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.slice(0, 4).map((c) => {
          const spent = totals.find((t) => t.id === c.id)?.total ?? 0;
          const pct = Math.min(100, Math.round((spent / (c.budget * 6)) * 100));
          return (
            <Card key={c.id} className="rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-2 text-xl font-semibold">{formatCurrency(spent)}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">of {formatCurrency(c.budget * 6)} budget</p>
                <Progress value={pct} className="mt-3 h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ExpenseModal open={open} onOpenChange={setOpen} />
    </>
  );
}
