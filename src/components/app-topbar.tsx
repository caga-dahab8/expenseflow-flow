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
import { useGlobalSearch, useNotifications, useReadNotifications } from "@/lib/operations";
import { useIncomingWorkspaceInvitations, useWorkspace } from "@/lib/workspace";

export function AppTopbar() {
  const navigate = useNavigate();
  const auth = useCurrentUser();
  const logout = useLogout();
  const invitations = useIncomingWorkspaceInvitations();
  const notifications = useNotifications();
  const readNotifications = useReadNotifications();
  const { activeWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchResults = useGlobalSearch(search);
  const user = auth.data!.user;
  const pending = invitations.data?.invitations ?? [];
  const unread = (notifications.data?.unread ?? 0) + pending.length;

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
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
        />
        {searchFocused && search.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-xl border bg-popover shadow-xl">
            {searchResults.isPending ? (
              <p className="p-4 text-sm text-muted-foreground">Searching…</p>
            ) : searchResults.data &&
              (searchResults.data.transactions.length ||
                searchResults.data.categories.length ||
                searchResults.data.reports.length) ? (
              <div className="max-h-96 overflow-y-auto p-2">
                {searchResults.data.transactions.map((item) => (
                  <Link
                    key={item.id}
                    to="/expenses"
                    search={{ q: item.title }}
                    className="block rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Expense · {(item.amountMinor / 100).toFixed(2)} {item.currency}
                    </p>
                  </Link>
                ))}
                {searchResults.data.categories.map((item) => (
                  <Link
                    key={item.id}
                    to="/categories"
                    className="block rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Category</p>
                  </Link>
                ))}
                {searchResults.data.reports.map((item) => (
                  <Link
                    key={item.id}
                    to="/automation"
                    className="block rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Saved report</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                No matching expenses, categories, or reports.
              </p>
            )}
          </div>
        )}
      </form>
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && <Badge variant="secondary">{unread} new</Badge>}
            </div>
            {notifications.isPending || invitations.isPending ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Checking notifications…
              </p>
            ) : pending.length === 0 && !notifications.data?.notifications.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                You’re all caught up.
              </p>
            ) : (
              <div className="divide-y">
                {(notifications.data?.notifications ?? []).slice(0, 5).map((notification) => (
                  <Link
                    key={notification.id}
                    to={
                      notification.actionUrl === "/expenses"
                        ? "/expenses"
                        : notification.actionUrl === "/automation"
                          ? "/automation"
                          : notification.actionUrl === "/budgets"
                            ? "/budgets"
                            : "/"
                    }
                    search={notification.actionUrl === "/expenses" ? {} : undefined}
                    className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{notification.title}</p>
                      {!notification.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                  </Link>
                ))}
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
                {(notifications.data?.unread ?? 0) > 0 && (
                  <button
                    className="w-full px-4 py-3 text-left text-xs font-medium text-primary hover:bg-muted/50"
                    onClick={() => readNotifications.mutate()}
                  >
                    Mark all as read
                  </button>
                )}
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
