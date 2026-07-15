import * as SQLite from 'expo-sqlite';

import type { AppSettings, Budget, SmsParseResult, Transaction, TransactionDirection } from '@/features/burnrate/types';

const DATABASE_NAME = 'burnrate.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

type TransactionRow = {
  id: string;
  amount_paise: number;
  direction: TransactionDirection;
  merchant: string;
  category: string;
  source: 'manual' | 'sms';
  occurred_at: number;
  created_at: number;
  sync_status: 'pending' | 'synced' | 'failed';
  dedupe_key: string | null;
};

type BudgetRow = {
  id: string;
  category: string;
  limit_paise: number;
  period: 'monthly';
  created_at: number;
  updated_at: number;
};

export async function getBurnrateDb() {
  dbPromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = await dbPromise;
  await migrate(db);
  return db;
}

/**
 * Open SQLite and ensure schema exists. Starts empty — no demo seed data.
 * Defaults are applied lazily via getAppSettings / onboarding completion.
 */
export async function initializeBurnrateDb() {
  const db = await getBurnrateDb();
  // Legacy upgrade: previous builds seeded demo data without an onboarding flag.
  const onboarding = await getSetting(db, 'onboarding_completed');
  if (!onboarding) {
    const legacySeeded = await getSetting(db, 'demo_seeded');
    if (legacySeeded === 'true') {
      await setSetting('onboarding_completed', true);
    }
  }

  // Legacy: baseline was applied with ALL transactions, which double-counted
  // activity already in the bank balance. Snapshot "as of now" so home matches
  // the saved baseline until new activity is logged.
  const balanceSetAt = await getSetting(db, 'opening_balance_set_at');
  if (balanceSetAt == null) {
    const hasBalance = await getSetting(db, 'opening_balance_paise');
    const onboarded =
      (await getSetting(db, 'onboarding_completed')) === 'true' ||
      hasBalance != null;
    if (onboarded) {
      await setSetting('opening_balance_set_at', Date.now());
    }
  }
}

export async function listTransactions(): Promise<Transaction[]> {
  const db = await getBurnrateDb();
  const rows = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions ORDER BY occurred_at DESC, created_at DESC'
  );
  return rows.map(mapTransaction);
}

export async function listBudgets(): Promise<Budget[]> {
  const db = await getBurnrateDb();
  const rows = await db.getAllAsync<BudgetRow>('SELECT * FROM budgets ORDER BY category ASC');
  return rows.map(mapBudget);
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getBurnrateDb();
  const [openingBalance, balanceSetAt, smsConsent, smsEnabled, onboarding] = await Promise.all([
    getSetting(db, 'opening_balance_paise'),
    getSetting(db, 'opening_balance_set_at'),
    getSetting(db, 'sms_consent_granted'),
    getSetting(db, 'sms_monitoring_enabled'),
    getSetting(db, 'onboarding_completed'),
  ]);

  return {
    openingBalancePaise: Number(openingBalance ?? 0),
    openingBalanceSetAt: Number(balanceSetAt ?? 0),
    smsConsentGranted: smsConsent === 'true',
    smsMonitoringEnabled: smsEnabled === 'true',
    onboardingCompleted: onboarding === 'true',
  };
}

/** Persist first-run setup: balance snapshot, optional SMS prefs, mark onboarded. */
export async function completeOnboarding(input: {
  openingBalancePaise: number;
  smsConsentGranted: boolean;
}) {
  const now = Date.now();
  await setSetting('opening_balance_paise', Math.max(0, Math.round(input.openingBalancePaise)));
  await setSetting('opening_balance_set_at', now);
  await setSetting('sms_consent_granted', input.smsConsentGranted);
  // Monitoring stays off until the user enables it later in Settings.
  await setSetting('sms_monitoring_enabled', false);
  await setSetting('onboarding_completed', true);
}

/** Update available-balance snapshot; only later transactions adjust home balance. */
export async function setOpeningBalance(amountPaise: number) {
  const now = Date.now();
  await setSetting('opening_balance_paise', Math.max(0, Math.round(amountPaise)));
  await setSetting('opening_balance_set_at', now);
}

/**
 * Wipe all local SQLite data and settings so the next session is a first install
 * (empty ledger, onboarding incomplete).
 */
export async function resetAppData() {
  const db = await getBurnrateDb();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM sync_queue;
    DELETE FROM sms_dedupes;
    DELETE FROM settings;
  `);
}

export async function setSetting(key: string, value: string | number | boolean) {
  const db = await getBurnrateDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    String(value)
  );
}

export async function getPendingSyncCount() {
  const db = await getBurnrateDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0'
  );
  return row?.count ?? 0;
}

export async function createManualTransaction(input: {
  amountPaise: number;
  category: string;
  direction: TransactionDirection;
  merchant: string;
  occurredAt?: number;
}) {
  const transaction = await insertTransaction({
    ...input,
    dedupeKey: null,
    source: 'manual',
  });
  await enqueueSyncMutation('transactions.create', transaction);
  return transaction;
}

export async function createSmsTransaction(input: SmsParseResult) {
  const db = await getBurnrateDb();
  const duplicate = await db.getFirstAsync<{ dedupe_key: string }>(
    'SELECT dedupe_key FROM sms_dedupes WHERE dedupe_key = ?',
    input.dedupeKey
  );
  if (duplicate) {
    return { inserted: false as const, transaction: null };
  }

  const transaction = await insertTransaction({
    amountPaise: input.amountPaise,
    category: input.direction === 'income' ? 'Income' : categorizeMerchant(input.merchant),
    dedupeKey: input.dedupeKey,
    direction: input.direction,
    merchant: input.merchant,
    occurredAt: input.occurredAt,
    source: 'sms',
  });
  await db.runAsync(
    'INSERT INTO sms_dedupes (dedupe_key, transaction_id, raw_hash_created_at) VALUES (?, ?, ?)',
    input.dedupeKey,
    transaction.id,
    Date.now()
  );
  await enqueueSyncMutation('transactions.createFromSms', transaction);
  return { inserted: true as const, transaction };
}

export async function deleteTransaction(id: string) {
  const db = await getBurnrateDb();
  // Remove any associated SMS dedupe entry so the message can be re-imported if needed
  await db.runAsync('DELETE FROM sms_dedupes WHERE transaction_id = ?', id);
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
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
  const db = await getBurnrateDb();
  await db.runAsync(
    `UPDATE transactions SET amount_paise = ?, category = ?, direction = ?, merchant = ? WHERE id = ?`,
    input.amountPaise,
    input.category,
    input.direction,
    input.merchant,
    id
  );
}

export async function upsertBudget(category: string, limitPaise: number) {
  const db = await getBurnrateDb();
  const now = Date.now();
  const id = category.toLowerCase().replace(/\W+/g, '-');
  await db.runAsync(
    `INSERT INTO budgets (id, category, limit_paise, period, created_at, updated_at)
     VALUES (?, ?, ?, 'monthly', ?, ?)
     ON CONFLICT(id) DO UPDATE SET limit_paise = excluded.limit_paise, updated_at = excluded.updated_at`,
    id,
    category,
    limitPaise,
    now,
    now
  );
  await enqueueSyncMutation('budgets.upsert', { category, limitPaise });
}

export async function deleteBudget(id: string) {
  const db = await getBurnrateDb();
  await db.runAsync(`DELETE FROM budgets WHERE id = ?`, id);
  await enqueueSyncMutation('budgets.delete', { id });
}

async function insertTransaction(input: {
  amountPaise: number;
  category: string;
  dedupeKey: string | null;
  direction: TransactionDirection;
  merchant: string;
  occurredAt?: number;
  source: 'manual' | 'sms';
}) {
  const db = await getBurnrateDb();
  const now = Date.now();
  const transaction: Transaction = {
    amountPaise: input.amountPaise,
    category: input.category || 'Other',
    createdAt: now,
    dedupeKey: input.dedupeKey,
    direction: input.direction,
    id: createId('txn'),
    merchant: input.merchant.trim() || 'Unknown',
    occurredAt: input.occurredAt ?? now,
    source: input.source,
    syncStatus: 'pending',
  };

  await db.runAsync(
    `INSERT INTO transactions
      (id, amount_paise, direction, merchant, category, source, occurred_at, created_at, sync_status, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    transaction.id,
    transaction.amountPaise,
    transaction.direction,
    transaction.merchant,
    transaction.category,
    transaction.source,
    transaction.occurredAt,
    transaction.createdAt,
    transaction.syncStatus,
    transaction.dedupeKey ?? null
  );
  return transaction;
}

async function enqueueSyncMutation(operation: string, payload: unknown) {
  const db = await getBurnrateDb();
  await db.runAsync(
    `INSERT INTO sync_queue (id, operation, payload, retry_count, created_at, synced)
     VALUES (?, ?, ?, 0, ?, 0)`,
    createId('sync'),
    operation,
    JSON.stringify(payload),
    Date.now()
  );
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      amount_paise INTEGER NOT NULL,
      direction TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      sync_status TEXT NOT NULL,
      dedupe_key TEXT
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL UNIQUE,
      limit_paise INTEGER NOT NULL,
      period TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sms_dedupes (
      dedupe_key TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL,
      raw_hash_created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

async function getSetting(db: SQLite.SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value;
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    amountPaise: row.amount_paise,
    category: row.category,
    createdAt: row.created_at,
    dedupeKey: row.dedupe_key,
    direction: row.direction,
    id: row.id,
    merchant: row.merchant,
    occurredAt: row.occurred_at,
    source: row.source,
    syncStatus: row.sync_status,
  };
}

function mapBudget(row: BudgetRow): Budget {
  return {
    category: row.category,
    createdAt: row.created_at,
    id: row.id,
    limitPaise: row.limit_paise,
    period: row.period,
    updatedAt: row.updated_at,
  };
}

function categorizeMerchant(merchant: string) {
  const value = merchant.toLowerCase();
  if (/zomato|swiggy|cafe|mess|food|restaurant|tea/.test(value)) return 'Food';
  if (/uber|ola|metro|bus|train|fuel/.test(value)) return 'Transport';
  if (/amazon|flipkart|myntra|store|shop/.test(value)) return 'Shopping';
  if (/recharge|electric|bill|wifi|phone/.test(value)) return 'Bills';
  return 'Other';
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
