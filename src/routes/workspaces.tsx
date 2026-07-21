import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Crown,
  Home,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { WorkspaceDialog } from "@/components/workspace-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials, useCurrentUser, type WorkspaceSummary } from "@/lib/auth";
import {
  useAcceptWorkspaceInvitation,
  useDeleteWorkspace,
  useIncomingWorkspaceInvitations,
  useInviteWorkspaceMember,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
  useRevokeWorkspaceInvitation,
  useTransferWorkspaceOwnership,
  useUpdateWorkspace,
  useUpdateWorkspaceMember,
  useWorkspace,
  useWorkspaceDetails,
  type WorkspaceMember,
} from "@/lib/workspace";

export const Route = createFileRoute("/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — ExpenseFlow" }] }),
  component: WorkspacesPage,
});

const icons = { personal: Home, family: Users, business: Building2 };
const roles = {
  owner: "Full control and workspace ownership",
  admin: "Manage finances, members, and invitations",
  member: "Create and manage financial records",
  viewer: "View workspace data without editing",
};

type ConfirmAction =
  | { type: "remove"; member: WorkspaceMember }
  | { type: "transfer"; member: WorkspaceMember }
  | { type: "leave" }
  | { type: "delete" }
  | null;

function WorkspacesPage() {
  const workspace = useWorkspace();
  const auth = useCurrentUser();
  const details = useWorkspaceDetails();
  const incoming = useIncomingWorkspaceInvitations();
  const updateWorkspace = useUpdateWorkspace();
  const inviteMember = useInviteWorkspaceMember();
  const updateMember = useUpdateWorkspaceMember();
  const removeMember = useRemoveWorkspaceMember();
  const revokeInvitation = useRevokeWorkspaceInvitation();
  const transferOwnership = useTransferWorkspaceOwnership();
  const leaveWorkspace = useLeaveWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const acceptInvitation = useAcceptWorkspaceInvitation();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceSummary["type"]>("personal");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");

  useEffect(() => {
    const selected = details.data?.workspace;
    if (!selected) return;
    setName(selected.name);
    setType(selected.type);
    setCurrency(selected.settings?.defaultCurrency ?? "USD");
    setTimezone(selected.settings?.timezone ?? "UTC");
  }, [details.data?.workspace]);

  const selected = details.data?.workspace;
  const currentRole = workspace.activeWorkspace?.role;
  const canManage = currentRole === "owner" || currentRole === "admin";
  const isOwner = currentRole === "owner";

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateWorkspace.mutateAsync({ name: name.trim(), type, currency, timezone });
      toast.success("Workspace settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update workspace");
    }
  }

  async function sendInvitation(event: React.FormEvent) {
    event.preventDefault();
    try {
      await inviteMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      toast.success("Invitation created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invitation");
    }
  }

  async function changeRole(id: string, role: "admin" | "member" | "viewer") {
    try {
      await updateMember.mutateAsync({ id, role });
      toast.success("Member role updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update member");
    }
  }

  async function confirmDangerousAction() {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "remove") {
        await removeMember.mutateAsync(confirmAction.member.id);
        toast.success("Member removed");
      } else if (confirmAction.type === "transfer") {
        await transferOwnership.mutateAsync(confirmAction.member.id);
        toast.success("Workspace ownership transferred");
      } else if (confirmAction.type === "leave") {
        await leaveWorkspace.mutateAsync();
        toast.success("You left the workspace");
      } else {
        await deleteWorkspace.mutateAsync();
        toast.success("Workspace archived");
      }
      setConfirmAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed");
    }
  }

  const actionPending =
    removeMember.isPending ||
    transferOwnership.isPending ||
    leaveWorkspace.isPending ||
    deleteWorkspace.isPending;

  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Manage separated finances, collaborators, and permissions."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create workspace
          </Button>
        }
      />

      {!!incoming.data?.invitations.length && (
        <Card className="rounded-xl border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Workspace invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incoming.data.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium">{invitation.workspace.name}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {invitation.workspace.type} workspace · {invitation.role}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={acceptInvitation.isPending}
                  onClick={async () => {
                    try {
                      await acceptInvitation.mutateAsync(invitation.id);
                      toast.success(`Joined ${invitation.workspace.name}`);
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Could not accept invitation",
                      );
                    }
                  }}
                >
                  Accept invitation
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspace.workspaces.map((item) => {
          const Icon = icons[item.type];
          const active = item.id === workspace.activeWorkspace?.id;
          return (
            <Card
              key={item.id}
              className={active ? "border-primary/60 shadow-sm" : "border-border/60"}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{item.name}</CardTitle>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {item.type} · {item.role}
                    </p>
                  </div>
                </div>
                {active && (
                  <Badge className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex justify-end">
                {!active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => workspace.selectWorkspace(item.id)}
                  >
                    Switch
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {details.isPending ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : details.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            {details.error.message}
          </CardContent>
        </Card>
      ) : selected ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="rounded-xl xl:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Workspace settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveSettings}>
                <div className="space-y-2">
                  <Label htmlFor="workspace-settings-name">Name</Label>
                  <Input
                    id="workspace-settings-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!canManage}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={type}
                    onValueChange={(value) => setType(value as WorkspaceSummary["type"])}
                    disabled={!canManage}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="family">Family or household</SelectItem>
                      <SelectItem value="business">Team or business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency} disabled={!canManage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["USD", "EUR", "GBP", "KES", "SOS"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-timezone">Timezone</Label>
                    <Input
                      id="workspace-timezone"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      disabled={!canManage}
                    />
                  </div>
                </div>
                {canManage && (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateWorkspace.isPending || name.trim().length < 2}
                  >
                    {updateWorkspace.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save settings
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-xl xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
              <p className="text-xs text-muted-foreground">
                {details.data.members.length} active member
                {details.data.members.length === 1 ? "" : "s"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {canManage && selected.type === "personal" && (
                <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <Home className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Personal workspaces are private</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Change the workspace type to Family or Business above and save the settings
                      before inviting other people.
                    </p>
                  </div>
                </div>
              )}
              {canManage && selected.type !== "personal" && (
                <form
                  className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row"
                  onSubmit={sendInvitation}
                >
                  <Input
                    type="email"
                    placeholder="person@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                    className="flex-1"
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as typeof inviteRole)}
                  >
                    <SelectTrigger className="sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={inviteMember.isPending}>
                    {inviteMember.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Invite
                  </Button>
                </form>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.data.members.map((member) => {
                      const isCurrentUser = member.userId === auth.data?.user.id;
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatarUrl ?? undefined} />
                                <AvatarFallback>{initials(member.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {member.name}
                                  {isCurrentUser ? " (you)" : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isOwner && member.role !== "owner" ? (
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  changeRole(member.id, value as "admin" | "member" | "viewer")
                                }
                                disabled={updateMember.isPending}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div>
                                <Badge
                                  variant={member.role === "owner" ? "default" : "secondary"}
                                  className="capitalize"
                                >
                                  {member.role === "owner" && <Crown className="mr-1 h-3 w-3" />}
                                  {member.role}
                                </Badge>
                                <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
                                  {roles[member.role]}
                                </p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isOwner && member.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmAction({ type: "transfer", member })}
                              >
                                <Crown className="mr-1.5 h-4 w-4" />
                                Transfer
                              </Button>
                            )}
                            {canManage &&
                              member.role !== "owner" &&
                              !isCurrentUser &&
                              !(currentRole === "admin" && member.role === "admin") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => setConfirmAction({ type: "remove", member })}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {canManage && !!details.data.invitations.length && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Pending invitations</h3>
                  {details.data.invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{invitation.email}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {invitation.role} · expires{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={revokeInvitation.isPending}
                        onClick={async () => {
                          try {
                            await revokeInvitation.mutateAsync(invitation.id);
                            toast.success("Invitation revoked");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not revoke invitation",
                            );
                          }
                        }}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selected && (
        <Card className="rounded-xl border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Workspace access
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">
                {isOwner ? "Archive this workspace" : "Leave this workspace"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? "Financial records are preserved, but all members lose access."
                  : "You will need a new invitation to regain access."}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirmAction(isOwner ? { type: "delete" } : { type: "leave" })}
            >
              {isOwner ? "Archive workspace" : "Leave workspace"}
            </Button>
          </CardContent>
        </Card>
      )}

      <WorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove"
                ? "Remove this member?"
                : confirmAction?.type === "transfer"
                  ? "Transfer workspace ownership?"
                  : confirmAction?.type === "leave"
                    ? "Leave this workspace?"
                    : "Archive this workspace?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove"
                ? `${confirmAction.member.name} will immediately lose access.`
                : confirmAction?.type === "transfer"
                  ? `${confirmAction.member.name} will become the owner and your role will change to admin.`
                  : confirmAction?.type === "leave"
                    ? "You will immediately lose access to this workspace."
                    : "All members will lose access. The financial records will remain archived."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actionPending} onClick={confirmDangerousAction}>
              {actionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
