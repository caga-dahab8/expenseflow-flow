import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ token: z.string().catch("") }),
  head: () => ({ meta: [{ title: "Verify email — ExpenseFlow" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  useEffect(() => {
    if (!token) return setStatus("error");
    apiRequest<void>("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-lg">
        {status === "pending" ? (
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
        ) : status === "success" ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        ) : (
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
        )}
        <h1 className="mt-4 font-display text-2xl font-semibold">
          {status === "pending"
            ? "Verifying your email"
            : status === "success"
              ? "Email verified"
              : "Link unavailable"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "success"
            ? "Your account email is now verified."
            : status === "error"
              ? "This link is invalid or has expired."
              : "This will only take a moment."}
        </p>
        {status !== "pending" && (
          <Button className="mt-6" asChild>
            <Link to="/">Continue to ExpenseFlow</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
