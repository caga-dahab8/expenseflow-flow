export type ApiErrorBody = {
  error: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

// In development, keep API requests same-origin and let Vite proxy /api to Fastify.
// This ensures the HTTP-only session cookie also works when Vite is opened by LAN IP.
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const ACTIVE_WORKSPACE_KEY = "expenseflow_active_workspace";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const workspaceId =
    typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: "REQUEST_FAILED",
      message: "The request could not be completed.",
    }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename?: string }> {
  const workspaceId =
    typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: workspaceId ? { "x-workspace-id": workspaceId } : undefined,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: "REQUEST_FAILED",
      message: "The report could not be downloaded.",
    }))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }
  const disposition = response.headers.get("content-disposition");
  const filename = disposition?.match(/filename="([^"]+)"/)?.[1];
  return { blob: await response.blob(), filename };
}
