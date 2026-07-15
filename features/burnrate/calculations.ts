import type {
  AppSettings,
  Budget,
  BudgetWarning,
  DashboardSummary,
  Transaction,
  WeekDaySpend,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const INR = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

export function rupeesToPaise(value: string | number) {
  const parsed =
    typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

/** Allows zero (valid for empty start / onboarding). Returns null if invalid. */
export function parseRupeesToPaise(value: string | number): number | null {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const parsed =
    typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function paiseToRupees(value: number) {
  return value / 100;
}

export function formatInr(valuePaise: number) {
  return INR.format(Math.round(valuePaise / 100));
}

export function formatRunway(days: number | null) {
  if (days === null) {
    return "No burn yet";
  }
  if (days > 365) {
    return "1y+";
  }
  return `${Math.max(0, Math.floor(days))} days`;
}

export function startOfCurrentMonth(now = Date.now()) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/** Local Monday 00:00 for the week containing `now`. */
export function startOfWeekMonday(now = Date.now()) {
  const date = new Date(now);
  const day = date.getDay(); // 0 = Sun … 6 = Sat
  const daysFromMonday = (day + 6) % 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysFromMonday,
    0,
    0,
    0,
    0,
  ).getTime();
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
}

/** Expense totals for Mon–Sun of the current local week (with category stacks). */
export function getCurrentWeekSpend(
  transactions: Transaction[],
  now = Date.now(),
): { days: WeekDaySpend[]; totalPaise: number; avgDailyPaise: number } {
  const weekStart = startOfWeekMonday(now);
  const todayStart = startOfLocalDay(now);

  const days: WeekDaySpend[] = WEEKDAY_LABELS.map((label, index) => {
    const dayStart = weekStart + index * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const byCategory: Record<string, number> = {};

    for (const transaction of transactions) {
      if (
        transaction.direction !== "expense" ||
        transaction.occurredAt < dayStart ||
        transaction.occurredAt >= dayEnd
      ) {
        continue;
      }
      const category = transaction.category || "Other";
      byCategory[category] = (byCategory[category] ?? 0) + transaction.amountPaise;
    }

    const categories = Object.entries(byCategory)
      .map(([category, amountPaise]) => ({ amountPaise, category }))
      .sort((a, b) => a.category.localeCompare(b.category));

    const amountPaise = categories.reduce(
      (total, item) => total + item.amountPaise,
      0,
    );

    return {
      amountPaise,
      categories,
      dayStart,
      isToday: dayStart === todayStart,
      label,
    };
  });

  // Calendar week only — never month or rolling-window burn.
  const totalPaise = days.reduce((sum, day) => sum + day.amountPaise, 0);
  const avgDailyPaise = Math.round(totalPaise / WEEKDAY_LABELS.length);
  return { days, totalPaise, avgDailyPaise };
}

/** Compact axis labels for the week chart scale (paise → rupees). */
export function formatChartScale(valuePaise: number) {
  const rupees = Math.round(valuePaise / 100);
  if (rupees >= 100000) {
    const lakhs = rupees / 100000;
    return `₹${lakhs >= 10 ? Math.round(lakhs) : lakhs.toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    const thousands = rupees / 1000;
    return `₹${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }
  return `₹${rupees}`;
}

/**
 * High-contrast category colors for stacked week bars.
 * Chosen so adjacent segments stay visually distinct.
 */
export function getCategoryChartColor(category: string): string {
  switch (category.toLowerCase().trim()) {
    case "food":
      return "#FF5A5F"; // coral red
    case "transport":
      return "#3B82F6"; // blue
    case "rent":
      return "#F59E0B"; // amber
    case "college":
      return "#8B5CF6"; // violet
    case "shopping":
      return "#EC4899"; // pink
    case "bills":
      return "#EAB308"; // yellow
    case "entertainment":
      return "#10B981"; // emerald
    case "health":
      return "#14B8A6"; // teal
    case "income":
      return "#22C55E"; // green
    default:
      return "#64748B"; // slate
  }
}

export function summarizeDashboard(
  transactions: Transaction[],
  budgets: Budget[],
  settings: AppSettings,
  now = Date.now(),
): DashboardSummary {
  const monthStart = startOfCurrentMonth(now);
  const sevenDaysAgo = now - 7 * DAY_MS;
  const {
    days: weekDays,
    totalPaise: weekSpendPaise,
    avgDailyPaise: weekAvgDailyPaise,
  } = getCurrentWeekSpend(transactions, now);

  // Baseline is "money available right now" when it was set. Only activity
  // after that timestamp adjusts the displayed balance (avoids double-counting).
  const balanceSetAt = settings.openingBalanceSetAt ?? 0;
  const balanceDelta = transactions.reduce((total, transaction) => {
    if (balanceSetAt > 0 && transaction.occurredAt <= balanceSetAt) {
      return total;
    }
    return transaction.direction === "income"
      ? total + transaction.amountPaise
      : total - transaction.amountPaise;
  }, 0);

  const monthExpenses = transactions.filter(
    (transaction) =>
      transaction.direction === "expense" &&
      transaction.occurredAt >= monthStart,
  );
  const sevenDaySpend = transactions
    .filter(
      (transaction) =>
        transaction.direction === "expense" &&
        transaction.occurredAt >= sevenDaysAgo,
    )
    .reduce((total, transaction) => total + transaction.amountPaise, 0);

  const monthSpendPaise = monthExpenses.reduce(
    (total, transaction) => total + transaction.amountPaise,
    0,
  );
  const dailyBurnPaise = Math.round(sevenDaySpend / 7);
  const balancePaise = settings.openingBalancePaise + balanceDelta;
  const runwayDays =
    dailyBurnPaise > 0 ? Math.floor(balancePaise / dailyBurnPaise) : null;

  const categoryTotals = monthExpenses.reduce<Record<string, number>>(
    (totals, transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] ?? 0) + transaction.amountPaise;
      return totals;
    },
    {},
  );

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amountPaise]) => ({
      amountPaise,
      category,
      share: monthSpendPaise > 0 ? amountPaise / monthSpendPaise : 0,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);

  const budgetWarnings = budgets
    .map((budget) => {
      const spentPaise = categoryTotals[budget.category] ?? 0;
      const ratio = budget.limitPaise > 0 ? spentPaise / budget.limitPaise : 0;
      if (ratio < 0.8) {
        return null;
      }
      return {
        category: budget.category,
        limitPaise: budget.limitPaise,
        ratio,
        spentPaise,
        level: ratio >= 1 ? ("breached" as const) : ("warning" as const),
      };
    })
    .filter((warning): warning is BudgetWarning => warning !== null);

  return {
    balancePaise,
    budgetWarnings,
    categoryBreakdown,
    dailyBurnPaise,
    monthSpendPaise,
    runwayDays,
    weekAvgDailyPaise,
    weekDays,
    weekSpendPaise,
  };
}
