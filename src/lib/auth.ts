import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIVE_WORKSPACE_KEY, apiRequest, ApiError } from "./api-client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  preferences: {
    currency?: string;
    timezone?: string;
    language?: string;
    dateFormat?: string;
    theme?: string;
  };
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: "personal" | "family" | "business";
  role: "owner" | "admin" | "member" | "viewer";
  settings?: { defaultCurrency: string; timezone: string; fiscalYearStartMonth: number };
};

export type AuthResponse = {
  user: AuthUser;
  workspaces?: WorkspaceSummary[];
  workspace?: WorkspaceSummary;
};

export const authQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: authQueryKey,
    queryFn: () => apiRequest<AuthResponse>("/api/auth/me"),
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
    staleTime: 60_000,
    enabled: typeof window !== "undefined",
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiRequest<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (data) => {
      queryClient.removeQueries();
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      queryClient.setQueryData(authQueryKey, data);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      currency: string;
      timezone: string;
    }) =>
      apiRequest<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.removeQueries();
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      queryClient.setQueryData(authQueryKey, {
        user: data.user,
        workspaces: data.workspace ? [data.workspace] : [],
      });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.removeQueries();
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    },
  });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
