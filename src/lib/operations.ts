import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./api-client";
import { useWorkspace } from "./workspace";

function useWorkspaceQuery<T>(key: string, path: string) {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: [key, activeWorkspace?.id],
    queryFn: () => apiRequest<T>(path),
    enabled: !!activeWorkspace,
  });
}

export type RecurringExpense = {
  id: string;
  title: string;
  description?: string;
  amountMinor: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  interval: number;
  startDate: string;
  nextRunAt: string;
  autoCreate: boolean;
  status: "active" | "paused" | "completed";
  category: { id: string; name: string; color: string } | null;
};

export function useRecurringExpenses() {
  return useWorkspaceQuery<{ recurring: RecurringExpense[] }>(
    "recurring",
    "/api/recurring-transactions",
  );
}

export function useRecurringActions() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["recurring"] });
    void client.invalidateQueries({ queryKey: ["transactions"] });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const create = useMutation({
    mutationFn: (input: {
      categoryId: string;
      title: string;
      description?: string;
      amountMinor: number;
      frequency: RecurringExpense["frequency"];
      interval: number;
      startDate: string;
      autoCreate: boolean;
    }) =>
      apiRequest("/api/recurring-transactions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
  const run = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/recurring-transactions/${id}/run`, { method: "POST" }),
    onSuccess: refresh,
  });
  const status = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      apiRequest(`/api/recurring-transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/recurring-transactions/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { create, run, status, remove };
}

export type ImportBatch = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
  createdAt: string;
};
export function useImports() {
  return useWorkspaceQuery<{ imports: ImportBatch[] }>("imports", "/api/imports");
}
export function useImportCsv() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileName: string;
      rows: Array<{
        title: string;
        amount: number;
        date: string;
        category?: string;
        description?: string;
      }>;
    }) =>
      apiRequest<{ importedRows: number; failedRows: number }>("/api/imports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["imports"] });
      void client.invalidateQueries({ queryKey: ["transactions"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  actor: string;
  createdAt: string;
};
export function useAuditLogs() {
  return useWorkspaceQuery<{ logs: AuditLog[] }>("audit-logs", "/api/audit-logs");
}

export type SavedReport = {
  id: string;
  name: string;
  reportType: "spending" | "income_expense" | "category" | "budget";
  filters: { start: string; end: string };
  createdAt: string;
};
export function useSavedReports() {
  return useWorkspaceQuery<{ reports: SavedReport[] }>("saved-reports", "/api/saved-reports");
}
export function useSavedReportActions() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: ["saved-reports"] });
  return {
    create: useMutation({
      mutationFn: (input: Omit<SavedReport, "id" | "createdAt">) =>
        apiRequest("/api/saved-reports", { method: "POST", body: JSON.stringify(input) }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiRequest(`/api/saved-reports/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

export type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
};
export function useAttachments(transactionId?: string) {
  return useQuery({
    queryKey: ["attachments", transactionId],
    queryFn: () =>
      apiRequest<{ attachments: Attachment[] }>(`/api/attachments/transaction/${transactionId}`),
    enabled: !!transactionId,
  });
}
export function useAttachmentActions(transactionId?: string) {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: ["attachments", transactionId] });
  return {
    upload: useMutation({
      mutationFn: (input: {
        transactionId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        dataUrl: string;
      }) => apiRequest("/api/attachments", { method: "POST", body: JSON.stringify(input) }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiRequest(`/api/attachments/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  readAt?: string;
  createdAt: string;
};
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      apiRequest<{ unread: number; notifications: Notification[] }>("/api/notifications"),
    refetchInterval: 60_000,
  });
}
export function useReadNotifications() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export type SearchResults = {
  transactions: Array<{
    id: string;
    title: string;
    amountMinor: number;
    currency: string;
    transactionDate: string;
  }>;
  categories: Array<{ id: string; name: string; color: string }>;
  reports: Array<{ id: string; name: string; reportType: string }>;
};
export function useGlobalSearch(q: string) {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["global-search", activeWorkspace?.id, q],
    queryFn: () => apiRequest<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: !!activeWorkspace && q.trim().length >= 2,
    staleTime: 15_000,
  });
}
