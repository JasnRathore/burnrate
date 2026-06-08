import { CATEGORIES, type AppSettings, type Budget, type SmsParseResult, type Transaction, type TransactionDirection } from '@/features/burnrate/types';

let transactions: Transaction[] = [];
let budgets: Budget[] = [];
let syncQueue: unknown[] = [];
let smsDedupeKeys = new Set<string>();
let settings: AppSettings & { demoSeeded?: boolean } = {
  openingBalancePaise: 0,
  smsConsentGranted: false,
  smsMonitoringEnabled: false,
};

export async function initializeBurnrateDb() {
  load();
  if (settings.demoSeeded) return;

  const now = Date.now();
  settings = {
    demoSeeded: true,
    openingBalancePaise: 850000,
    smsConsentGranted: false,
    smsMonitoringEnabled: false,
  };
  transactions = [
    transaction('expense', 12500, 'Hostel mess', 'Food', now - 1 * 24 * 60 * 60 * 1000),
    transaction('expense', 8000, 'Metro card', 'Transport', now - 2 * 24 * 60 * 60 * 1000),
    transaction('expense', 48000, 'Book store', 'College', now - 4 * 24 * 60 * 60 * 1000),
    transaction('income', 500000, 'Monthly allowance', 'Income', now - 6 * 24 * 60 * 60 * 1000),
  ];
  budgets = CATEGORIES.slice(0, 4).map((category) => ({
    category,
    createdAt: now,
    id: slug(category),
    limitPaise: category === 'Food' ? 450000 : 200000,
    period: 'monthly',
    updatedAt: now,
  }));
  save();
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
    smsConsentGranted: settings.smsConsentGranted,
    smsMonitoringEnabled: false,
  };
}

export async function setSetting(key: string, value: string | number | boolean) {
  load();
  if (key === 'opening_balance_paise') settings.openingBalancePaise = Number(value);
  if (key === 'sms_consent_granted') settings.smsConsentGranted = value === true || value === 'true';
  if (key === 'sms_monitoring_enabled') settings.smsMonitoringEnabled = false;
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
  settings = parsed.settings ?? settings;
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
