import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as Icons from "lucide-react";
import { MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { BudgetDialog } from "@/components/budget-dialog";
import { categoryHex } from "@/components/category-badge";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatMoneyMinor, useBudgets, useDeleteBudget, type Budget } from "@/lib/financial-data";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — ExpenseFlow" },
      { name: "description", content: "Set monthly budgets and stay on track." },
    ],
  }),
  component: BudgetsPage,
});

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function BudgetsPage() {
  const { activeWorkspace } = useWorkspace();
  const [month, setMonth] = useState(currentMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const query = useBudgets(month);
  const remove = useDeleteBudget();
  const budgets = query.data?.budgets ?? [];
  const canManage = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success("Budget deleted");
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete budget");
    }
  }

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Real spending progress for the active workspace."
        actions={
          <div className="flex items-center gap-2">
            <Input
              aria-label="Budget month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-40"
            />
            {canManage && (
              <Button onClick={openNew}>
                <Plus className="mr-1.5 h-4 w-4" /> New budget
              </Button>
            )}
          </div>
        }
      />

      {query.isPending ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Loading budgets…
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-16 text-center text-destructive">
            {query.error.message}
          </CardContent>
        </Card>
      ) : budgets.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">No budgets for this month</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {canManage
                ? "Create a category budget to compare its limit with completed expenses."
                : "An owner or admin can create budgets for this workspace."}
            </p>
            {canManage && (
              <Button className="mt-5" onClick={openNew}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create budget
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const percentage = Math.round((budget.spentMinor / budget.amountMinor) * 100);
            const displayPercentage = Math.min(100, percentage);
            const remaining = budget.amountMinor - budget.spentMinor;
            const status =
              percentage >= 100 ? "Over budget" : percentage >= 80 ? "Almost there" : "On track";
            const tone =
              percentage >= 100
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : percentage >= 80
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
            const Icon =
              (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
                budget.category.icon
              ] ?? Wallet;
            const color = categoryHex[budget.category.color] ?? categoryHex.slate;
            return (
              <Card key={budget.id} className="rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{budget.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {budget.category.name} · Monthly
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
                        {status}
                      </span>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(budget);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600"
                              onClick={() => setDeleting(budget)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="text-2xl font-semibold">
                      {formatMoneyMinor(budget.spentMinor, budget.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      of {formatMoneyMinor(budget.amountMinor, budget.currency)}
                    </div>
                  </div>
                  <Progress value={displayPercentage} className="mt-3 h-1.5" />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{percentage}% used</span>
                    <span className={remaining < 0 ? "text-rose-500" : ""}>
                      {remaining < 0
                        ? `${formatMoneyMinor(Math.abs(remaining), budget.currency)} over`
                        : `${formatMoneyMinor(remaining, budget.currency)} left`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog open={dialogOpen} onOpenChange={setDialogOpen} budget={editing} month={month} />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the spending target. Your expenses are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
