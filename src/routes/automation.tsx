import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  FileUp,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoneyMinor, useCategories } from "@/lib/financial-data";
import {
  useAuditLogs,
  useImportCsv,
  useImports,
  useRecurringActions,
  useRecurringExpenses,
  useSavedReportActions,
  useSavedReports,
  type RecurringExpense,
} from "@/lib/operations";

export const Route = createFileRoute("/automation")({
  head: () => ({ meta: [{ title: "Automation & data — ExpenseFlow" }] }),
  component: AutomationPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}
function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) throw new Error("The CSV needs a header and at least one data row.");
  const split = (line: string) => {
    const result: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        result.push(value.trim());
        value = "";
      } else value += char;
    }
    result.push(value.trim());
    return result;
  };
  const headers = split(lines[0]).map((item) => item.toLowerCase());
  const index = (names: string[]) => headers.findIndex((item) => names.includes(item));
  const title = index(["title", "expense", "name"]);
  const amount = index(["amount", "value"]);
  const date = index(["date", "transactiondate"]);
  const category = index(["category"]);
  const description = index(["description", "notes"]);
  if (title < 0 || amount < 0 || date < 0)
    throw new Error("Required columns: title, amount, date.");
  return lines.slice(1).map((line) => {
    const values = split(line);
    return {
      title: values[title],
      amount: Number(values[amount]?.replace(/[^0-9.-]/g, "")),
      date: values[date],
      category: category >= 0 ? values[category] : undefined,
      description: description >= 0 ? values[description] : undefined,
    };
  });
}

function AutomationPage() {
  const recurring = useRecurringExpenses();
  const recurringActions = useRecurringActions();
  const categories = useCategories();
  const imports = useImports();
  const importCsv = useImportCsv();
  const logs = useAuditLogs();
  const reports = useSavedReports();
  const reportActions = useSavedReportActions();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurringExpense["frequency"]>("monthly");
  const [startDate, setStartDate] = useState(today());
  const [reportName, setReportName] = useState("");
  const [reportStart, setReportStart] = useState(yearStart());
  const [reportEnd, setReportEnd] = useState(today());
  const activeCategories = useMemo(
    () =>
      (categories.data?.categories ?? []).filter(
        (item) => item.status === "active" && item.type === "expense",
      ),
    [categories.data],
  );

  async function createRecurring(event: React.FormEvent) {
    event.preventDefault();
    try {
      await recurringActions.create.mutateAsync({
        categoryId,
        title,
        amountMinor: Math.round(Number(amount) * 100),
        frequency,
        interval: 1,
        startDate: new Date(`${startDate}T12:00:00`).toISOString(),
        autoCreate: true,
      });
      setTitle("");
      setAmount("");
      toast.success("Recurring expense created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create recurring expense");
    }
  }

  return (
    <>
      <PageHeader
        title="Automation & data"
        description="Schedule expenses, import records, review activity, and reuse reports."
      />
      <Tabs defaultValue="recurring">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="import">CSV import</TabsTrigger>
          <TabsTrigger value="reports">Saved reports</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="recurring" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New recurring expense</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={createRecurring}>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Monthly rent"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Repeats</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => setFrequency(value as RecurringExpense["frequency"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["daily", "weekly", "monthly", "quarterly", "yearly"].map((value) => (
                        <SelectItem key={value} value={value} className="capitalize">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Starts</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end md:col-span-4">
                  <Button disabled={recurringActions.create.isPending || !categoryId}>
                    {recurringActions.create.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create schedule
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {(recurring.data?.recurring ?? []).map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoneyMinor(item.amountMinor, item.currency)} · {item.frequency} · next{" "}
                      {new Date(item.nextRunAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recurringActions.run.mutate(item.id)}
                    >
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Run now
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        recurringActions.status.mutate({
                          id: item.id,
                          status: item.status === "active" ? "paused" : "active",
                        })
                      }
                    >
                      {item.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => recurringActions.remove.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!recurring.isPending && !recurring.data?.recurring.length && (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No recurring expenses yet.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="import" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import expenses from CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Required columns: title, amount, date. Optional: category and description. Up to
                1,000 rows.
              </p>
              <Input
                type="file"
                accept=".csv,text/csv"
                disabled={importCsv.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      const rows = parseCsv(String(reader.result));
                      const result = await importCsv.mutateAsync({ fileName: file.name, rows });
                      toast.success(`${result.importedRows} expenses imported`);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Import failed");
                    }
                  };
                  reader.readAsText(file);
                }}
              />
              {importCsv.isPending && (
                <p className="flex items-center text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing…
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import history</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {(imports.data?.imports ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm">
                    {item.importedRows} imported
                    {item.failedRows ? ` · ${item.failedRows} failed` : ""}
                  </p>
                </div>
              ))}
              {!imports.data?.imports.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No imports yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Save a report view</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    await reportActions.create.mutateAsync({
                      name: reportName,
                      reportType: "spending",
                      filters: { start: reportStart, end: reportEnd },
                    });
                    setReportName("");
                    toast.success("Report saved");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not save report");
                  }
                }}
              >
                <div className="grid flex-1 gap-2">
                  <Label>Name</Label>
                  <Input
                    value={reportName}
                    onChange={(event) => setReportName(event.target.value)}
                    placeholder="Quarterly spending"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={reportStart}
                    onChange={(event) => setReportStart(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={reportEnd}
                    onChange={(event) => setReportEnd(event.target.value)}
                  />
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            {(reports.data?.reports ?? []).map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.filters.start} — {item.filters.end}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to="/reports"
                        search={{ start: item.filters.start, end: item.filters.end }}
                      >
                        Open
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => reportActions.remove.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Workspace activity
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {(logs.data?.logs ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{item.actor}</span>{" "}
                      {item.action.replaceAll(".", " ")}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">{item.entityType}</p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
              {!logs.data?.logs.length && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
