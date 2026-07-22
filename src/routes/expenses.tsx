import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { ExpenseModal } from "@/components/expense-modal";
import { CategoryBadge } from "@/components/category-badge";
import {
  formatMoneyMinor,
  useCategories,
  useDeleteTransaction,
  useTransactions,
  type Transaction,
} from "@/lib/financial-data";

export const Route = createFileRoute("/expenses")({
  validateSearch: z.object({ q: z.string().max(100).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Expenses — ExpenseFlow" },
      { name: "description", content: "Search, filter and manage every transaction." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState(routeSearch.q ?? "");
  const [categoryId, setCategoryId] = useState("all");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const categoriesQuery = useCategories();
  const transactionsQuery = useTransactions({ page, limit: 10, search, categoryId, sort });
  const deleteTransaction = useDeleteTransaction();
  const transactions = transactionsQuery.data?.transactions ?? [];
  const pagination = transactionsQuery.data?.pagination ?? {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  useEffect(() => {
    setSearch(routeSearch.q ?? "");
    setPage(1);
  }, [routeSearch.q]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteTransaction.mutateAsync(deleting.id);
      toast.success("Expense deleted");
      setDeleting(null);
      if (transactions.length === 1 && page > 1) setPage(page - 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete expense");
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Every transaction in the active workspace."
        actions={
          <>
            <Button variant="outline" onClick={() => toast("CSV export is coming next")}>
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add expense
            </Button>
          </>
        }
      />
      <Card className="rounded-xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions…"
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categoriesQuery.data?.categories ?? [])
                  .filter((item) => item.status === "active" && item.type === "expense")
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value: "date" | "amount") => setSort(value)}>
              <SelectTrigger className="w-full md:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsQuery.isPending ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      Loading expenses…
                    </TableCell>
                  </TableRow>
                ) : transactionsQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-destructive">
                      {transactionsQuery.error.message}
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No expenses found in this workspace.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="font-medium">{transaction.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.id.slice(-8).toUpperCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={transaction.category} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transaction.transactionDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoneyMinor(transaction.amountMinor, transaction.currency)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                toast(transaction.title, {
                                  description: transaction.description || "No description",
                                })
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(transaction)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600"
                              onClick={() => setDeleting(transaction)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {pagination.total === 0 ? 0 : (page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 tabular-nums">
                Page {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
                disabled={page >= pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <ExpenseModal open={modalOpen} onOpenChange={setModalOpen} transaction={editing} />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              The expense will be removed from reports and budget totals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleteTransaction.isPending} onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
