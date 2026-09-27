/**
 * TaxFlow - Double-Entry Accounting & Tally Integration Engine
 * Strictly enforces Total Debit === Total Credit
 * Generates valid Tally ERP 9 / Tally Prime XML import payloads
 */

import { Voucher, VoucherEntry, VoucherType, Ledger } from '../../src/types.ts';
import crypto from 'crypto';

export class VoucherEngine {
  /**
   * Generates a stable unique fingerprint for duplicate push prevention
   */
  public static createTransactionFingerprint(txn: {
    date: string;
    withdrawal: number;
    deposit: number;
    reference?: string;
    narration: string;
  }): string {
    const raw = [
      (txn.date || '').trim(),
      (txn.withdrawal || 0).toFixed(2),
      (txn.deposit || 0).toFixed(2),
      (txn.reference || '').trim().toLowerCase(),
      (txn.narration || '').trim().toLowerCase().slice(0, 40),
    ].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Validate double entry: Total Debit must equal Total Credit
   */
  public static validateVoucherBalance(entries: VoucherEntry[]): { isValid: boolean; totalDebit: number; totalCredit: number; diff: number } {
    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of entries) {
      if (entry.type === 'DEBIT') {
        totalDebit += entry.amount;
      } else {
        totalCredit += entry.amount;
      }
    }

    const diff = Math.abs(totalDebit - totalCredit);
    return {
      isValid: diff < 0.01,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      diff: Number(diff.toFixed(2)),
    };
  }

  /**
   * Generate double-entry voucher from a bank transaction
   */
  public static createVoucherFromBankTxn(
    txn: {
      id: string;
      date: string;
      narration: string;
      withdrawal: number;
      deposit: number;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'UNKNOWN';
      suggestedLedger: string;
      finalLedger?: string;
      reference?: string;
      firmId: string;
      companyId: string;
    },
    bankLedgerName: string = 'HDFC Bank Current A/C'
  ): Voucher {
    const isWithdrawal = txn.withdrawal > 0;
    const amount = isWithdrawal ? txn.withdrawal : txn.deposit;
    const targetLedger = txn.finalLedger || txn.suggestedLedger || 'Office Expenses';

    let voucherType: VoucherType = 'PAYMENT';
    const entries: VoucherEntry[] = [];

    if (txn.type === 'TRANSFER' || targetLedger === 'Cash in Hand') {
      voucherType = 'CONTRA';
      if (isWithdrawal) {
        // Cash in Hand Dr, Bank Cr
        entries.push({
          id: `entry_${Date.now()}_1`,
          ledgerId: 'led_cash',
          ledgerName: targetLedger,
          type: 'DEBIT',
          amount,
          narration: `Cash withdrawn from ${bankLedgerName}`,
        });
        entries.push({
          id: `entry_${Date.now()}_2`,
          ledgerId: 'led_bank',
          ledgerName: bankLedgerName,
          type: 'CREDIT',
          amount,
          narration: txn.narration,
        });
      } else {
        // Bank Dr, Cash Cr
        entries.push({
          id: `entry_${Date.now()}_1`,
          ledgerId: 'led_bank',
          ledgerName: bankLedgerName,
          type: 'DEBIT',
          amount,
          narration: txn.narration,
        });
        entries.push({
          id: `entry_${Date.now()}_2`,
          ledgerId: 'led_cash',
          ledgerName: targetLedger,
          type: 'CREDIT',
          amount,
          narration: `Cash deposited to ${bankLedgerName}`,
        });
      }
    } else if (isWithdrawal) {
      // Payment voucher: Expense/Party Dr, Bank Cr
      voucherType = 'PAYMENT';
      entries.push({
        id: `entry_${Date.now()}_1`,
        ledgerId: `led_${targetLedger.replace(/\s+/g, '_').toLowerCase()}`,
        ledgerName: targetLedger,
        type: 'DEBIT',
        amount,
        narration: txn.narration,
      });
      entries.push({
        id: `entry_${Date.now()}_2`,
        ledgerId: 'led_bank',
        ledgerName: bankLedgerName,
        type: 'CREDIT',
        amount,
        narration: `Paid via Bank: ${txn.narration}`,
      });
    } else {
      // Receipt voucher: Bank Dr, Income/Customer Cr
      voucherType = 'RECEIPT';
      entries.push({
        id: `entry_${Date.now()}_1`,
        ledgerId: 'led_bank',
        ledgerName: bankLedgerName,
        type: 'DEBIT',
        amount,
        narration: `Received in Bank: ${txn.narration}`,
      });
      entries.push({
        id: `entry_${Date.now()}_2`,
        ledgerId: `led_${targetLedger.replace(/\s+/g, '_').toLowerCase()}`,
        ledgerName: targetLedger,
        type: 'CREDIT',
        amount,
        narration: txn.narration,
      });
    }

    return {
      id: `vch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      firmId: txn.firmId,
      companyId: txn.companyId,
      voucherNumber: `TF-VCH-${Date.now().toString().slice(-6)}`,
      voucherType,
      date: txn.date,
      narration: txn.narration,
      reference: txn.reference,
      totalAmount: amount,
      status: 'APPROVED',
      entries,
      tallySyncStatus: 'NOT_SYNCED',
      sourceDocumentId: txn.id,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generates standard Tally XML Import Envelope for Vouchers
   */
  public static generateTallyXml(vouchers: Voucher[], companyName: string): string {
    const voucherXmlBlocks = vouchers.map(v => {
      const tallyVchType =
        v.voucherType === 'PAYMENT' ? 'Payment' :
        v.voucherType === 'RECEIPT' ? 'Receipt' :
        v.voucherType === 'CONTRA' ? 'Contra' :
        v.voucherType === 'SALES' ? 'Sales' :
        v.voucherType === 'PURCHASE' ? 'Purchase' : 'Journal';

      // Format date from DD/MM/YYYY to YYYYMMDD
      const dateParts = v.date.split(/[\/\-]/);
      let tallyDate = '20260401';
      if (dateParts.length === 3) {
        if (dateParts[2].length === 4) {
          tallyDate = `${dateParts[2]}${dateParts[1].padStart(2, '0')}${dateParts[0].padStart(2, '0')}`;
        } else {
          tallyDate = `20${dateParts[2]}${dateParts[1].padStart(2, '0')}${dateParts[0].padStart(2, '0')}`;
        }
      }

      const ledgerEntriesXml = v.entries.map(e => `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${e.ledgerName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${e.type === 'DEBIT' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${e.type === 'DEBIT' ? `-${e.amount.toFixed(2)}` : `${e.amount.toFixed(2)}`}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      `).join('');

      return `
      <VOUCHER VCHTYPE="${tallyVchType}" ACTION="Create">
        <DATE>${tallyDate}</DATE>
        <VOUCHERTYPENAME>${tallyVchType}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${v.voucherNumber}</VOUCHERNUMBER>
        <NARRATION>${v.narration.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</NARRATION>
        ${ledgerEntriesXml}
      </VOUCHER>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${voucherXmlBlocks}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  /**
   * Generates standard Tally XML Import Envelope for Ledger Masters
   */
  public static generateTallyLedgerMasterXml(ledgers: Ledger[], companyName: string): string {
    const ledgerBlocks = ledgers.map(l => {
      const openingBalSign = l.balanceType === 'DR' ? '-' : '';
      const openingBal = l.openingBalance ? `${openingBalSign}${l.openingBalance.toFixed(2)}` : '0.00';
      const cleanName = l.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const cleanGroup = l.group.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `
      <LEDGER NAME="${cleanName}" ACTION="Create">
        <NAME>${cleanName}</NAME>
        <PARENT>${cleanGroup}</PARENT>
        <OPENINGBALANCE>${openingBal}</OPENINGBALANCE>
        <ISBILLWISEON>No</ISBILLWISEON>
        <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
        ${l.gstApplicable ? '<ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>' : '<ISGSTAPPLICABLE>No</ISGSTAPPLICABLE>'}
        ${l.hsnSac ? `<HSNCODE>${l.hsnSac}</HSNCODE>` : ''}
      </LEDGER>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${ledgerBlocks}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
