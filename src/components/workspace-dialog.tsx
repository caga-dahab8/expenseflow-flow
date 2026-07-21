import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateWorkspace } from "@/lib/workspace";

export function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const createWorkspace = useCreateWorkspace();
  const resetCreateWorkspace = createWorkspace.reset;
  const [name, setName] = useState("");
  const [type, setType] = useState<"personal" | "family" | "business">("family");

  useEffect(() => {
    if (!open) {
      setName("");
      setType("family");
      resetCreateWorkspace();
    }
  }, [open, resetCreateWorkspace]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return;
    try {
      await createWorkspace.mutateAsync({ name: name.trim(), type });
      onOpenChange(false);
    } catch {
      // Mutation state renders the server error in the dialog.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Keep personal, family, and business finances separated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mokhtar Family"
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Workspace type</Label>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
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
          {createWorkspace.error && (
            <p className="text-sm text-destructive">{createWorkspace.error.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkspace.isPending || name.trim().length < 2}>
              {createWorkspace.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
