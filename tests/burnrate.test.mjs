import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeDashboard } from '../features/burnrate/calculations.ts';
import { createSmsDedupeKey, parseFinancialSms } from '../features/sms/sms-parser.ts';

const now = new Date('2026-05-20T12:00:00.000Z').getTime();

test('runway calculation uses seven-day burn and current balance', () => {
  const summary = summarizeDashboard(
    [
      transaction('expense', 420000, 'Food', now - 24 * 60 * 60 * 1000),
      transaction('income', 300000, 'Income', now - 2 * 24 * 60 * 60 * 1000),
    ],
    [{ id: 'food', category: 'Food', limitPaise: 500000, period: 'monthly', createdAt: now, updatedAt: now }],
    { openingBalancePaise: 300000, smsConsentGranted: false, smsMonitoringEnabled: false },
    now
  );

  assert.equal(summary.balancePaise, 180000);
  assert.equal(summary.dailyBurnPaise, 60000);
  assert.equal(summary.runwayDays, 3);
  assert.equal(summary.budgetWarnings[0].level, 'warning');
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
