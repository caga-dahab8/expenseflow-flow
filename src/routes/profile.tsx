import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, Loader2, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { initials, useChangePassword, useCurrentUser, useUpdateProfile } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ExpenseFlow" },
      { name: "description", content: "Manage your ExpenseFlow account." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const auth = useCurrentUser();
  const { activeWorkspace, workspaces } = useWorkspace();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const user = auth.data!.user;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currency, setCurrency] = useState(user.preferences.currency ?? "USD");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setCurrency(user.preferences.currency ?? "USD");
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({ name: name.trim(), email: email.trim(), currency });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your profile");
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("The new passwords do not match");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password");
    }
  }

  return (
    <>
      <PageHeader title="Profile" description="Manage your identity and account security." />

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="text-2xl">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <h2 className="mt-4 font-display text-xl font-semibold">{user.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-3 capitalize">
                {activeWorkspace?.role ?? "member"}
              </Badge>
            </div>
            <Separator className="my-6" />
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground">Available to this account</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="font-medium">Account active</p>
                  <p className="text-xs text-muted-foreground">Signed in securely</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-primary" /> Personal information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                <div className="grid gap-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">Email address</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Default currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["USD", "EUR", "GBP", "KES", "SOS", "TZS", "UGX"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used as the default for new workspaces.
                  </p>
                </div>
                <div className="flex items-end justify-end sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={updateProfile.isPending || name.trim().length < 2}
                  >
                    {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 lg:grid-cols-3" onSubmit={savePassword}>
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={10}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={10}
                    required
                  />
                </div>
                <div className="flex justify-end lg:col-span-3">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={changePassword.isPending || newPassword.length < 10}
                  >
                    {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
