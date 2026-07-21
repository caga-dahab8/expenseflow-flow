import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown, Home, Plus, Settings2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useWorkspace } from "@/lib/workspace";
import { WorkspaceDialog } from "./workspace-dialog";

const icons = { personal: Home, family: Users, business: Building2 };

export function WorkspaceSwitcher() {
  const workspace = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const active = workspace.activeWorkspace;
  const ActiveIcon = active ? icons[active.type] : Home;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ActiveIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {active?.name ?? "Loading workspace…"}
                  </span>
                  <span className="truncate text-xs capitalize text-muted-foreground">
                    {active ? `${active.type} · ${active.role}` : ""}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-64"
              align="start"
              side="right"
              sideOffset={8}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {workspace.workspaces.map((item) => {
                const Icon = icons[item.type];
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => workspace.selectWorkspace(item.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-7 items-center justify-center rounded-md border">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {item.type} · {item.role}
                      </div>
                    </div>
                    {item.id === active?.id && <Check className="size-4 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Create workspace
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/workspaces">
                  <Settings2 className="size-4" />
                  Manage workspaces
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <WorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
