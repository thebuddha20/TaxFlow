/**
 * TaxFlow - Multi-format Bank Statement Parser
 * Supports PDF, Excel (.xlsx, .xls), CSV, and Plain Text formats
 * Auto-detects Indian banks, tabular layouts, and column headers
 */

import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { BankTransaction, TransactionType, TransactionReviewStatus, LearnedMapping } from '../../src/types.ts';
import { classifyTransaction } from './transactionClassifier.ts';
import { detectDuplicates, TransactionInput } from './duplicateDetector.ts';
import { VoucherEngine } from './voucherEngine.ts';

export interface ColumnMapping {
  dateCol?: string;
  descCol?: string;
  debitCol?: string;
  creditCol?: string;
  amountCol?: string;
  balanceCol?: string;
  refCol?: string;
}

export interface ParseOptions {
  firmId: string;
  companyId: string;
  clientId?: string;
  customMappings?: ColumnMapping;
  existingTransactions?: BankTransaction[];
  bankNameOverride?: string;
  accountNumberOverride?: string;
  learnedMappings?: LearnedMapping[];
}

export interface ParseResult {
  success: boolean;
  detectedBank: string;
  accountNumber: string;
  transactions: BankTransaction[];
  totalDetected: number;
  totalDeposits: number;
  totalWithdrawals: number;
  duplicatesCount: number;
  needsReviewCount: number;
  autoApprovedCount: number;
  error?: string;
}

interface RawTxnRow {
  date: string;
  narration: string;
  referenceNumber: string;
  withdrawal: number;
  deposit: number;
  balance: number;
}

export class BankStatementParser {
  /**
   * Parse an uploaded file buffer (PDF, XLSX, XLS, CSV)
   */
  public static async parseFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options: ParseOptions
  ): Promise<ParseResult> {
    const ext = (fileName.split('.').pop() || '').toLowerCase();

    try {
      let rawRows: RawTxnRow[] = [];
      let detectedBank = options.bankNameOverride || 'Indian Commercial Bank';
      let detectedAccount = options.accountNumberOverride || '';

      if (ext === 'pdf' || mimeType.includes('pdf')) {
        const parsed = await this.parsePdfBuffer(buffer);
        rawRows = parsed.rows;
        if (parsed.detectedBank) detectedBank = parsed.detectedBank;
        if (parsed.accountNumber) detectedAccount = parsed.accountNumber;
      } else if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
        const parsed = this.parseSpreadsheetBuffer(buffer, options.customMappings);
        rawRows = parsed.rows;
        if (parsed.detectedBank) detectedBank = parsed.detectedBank;
        if (parsed.accountNumber) detectedAccount = parsed.accountNumber;
      } else {
        // Fallback to text parsing
        const text = buffer.toString('utf-8');
        const parsed = this.parseTextContent(text, options.customMappings);
        rawRows = parsed.rows;
        if (parsed.detectedBank) detectedBank = parsed.detectedBank;
      }

      if (rawRows.length === 0) {
        return {
          success: false,
          detectedBank,
          accountNumber: detectedAccount,
          transactions: [],
          totalDetected: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          duplicatesCount: 0,
          needsReviewCount: 0,
          autoApprovedCount: 0,
          error: 'No valid transaction records could be extracted from the uploaded document. Please check the file format or column headers.',
        };
      }

      // Convert raw rows to BankTransactions with classification and duplicate detection
      return this.processRawRows(rawRows, detectedBank, detectedAccount, options);
    } catch (err: any) {
      console.error('Error in BankStatementParser.parseFile:', err);
      return {
        success: false,
        detectedBank: 'Unknown Bank',
        accountNumber: '',
        transactions: [],
        totalDetected: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        duplicatesCount: 0,
        needsReviewCount: 0,
        autoApprovedCount: 0,
        error: `Failed to parse bank statement: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Parse plain text or CSV string
   */
  public static parseText(text: string, options: ParseOptions): ParseResult {
    const { rows, detectedBank, accountNumber } = this.parseTextContent(text, options.customMappings);
    return this.processRawRows(rows, options.bankNameOverride || detectedBank, options.accountNumberOverride || accountNumber, options);
  }

  // --- PDF Parsing ---
  private static async parsePdfBuffer(buffer: Buffer): Promise<{ rows: RawTxnRow[]; detectedBank: string; accountNumber: string }> {
    let fullText = '';
    try {
      const parser = new (PDFParse as any)({ data: buffer });
      await parser.load();
      const textResult = await parser.getText();
      fullText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
    } catch (err) {
      console.warn('PDFParse failed, falling back to buffer string search:', err);
      fullText = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
    }

    const detectedBank = this.detectBankName(fullText);
    const accountNumber = this.detectAccountNumber(fullText);
    const rows = this.extractRowsFromLines(fullText.split(/\r?\n/));

    return { rows, detectedBank, accountNumber };
  }

  // --- Excel / CSV Parsing via xlsx ---
  private static parseSpreadsheetBuffer(
    buffer: Buffer,
    customMappings?: ColumnMapping
  ): { rows: RawTxnRow[]; detectedBank: string; accountNumber: string } {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read as 2D array of cells
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawData || rawData.length === 0) {
      return { rows: [], detectedBank: '', accountNumber: '' };
    }

    // Inspect header text for bank name detection
    const fullTextSample = rawData.slice(0, 15).map(r => r.join(' ')).join('\n');
    const detectedBank = this.detectBankName(fullTextSample);
    const accountNumber = this.detectAccountNumber(fullTextSample);

    // Locate header row by looking for banking keywords
    let headerRowIdx = -1;
    let colIndices: Record<string, number> = {};

    for (let r = 0; r < Math.min(rawData.length, 30); r++) {
      const row = rawData[r].map(c => String(c || '').trim().toLowerCase());
      const indices = this.matchHeaderColumns(row, customMappings);
      if (indices.dateCol !== undefined && (indices.debitCol !== undefined || indices.amountCol !== undefined || indices.descCol !== undefined)) {
        headerRowIdx = r;
        colIndices = indices;
        break;
      }
    }

    // If no explicit header matched, assume row 0 if it has dates/numbers
    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      colIndices = this.matchHeaderColumns(rawData[0].map(c => String(c || '').trim().toLowerCase()), customMappings);
    }

    const rows: RawTxnRow[] = [];
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const dateRaw = colIndices.dateCol !== undefined ? row[colIndices.dateCol] : row[0];
      const parsedDate = this.normalizeDate(dateRaw);
      if (!parsedDate) continue; // Skip non-transaction or summary rows

      const narration = colIndices.descCol !== undefined ? String(row[colIndices.descCol] || '').trim() : String(row[1] || '').trim();
      const ref = colIndices.refCol !== undefined ? String(row[colIndices.refCol] || '').trim() : '';

      let withdrawal = 0;
      let deposit = 0;

      if (colIndices.debitCol !== undefined && colIndices.creditCol !== undefined) {
        withdrawal = this.parseAmount(row[colIndices.debitCol]);
        deposit = this.parseAmount(row[colIndices.creditCol]);
      } else if (colIndices.amountCol !== undefined) {
        const val = this.parseAmount(row[colIndices.amountCol]);
        const typeHint = String(row[colIndices.amountCol] || '') + ' ' + narration;
        if (/dr|debit|-/i.test(typeHint)) {
          withdrawal = Math.abs(val);
        } else {
          deposit = Math.abs(val);
        }
      }

      const balance = colIndices.balanceCol !== undefined ? this.parseAmount(row[colIndices.balanceCol]) : 0;

      if (withdrawal > 0 || deposit > 0) {
        rows.push({
          date: parsedDate,
          narration: narration || 'Bank Transaction',
          referenceNumber: ref,
          withdrawal,
          deposit,
          balance,
        });
      }
    }

    return { rows, detectedBank, accountNumber };
  }

  // --- Plain Text Parsing ---
  private static parseTextContent(
    text: string,
    _customMappings?: ColumnMapping
  ): { rows: RawTxnRow[]; detectedBank: string; accountNumber: string } {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const detectedBank = this.detectBankName(text.slice(0, 1500));
    const accountNumber = this.detectAccountNumber(text.slice(0, 1500));
    const rows = this.extractRowsFromLines(lines);

    return { rows, detectedBank, accountNumber };
  }

  private static extractRowsFromLines(lines: string[]): RawTxnRow[] {
    const rows: RawTxnRow[] = [];

    for (const line of lines) {
      // Split by tab, pipe, or comma
      let parts: string[] = [];
      if (line.includes('\t')) parts = line.split('\t');
      else if (line.includes('|')) parts = line.split('|');
      else if (line.includes(',')) parts = this.parseCsvLine(line);
      else {
        // Space separated line with date at start
        const dateMatch = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}-[A-Za-z]{3}-\d{2,4})/);
        if (dateMatch) {
          const rest = line.slice(dateMatch[0].length).trim();
          const amounts = rest.match(/[\d,]+\.\d{2}/g);
          if (amounts && amounts.length >= 1) {
            const date = this.normalizeDate(dateMatch[0]);
            if (date) {
              const withdrawal = this.parseAmount(amounts[0]);
              const deposit = amounts.length > 1 ? this.parseAmount(amounts[1]) : 0;
              const narration = rest.replace(/[\d,]+\.\d{2}/g, '').replace(/\s+/g, ' ').trim();
              rows.push({
                date,
                narration: narration || 'Bank Transaction',
                referenceNumber: '',
                withdrawal,
                deposit,
                balance: 0,
              });
              continue;
            }
          }
        }
        continue;
      }

      parts = parts.map(p => p.trim());
      if (parts.length < 3) continue;

      // Check first 1-2 columns for date
      let date = this.normalizeDate(parts[0]);
      let colOffset = 0;
      if (!date && parts.length > 3) {
        date = this.normalizeDate(parts[1]);
        if (date) colOffset = 1;
      }
      if (!date) continue;

      const narration = parts[colOffset + 1] || 'Bank Transaction';
      let withdrawal = 0;
      let deposit = 0;
      let balance = 0;
      let ref = '';

      // Find amounts in remaining columns
      const remainingCols = parts.slice(colOffset + 2);
      const numValues: number[] = [];
      for (const col of remainingCols) {
        const amt = this.parseAmount(col);
        if (amt > 0) numValues.push(amt);
        else if (col.length > 5 && !ref && /[A-Z0-9]{6,}/.test(col)) {
          ref = col;
        }
      }

      if (numValues.length === 1) {
        // Single amount, check narration for direction
        if (/dr|withdrawal|debit|payment|pos|upi/i.test(line)) {
          withdrawal = numValues[0];
        } else {
          deposit = numValues[0];
        }
      } else if (numValues.length >= 2) {
        // 2 or 3 values: withdrawal, deposit, balance OR amount, balance
        if (remainingCols.length >= 3 && this.parseAmount(remainingCols[0]) > 0 && this.parseAmount(remainingCols[1]) === 0) {
          withdrawal = this.parseAmount(remainingCols[0]);
          balance = this.parseAmount(remainingCols[2]);
        } else if (remainingCols.length >= 3 && this.parseAmount(remainingCols[0]) === 0 && this.parseAmount(remainingCols[1]) > 0) {
          deposit = this.parseAmount(remainingCols[1]);
          balance = this.parseAmount(remainingCols[2]);
        } else {
          withdrawal = numValues[0];
          deposit = numValues[1];
          if (numValues.length >= 3) balance = numValues[2];
        }
      }

      if (withdrawal > 0 || deposit > 0) {
        rows.push({
          date,
          narration,
          referenceNumber: ref,
          withdrawal,
          deposit,
          balance,
        });
      }
    }

    return rows;
  }

  // --- Header Column Identification ---
  private static matchHeaderColumns(headers: string[], customMappings?: ColumnMapping): Record<string, number> {
    const indices: Record<string, number> = {};

    headers.forEach((h, idx) => {
      const norm = h.toLowerCase().replace(/[_\s-]+/g, ' ').trim();

      // Custom override checks
      if (customMappings?.dateCol && norm.includes(customMappings.dateCol.toLowerCase())) indices.dateCol = idx;
      if (customMappings?.descCol && norm.includes(customMappings.descCol.toLowerCase())) indices.descCol = idx;
      if (customMappings?.debitCol && norm.includes(customMappings.debitCol.toLowerCase())) indices.debitCol = idx;
      if (customMappings?.creditCol && norm.includes(customMappings.creditCol.toLowerCase())) indices.creditCol = idx;
      if (customMappings?.amountCol && norm.includes(customMappings.amountCol.toLowerCase())) indices.amountCol = idx;
      if (customMappings?.balanceCol && norm.includes(customMappings.balanceCol.toLowerCase())) indices.balanceCol = idx;

      // Standard heuristic checks
      if (indices.dateCol === undefined && (norm.includes('date') || norm === 'dt' || norm.includes('txn date') || norm.includes('value dt'))) {
        indices.dateCol = idx;
      } else if (indices.descCol === undefined && (norm.includes('particulars') || norm.includes('narration') || norm.includes('description') || norm.includes('remarks') || norm.includes('details'))) {
        indices.descCol = idx;
      } else if (indices.debitCol === undefined && (norm.includes('withdrawal') || norm.includes('debit') || norm === 'dr' || norm.includes('dr amount') || norm.includes('withdrawn'))) {
        indices.debitCol = idx;
      } else if (indices.creditCol === undefined && (norm.includes('deposit') || norm.includes('credit') || norm === 'cr' || norm.includes('cr amount') || norm.includes('deposited'))) {
        indices.creditCol = idx;
      } else if (indices.amountCol === undefined && (norm === 'amount' || norm.includes('txn amount') || norm.includes('net amount'))) {
        indices.amountCol = idx;
      } else if (indices.balanceCol === undefined && (norm.includes('balance') || norm === 'bal' || norm.includes('closing bal'))) {
        indices.balanceCol = idx;
      } else if (indices.refCol === undefined && (norm.includes('chq') || norm.includes('ref') || norm.includes('utr') || norm.includes('cheque no'))) {
        indices.refCol = idx;
      }
    });

    return indices;
  }

  // --- Row Processing Pipeline ---
  private static processRawRows(
    rawRows: RawTxnRow[],
    detectedBank: string,
    accountNumber: string,
    options: ParseOptions
  ): ParseResult {
    // 1. Run Duplicate Detection across batch & existing DB transactions
    const txnInputs: TransactionInput[] = rawRows.map(r => ({
      date: r.date,
      narration: r.narration,
      referenceNumber: r.referenceNumber,
      withdrawal: r.withdrawal,
      deposit: r.deposit,
    }));

    const existingInputs: TransactionInput[] = (options.existingTransactions || []).map(t => ({
      id: t.id,
      date: t.date,
      narration: t.narration,
      referenceNumber: t.referenceNumber,
      withdrawal: t.withdrawal,
      deposit: t.deposit,
    }));

    const dupMap = detectDuplicates(txnInputs, existingInputs);

    // 2. Classify and assemble BankTransaction models
    const transactions: BankTransaction[] = [];
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let duplicatesCount = 0;
    let needsReviewCount = 0;
    let autoApprovedCount = 0;

    const timestamp = Date.now();

    // Prepare learned rules dictionary for classifier
    const learnedRulesDict: Record<string, { type: 'INCOME' | 'EXPENSE' | 'TRANSFER'; category: string; suggestedLedger: string }> = {};
    if (Array.isArray(options.learnedMappings)) {
      for (const lm of options.learnedMappings) {
        learnedRulesDict[lm.pattern] = {
          type: 'EXPENSE', // will be adjusted by classifier based on direction
          category: lm.category || 'Learned Rule',
          suggestedLedger: lm.targetLedger,
        };
      }
    }

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const dup = dupMap.get(i);
      const isDup = Boolean(dup?.isDuplicate);

      const classification = classifyTransaction(row.narration, row.withdrawal, row.deposit, learnedRulesDict);
      const isLearnedRule = Boolean(options.learnedMappings?.some(m => row.narration.toLowerCase().includes(m.pattern.toLowerCase())));

      // Determine initial review status
      let reviewStatus: TransactionReviewStatus = 'PENDING_REVIEW';
      if (isDup) {
        reviewStatus = 'PENDING_REVIEW';
        duplicatesCount++;
      } else if ((classification.confidence >= 0.85 || isLearnedRule) && classification.suggestedLedger !== 'Suspense Account') {
        reviewStatus = 'APPROVED';
        autoApprovedCount++;
      } else {
        reviewStatus = 'PENDING_REVIEW';
        needsReviewCount++;
      }

      const fingerprint = VoucherEngine.createTransactionFingerprint({
        date: row.date,
        withdrawal: row.withdrawal,
        deposit: row.deposit,
        reference: row.referenceNumber || this.extractReference(row.narration),
        narration: row.narration,
      });

      const txn: BankTransaction = {
        id: `txn_${timestamp}_${i + 1}`,
        firmId: options.firmId,
        companyId: options.companyId,
        clientId: options.clientId,
        date: row.date,
        narration: row.narration,
        referenceNumber: row.referenceNumber || this.extractReference(row.narration),
        withdrawal: row.withdrawal,
        deposit: row.deposit,
        balance: row.balance,
        type: classification.type as TransactionType,
        category: classification.category,
        suggestedLedger: classification.suggestedLedger,
        finalLedger: classification.suggestedLedger,
        confidence: isDup ? Math.min(0.5, classification.confidence) : classification.confidence,
        status: reviewStatus,
        reviewStatus,
        tallyStatus: 'PENDING',
        transactionFingerprint: fingerprint,
        learnedRuleApplied: isLearnedRule,
        reason: isLearnedRule
          ? 'Learned Ledger Rule applied from previous human review'
          : classification.reason || (reviewStatus === 'APPROVED' ? 'Automated high-confidence match' : 'Requires verification'),
        isDuplicate: isDup,
        duplicateReason: dup?.reason,
        duplicatePairId: dup?.pairId,
        voucherGenerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      totalDeposits += row.deposit;
      totalWithdrawals += row.withdrawal;
      transactions.push(txn);
    }

    return {
      success: true,
      detectedBank,
      accountNumber,
      transactions,
      totalDetected: transactions.length,
      totalDeposits: Number(totalDeposits.toFixed(2)),
      totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
      duplicatesCount,
      needsReviewCount,
      autoApprovedCount,
    };
  }

  // --- Helpers ---
  private static detectBankName(text: string): string {
    const t = text.toUpperCase();
    if (t.includes('HDFC')) return 'HDFC Bank';
    if (t.includes('ICICI')) return 'ICICI Bank';
    if (t.includes('STATE BANK OF INDIA') || t.includes('SBI')) return 'State Bank of India';
    if (t.includes('AXIS')) return 'Axis Bank';
    if (t.includes('KOTAK')) return 'Kotak Mahindra Bank';
    if (t.includes('PUNJAB NATIONAL') || t.includes('PNB')) return 'Punjab National Bank';
    if (t.includes('BANK OF BARODA') || t.includes('BOB')) return 'Bank of Baroda';
    if (t.includes('INDUSIND')) return 'IndusInd Bank';
    if (t.includes('CANARA')) return 'Canara Bank';
    if (t.includes('UNION BANK')) return 'Union Bank of India';
    if (t.includes('YES BANK')) return 'Yes Bank';
    if (t.includes('IDFC')) return 'IDFC First Bank';
    return 'Commercial Bank of India';
  }

  private static detectAccountNumber(text: string): string {
    const match = text.match(/(?:A\/C|Account|Acc|A\/c\s*No\.?)[\s:]*([0-9Xx]{8,18})/i);
    return match ? match[1] : '';
  }

  private static extractReference(narration: string): string {
    const upiMatch = narration.match(/(?:UPI|IMPS|NEFT|RTGS)[\/-]([0-9A-Za-z]{8,20})/i);
    if (upiMatch) return upiMatch[1];
    const numMatch = narration.match(/\b([0-9]{10,16})\b/);
    return numMatch ? numMatch[1] : '';
  }

  private static normalizeDate(raw: any): string | null {
    if (!raw) return null;
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const dd = String(raw.getDate()).padStart(2, '0');
      const mm = String(raw.getMonth() + 1).padStart(2, '0');
      const yyyy = raw.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    const str = String(raw).trim();
    // Excel serial number (e.g. 45748)
    if (/^\d{5}$/.test(str)) {
      const serial = parseInt(str, 10);
      const utcDays = serial - 25569;
      const date = new Date(utcDays * 86400 * 1000);
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = date.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmy) {
      const dd = dmy[1].padStart(2, '0');
      const mm = dmy[2].padStart(2, '0');
      let yyyy = dmy[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      return `${dd}/${mm}/${yyyy}`;
    }

    // YYYY-MM-DD
    const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymd) {
      const yyyy = ymd[1];
      const mm = ymd[2].padStart(2, '0');
      const dd = ymd[3].padStart(2, '0');
      return `${dd}/${mm}/${yyyy}`;
    }

    // DD-MMM-YYYY (e.g. 05-Apr-2026)
    const dMmmY = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
    if (dMmmY) {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const dd = dMmmY[1].padStart(2, '0');
      const mm = months[dMmmY[2].toLowerCase()] || '01';
      let yyyy = dMmmY[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      return `${dd}/${mm}/${yyyy}`;
    }

    return null;
  }

  private static parseAmount(raw: any): number {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.abs(raw);
    if (!raw) return 0;
    const clean = String(raw).replace(/[₹$,\s]/g, '').replace(/\((.*?)\)/, '-$1');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.abs(val);
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(s => s.replace(/^"|"$/g, '').trim());
  }
}
