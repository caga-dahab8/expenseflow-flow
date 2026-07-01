// Realistic demo data for ExpenseFlow

export type Category = {
  id: string;
  name: string;
  color: string; // tailwind bg color class base (e.g. "emerald")
  icon: string; // lucide icon name
  budget: number;
};

export type Expense = {
  id: string;
  title: string;
  categoryId: string;
  amount: number;
  paymentMethod: "Credit Card" | "Debit Card" | "Cash" | "Bank Transfer" | "PayPal";
  date: string; // ISO
  status: "Completed" | "Pending" | "Failed";
  description?: string;
};

export const categories: Category[] = [
  { id: "food", name: "Food & Dining", color: "orange", icon: "UtensilsCrossed", budget: 800 },
  { id: "transport", name: "Transport", color: "sky", icon: "Car", budget: 400 },
  { id: "shopping", name: "Shopping", color: "pink", icon: "ShoppingBag", budget: 600 },
  { id: "bills", name: "Bills & Utilities", color: "amber", icon: "ReceiptText", budget: 700 },
  { id: "health", name: "Healthcare", color: "emerald", icon: "HeartPulse", budget: 300 },
  { id: "education", name: "Education", color: "indigo", icon: "GraduationCap", budget: 250 },
  { id: "entertainment", name: "Entertainment", color: "violet", icon: "Clapperboard", budget: 350 },
  { id: "other", name: "Other", color: "slate", icon: "Wallet", budget: 200 },
];

const titlesByCategory: Record<string, string[]> = {
  food: ["Whole Foods groceries", "Blue Bottle coffee", "Chipotle lunch", "Sushi dinner", "Trader Joe's run", "Starbucks meeting", "Pizzeria takeout", "Farmer's market"],
  transport: ["Uber to airport", "Monthly metro pass", "Shell gas station", "Lyft ride", "Parking garage", "Car service oil change", "Train ticket to Boston"],
  shopping: ["Amazon order", "Nike sneakers", "Apple accessories", "IKEA furniture", "Zara clothing", "Best Buy headphones", "Ray-Ban sunglasses"],
  bills: ["Electricity bill", "Comcast internet", "Verizon phone", "Water utility", "Netflix subscription", "Spotify Family", "Renter's insurance"],
  health: ["CVS pharmacy", "Dental checkup", "Yoga class pack", "Vitamin refill", "Therapy session", "Eye exam", "Gym membership"],
  education: ["Coursera annual", "Design conference", "O'Reilly books", "Udemy course", "Notion Pro", "Figma team seat"],
  entertainment: ["Movie tickets", "Concert — The National", "Steam game bundle", "Museum entry", "Bowling night", "Broadway show"],
  other: ["Charity donation", "Gift for Anna", "Postage & shipping", "Locksmith", "Household misc"],
};

const paymentMethods: Expense["paymentMethod"][] = ["Credit Card", "Debit Card", "Cash", "Bank Transfer", "PayPal"];
const statuses: Expense["status"][] = ["Completed", "Completed", "Completed", "Completed", "Pending", "Failed"];

// Deterministic pseudo-random for stable demo data
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateExpenses(count: number): Expense[] {
  const rand = mulberry32(42);
  const now = new Date();
  const items: Expense[] = [];
  for (let i = 0; i < count; i++) {
    const cat = categories[Math.floor(rand() * categories.length)];
    const titles = titlesByCategory[cat.id];
    const title = titles[Math.floor(rand() * titles.length)];
    const amount = Math.round((5 + rand() * 380) * 100) / 100;
    const daysAgo = Math.floor(rand() * 180);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    items.push({
      id: `EXP-${(1000 + i).toString()}`,
      title,
      categoryId: cat.id,
      amount,
      paymentMethod: paymentMethods[Math.floor(rand() * paymentMethods.length)],
      date: d.toISOString(),
      status: statuses[Math.floor(rand() * statuses.length)],
      description: "Auto-imported from linked account.",
    });
  }
  return items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export const expenses: Expense[] = generateExpenses(100);

export function getCategory(id: string) {
  return categories.find((c) => c.id === id) ?? categories[categories.length - 1];
}

export const monthlySeries = (() => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rand = mulberry32(7);
  return months.map((m, i) => ({
    month: m,
    expenses: Math.round(1800 + rand() * 2200 + i * 40),
    income: Math.round(4200 + rand() * 900 + i * 30),
  }));
})();

export const weekdaySeries = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rand = mulberry32(11);
  return days.map((d) => ({ day: d, amount: Math.round(60 + rand() * 320) }));
})();

export function categoryTotals() {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    const cur = totals.get(e.categoryId) ?? { amount: 0, count: 0 };
    cur.amount += e.amount;
    cur.count += 1;
    totals.set(e.categoryId, cur);
  }
  return categories.map((c) => ({
    ...c,
    total: totals.get(c.id)?.amount ?? 0,
    count: totals.get(c.id)?.count ?? 0,
  }));
}

export function currentMonthExpenses() {
  const now = new Date();
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

export function todayExpenses() {
  const now = new Date();
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
}

export const totalBudget = categories.reduce((s, c) => s + c.budget, 0);

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Calendar heatmap: last 20 weeks
export function heatmapData() {
  const rand = mulberry32(19);
  const weeks = 20;
  const data: { week: number; day: number; value: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      data.push({ week: w, day: d, value: Math.round(rand() * 320) });
    }
  }
  return data;
}

export const notifications = [
  { id: "1", title: "Budget alert", body: "Shopping is at 82% of monthly budget.", time: "2m ago", unread: true },
  { id: "2", title: "New expense synced", body: "Blue Bottle coffee — $6.75", time: "1h ago", unread: true },
  { id: "3", title: "Weekly report ready", body: "Your Nov 18 – 24 report is available.", time: "Yesterday", unread: false },
  { id: "4", title: "Payment successful", body: "Comcast Internet — $79.99", time: "2 days ago", unread: false },
];

export const user = {
  name: "Amelia Bennett",
  email: "amelia.bennett@expenseflow.io",
  phone: "+1 (415) 555-0132",
  avatar: "https://i.pravatar.cc/128?img=47",
  currency: "USD",
  language: "English (US)",
  timezone: "America/Los_Angeles",
};
