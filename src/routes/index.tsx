import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Loader2,
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
import { toast } from "sonner";
import { CategoryBadge, categoryHex } from "@/components/category-badge";
import { ExpenseModal } from "@/components/expense-modal";
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
import { useCurrentUser } from "@/lib/auth";
import { useDashboard } from "@/lib/dashboard-data";
import { formatMoneyMinor } from "@/lib/financial-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExpenseFlow" },
      { name: "description", content: "See spending, budgets and top categories at a glance." },
    ],
  }),
  component: Dashboard,
});

function Change({ value, label }: { value: number | null; label: string }) {
  const decrease = value !== null && value < 0;
  const increase = value !== null && value > 0;
  return (
    <div className="mt-2 flex items-center gap-1 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${
          decrease
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : increase
              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {decrease ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        {value === null ? "New" : `${Math.abs(value).toFixed(1)}%`}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  change,
  comparison,
  supporting,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  change?: number | null;
  comparison?: string;
  supporting?: string;
}) {
  return (
    <Card className="rounded-xl border-border/60 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {comparison ? (
              <Change value={change ?? null} label={comparison} />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{supporting}</p>
            )}
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
  const auth = useCurrentUser();
  const dashboard = useDashboard();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const data = dashboard.data;

  if (dashboard.isPending || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Calculating your dashboard…</p>
        </div>
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="font-medium text-destructive">Dashboard data could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{dashboard.error.message}</p>
          <Button className="mt-4" onClick={() => dashboard.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { currency, summary } = data;
  const money = (amountMinor: number) => formatMoneyMinor(amountMinor, currency);
  const monthly = data.monthly.map((item) => ({
    ...item,
    label: new Date(`${item.key}-01T12:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }));
  const weekly = data.weekly.map((item) => ({
    ...item,
    label: new Date(`${item.key}T12:00:00Z`).toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    }),
  }));
  const budgetUsed = summary.totalBudgetMinor
    ? Math.round((summary.budgetSpentMinor / summary.totalBudgetMinor) * 100)
    : 0;
  const compactMoney = (amountMinor: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amountMinor / 100);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${auth.data!.user.name.split(" ")[0]}`}
        description="Here's what's happening with your finances today."
        actions={
          <>
            <Button variant="outline" onClick={() => toast("AI insights are coming later")}>
              <Sparkles className="mr-1.5 h-4 w-4" /> AI insights
            </Button>
            <Button onClick={() => setExpenseOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={money(summary.totalExpenseMinor)}
          icon={DollarSign}
          supporting={`${summary.completedTransactionCount} completed transactions`}
        />
        <StatCard
          label="This month"
          value={money(summary.currentMonthMinor)}
          icon={TrendingUp}
          change={summary.monthChangePercent}
          comparison="vs last month"
        />
        <StatCard
          label="Today"
          value={money(summary.todayMinor)}
          icon={Receipt}
          change={summary.todayChangePercent}
          comparison="vs yesterday"
        />
        <StatCard
          label="Remaining budget"
          value={money(summary.remainingBudgetMinor)}
          icon={Wallet}
          supporting={
            summary.totalBudgetMinor ? `${budgetUsed}% of budget used` : "No active budget"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Monthly expenses</CardTitle>
              <p className="text-xs text-muted-foreground">Latest 12 months</p>
            </div>
            <span className="text-sm font-semibold text-primary">
              {money(summary.currentMonthMinor)}
            </span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(220 90% 56%)" stopOpacity={0.4} />
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
                <RTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                  }}
                  formatter={(value: number) => money(value)}
                />
                <Area
                  type="monotone"
                  dataKey="amountMinor"
                  stroke="hsl(220 90% 56%)"
                  fill="url(#expenseArea)"
                  strokeWidth={2.5}
                />
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
            {data.categories.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="totalMinor"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.categories.map((category) => (
                      <Cell
                        key={category.id}
                        fill={categoryHex[category.color] ?? categoryHex.slate}
                      />
                    ))}
                  </Pie>
                  <RTooltip formatter={(value: number) => money(value)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No completed expenses this year.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Weekly spending trend</CardTitle>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={compactMoney}
                />
                <RTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                  }}
                  formatter={(value: number) => money(value)}
                />
                <Bar dataKey="amountMinor" radius={[8, 8, 0, 0]} fill="hsl(220 90% 56%)" />
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
            {data.categories.slice(0, 5).map((category) => {
              const percentage = Math.round(
                (category.totalMinor / (data.categories[0]?.totalMinor || 1)) * 100,
              );
              return (
                <div key={category.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: categoryHex[category.color] ?? categoryHex.slate,
                        }}
                      />
                      <span className="truncate font-medium">{category.name}</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {money(category.totalMinor)}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                </div>
              );
            })}
            {!data.categories.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No category spending yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent transactions</CardTitle>
            <p className="text-xs text-muted-foreground">Latest workspace activity</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/expenses">View all →</Link>
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
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.title}</TableCell>
                    <TableCell>
                      <CategoryBadge category={transaction.category} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(transaction.transactionDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: data.timeZone,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoneyMinor(transaction.amountMinor, transaction.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                {!data.recentTransactions.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Budget progress</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/budgets">Manage budgets →</Link>
          </Button>
        </div>
        {data.budgets.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {data.budgets.map((budget) => {
              const percentage = Math.round((budget.spentMinor / budget.amountMinor) * 100);
              return (
                <Card key={budget.id} className="rounded-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{budget.category.name}</span>
                      <span
                        className={`text-xs ${percentage > 100 ? "text-rose-500" : "text-muted-foreground"}`}
                      >
                        {percentage}%
                      </span>
                    </div>
                    <div className="mt-2 text-xl font-semibold">{money(budget.spentMinor)}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      of {money(budget.amountMinor)} budget
                    </p>
                    <Progress value={Math.min(100, percentage)} className="mt-3 h-1.5" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No active budgets for today.
            </CardContent>
          </Card>
        )}
      </div>

      <ExpenseModal open={expenseOpen} onOpenChange={setExpenseOpen} />
    </>
  );
}
