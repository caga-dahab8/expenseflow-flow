import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./api-client";
import { useWorkspace } from "./workspace";

export type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  isDefault: boolean;
  status: "active" | "archived";
};
export type ApiCategory = {
  id: string;
  name: string;
  type: "expense" | "income";
  color: string;
  icon: string;
  isSystem: boolean;
  status: "active" | "archived";
  totals: Array<{ currency: string; totalMinor: number; transactionCount: number }>;
};

export type CategoryInput = {
  name: string;
  type: ApiCategory["type"];
  color: string;
  icon: string;
};
export type Transaction = {
  id: string;
  title: string;
  description?: string;
  amountMinor: number;
  currency: string;
  transactionDate: string;
  paymentMethod:
    "cash" | "credit_card" | "debit_card" | "bank_transfer" | "mobile_money" | "paypal" | "other";
  status: "pending" | "completed" | "failed" | "cancelled";
  account: { id: string; name: string };
  category: { id: string; name: string; color: string; icon: string };
  tags: string[];
};

export type TransactionInput = {
  categoryId: string;
  title: string;
  description?: string;
  amountMinor: number;
  transactionDate: string;
  tags: string[];
};

export type Budget = {
  id: string;
  name: string;
  amountMinor: number;
  spentMinor: number;
  currency: string;
  period: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  startDate: string;
  endDate: string;
  rollover: boolean;
  alerts: Array<{ percentage: number; enabled: boolean }>;
  status: "active" | "paused" | "archived";
  category: { id: string; name: string; color: string; icon: string };
};

export type BudgetInput = {
  categoryId: string;
  name: string;
  amountMinor: number;
  currency: string;
  period: Budget["period"];
  startDate: string;
  endDate: string;
  rollover: boolean;
  alerts: Budget["alerts"];
  status: Budget["status"];
};

export function useAccounts() {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["accounts", activeWorkspace?.id],
    queryFn: () => apiRequest<{ accounts: Account[] }>("/api/accounts"),
    enabled: !!activeWorkspace,
  });
}

export function useCategories() {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["categories", activeWorkspace?.id],
    queryFn: () => apiRequest<{ categories: ApiCategory[] }>("/api/categories"),
    enabled: !!activeWorkspace,
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      apiRequest(`/api/categories${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSetCategoryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiCategory["status"] }) =>
      apiRequest(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useTransactions(input: {
  page: number;
  limit: number;
  search: string;
  categoryId: string;
  sort: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const params = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit),
    sort: input.sort,
  });
  if (input.search.trim()) params.set("search", input.search.trim());
  if (input.categoryId !== "all") params.set("categoryId", input.categoryId);
  return useQuery({
    queryKey: ["transactions", activeWorkspace?.id, input],
    queryFn: () =>
      apiRequest<{
        transactions: Transaction[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/transactions?${params}`),
    enabled: !!activeWorkspace,
    placeholderData: (previous) => previous,
  });
}

export function useSaveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TransactionInput }) =>
      apiRequest(`/api/transactions${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBudgets(month: string) {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["budgets", activeWorkspace?.id, month],
    queryFn: () =>
      apiRequest<{ budgets: Budget[]; month: string }>(
        `/api/budgets?month=${encodeURIComponent(month)}`,
      ),
    enabled: !!activeWorkspace,
  });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BudgetInput }) =>
      apiRequest(`/api/budgets${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function formatMoneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

export function paymentLabel(value: Transaction["paymentMethod"]) {
  return {
    cash: "Cash",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    bank_transfer: "Bank Transfer",
    mobile_money: "Mobile Money",
    paypal: "PayPal",
    other: "Other",
  }[value];
}
