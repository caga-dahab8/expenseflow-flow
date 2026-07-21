import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as Icons from "lucide-react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CategoryDialog } from "@/components/category-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatMoneyMinor,
  useCategories,
  useSetCategoryStatus,
  type ApiCategory,
} from "@/lib/financial-data";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — ExpenseFlow" },
      { name: "description", content: "Organize your expenses with colorful categories." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { activeWorkspace } = useWorkspace();
  const query = useCategories();
  const setStatus = useSetCategoryStatus();
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("expense");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCategory | null>(null);
  const [archiving, setArchiving] = useState<ApiCategory | null>(null);
  const currency = activeWorkspace?.settings?.defaultCurrency ?? "USD";
  const canManage = activeWorkspace?.role !== "viewer";
  const categories = (query.data?.categories ?? []).filter(
    (category) =>
      (typeFilter === "all" || category.type === typeFilter) && category.status === statusFilter,
  );

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function changeStatus(category: ApiCategory, status: ApiCategory["status"]) {
    try {
      await setStatus.mutateAsync({ id: category.id, status });
      toast.success(status === "archived" ? "Category archived" : "Category restored");
      setArchiving(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update category");
    }
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organize transactions and see real totals by category."
        actions={
          canManage && (
            <Button onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" /> Add category
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Loading categories…
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-16 text-center text-destructive">
            {query.error.message}
          </CardContent>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No {statusFilter} categories match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => {
            const Icon =
              (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
                category.icon
              ] ?? Icons.Wallet;
            const color = categoryHex[category.color] ?? categoryHex.slate;
            const currencyTotal = category.totals.find((total) => total.currency === currency);
            const transactionCount = category.totals.reduce(
              (sum, total) => sum + total.transactionCount,
              0,
            );
            return (
              <Card
                key={category.id}
                className={`group rounded-xl border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md ${category.status === "archived" ? "opacity-65" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {canManage && (
                      <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        {category.status === "active" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${category.name}`}
                              onClick={() => {
                                setEditing(category);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Archive ${category.name}`}
                              onClick={() => setArchiving(category)}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Restore ${category.name}`}
                            onClick={() => changeStatus(category, "active")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="text-sm font-semibold">{category.name}</div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {category.type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">
                    {formatMoneyMinor(currencyTotal?.totalMinor ?? 0, currency)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {transactionCount} completed{" "}
                    {transactionCount === 1 ? "transaction" : "transactions"}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
      <AlertDialog open={!!archiving} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this category?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing expenses keep this category, but it cannot be selected for new expenses or
              budgets until restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={setStatus.isPending}
              onClick={() => archiving && changeStatus(archiving, "archived")}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
