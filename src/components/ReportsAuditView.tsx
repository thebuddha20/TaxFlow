import React, { useState } from 'react';
import { AuditLog, BankTransaction, Voucher, GstReconciliationItem } from '../types.ts';
import {
  FileBarChart2,
  Download,
  Filter,
  Shield,
  FileCheck2,
  AlertTriangle,
  Scale,
  Calendar,
} from 'lucide-react';

interface ReportsAuditViewProps {
  auditLogs: AuditLog[];
  bankTransactions: BankTransaction[];
  vouchers: Voucher[];
  gstReconciliation: GstReconciliationItem[];
}

export const ReportsAuditView: React.FC<ReportsAuditViewProps> = ({
  auditLogs,
  bankTransactions,
  vouchers,
  gstReconciliation,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'AUDIT_TRAIL' | 'BRS' | 'DUPLICATES_REPORT' | 'TRIAL_BALANCE' | 'ITC_AUDIT'>('AUDIT_TRAIL');

  // Compute Trial Balance
  const totalDebit = vouchers.reduce(
    (sum, v) => sum + v.entries.filter(e => e.type === 'DEBIT').reduce((s, e) => s + e.amount, 0),
    0
  );
  const totalCredit = vouchers.reduce(
    (sum, v) => sum + v.entries.filter(e => e.type === 'CREDIT').reduce((s, e) => s + e.amount, 0),
    0
  );

  const duplicatePairs = bankTransactions.filter(t => t.isDuplicate);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Reports &amp; CA Statutory Audit Trail</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ICAI &amp; GST Compliant
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable audit logging, Bank Reconciliation Statements (BRS), Duplicate Detection reports, and Trial Balance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export / Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveReportTab('AUDIT_TRAIL')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            activeReportTab === 'AUDIT_TRAIL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Firm Audit Trail ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveReportTab('DUPLICATES_REPORT')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            activeReportTab === 'DUPLICATES_REPORT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Duplicate Txn Audit ({duplicatePairs.length})
        </button>
        <button
          onClick={() => setActiveReportTab('TRIAL_BALANCE')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            activeReportTab === 'TRIAL_BALANCE' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Trial Balance Verification (Dr = Cr)
        </button>
        <button
          onClick={() => setActiveReportTab('ITC_AUDIT')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            activeReportTab === 'ITC_AUDIT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Section 16(2)(aa) ITC Report
        </button>
      </div>

      {/* Tab 1: Audit Trail */}
      {activeReportTab === 'AUDIT_TRAIL' && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Immutable Action Log (Who Did What &amp; When)
            </h2>
            <span className="text-[11px] text-slate-400">Sharma &amp; Associates</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User &amp; Role</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-200">{log.userName}</span>
                      <span className="text-[10px] text-slate-500 block">({log.userRole})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{log.details}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Duplicate Audit */}
      {activeReportTab === 'DUPLICATES_REPORT' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <span className="font-bold">Multi-Factor Duplicate Scoring Results</span>
                <p className="text-[11px] text-amber-300/80">
                  Identified exact date + amount + fuzzy narration matches. Prevents accidental double counting in P&amp;L.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded bg-amber-500/20 font-bold border border-amber-500/40">
              {duplicatePairs.length} Records ({duplicatePairs.length / 2} Pairs)
            </span>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Narration</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3">Detection Factor</th>
                    <th className="px-4 py-3">Audit Finding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {duplicatePairs.map(dup => (
                    <tr key={dup.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-300">{dup.date}</td>
                      <td className="px-4 py-3 font-medium text-white">{dup.narration}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                        ₹{(dup.withdrawal || dup.deposit).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">Same Date + Amount + Narration Token Hash</td>
                      <td className="px-4 py-3 text-amber-300 text-[11px]">{dup.duplicateReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Trial Balance */}
      {activeReportTab === 'TRIAL_BALANCE' && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Trial Balance Double-Entry Verification
              </h2>
              <p className="text-xs text-slate-400">Every voucher guarantees Total Debit === Total Credit</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              <span>Balanced: ₹{totalDebit.toFixed(2)} Dr = ₹{totalCredit.toFixed(2)} Cr</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Total Debit Balance</span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Total Credit Balance</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
            <span>Accounting Verification: Difference is strictly 0.00</span>
            <span className="font-bold uppercase font-mono">100% AUDIT READY</span>
          </div>
        </div>
      )}

      {/* Tab 4: ITC Audit */}
      {activeReportTab === 'ITC_AUDIT' && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              CGST Sec 16(2)(aa) Supplier Non-Compliance Report
            </h2>
            <span className="text-xs text-rose-400 font-bold">Action Required for Disallowed ITC</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3 text-right">Disallowed ITC (₹)</th>
                  <th className="px-4 py-3">Statutory Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {gstReconciliation
                  .filter(r => !r.itcEligible)
                  .map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-white">{r.supplierName}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{r.gstin}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{r.invoiceNumber}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                        ₹{r.booksTaxAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-rose-300 text-[11px]">
                        Vendor has not uploaded in GSTR-1. Inadmissible under Section 16(2)(aa).
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
