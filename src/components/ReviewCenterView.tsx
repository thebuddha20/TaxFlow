import React from 'react';
import { BankTransaction, ExtractedInvoice } from '../types.ts';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface ReviewCenterViewProps {
  pendingTransactions: BankTransaction[];
  pendingInvoices: ExtractedInvoice[];
  onReviewTransaction: (id: string, action: 'APPROVE' | 'REJECT' | 'MARK_DUPLICATE' | 'IGNORE_DUPLICATE' | 'EDIT') => Promise<void>;
  onApproveInvoice: (invoiceId: string) => Promise<void>;
}

export const ReviewCenterView: React.FC<ReviewCenterViewProps> = ({
  pendingTransactions,
  pendingInvoices,
  onReviewTransaction,
  onApproveInvoice,
}) => {
  const totalPending = pendingTransactions.length + pendingInvoices.filter(i => i.status !== 'APPROVED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Human-in-the-Loop Review Center</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {totalPending} Items Awaiting Review
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auditable review queue for low-confidence AI classifications, duplicate transactions, and vendor tax mismatches.
          </p>
        </div>
      </div>

      {totalPending === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h2 className="text-sm font-bold text-white">Review Queue is Clear</h2>
          <p className="text-xs text-slate-400">
            All bank transactions, invoice extractions, and duplicate checks have been reviewed and approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bank Review Cards */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Pending Bank Transactions ({pendingTransactions.length})</span>
            </h2>

            {pendingTransactions.map((txn, idx) => (
              <div
                key={txn.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">
                        ₹{(txn.withdrawal || txn.deposit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">({txn.date})</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 font-medium">{txn.narration}</p>
                    {txn.referenceNumber && (
                      <p className="text-[10px] font-mono text-slate-500">{txn.referenceNumber}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        txn.confidence >= 0.9
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {Math.round(txn.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Suggested Ledger:</span>
                    <span className="font-semibold text-slate-200">{txn.suggestedLedger}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px] block">Category:</span>
                    <span className="text-slate-300">{txn.category}</span>
                  </div>
                </div>

                {txn.isDuplicate && (
                  <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Duplicate Alert: {txn.duplicateReason}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500">{txn.reason}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`review-center-reject-${idx}`}
                      onClick={() => onReviewTransaction(txn.id, 'REJECT')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      Reject
                    </button>
                    {txn.isDuplicate && (
                      <button
                        id={`review-center-keep-${idx}`}
                        onClick={() => onReviewTransaction(txn.id, 'IGNORE_DUPLICATE')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-slate-700"
                      >
                        Keep Both
                      </button>
                    )}
                    <button
                      id={`review-center-approve-${idx}`}
                      onClick={() => onReviewTransaction(txn.id, 'APPROVE')}
                      className="px-3.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Invoice Review Cards */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-purple-400" />
              <span>Pending Invoice Extractions ({pendingInvoices.filter(i => i.status !== 'APPROVED').length})</span>
            </h2>

            {pendingInvoices
              .filter(i => i.status !== 'APPROVED')
              .map((inv, idx) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-sm text-white">
                        {inv.supplierName}
                      </span>
                      <p className="text-xs font-mono text-emerald-400 font-medium">Inv #{inv.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-400">Date: {inv.invoiceDate} • POS: {inv.placeOfSupply}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-mono font-bold text-white">₹{inv.totalAmount.toFixed(2)}</p>
                      <span className="text-[10px] font-mono text-slate-400">
                        GSTIN: {Math.round(inv.confidence.gstin * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Supplier GSTIN:</span>
                      <span className="font-mono text-slate-200">{inv.supplierGstin}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Tax Component:</span>
                      <span className="font-mono text-slate-200">
                        CGST+SGST: ₹{(inv.cgst + inv.sgst).toFixed(2)} | IGST: ₹{inv.igst.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      id={`approve-inv-review-${idx}`}
                      onClick={() => onApproveInvoice(inv.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Post to Books</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
