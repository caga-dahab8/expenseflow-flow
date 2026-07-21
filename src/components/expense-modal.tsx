import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAccounts,
  useCategories,
  useSaveTransaction,
  type Transaction,
} from "@/lib/financial-data";

export function ExpenseModal({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  transaction?: Transaction | null;
}) {
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const save = useSaveTransaction();
  const resetSave = save.reset;
  const accounts = useMemo(
    () => (accountsQuery.data?.accounts ?? []).filter((item) => item.status === "active"),
    [accountsQuery.data],
  );
  const categories = useMemo(
    () =>
      (categoriesQuery.data?.categories ?? []).filter(
        (item) => item.status === "active" && item.type === "expense",
      ),
    [categoriesQuery.data],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    setTitle(transaction?.title ?? "");
    setDescription(transaction?.description ?? "");
    setAmount(transaction ? String(transaction.amountMinor / 100) : "");
    setCategoryId(transaction?.category.id ?? categories[0]?.id ?? "");
    setDate(
      transaction
        ? new Date(transaction.transactionDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    resetSave();
  }, [open, transaction, accounts, categories, resetSave]);

  const defaultAccount = accounts.find((item) => item.isDefault) ?? accounts[0];
  const currency = transaction?.currency ?? defaultAccount?.currency;
  const loadingReferences = accountsQuery.isPending || categoriesQuery.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if ((!transaction && !defaultAccount) || !categoryId) return;
    const amountMinor = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;
    try {
      await save.mutateAsync({
        id: transaction?.id,
        input: {
          categoryId,
          title: title.trim(),
          description: description.trim() || undefined,
          amountMinor,
          transactionDate: new Date(`${date}T12:00:00`).toISOString(),
          tags: transaction?.tags ?? [],
        },
      });
      toast.success(transaction ? "Expense updated" : "Expense saved");
      onOpenChange(false);
    } catch {
      // Mutation error is rendered below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit expense" : "Add new expense"}</DialogTitle>
          <DialogDescription>
            {transaction
              ? "Update this transaction in the active workspace."
              : "Log a transaction in the active workspace."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="expense-title">Expense title</Label>
            <Input
              id="expense-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Team lunch"
              minLength={1}
              maxLength={160}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Amount ({currency ?? "—"})</Label>
              <Input
                id="expense-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="49.99"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-date">Expense date</Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Textarea
              id="expense-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Optional notes"
            />
          </div>
          {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
          {!loadingReferences && (!accounts.length || !categories.length) && (
            <p className="text-sm text-amber-600">
              This workspace needs an active default account and expense category.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                save.isPending ||
                loadingReferences ||
                (!transaction && !defaultAccount) ||
                !categories.length
              }
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transaction ? "Save changes" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
