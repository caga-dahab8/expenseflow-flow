import { useQuery } from "@tanstack/react-query";
import { apiDownload, apiRequest } from "./api-client";
import { useWorkspace } from "./workspace";

export type ReportRange = { start: string; end: string };

export type ReportData = {
  currency: string;
  timeZone: string;
  range: ReportRange;
  summary: {
    totalMinor: number;
    transactionCount: number;
    averageMinor: number;
    averageDailyMinor: number;
  };
  monthly: Array<{ key: string; amountMinor: number; transactionCount: number }>;
  weekdays: Array<{
    key: number;
    label: string;
    amountMinor: number;
    transactionCount: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    totalMinor: number;
    transactionCount: number;
  }>;
  daily: Array<{ key: string; amountMinor: number }>;
  topExpenses: Array<{
    id: string;
    title: string;
    amountMinor: number;
    transactionDate: string;
    category: { id: string; name: string; color: string };
  }>;
  budgets: Array<{
    id: string;
    name: string;
    amountMinor: number;
    spentMinor: number;
    category: { id: string; name: string; color: string };
  }>;
};

export function defaultReportRange(): ReportRange {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function useReportData(range: ReportRange) {
  const { activeWorkspace } = useWorkspace();
  const params = new URLSearchParams(range);
  return useQuery({
    queryKey: ["reports", activeWorkspace?.id, range],
    queryFn: () => apiRequest<ReportData>(`/api/reports?${params}`),
    enabled: !!activeWorkspace && range.start <= range.end,
    staleTime: 30_000,
  });
}

export async function downloadReportCsv(range: ReportRange) {
  const params = new URLSearchParams(range);
  const { blob, filename } = await apiDownload(`/api/reports/export.csv?${params}`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? `expenseflow-${range.start}-to-${range.end}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
