import type { Category } from "@/lib/mock-data";

const colorMap: Record<string, string> = {
  orange: "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30",
  sky: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  pink: "bg-pink-100 text-pink-700 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/30",
  amber: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  indigo: "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
  violet: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
};

export const categoryHex: Record<string, string> = {
  orange: "#f97316",
  sky: "#0ea5e9",
  pink: "#ec4899",
  amber: "#f59e0b",
  emerald: "#10b981",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  slate: "#64748b",
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorMap[category.color]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: categoryHex[category.color] }}
      />
      {category.name}
    </span>
  );
}

export function StatusBadge({ status }: { status: "Completed" | "Pending" | "Failed" }) {
  const map = {
    Completed: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    Pending: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    Failed: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status]}`}
    >
      {status}
    </span>
  );
}
