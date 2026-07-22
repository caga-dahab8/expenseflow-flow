import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function useTheme() {
  const theme = useSyncExternalStore(
    (notify) => {
      window.addEventListener("expenseflow:theme-changed", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("expenseflow:theme-changed", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => (localStorage.getItem("theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    window.dispatchEvent(new Event("expenseflow:theme-changed"));
  };
  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
