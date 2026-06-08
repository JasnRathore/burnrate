import type { SmsParseResult, TransactionDirection } from '../burnrate/types';

const MONEY_PATTERN =
  /(?:inr|rs\.?|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)/i;
const FINANCIAL_HINTS = /\b(upi|debited|credited|spent|paid|received|a\/c|acct|account|transaction|txn|bank|card|wallet|phonepe|gpay|google pay|paytm|sbi|hdfc|icici)\b/i;
const CREDIT_HINTS = /\b(credited|received|deposited|refund|cashback)\b/i;
const DEBIT_HINTS = /\b(debited|spent|paid|purchase|withdrawn|sent)\b/i;
const MERCHANT_PATTERNS = [
  /\b(?:to|at|towards|paid to)\s+([a-z0-9 .&_-]{3,40})/i,
  /\b(?:from)\s+([a-z0-9 .&_-]{3,40})/i,
  /\b(?:upi\/p2m\/|merchant[:\s]+)([a-z0-9 .&_-]{3,40})/i,
];
const CREDIT_MERCHANT_PATTERNS = [
  /\b(?:from)\s+([a-z0-9 .&_-]{3,40})/i,
  /\b(?:merchant[:\s]+)([a-z0-9 .&_-]{3,40})/i,
];

export function looksLikeFinancialSms(message: string) {
  return FINANCIAL_HINTS.test(message) && MONEY_PATTERN.test(message);
}

export async function createSmsDedupeKey(rawMessage: string, occurredAt: number, amountPaise: number) {
  return sha256Hex(`${rawMessage}|${occurredAt}|${amountPaise}`);
}

export async function parseFinancialSms(
  rawMessage: string,
  receivedAt = Date.now()
): Promise<SmsParseResult | null> {
  const normalized = rawMessage.replace(/\s+/g, ' ').trim();
  if (!looksLikeFinancialSms(normalized)) {
    return null;
  }

  const moneyMatch = MONEY_PATTERN.exec(normalized);
  const amountText = moneyMatch?.[1] ?? moneyMatch?.[2];
  const amount = Number(amountText?.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const direction: TransactionDirection = CREDIT_HINTS.test(normalized)
    ? 'income'
    : DEBIT_HINTS.test(normalized)
      ? 'expense'
      : 'expense';

  const merchant =
    (direction === 'income' ? CREDIT_MERCHANT_PATTERNS : MERCHANT_PATTERNS)
      .map((pattern) => pattern.exec(normalized)?.[1]?.trim())
      .find(Boolean)
      ?.replace(/\b(on|via|ref|upi|txn|transaction|rs|inr)\b.*$/i, '')
      .trim() || (direction === 'income' ? 'Incoming transfer' : 'UPI transaction');

  const amountPaise = Math.round(amount * 100);
  const dedupeKey = await createSmsDedupeKey(normalized, receivedAt, amountPaise);

  return {
    amountPaise,
    confidence: merchant === 'UPI transaction' || merchant === 'Incoming transfer' ? 0.72 : 0.9,
    dedupeKey,
    direction,
    merchant: titleCase(merchant),
    occurredAt: receivedAt,
  };
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function sha256Hex(value: string) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  const Crypto = await import('expo-crypto');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
