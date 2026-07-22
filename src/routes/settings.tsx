import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Download,
  KeyRound,
  Loader2,
  MonitorCog,
  PanelsTopLeft,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { useTheme } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiDownload } from "@/lib/api-client";
import { useDeleteAccount, useLogoutOtherSessions } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ExpenseFlow" },
      { name: "description", content: "Appearance, security, and data settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { activeWorkspace } = useWorkspace();
  const logoutOtherSessions = useLogoutOtherSessions();
  const deleteAccount = useDeleteAccount();
  const navigate = useNavigate();
  const [deletePassword, setDeletePassword] = useState("");

  async function exportData() {
    try {
      const today = new Date();
      const start = `${today.getFullYear() - 4}-01-01`;
      const end = today.toISOString().slice(0, 10);
      const { blob, filename } = await apiDownload(
        `/api/reports/export.csv?start=${start}&end=${end}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? "expenseflow-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export your data");
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Control your app experience, security, and workspace data."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorCog className="h-4 w-4 text-primary" /> Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
              <div>
                <Label htmlFor="dark-mode">Dark mode</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use a darker color scheme throughout ExpenseFlow.
                </p>
              </div>
              <Switch id="dark-mode" checked={theme === "dark"} onCheckedChange={toggle} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">Other signed-in devices</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  End every other session while keeping this device signed in.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={logoutOtherSessions.isPending}
                onClick={async () => {
                  try {
                    await logoutOtherSessions.mutateAsync();
                    toast.success("Other sessions signed out");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not end sessions");
                  }
                }}
              >
                {logoutOtherSessions.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign out others
              </Button>
            </div>
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/profile">
                <KeyRound className="mr-2 h-4 w-4" /> Change password
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" /> Workspace data
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">
                Export {activeWorkspace?.name ?? "active workspace"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Download the current workspace’s expense records as a CSV file.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/workspaces">
                  <PanelsTopLeft className="mr-2 h-4 w-4" /> Manage workspace
                </Link>
              </Button>
              <Button onClick={exportData}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-destructive/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <ShieldAlert className="h-4 w-4" /> Account deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">Delete your ExpenseFlow account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Access is removed immediately and workspaces you own are archived.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action signs you out everywhere and cannot be undone from the application.
                    Enter your password to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  type="password"
                  placeholder="Current password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!deletePassword || deleteAccount.isPending}
                    onClick={async (event) => {
                      event.preventDefault();
                      try {
                        await deleteAccount.mutateAsync(deletePassword);
                        await navigate({ to: "/login", replace: true });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Could not delete the account",
                        );
                      }
                    }}
                  >
                    {deleteAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Permanently delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
