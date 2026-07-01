import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
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
import { CategoryBadge, StatusBadge } from "@/components/category-badge";
import { categories, expenses, formatCurrency, getCategory } from "@/lib/mock-data";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — ExpenseFlow" },
      { name: "description", content: "Search, filter and manage every transaction." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let arr = expenses.filter((e) => {
      const okQ = q === "" || e.title.toLowerCase().includes(q.toLowerCase());
      const okC = cat === "all" || e.categoryId === cat;
      const okS = status === "all" || e.status === status;
      return okQ && okC && okS;
    });
    arr = [...arr].sort((a, b) =>
      sort === "amount" ? b.amount - a.amount : +new Date(b.date) - +new Date(a.date),
    );
    return arr;
  }, [q, cat, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Every transaction across your accounts, in one place."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Export started")}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add expense
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
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v: "date" | "amount") => setSort(v)}>
              <SelectTrigger className="w-full md:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" title="More filters">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No expenses match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((e) => (
                    <TableRow key={e.id} className="group">
                      <TableCell>
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{e.id}</div>
                      </TableCell>
                      <TableCell><CategoryBadge category={getCategory(e.categoryId)} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.paymentMethod}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(e.amount)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-60 hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast(e.title, { description: e.description })}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setModal(true)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-rose-600" onClick={() => setConfirm(e.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 tabular-nums">Page {page} / {totalPages}</span>
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExpenseModal open={modal} onOpenChange={setModal} />
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can't be undone. The expense will be removed from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                toast.success("Expense deleted");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
