/**
 * TaxFlow - Layered Transaction Classification Engine
 * Indian Business & CA Accounting Rules
 * Categorizes bank transactions into standardized Indian chart of accounts
 */

export interface ClassificationResult {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'UNKNOWN';
  category: string;
  suggestedLedger: string;
  confidence: number;
  reason: string;
}

interface Rule {
  keywords: string[];
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  suggestedLedger: string;
  confidence: number;
  reason: string;
}

const BUILT_IN_RULES: Rule[] = [
  // 1. Food & Refreshments
  {
    keywords: ['swiggy', 'zomato', 'ubereats', 'mcdonalds', 'starbucks', 'restaurant', 'cafe', 'food', 'canteen', 'dining'],
    type: 'EXPENSE',
    category: 'Food Expense',
    suggestedLedger: 'Food & Refreshments',
    confidence: 0.95,
    reason: 'Recognized dining / food delivery merchant',
  },
  // 2. Electricity & Utilities
  {
    keywords: ['electricity', 'bescom', 'msedcl', 'power', 'discom', 'tata power', 'adani electricity', 'torrent power', 'water bill', 'utility'],
    type: 'EXPENSE',
    category: 'Electricity Expense',
    suggestedLedger: 'Electricity Expenses',
    confidence: 0.96,
    reason: 'Recognized public utility or electricity provider',
  },
  // 3. Rent & Property Lease
  {
    keywords: ['rent', 'landlord', 'office lease', 'premises rent', 'tenancy', 'maintenance charges'],
    type: 'EXPENSE',
    category: 'Rent Expense',
    suggestedLedger: 'Rent & Maintenance',
    confidence: 0.92,
    reason: 'Identified office rental / premises lease disbursement',
  },
  // 4. Staff Salary & Payroll
  {
    keywords: ['salary', 'payroll', 'wages', 'stipend', 'staff advance', 'bonus payment'],
    type: 'EXPENSE',
    category: 'Salary',
    suggestedLedger: 'Salaries & Wages',
    confidence: 0.95,
    reason: 'Identified staff salary disbursement',
  },
  // 5. Professional Fees & Consulting
  {
    keywords: ['professional fees', 'legal fees', 'consulting fee', 'advisory fee', 'ca fees', 'retainer fee', 'audit fee', 'advocate'],
    type: 'EXPENSE',
    category: 'Professional Fees',
    suggestedLedger: 'Professional Fees Expense',
    confidence: 0.92,
    reason: 'Identified professional & legal services debit',
  },
  // 6. Bank Charges & Statutory fees
  {
    keywords: ['bank charges', 'chg', 'sms charges', 'annual fee', 'gst on chg', 'chq return', 'minimum balance', 'imps charges', 'neft charges'],
    type: 'EXPENSE',
    category: 'Bank Charges',
    suggestedLedger: 'Bank Charges & Commission',
    confidence: 0.98,
    reason: 'Identified bank service fee / statutory debit',
  },
  // 7. Travel & Conveyance
  {
    keywords: ['uber', 'ola', 'irctc', 'indigo', 'air india', 'makemytrip', 'fastag', 'fuel', 'petrol', 'diesel', 'toll', 'flight', 'railway'],
    type: 'EXPENSE',
    category: 'Travel',
    suggestedLedger: 'Travel & Conveyance',
    confidence: 0.94,
    reason: 'Identified travel / transport / fuel merchant',
  },
  // 8. Office Expenses & Consumables
  {
    keywords: ['stationery', 'office depot', 'xerox', 'courier', 'dhl', 'bluedart', 'printing', 'hardware', 'office supplies'],
    type: 'EXPENSE',
    category: 'Office Expense',
    suggestedLedger: 'Office Expenses',
    confidence: 0.90,
    reason: 'Identified office supplies / logistics consumable',
  },
  // 9. Purchases & Inventory
  {
    keywords: ['purchase', 'vendor payment', 'supplier payment', 'raw material', 'invoice payment', 'goods purchase'],
    type: 'EXPENSE',
    category: 'Purchase',
    suggestedLedger: 'Purchase Account',
    confidence: 0.88,
    reason: 'Identified vendor purchase disbursement',
  },
  // 10. Software, Cloud & Technology
  {
    keywords: ['aws', 'google cloud', 'github', 'zoom', 'slack', 'microsoft', 'adobe', 'godaddy', 'digitalocean', 'zoho'],
    type: 'EXPENSE',
    category: 'Office Expense',
    suggestedLedger: 'Software & Technology Expenses',
    confidence: 0.95,
    reason: 'Identified recurring SaaS / cloud infrastructure vendor',
  },
  // 11. Sales Receipts & Customer Inflows
  {
    keywords: ['sales receipt', 'customer payment', 'client payment', 'inward remittance', 'invoice receipt', 'pos settlement', 'pg settlement', 'razorpay', 'paytm merchant'],
    type: 'INCOME',
    category: 'Sales Receipt',
    suggestedLedger: 'Sales Account',
    confidence: 0.92,
    reason: 'Identified customer collection / sales receipt',
  },
  // 12. Client Receipts & Professional Income
  {
    keywords: ['client retainer', 'freelance', 'consulting receipt', 'advisory receipt', 'client receipts', 'fee received'],
    type: 'INCOME',
    category: 'Professional Fees',
    suggestedLedger: 'Professional Fees Income',
    confidence: 0.94,
    reason: 'Identified professional fees revenue receipt',
  },
  // 13. Cash Withdrawal (ATM / Self)
  {
    keywords: ['atm', 'cash withdrawal', 'atm wdl', 'self withdrawal', 'cash wdl'],
    type: 'TRANSFER',
    category: 'Cash Withdrawal',
    suggestedLedger: 'Cash in Hand',
    confidence: 0.99,
    reason: 'Contra cash withdrawal from bank to cash in hand',
  },
  // 14. Cash Deposit
  {
    keywords: ['cash deposit', 'by cash', 'cdm deposit', 'cash dep'],
    type: 'TRANSFER',
    category: 'Cash Withdrawal',
    suggestedLedger: 'Cash in Hand',
    confidence: 0.98,
    reason: 'Contra cash deposit from cash in hand to bank',
  },
  // 15. Inter-bank Transfer
  {
    keywords: ['transfer to', 'trf to', 'inter account', 'sweep in', 'sweep out', 'own account transfer', 'inter-bank'],
    type: 'TRANSFER',
    category: 'Inter-bank Transfer',
    suggestedLedger: 'Inter-Bank Transfer A/C',
    confidence: 0.90,
    reason: 'Identified internal account transfer / sweep',
  },
  // 16. Loans & Borrowings
  {
    keywords: ['loan disbursement', 'business loan', 'term loan', 'credit facility', 'overdraft'],
    type: 'INCOME',
    category: 'Loan',
    suggestedLedger: 'Secured/Unsecured Loans',
    confidence: 0.88,
    reason: 'Identified loan receipt / financing inflow',
  },
  // 17. EMI & Loan Repayments
  {
    keywords: ['emi', 'loan repayment', 'hdfc loan', 'bajaj finance', 'auto debit emi', 'nach loan', 'loan emi'],
    type: 'EXPENSE',
    category: 'EMI',
    suggestedLedger: 'Loan Repayment & Interest',
    confidence: 0.94,
    reason: 'Identified loan amortization / EMI installment debit',
  },
  // 18. Tax Payments (Advance Tax / Self Assessment)
  {
    keywords: ['advance tax', 'self assessment tax', 'income tax', 'challan 280', 'cbdts tax', 'tax payment'],
    type: 'EXPENSE',
    category: 'Tax Payment',
    suggestedLedger: 'Direct Taxes / Advance Tax',
    confidence: 0.96,
    reason: 'Direct income tax statutory payment (Challan 280)',
  },
  // 19. GST Payment
  {
    keywords: ['gst payment', 'gst pmt', 'pmt-06', 'gstin challan', 'cbic tax', 'gstin payment'],
    type: 'EXPENSE',
    category: 'GST Payment',
    suggestedLedger: 'GST Electronic Cash Ledger',
    confidence: 0.97,
    reason: 'Statutory GST liability remittance (PMT-06)',
  },
  // 20. TDS Payment
  {
    keywords: ['tds payment', 'challan 281', 'tax deducted at source', 'tds payable', 'nsdl challan'],
    type: 'EXPENSE',
    category: 'TDS Payment',
    suggestedLedger: 'TDS Payable A/C',
    confidence: 0.96,
    reason: 'Statutory TDS remittance (Challan 281)',
  },
];

export function classifyTransaction(
  narration: string,
  withdrawal: number,
  deposit: number,
  customMappings: Record<string, { type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; category: string; suggestedLedger: string }> = {}
): ClassificationResult {
  const norm = (narration || '').toLowerCase();
  const isWithdrawal = withdrawal > 0;
  const isDeposit = deposit > 0;

  // Layer 1: User-configured Custom Mappings
  for (const [pattern, mapping] of Object.entries(customMappings)) {
    if (norm.includes(pattern.toLowerCase())) {
      return {
        type: mapping.type,
        category: mapping.category,
        suggestedLedger: mapping.suggestedLedger,
        confidence: 0.99,
        reason: `Matched verified firm rule for "${pattern}"`,
      };
    }
  }

  // Layer 2: Built-in Indian Accounting Rules
  for (const rule of BUILT_IN_RULES) {
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) {
        // Check direction reconciliation
        if (rule.type === 'EXPENSE' && isDeposit && !isWithdrawal) {
          return {
            type: 'INCOME',
            category: `${rule.category} (Refund/Reversal)`,
            suggestedLedger: rule.suggestedLedger,
            confidence: 0.82,
            reason: `Refund or reversal credited from "${kw}"`,
          };
        }

        if (rule.type === 'INCOME' && isWithdrawal && !isDeposit) {
          return {
            type: 'EXPENSE',
            category: `${rule.category} (Debit)`,
            suggestedLedger: rule.suggestedLedger,
            confidence: 0.80,
            reason: `Debit transaction with income keyword "${kw}"`,
          };
        }

        return {
          type: rule.type,
          category: rule.category,
          suggestedLedger: rule.suggestedLedger,
          confidence: rule.confidence,
          reason: rule.reason,
        };
      }
    }
  }

  // Layer 3: Directional Heuristics
  if (isDeposit) {
    // Check for common receipt markers
    if (/upi|neft|imps|rtgs|cr|inw|by\s+trf|credit/i.test(norm)) {
      return {
        type: 'INCOME',
        category: 'Sales Receipt',
        suggestedLedger: 'Client Receipts',
        confidence: 0.72,
        reason: 'Inflow receipt detected via electronic banking channel',
      };
    }
    return {
      type: 'INCOME',
      category: 'Unknown',
      suggestedLedger: 'Suspense Account',
      confidence: 0.50,
      reason: 'Unclassified deposit - review required to allocate ledger',
    };
  }

  if (isWithdrawal) {
    // Check for common payment markers
    if (/upi|pos|ecom|dr|outw|to\s+trf|debit|ach/i.test(norm)) {
      return {
        type: 'EXPENSE',
        category: 'Office Expense',
        suggestedLedger: 'Office Expenses',
        confidence: 0.70,
        reason: 'Electronic disbursement - auto-suggested to Office Expenses',
      };
    }
    return {
      type: 'EXPENSE',
      category: 'Unknown',
      suggestedLedger: 'Suspense Account',
      confidence: 0.45,
      reason: 'Unclassified withdrawal - manual review required',
    };
  }

  return {
    type: 'UNKNOWN',
    category: 'Unknown',
    suggestedLedger: 'Suspense Account',
    confidence: 0.30,
    reason: 'Zero amount or unclassifiable entry',
  };
}
