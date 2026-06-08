import type {
  AppSettings,
  Budget,
  BudgetWarning,
  DashboardSummary,
  Transaction,
} from "./types";

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

export function summarizeDashboard(
  transactions: Transaction[],
  budgets: Budget[],
  settings: AppSettings,
  now = Date.now(),
): DashboardSummary {
  const monthStart = startOfCurrentMonth(now);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const balanceDelta = transactions.reduce((total, transaction) => {
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
  };
}
