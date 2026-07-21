import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/lib/workspace";
import { useCategories, useSaveBudget, type Budget } from "@/lib/financial-data";

function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export function BudgetDialog({
  open,
  onOpenChange,
  budget,
  month,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  budget?: Budget | null;
  month: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const categoriesQuery = useCategories();
  const save = useSaveBudget();
  const resetSave = save.reset;
  const categories = useMemo(
    () =>
      (categoriesQuery.data?.categories ?? []).filter(
        (category) => category.type === "expense" && category.status === "active",
      ),
    [categoriesQuery.data],
  );
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(month);
  const [rollover, setRollover] = useState(false);
  const currency = activeWorkspace?.settings?.defaultCurrency ?? "USD";

  useEffect(() => {
    if (!open) return;
    setCategoryId(budget?.category.id ?? categories[0]?.id ?? "");
    setName(budget?.name ?? "");
    setAmount(budget ? String(budget.amountMinor / 100) : "");
    setBudgetMonth(budget ? budget.startDate.slice(0, 7) : month);
    setRollover(budget?.rollover ?? false);
    resetSave();
  }, [open, budget, categories, month, resetSave]);

  function selectCategory(value: string) {
    setCategoryId(value);
    if (!name.trim() || name === categories.find((item) => item.id === categoryId)?.name) {
      setName(categories.find((item) => item.id === value)?.name ?? "");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountMinor = Math.round(Number(amount) * 100);
    if (!categoryId || !name.trim() || !Number.isSafeInteger(amountMinor) || amountMinor <= 0)
      return;
    try {
      await save.mutateAsync({
        id: budget?.id,
        input: {
          categoryId,
          name: name.trim(),
          amountMinor,
          currency,
          period: "monthly",
          ...monthDates(budgetMonth),
          rollover,
          alerts: [{ percentage: 80, enabled: true }],
          status: budget?.status ?? "active",
        },
      });
      toast.success(budget ? "Budget updated" : "Budget created");
      onOpenChange(false);
    } catch {
      // The API error is displayed below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "Create monthly budget"}</DialogTitle>
          <DialogDescription>Set a spending target for one expense category.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={selectCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="budget-name">Budget name</Label>
            <Input
              id="budget-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="budget-amount">Limit ({currency})</Label>
              <Input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget-month">Month</Label>
              <Input
                id="budget-month"
                type="month"
                value={budgetMonth}
                onChange={(event) => setBudgetMonth(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="budget-rollover">Rollover unused amount</Label>
              <p className="text-xs text-muted-foreground">
                Saved now for future rollover calculations.
              </p>
            </div>
            <Switch id="budget-rollover" checked={rollover} onCheckedChange={setRollover} />
          </div>
          {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
          {!categoriesQuery.isPending && categories.length === 0 && (
            <p className="text-sm text-amber-600">Create an active expense category first.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || categoriesQuery.isPending || !categories.length}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {budget ? "Save changes" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
