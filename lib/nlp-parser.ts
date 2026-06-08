import { CATEGORIES } from '@/features/burnrate/types';

export type ParsedTransaction = {
  amount: number;
  amountPaise: number;
  direction: 'expense' | 'income';
  category: string;
  merchant: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'food', 'lunch', 'dinner', 'breakfast', 'starbucks', 'coffee', 'tea', 'chai', 'cafe',
    'mcdonalds', 'pizza', 'swiggy', 'zomato', 'eat', 'eating', 'restaurant', 'groceries',
    'grocery', 'supermarket', 'milk', 'bread', 'veggies', 'vegetables', 'fruit', 'burger',
    'dominos', 'kfc', 'subway', 'dine', 'sweets', 'bakery'
  ],
  Transport: [
    'cab', 'uber', 'ola', 'auto', 'metro', 'bus', 'train', 'flight', 'ticket', 'petrol',
    'fuel', 'diesel', 'gas', 'travel', 'ride', 'rickshaw', 'rapido', 'taxi', 'toll', 'parking'
  ],
  Rent: [
    'rent', 'landlord', 'flat', 'room', 'pg', 'hostel', 'lease', 'house rent'
  ],
  College: [
    'college', 'school', 'tuition', 'fee', 'fees', 'book', 'books', 'stationery', 'pen',
    'pencil', 'exam', 'library', 'course', 'academy', 'class', 'classes'
  ],
  Shopping: [
    'shopping', 'clothes', 'dress', 'shirt', 'pants', 'shoes', 'amazon', 'flipkart',
    'myntra', 'mall', 'store', 'bought', 'buy', 'gift', 'gifts', 'gadget', 'phone', 'laptop',
    'electronics', 'furniture', 'zara', 'h&m'
  ],
  Bills: [
    'bill', 'electricity', 'water', 'wifi', 'internet', 'recharge', 'broadband', 'gas bill',
    'netflix', 'spotify', 'youtube', 'apple', 'sub', 'subscription', 'mobile bill', 'phone recharge',
    'dth', 'insurance', 'tax'
  ],
  Entertainment: [
    'movie', 'cinema', 'theatre', 'game', 'gaming', 'party', 'club', 'beer', 'wine', 'drinks',
    'concert', 'event', 'show', 'fun', 'bar', 'pub', 'steam', 'playstation', 'xbox'
  ],
  Health: [
    'health', 'doctor', 'medicine', 'pharmacy', 'hospital', 'dentist', 'gym', 'workout',
    'fitness', 'protein', 'clinic', 'medical', 'chemist', 'physio', 'therapy'
  ],
  Income: [
    'salary', 'paycheck', 'refund', 'cashback', 'dividend', 'interest', 'side hustle',
    'earned', 'got', 'bonus', 'pay', 'received', 'transfer'
  ],
};

const EXPENSE_KEYWORDS = [
  'spent', 'paid', 'buy', 'bought', 'gave', 'sent', 'purchase', 'expense', 'shopping', 'cost',
  'loss', 'debit', 'charged', 'spent on'
];

const INCOME_KEYWORDS = [
  'received', 'got', 'earned', 'income', 'salary', 'refund', 'won', 'credit', 'deposit', 'bonus',
  'interest', 'cashback'
];

/**
 * Capitalize first letter of each word in a string
 */
function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Smart Natural Language Transaction Parser
 * @param text The plain text input, e.g., "spent 350 at Starbucks" or "received 50000 salary"
 */
export function parseNaturalLanguageTransaction(text: string): ParsedTransaction {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      amount: 0,
      amountPaise: 0,
      direction: 'expense',
      category: 'Other',
      merchant: '',
    };
  }

  // 1. Extract Amount
  // Matches numbers like: 300, 1500.50, ₹1,500, Rs. 250, 45,000 etc.
  const amountMatch = cleanText.match(/(?:inr|rs\.?|₹|usd|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
  let amount = 0;
  let rawAmountString = '';

  if (amountMatch && amountMatch[1]) {
    rawAmountString = amountMatch[1];
    // Remove commas if any
    const normalizedAmount = rawAmountString.replace(/,/g, '');
    amount = parseFloat(normalizedAmount) || 0;
  }

  const amountPaise = Math.round(amount * 100);

  // 2. Extract Direction
  const lowerText = cleanText.toLowerCase();
  let direction: 'expense' | 'income' = 'expense';

  const hasIncomeKeyword = INCOME_KEYWORDS.some(kw => lowerText.includes(kw));
  const hasExpenseKeyword = EXPENSE_KEYWORDS.some(kw => lowerText.includes(kw));

  if (hasIncomeKeyword && !hasExpenseKeyword) {
    direction = 'income';
  }

  // 3. Extract Category
  let category = direction === 'income' ? 'Income' : 'Other';
  
  if (direction === 'expense') {
    let bestMatchCategory = 'Other';
    let maxKeywordScore = 0;

    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (catName === 'Income') continue; // Skip income for expenses
      
      let score = 0;
      for (const keyword of keywords) {
        // Look for exact word matches or boundary matches
        const regex = new RegExp(`\\b${keyword}\\b|${keyword}`, 'i');
        if (regex.test(lowerText)) {
          score += 1;
        }
      }

      if (score > maxKeywordScore) {
        maxKeywordScore = score;
        bestMatchCategory = catName;
      }
    }
    category = bestMatchCategory;
  }

  // 4. Extract Merchant / Description
  // Strategy: Try to find text after prepositions like "at", "from", "to", "on", "for"
  // E.g. "spent 500 at Starbucks" -> "Starbucks"
  // "350 for Uber ride" -> "Uber ride"
  let merchant = '';
  const prepMatches = cleanText.match(/\b(at|on|for|from|to|in)\b\s+(.+)$/i);

  if (prepMatches && prepMatches[2]) {
    let candidate = prepMatches[2].trim();
    // Remove amount string if it leaks into the candidate
    if (rawAmountString) {
      candidate = candidate.replace(new RegExp(rawAmountString, 'g'), '');
    }
    // Clean up punctuation and capitalize
    candidate = candidate.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();
    if (candidate.length > 0) {
      merchant = capitalizeWords(candidate);
    }
  }

  // Fallback: If no preposition found, strip out amount, prepositions, action keywords and category names,
  // and use what's left as merchant.
  if (!merchant) {
    let remaining = lowerText;
    
    // Strip amount
    if (rawAmountString) {
      remaining = remaining.replace(rawAmountString.toLowerCase(), '');
    }
    // Strip currency symbols
    remaining = remaining.replace(/(inr|rs\.?|₹|usd|\$)/gi, '');
    
    // Strip action keywords
    const allKeywords = [...EXPENSE_KEYWORDS, ...INCOME_KEYWORDS, 'at', 'on', 'for', 'from', 'to', 'in', 'spent', 'paid'];
    for (const kw of allKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      remaining = remaining.replace(regex, '');
    }

    // Strip category names themselves
    for (const cat of CATEGORIES) {
      const regex = new RegExp(`\\b${cat}\\b`, 'gi');
      remaining = remaining.replace(regex, '');
    }

    // Clean up spaces, non-alphanumeric, and capitalize
    const finalText = remaining.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (finalText) {
      merchant = capitalizeWords(finalText);
    } else {
      // Last resort: just describe the transaction
      merchant = direction === 'income' ? 'Income' : category !== 'Other' ? category : 'Expense';
    }
  }

  return {
    amount,
    amountPaise,
    direction,
    category,
    merchant,
  };
}
