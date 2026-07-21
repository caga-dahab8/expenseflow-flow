import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api-client";
import { useWorkspace } from "./workspace";

export type DashboardData = {
  currency: string;
  timeZone: string;
  summary: {
    totalExpenseMinor: number;
    completedTransactionCount: number;
    currentMonthMinor: number;
    previousMonthMinor: number;
    monthChangePercent: number | null;
    todayMinor: number;
    yesterdayMinor: number;
    todayChangePercent: number | null;
    totalBudgetMinor: number;
    budgetSpentMinor: number;
    remainingBudgetMinor: number;
  };
  monthly: Array<{ key: string; amountMinor: number }>;
  weekly: Array<{ key: string; amountMinor: number }>;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    totalMinor: number;
    transactionCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    title: string;
    amountMinor: number;
    currency: string;
    transactionDate: string;
    status: "pending" | "completed" | "failed" | "cancelled";
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

export function useDashboard() {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard", activeWorkspace?.id],
    queryFn: () => apiRequest<DashboardData>("/api/dashboard"),
    enabled: !!activeWorkspace,
    staleTime: 30_000,
  });
}
