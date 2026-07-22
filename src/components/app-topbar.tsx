import { Bell, ChevronDown, LogOut, PanelsTopLeft, Search, Settings, User } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { initials, useCurrentUser, useLogout } from "@/lib/auth";
import { useIncomingWorkspaceInvitations, useWorkspace } from "@/lib/workspace";

export function AppTopbar() {
  const navigate = useNavigate();
  const auth = useCurrentUser();
  const logout = useLogout();
  const invitations = useIncomingWorkspaceInvitations();
  const { activeWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const user = auth.data!.user;
  const pending = invitations.data?.invitations ?? [];

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await navigate({ to: "/expenses", search: { q: search.trim() || undefined } });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />
      <form
        className="relative hidden max-w-lg flex-1 md:block"
        onSubmit={submitSearch}
        role="search"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search expenses"
          placeholder="Search expenses…"
          className="h-9 rounded-lg border-transparent bg-muted/50 pl-9 focus-visible:bg-background"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </form>
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Workspace invitations"
            >
              <Bell className="h-4 w-4" />
              {pending.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {pending.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Invitations</span>
              {pending.length > 0 && <Badge variant="secondary">{pending.length} pending</Badge>}
            </div>
            {invitations.isPending ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Checking invitations…
              </p>
            ) : pending.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                You have no pending invitations.
              </p>
            ) : (
              <div className="divide-y">
                {pending.slice(0, 4).map((invitation) => (
                  <Link
                    key={invitation.id}
                    to="/workspaces"
                    className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{invitation.workspace.name}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {invitation.workspace.type} workspace · {invitation.role}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-muted"
              aria-label="Open account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="hidden max-w-40 text-left leading-tight sm:block">
                <div className="truncate text-xs font-medium">{user.name}</div>
                <div className="truncate text-[11px] capitalize text-muted-foreground">
                  {activeWorkspace?.role ?? "member"}
                </div>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/workspaces">
                <PanelsTopLeft className="mr-2 h-4 w-4" /> Workspaces
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={logout.isPending}
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await logout.mutateAsync();
                await navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
