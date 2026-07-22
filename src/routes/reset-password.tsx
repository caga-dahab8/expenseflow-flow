import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().catch("") }),
  head: () => ({ meta: [{ title: "Choose password — ExpenseFlow" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("The passwords do not match.");
    setPending(true);
    setError("");
    try {
      await apiRequest<void>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      await navigate({ to: "/login", replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be reset.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <Card className="border-border/60 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Choose a new password</CardTitle>
          <CardDescription>Use at least 10 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4 text-sm">
              <p className="text-destructive">This reset link is incomplete.</p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request another link</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="new-reset-password">New password</Label>
                <Input
                  id="new-reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-reset-password">Confirm password</Label>
                <Input
                  id="confirm-reset-password"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={10}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Reset password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
