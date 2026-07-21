import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { categoryHex } from "@/components/category-badge";
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
import { useSaveCategory, type ApiCategory } from "@/lib/financial-data";

const colors = ["orange", "sky", "pink", "amber", "emerald", "indigo", "violet", "slate"];
const iconNames = [
  "UtensilsCrossed",
  "Car",
  "ShoppingBag",
  "ReceiptText",
  "HeartPulse",
  "GraduationCap",
  "Clapperboard",
  "Home",
  "Plane",
  "Gift",
  "Wallet",
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  category?: ApiCategory | null;
}) {
  const save = useSaveCategory();
  const resetSave = save.reset;
  const [name, setName] = useState("");
  const [type, setType] = useState<ApiCategory["type"]>("expense");
  const [color, setColor] = useState("slate");
  const [icon, setIcon] = useState("Wallet");

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setType(category?.type ?? "expense");
    setColor(category?.color ?? "slate");
    setIcon(category?.icon ?? "Wallet");
    resetSave();
  }, [open, category, resetSave]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: category?.id,
        input: { name: name.trim(), type, color, icon },
      });
      toast.success(category ? "Category updated" : "Category created");
      onOpenChange(false);
    } catch {
      // The API error is shown below.
    }
  }

  const SelectedIcon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ??
    Icons.Wallet;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Create category"}</DialogTitle>
          <DialogDescription>
            Choose how transactions in this category are displayed.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                color: categoryHex[color] ?? categoryHex.slate,
                backgroundColor: `${categoryHex[color] ?? categoryHex.slate}20`,
              }}
            >
              <SelectedIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">{name.trim() || "Category preview"}</div>
              <div className="text-xs capitalize text-muted-foreground">{type}</div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Travel"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconNames.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} color`}
                  aria-pressed={color === value}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${color === value ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: categoryHex[value] }}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
          </div>
          {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
