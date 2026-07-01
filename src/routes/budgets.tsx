import { createFileRoute } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { categoryTotals, formatCurrency } from "@/lib/mock-data";
import { categoryHex } from "@/components/category-badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — ExpenseFlow" },
      { name: "description", content: "Set monthly budgets and stay on track." },
    ],
  }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const items = categoryTotals().map((c) => {
    const spent = c.total / 6; // monthly avg
    const pct = Math.min(120, Math.round((spent / c.budget) * 100));
    const status = pct >= 100 ? "Over budget" : pct >= 80 ? "Almost there" : "On track";
    return { ...c, spent, pct, status };
  });

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Track how much you've spent against your monthly targets."
        actions={
          <Button onClick={() => toast.success("New budget draft created")}>
            <Plus className="mr-1.5 h-4 w-4" /> New budget
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ?? Icons.Wallet;
          const hex = categoryHex[c.color];
          const remaining = Math.max(0, c.budget - c.spent);
          const statusTone =
            c.pct >= 100
              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
              : c.pct >= 80
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
          return (
            <Card key={c.id} className="rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${hex}20`, color: hex }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">Monthly budget</div>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone}`}>
                    {c.status}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <div className="text-2xl font-semibold">{formatCurrency(c.spent)}</div>
                  <div className="text-xs text-muted-foreground">of {formatCurrency(c.budget)}</div>
                </div>
                <Progress value={Math.min(100, c.pct)} className="mt-3 h-1.5" />
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.pct}% used</span>
                  <span>{formatCurrency(remaining)} left</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
