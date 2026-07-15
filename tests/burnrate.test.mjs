import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRupeesToPaise, summarizeDashboard } from '../features/burnrate/calculations.ts';
import { createSmsDedupeKey, parseFinancialSms } from '../features/sms/sms-parser.ts';

const now = new Date('2026-05-20T12:00:00.000Z').getTime();

test('runway calculation uses seven-day burn and current balance', () => {
  const summary = summarizeDashboard(
    [
      transaction('expense', 420000, 'Food', now - 24 * 60 * 60 * 1000),
      transaction('income', 300000, 'Income', now - 2 * 24 * 60 * 60 * 1000),
    ],
    [{ id: 'food', category: 'Food', limitPaise: 500000, period: 'monthly', createdAt: now, updatedAt: now }],
    {
      openingBalancePaise: 300000,
      openingBalanceSetAt: 0,
      smsConsentGranted: false,
      smsMonitoringEnabled: false,
      onboardingCompleted: true,
    },
    now
  );

  assert.equal(summary.balancePaise, 180000);
  assert.equal(summary.dailyBurnPaise, 60000);
  assert.equal(summary.runwayDays, 3);
  assert.equal(summary.budgetWarnings[0].level, 'warning');
  assert.equal(summary.weekDays.length, 7);
  assert.ok(typeof summary.weekSpendPaise === 'number');
});

test('balance ignores transactions at or before baseline set time', () => {
  const setAt = now - 12 * 60 * 60 * 1000; // baseline set midday yesterday window
  const summary = summarizeDashboard(
    [
      // Already reflected in bank balance when baseline was set — must not count
      transaction('income', 395800, 'Income', setAt - 60 * 60 * 1000),
      transaction('expense', 10000, 'Food', setAt - 30 * 60 * 1000),
      // After baseline — should count
      transaction('expense', 50000, 'Food', setAt + 60 * 60 * 1000),
    ],
    [],
    {
      openingBalancePaise: 1000000,
      openingBalanceSetAt: setAt,
      smsConsentGranted: false,
      smsMonitoringEnabled: false,
      onboardingCompleted: true,
    },
    now
  );

  // 10000 rupees baseline - 500 expense after set = 9500 rupees in paise
  assert.equal(summary.balancePaise, 950000);
});

test('parses debit UPI SMS messages', async () => {
  const parsed = await parseFinancialSms(
    'HDFC Bank: Rs.120.50 debited from A/c XX1234 to SWIGGY via UPI. Txn ID 12345',
    now
  );

  assert.equal(parsed?.amountPaise, 12050);
  assert.equal(parsed?.direction, 'expense');
  assert.equal(parsed?.merchant, 'Swiggy');
  assert.equal(parsed?.dedupeKey.length, 64);
});

test('parses credit SMS messages', async () => {
  const parsed = await parseFinancialSms(
    'SBI: INR 2,000 credited to your account from RAHUL via UPI on 20-May.',
    now
  );

  assert.equal(parsed?.amountPaise, 200000);
  assert.equal(parsed?.direction, 'income');
  assert.equal(parsed?.merchant, 'Rahul');
});

test('parseRupeesToPaise allows zero and rejects invalid', () => {
  assert.equal(parseRupeesToPaise('0'), 0);
  assert.equal(parseRupeesToPaise('150.5'), 15050);
  assert.equal(parseRupeesToPaise(''), null);
  assert.equal(parseRupeesToPaise('-10'), null);
});

test('dedupe hash is stable and changes with amount', async () => {
  const a = await createSmsDedupeKey('PhonePe paid Rs 99 to cafe', now, 9900);
  const b = await createSmsDedupeKey('PhonePe paid Rs 99 to cafe', now, 9900);
  const c = await createSmsDedupeKey('PhonePe paid Rs 99 to cafe', now, 10000);

  assert.equal(a, b);
  assert.notEqual(a, c);
});

function transaction(direction, amountPaise, category, occurredAt) {
  return {
    amountPaise,
    category,
    createdAt: occurredAt,
    direction,
    id: `${direction}-${amountPaise}`,
    merchant: category,
    occurredAt,
    source: 'manual',
    syncStatus: 'pending',
  };
}
