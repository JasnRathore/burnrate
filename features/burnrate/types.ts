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

export type DashboardSummary = {
  balancePaise: number;
  dailyBurnPaise: number;
  runwayDays: number | null;
  monthSpendPaise: number;
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
  openingBalancePaise: number;
  smsConsentGranted: boolean;
  smsMonitoringEnabled: boolean;
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
