/* eslint-disable react-refresh/only-export-components */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACTIVE_WORKSPACE_KEY, apiRequest } from "./api-client";
import type { WorkspaceSummary } from "./auth";

const workspaceQueryKey = ["workspaces"] as const;

type WorkspaceContextValue = {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  isLoading: boolean;
  selectWorkspace(id: string): void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => apiRequest<{ workspaces: WorkspaceSummary[] }>("/api/workspaces"),
    staleTime: 60_000,
  });
  const workspaces = useMemo(() => query.data?.workspaces ?? [], [query.data?.workspaces]);
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null,
  );

  useEffect(() => {
    if (!workspaces.length) return;
    const nextId = workspaces.some((workspace) => workspace.id === activeId)
      ? activeId!
      : workspaces[0].id;
    if (nextId !== activeId) setActiveId(nextId);
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextId);
  }, [activeId, workspaces]);

  useEffect(() => {
    const handleSelection = (event: Event) => setActiveId((event as CustomEvent<string>).detail);
    window.addEventListener("expenseflow:workspace-selected", handleSelection);
    return () => window.removeEventListener("expenseflow:workspace-selected", handleSelection);
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace:
        workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null,
      isLoading: query.isPending,
      selectWorkspace(id) {
        if (!workspaces.some((workspace) => workspace.id === id)) return;
        window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
        setActiveId(id);
        void queryClient.invalidateQueries({
          predicate: (item) => item.queryKey[0] !== "auth" && item.queryKey[0] !== "workspaces",
        });
      },
    }),
    [activeId, query.isPending, queryClient, workspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: "personal" | "family" | "business" }) =>
      apiRequest<{ workspace: WorkspaceSummary }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: ({ workspace }) => {
      queryClient.setQueryData<{ workspaces: WorkspaceSummary[] }>(
        workspaceQueryKey,
        (current) => ({
          workspaces: [...(current?.workspaces ?? []), workspace].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        }),
      );
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
      window.dispatchEvent(
        new CustomEvent("expenseflow:workspace-selected", { detail: workspace.id }),
      );
      void queryClient.invalidateQueries();
    },
  });
}

export type WorkspaceMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  expiresAt: string;
  createdAt: string;
};

export type WorkspaceDetails = {
  workspace: WorkspaceSummary;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
};

function useRefreshWorkspaces() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["workspace-details"] });
    void queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
    void queryClient.invalidateQueries({ queryKey: ["auth"] });
  };
}

export function useWorkspaceDetails() {
  const { activeWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-details", activeWorkspace?.id],
    queryFn: () => apiRequest<WorkspaceDetails>("/api/workspace"),
    enabled: !!activeWorkspace,
  });
}

export function useUpdateWorkspace() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      type?: WorkspaceSummary["type"];
      currency?: string;
      timezone?: string;
    }) =>
      apiRequest("/api/workspace", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
  });
}

export function useInviteWorkspaceMember() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: (input: { email: string; role: "admin" | "member" | "viewer" }) =>
      apiRequest("/api/workspace/invitations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
  });
}

export function useRevokeWorkspaceInvitation() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/workspace/invitations/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useUpdateWorkspaceMember() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "member" | "viewer" }) =>
      apiRequest(`/api/workspace/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: refresh,
  });
}

export function useRemoveWorkspaceMember() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/workspace/members/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useTransferWorkspaceOwnership() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiRequest("/api/workspace/transfer-ownership", {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: refresh,
  });
}

export function useLeaveWorkspace() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: () => apiRequest<void>("/api/workspace/leave", { method: "POST" }),
    onSuccess: refresh,
  });
}

export function useDeleteWorkspace() {
  const refresh = useRefreshWorkspaces();
  return useMutation({
    mutationFn: () => apiRequest<void>("/api/workspace", { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export type IncomingWorkspaceInvitation = {
  id: string;
  role: "admin" | "member" | "viewer";
  expiresAt: string;
  workspace: { id: string; name: string; type: WorkspaceSummary["type"] };
};

export function useIncomingWorkspaceInvitations() {
  return useQuery({
    queryKey: ["workspace-invitations"],
    queryFn: () =>
      apiRequest<{ invitations: IncomingWorkspaceInvitation[] }>("/api/workspace-invitations"),
  });
}

export function useAcceptWorkspaceInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ workspaceId: string }>(`/api/workspace-invitations/${id}/accept`, {
        method: "POST",
      }),
    onSuccess: async ({ workspaceId }) => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      window.dispatchEvent(
        new CustomEvent("expenseflow:workspace-selected", { detail: workspaceId }),
      );
      void queryClient.invalidateQueries({ queryKey: ["workspace-details"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
