import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
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
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryTotals, formatCurrency, monthlySeries, weekdaySeries } from "@/lib/mock-data";
import { categoryHex } from "@/components/category-badge";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — ExpenseFlow" },
      { name: "description", content: "Weekly, monthly and yearly spending reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const totals = categoryTotals().sort((a, b) => b.total - a.total);
  const yearly = monthlySeries.map((m) => ({ ...m, net: m.income - m.expenses }));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Download and share detailed spending reports."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Excel export queued")}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={() => toast.success("PDF export queued")}>
              <FileText className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </>
        }
      />

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
          <TabsTrigger value="category">By category</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Weekly spending report</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdaySeries}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="hsl(220 90% 56%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Monthly income vs expenses</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="hsl(160 84% 39%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(220 90% 56%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yearly" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Net savings trend</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearly}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="net" stroke="hsl(160 84% 39%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-5">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Spend by category</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={totals} dataKey="total" nameKey="name" outerRadius={110} strokeWidth={0}>
                      {totals.map((c) => (<Cell key={c.id} fill={categoryHex[c.color]} />))}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 self-center">
                {totals.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryHex[c.color] }} />
                      <span>{c.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="rounded-xl">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold">Scheduled reports</div>
            <p className="text-sm text-muted-foreground">Automatically deliver a monthly PDF to your inbox on the 1st.</p>
          </div>
          <Button variant="outline" onClick={() => toast.success("Weekly digest enabled")}>
            <Download className="mr-1.5 h-4 w-4" /> Enable weekly digest
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
