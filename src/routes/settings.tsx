import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, HardDriveDownload, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-toggle";
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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — ExpenseFlow" }, { name: "description", content: "Appearance, data and account settings." }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  return (
    <>
      <PageHeader title="Settings" description="Customize how ExpenseFlow looks and behaves." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark mode</Label>
                <p className="text-xs text-muted-foreground">Reduce glare and save battery on OLED screens.</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggle} />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select defaultValue="USD">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "JPY", "INR", "CAD"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Language</Label>
              <Select defaultValue="English (US)">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["English (US)", "English (UK)", "Français", "Deutsch", "Español", "日本語"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Data & backup</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Automatic backups</Label>
                <p className="text-xs text-muted-foreground">Encrypted daily snapshots to your linked storage.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => toast.success("Backup started")}>
                <HardDriveDownload className="mr-1.5 h-4 w-4" /> Backup now
              </Button>
              <Button variant="outline" onClick={() => toast.success("Export queued (CSV)")}>
                <Download className="mr-1.5 h-4 w-4" /> Export all data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-rose-200/60 dark:border-rose-900/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-600">
              <ShieldAlert className="h-4 w-4" /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-medium">Delete account</div>
              <p className="text-xs text-muted-foreground">This will permanently remove your account and all associated data.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent. All expenses, budgets and reports will be erased.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => toast.success("Account scheduled for deletion")}>
                    Yes, delete
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
