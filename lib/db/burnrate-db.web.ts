import type { AppSettings, Budget, SmsParseResult, Transaction, TransactionDirection } from '@/features/burnrate/types';

let transactions: Transaction[] = [];
let budgets: Budget[] = [];
let syncQueue: unknown[] = [];
let smsDedupeKeys = new Set<string>();
let settings: AppSettings = {
  openingBalancePaise: 0,
  openingBalanceSetAt: 0,
  smsConsentGranted: false,
  smsMonitoringEnabled: false,
  onboardingCompleted: false,
};

/** Web in-memory/localStorage backend — empty by default, no demo seed. */
export async function initializeBurnrateDb() {
  load();
}

export async function listTransactions() {
  load();
  return [...transactions].sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function listBudgets() {
  load();
  return [...budgets].sort((a, b) => a.category.localeCompare(b.category));
}

export async function getAppSettings(): Promise<AppSettings> {
  load();
  return {
    openingBalancePaise: settings.openingBalancePaise,
    openingBalanceSetAt: settings.openingBalanceSetAt,
    smsConsentGranted: settings.smsConsentGranted,
    smsMonitoringEnabled: settings.smsMonitoringEnabled,
    onboardingCompleted: settings.onboardingCompleted,
  };
}

export async function completeOnboarding(input: {
  openingBalancePaise: number;
  smsConsentGranted: boolean;
}) {
  load();
  const now = Date.now();
  settings = {
    ...settings,
    openingBalancePaise: Math.max(0, Math.round(input.openingBalancePaise)),
    openingBalanceSetAt: now,
    smsConsentGranted: input.smsConsentGranted,
    smsMonitoringEnabled: false,
    onboardingCompleted: true,
  };
  save();
}

export async function setOpeningBalance(amountPaise: number) {
  load();
  settings = {
    ...settings,
    openingBalancePaise: Math.max(0, Math.round(amountPaise)),
    openingBalanceSetAt: Date.now(),
  };
  save();
}

/** Wipe all web storage so the next session is a first install. */
export async function resetAppData() {
  transactions = [];
  budgets = [];
  syncQueue = [];
  smsDedupeKeys = new Set();
  settings = {
    openingBalancePaise: 0,
    openingBalanceSetAt: 0,
    smsConsentGranted: false,
    smsMonitoringEnabled: false,
    onboardingCompleted: false,
  };
  if (globalThis.localStorage) {
    globalThis.localStorage.removeItem('burnrate-web-db');
  }
}

export async function setSetting(key: string, value: string | number | boolean) {
  load();
  if (key === 'opening_balance_paise') settings.openingBalancePaise = Number(value);
  if (key === 'opening_balance_set_at') settings.openingBalanceSetAt = Number(value);
  if (key === 'sms_consent_granted') settings.smsConsentGranted = value === true || value === 'true';
  if (key === 'sms_monitoring_enabled') settings.smsMonitoringEnabled = value === true || value === 'true';
  if (key === 'onboarding_completed') settings.onboardingCompleted = value === true || value === 'true';
  save();
}

export async function getPendingSyncCount() {
  load();
  return syncQueue.length;
}

export async function createManualTransaction(input: {
  amountPaise: number;
  category: string;
  direction: TransactionDirection;
  merchant: string;
  occurredAt?: number;
}) {
  load();
  const item = transaction(
    input.direction,
    input.amountPaise,
    input.merchant.trim() || 'Manual transaction',
    input.category,
    input.occurredAt ?? Date.now()
  );
  transactions.unshift(item);
  syncQueue.push({ operation: 'transactions.create', payload: item });
  save();
  return item;
}

export async function createSmsTransaction(input: SmsParseResult) {
  load();
  if (smsDedupeKeys.has(input.dedupeKey)) {
    return { inserted: false as const, transaction: null };
  }
  smsDedupeKeys.add(input.dedupeKey);
  const item = transaction(
    input.direction,
    input.amountPaise,
    input.merchant,
    input.direction === 'income' ? 'Income' : 'Other',
    input.occurredAt,
    'sms',
    input.dedupeKey
  );
  transactions.unshift(item);
  syncQueue.push({ operation: 'transactions.createFromSms', payload: item });
  save();
  return { inserted: true as const, transaction: item };
}

export async function deleteTransaction(id: string) {
  load();
  transactions = transactions.filter((t) => t.id !== id);
  save();
}

export async function updateTransaction(
  id: string,
  input: {
    amountPaise: number;
    category: string;
    direction: TransactionDirection;
    merchant: string;
  }
) {
  load();
  const existing = transactions.find((t) => t.id === id);
  if (!existing) return;
  existing.amountPaise = input.amountPaise;
  existing.category = input.category;
  existing.direction = input.direction;
  existing.merchant = input.merchant;
  save();
}

export async function upsertBudget(category: string, limitPaise: number) {
  load();
  const now = Date.now();
  const existing = budgets.find((budget) => budget.category === category);
  if (existing) {
    existing.limitPaise = limitPaise;
    existing.updatedAt = now;
  } else {
    budgets.push({
      category,
      createdAt: now,
      id: slug(category),
      limitPaise,
      period: 'monthly',
      updatedAt: now,
    });
  }
  syncQueue.push({ operation: 'budgets.upsert', payload: { category, limitPaise } });
  save();
}

export async function deleteBudget(id: string) {
  load();
  budgets = budgets.filter((b) => b.id !== id);
  syncQueue.push({ operation: 'budgets.delete', payload: { id } });
  save();
}

function transaction(
  direction: TransactionDirection,
  amountPaise: number,
  merchant: string,
  category: string,
  occurredAt: number,
  source: 'manual' | 'sms' = 'manual',
  dedupeKey: string | null = null
): Transaction {
  return {
    amountPaise,
    category,
    createdAt: Date.now(),
    dedupeKey,
    direction,
    id: `${source}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    merchant,
    occurredAt,
    source,
    syncStatus: 'pending',
  };
}

function load() {
  if (!globalThis.localStorage) return;
  const raw = globalThis.localStorage.getItem('burnrate-web-db');
  if (!raw) return;
  const parsed = JSON.parse(raw);
  transactions = parsed.transactions ?? transactions;
  budgets = parsed.budgets ?? budgets;
  syncQueue = parsed.syncQueue ?? syncQueue;
  smsDedupeKeys = new Set(parsed.smsDedupeKeys ?? []);
  settings = {
    openingBalancePaise: 0,
    openingBalanceSetAt: 0,
    smsConsentGranted: false,
    smsMonitoringEnabled: false,
    onboardingCompleted: false,
    ...parsed.settings,
  };
}

function save() {
  if (!globalThis.localStorage) return;
  globalThis.localStorage.setItem(
    'burnrate-web-db',
    JSON.stringify({
      budgets,
      settings,
      smsDedupeKeys: Array.from(smsDedupeKeys),
      syncQueue,
      transactions,
    })
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/\W+/g, '-');
}
