import type { ReactNode } from "react";
import { BarChart3, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_42%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold">ExpenseFlow</span>
        </div>
        <div className="relative my-auto max-w-lg">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            Spend with clarity
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight xl:text-5xl">
            Your finances, organized in one calm workspace.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/75">
            Track daily spending, stay ahead of budgets, and turn every transaction into a useful
            decision.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              [Receipt, "Track expenses"],
              [BarChart3, "See trends"],
              [ShieldCheck, "Private by design"],
            ].map(([Icon, label]) => (
              <div
                key={label as string}
                className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur"
              >
                <Icon className="h-5 w-5" />
                <p className="mt-3 text-sm font-medium">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          ExpenseFlow · Modern expense management
        </p>
      </aside>
      <main className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
