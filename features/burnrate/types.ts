export type TransactionDirection = 'expense' | 'income';
export type TransactionSource = 'manual' | 'sms';
export type SyncStatus = 'pending' | 'synced' | 'failed';
export type BudgetPeriod = 'monthly';

export type Transaction = {
  id: string;
  amountPaise: number;
  direction: TransactionDirection;
  merchant: string;
  category: string;
  source: TransactionSource;
  occurredAt: number;
  createdAt: number;
  syncStatus: SyncStatus;
  dedupeKey?: string | null;
};

export type Budget = {
  id: string;
  category: string;
  limitPaise: number;
  period: BudgetPeriod;
  createdAt: number;
  updatedAt: number;
};

export type CategoryBreakdownItem = {
  category: string;
  amountPaise: number;
  share: number;
};

export type BudgetWarning = {
  category: string;
  spentPaise: number;
  limitPaise: number;
  ratio: number;
  level: 'warning' | 'breached';
};

export type WeekDayCategorySpend = {
  category: string;
  amountPaise: number;
};

export type WeekDaySpend = {
  /** Short weekday label, e.g. Mon */
  label: string;
  /** Start of local calendar day (epoch ms) */
  dayStart: number;
  amountPaise: number;
  /** Per-category expense breakdown for stacked bars */
  categories: WeekDayCategorySpend[];
  /** True when this bar is today */
  isToday: boolean;
};

export type DashboardSummary = {
  balancePaise: number;
  dailyBurnPaise: number;
  runwayDays: number | null;
  monthSpendPaise: number;
  /** Total expense for the current Mon–Sun calendar week */
  weekSpendPaise: number;
  /**
   * Mean daily expense for this calendar week only (weekSpend / 7).
   * Not the same as dailyBurnPaise (rolling 7-day / month burn).
   */
  weekAvgDailyPaise: number;
  weekDays: WeekDaySpend[];
  budgetWarnings: BudgetWarning[];
  categoryBreakdown: CategoryBreakdownItem[];
};

export type SmsParseResult = {
  amountPaise: number;
  direction: TransactionDirection;
  merchant: string;
  occurredAt: number;
  confidence: number;
  dedupeKey: string;
};

export type SyncMutation = {
  id: string;
  operation: string;
  payload: string;
  retry_count: number;
  created_at: number;
  synced: number;
};

export type AppSettings = {
  /** Snapshot of available money at `openingBalanceSetAt`. */
  openingBalancePaise: number;
  /**
   * Epoch ms when the baseline was last set. Balance only applies transactions
   * with occurredAt strictly after this (so the snapshot is not double-counted).
   * 0 means legacy: apply all transactions.
   */
  openingBalanceSetAt: number;
  smsConsentGranted: boolean;
  smsMonitoringEnabled: boolean;
  onboardingCompleted: boolean;
};

export const CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'College',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Income',
  'Other',
] as const;

export function getCategoryIcon(category: string): string {
  switch (category.toLowerCase().trim()) {
    case 'food':          return 'category.food';
    case 'transport':     return 'category.transport';
    case 'rent':          return 'category.rent';
    case 'college':       return 'category.college';
    case 'shopping':      return 'category.shopping';
    case 'bills':         return 'category.bills';
    case 'entertainment': return 'category.entertainment';
    case 'health':        return 'category.health';
    case 'income':        return 'category.income';
    default:              return 'category.other';
  }
}
