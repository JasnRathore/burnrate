import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

import { summarizeDashboard } from '@/features/burnrate/calculations';
import type { AppSettings, Budget, DashboardSummary, SmsParseResult, Transaction, TransactionDirection } from '@/features/burnrate/types';
import {
  createManualTransaction,
  createSmsTransaction,
  deleteTransaction as dbDeleteTransaction,
  updateTransaction as dbUpdateTransaction,
  getAppSettings,
  getPendingSyncCount,
  initializeBurnrateDb,
  listBudgets,
  listTransactions,
  setSetting,
  upsertBudget,
  deleteBudget as dbDeleteBudget,
} from '@/lib/db/burnrate-db';

type BurnrateState = {
  budgets: Budget[];
  error: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  settings: AppSettings;
  summary: DashboardSummary;
  transactions: Transaction[];
  createTransaction: (input: {
    amountPaise: number;
    category: string;
    direction: TransactionDirection;
    merchant: string;
  }) => Promise<void>;
  importSmsParse: (input: SmsParseResult) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, input: { amountPaise: number; category: string; direction: TransactionDirection; merchant: string }) => Promise<void>;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setNetworkOnline: (isOnline: boolean) => void;
  setOpeningBalance: (amountPaise: number) => Promise<void>;
  setSmsConsent: (granted: boolean) => Promise<void>;
  setSmsMonitoring: (enabled: boolean) => Promise<void>;
  saveBudget: (category: string, limitPaise: number) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
};

const emptySettings: AppSettings = {
  openingBalancePaise: 0,
  smsConsentGranted: false,
  smsMonitoringEnabled: false,
};

export const useBurnrateStore = create<BurnrateState>((set, get) => ({
  budgets: [],
  error: null,
  isInitialized: false,
  isLoading: false,
  isOnline: true,
  pendingSyncCount: 0,
  settings: emptySettings,
  summary: summarizeDashboard([], [], emptySettings),
  transactions: [],
  async createTransaction(input) {
    await createManualTransaction(input);
    await get().refresh();
  },
  async deleteTransaction(id) {
    await dbDeleteTransaction(id);
    await get().refresh();
  },
  async updateTransaction(id, input) {
    await dbUpdateTransaction(id, input);
    await get().refresh();
  },
  async importSmsParse(input) {
    const result = await createSmsTransaction(input);
    if (result.inserted) {
      await get().refresh();
    }
    return result.inserted;
  },
  async initialize() {
    if (get().isInitialized) return;
    set({ isLoading: true });
    try {
      await initializeBurnrateDb();
      const state = await loadState();
      set({ ...state, error: null, isInitialized: true, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to initialize Burnrate', isLoading: false });
    }
  },
  async refresh() {
    const state = await loadState();
    set({ ...state, error: null });
  },
  setNetworkOnline(isOnline) {
    set({ isOnline });
  },
  async setOpeningBalance(amountPaise) {
    await setSetting('opening_balance_paise', amountPaise);
    await get().refresh();
  },
  async setSmsConsent(granted) {
    await setSetting('sms_consent_granted', granted);
    if (!granted) {
      await setSetting('sms_monitoring_enabled', false);
    }
    await get().refresh();
  },
  async setSmsMonitoring(enabled) {
    await setSetting('sms_monitoring_enabled', enabled);
    await get().refresh();
  },
  async saveBudget(category, limitPaise) {
    await upsertBudget(category, limitPaise);
    await get().refresh();
  },
  async deleteBudget(id) {
    await dbDeleteBudget(id);
    await get().refresh();
  },
}));

export function attachNetworkListener() {
  return NetInfo.addEventListener((state) => {
    useBurnrateStore.getState().setNetworkOnline(Boolean(state.isConnected));
  });
}

async function loadState() {
  const [transactions, budgets, settings, pendingSyncCount] = await Promise.all([
    listTransactions(),
    listBudgets(),
    getAppSettings(),
    getPendingSyncCount(),
  ]);
  return {
    budgets,
    pendingSyncCount,
    settings,
    summary: summarizeDashboard(transactions, budgets, settings),
    transactions,
  };
}
