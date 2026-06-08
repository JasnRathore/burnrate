import * as SQLite from 'expo-sqlite';

import { CATEGORIES, type AppSettings, type Budget, type SmsParseResult, type Transaction, type TransactionDirection } from '@/features/burnrate/types';

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

export async function initializeBurnrateDb() {
  const db = await getBurnrateDb();
  const seeded = await getSetting(db, 'demo_seeded');
  if (!seeded) {
    await seedDemoData(db);
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
  const [openingBalance, smsConsent, smsEnabled] = await Promise.all([
    getSetting(db, 'opening_balance_paise'),
    getSetting(db, 'sms_consent_granted'),
    getSetting(db, 'sms_monitoring_enabled'),
  ]);

  return {
    openingBalancePaise: Number(openingBalance ?? 0),
    smsConsentGranted: smsConsent === 'true',
    smsMonitoringEnabled: smsEnabled === 'true',
  };
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

async function seedDemoData(db: SQLite.SQLiteDatabase) {
  await setSetting('opening_balance_paise', 850000);
  await setSetting('sms_consent_granted', false);
  await setSetting('sms_monitoring_enabled', false);

  const now = Date.now();
  const samples = [
    ['expense', 'Hostel mess', 'Food', 12500, now - 1 * 24 * 60 * 60 * 1000],
    ['expense', 'Metro card', 'Transport', 8000, now - 2 * 24 * 60 * 60 * 1000],
    ['expense', 'Book store', 'College', 48000, now - 4 * 24 * 60 * 60 * 1000],
    ['income', 'Monthly allowance', 'Income', 500000, now - 6 * 24 * 60 * 60 * 1000],
  ] as const;

  for (const [direction, merchant, category, amountPaise, occurredAt] of samples) {
    await insertTransaction({
      amountPaise,
      category,
      dedupeKey: null,
      direction,
      merchant,
      occurredAt,
      source: 'manual',
    });
  }

  const createdAt = Date.now();
  for (const category of CATEGORIES.slice(0, 4)) {
    const id = category.toLowerCase().replace(/\W+/g, '-');
    await db.runAsync(
      `INSERT OR IGNORE INTO budgets (id, category, limit_paise, period, created_at, updated_at)
       VALUES (?, ?, ?, 'monthly', ?, ?)`,
      id,
      category,
      category === 'Food' ? 450000 : 200000,
      createdAt,
      createdAt
    );
  }
  await setSetting('demo_seeded', true);
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
