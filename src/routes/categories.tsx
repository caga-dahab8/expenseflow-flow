import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as Icons from "lucide-react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryTotals, formatCurrency } from "@/lib/mock-data";
import { categoryHex } from "@/components/category-badge";
import { ExpenseModal } from "@/components/expense-modal";

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
  const [open, setOpen] = useState(false);
  const items = categoryTotals();
  return (
    <>
      <PageHeader
        title="Categories"
        description="Group and color-code transactions to spot trends quickly."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add category
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((c) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ?? Icons.Wallet;
          const hex = categoryHex[c.color];
          return (
            <Card key={c.id} className="group rounded-xl border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${hex}20`, color: hex }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" onClick={() => toast("Edit category")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toast.success("Category deleted")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">{formatCurrency(c.total)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.count} transactions</div>
                </div>
                <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (c.total / (c.budget * 6)) * 100)}%`, backgroundColor: hex }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ExpenseModal open={open} onOpenChange={setOpen} />
    </>
  );
}
