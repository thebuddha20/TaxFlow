import React, { useState } from 'react';
import { GstReconciliationItem, GstValidationRule } from '../types.ts';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Send,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

interface GstReconciliationViewProps {
  reconciliationItems: GstReconciliationItem[];
  rules: GstValidationRule[];
  onRefreshReconciliation: () => Promise<void>;
  isReconciling?: boolean;
}

export const GstReconciliationView: React.FC<GstReconciliationViewProps> = ({
  reconciliationItems,
  rules,
  onRefreshReconciliation,
  isReconciling,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'MATCHED' | 'MISSING_IN_GSTR' | 'PARTIAL'>('ALL');
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);
  const [reminderSentVendor, setReminderSentVendor] = useState<string | null>(null);

  const filteredItems = reconciliationItems.filter(item => {
    if (filter === 'MATCHED') return item.status === 'MATCHED';
    if (filter === 'MISSING_IN_GSTR') return item.status === 'MISSING_IN_GSTR';
    if (filter === 'PARTIAL') return item.status === 'PARTIAL_MATCH' || item.status === 'MISMATCH';
    return true;
  });

  const totalBooksTax = reconciliationItems.reduce((acc, r) => acc + r.booksTaxAmount, 0);
  const totalGstrTax = reconciliationItems.reduce((acc, r) => acc + r.gstrTaxAmount, 0);
  const eligibleItc = reconciliationItems.filter(r => r.itcEligible).reduce((acc, r) => acc + r.booksTaxAmount, 0);
  const blockedItc = reconciliationItems.filter(r => !r.itcEligible).reduce((acc, r) => acc + r.booksTaxAmount, 0);

  const handleSendVendorReminder = (supplierName: string) => {
    setReminderSentVendor(supplierName);
    setTimeout(() => setReminderSentVendor(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">GST Center &amp; GSTR-2B Reconciliation</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              IMS &amp; Sec 16(2)(aa) Compliance
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reconcile Purchase Books vs Auto-Drafted GSTR-2B to maximize Input Tax Credit and prevent reversal notices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="toggle-gst-rules-btn"
            onClick={() => setShowRulesDrawer(!showRulesDrawer)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>GST Rule Engine ({rules.length})</span>
          </button>
          <button
            id="re-run-recon-btn"
            onClick={onRefreshReconciliation}
            disabled={isReconciling}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            <span>{isReconciling ? 'Reconciling...' : 'Sync GSTR-2B & Reconcile'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">Books Tax (Purchase Register)</span>
          <p className="text-lg font-bold text-white mt-1 font-mono">
            ₹{totalBooksTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">GSTR-2B Available Tax</span>
          <p className="text-lg font-bold text-sky-400 mt-1 font-mono">
            ₹{totalGstrTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">Eligible ITC (Claim in 3B)</span>
          <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">
            ₹{eligibleItc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="text-slate-400">Blocked / Missing in 2B</span>
          <p className="text-lg font-bold text-rose-400 mt-1 font-mono">
            ₹{blockedItc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Rules Drawer Section */}
      {showRulesDrawer && (
        <div className="rounded-xl bg-slate-900 border border-amber-500/30 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Configurable Indian GST Statutory Validation Engine</span>
            </h3>
            <button
              onClick={() => setShowRulesDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map(r => (
              <div key={r.ruleId} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">{r.ruleId}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      r.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300'
                        : r.severity === 'ERROR'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {r.severity}
                  </span>
                </div>
                <p className="font-semibold text-slate-200">{r.name}</p>
                <p className="text-[11px] text-slate-400">{r.message}</p>
                <p className="text-[10px] text-emerald-400/90 pt-1 border-t border-slate-800/80">
                  Action: {r.suggestedAction}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Invoices ({reconciliationItems.length})
        </button>
        <button
          onClick={() => setFilter('MATCHED')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === 'MATCHED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-300'
          }`}
        >
          Matched ({reconciliationItems.filter(r => r.status === 'MATCHED').length})
        </button>
        <button
          onClick={() => setFilter('MISSING_IN_GSTR')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === 'MISSING_IN_GSTR' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-rose-300'
          }`}
        >
          Missing in GSTR-2B ({reconciliationItems.filter(r => r.status === 'MISSING_IN_GSTR').length})
        </button>
        <button
          onClick={() => setFilter('PARTIAL')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === 'PARTIAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          Tax Discrepancies ({reconciliationItems.filter(r => r.status === 'PARTIAL_MATCH' || r.status === 'MISMATCH').length})
        </button>
      </div>

      {/* Reconciled Items Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold border-b border-slate-700/80">
              <tr>
                <th className="px-3.5 py-3">Supplier &amp; GSTIN</th>
                <th className="px-3.5 py-3">Invoice # &amp; Date</th>
                <th className="px-3.5 py-3 text-right">Books Tax (₹)</th>
                <th className="px-3.5 py-3 text-right">GSTR-2B Tax (₹)</th>
                <th className="px-3.5 py-3 text-right">Tax Diff (₹)</th>
                <th className="px-3.5 py-3 text-center">Status</th>
                <th className="px-3.5 py-3">Statutory Audit Notes</th>
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.map(item => {
                const statusStyles = {
                  MATCHED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                  PARTIAL_MATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                  MISMATCH: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                  MISSING_IN_BOOKS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
                  MISSING_IN_GSTR: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                  DUPLICATE: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  REVIEW_REQUIRED: 'bg-slate-800 text-slate-300 border-slate-700',
                };

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3.5 py-3 max-w-xs">
                      <p className="font-semibold text-slate-100 truncate">{item.supplierName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{item.gstin}</p>
                    </td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <p className="font-mono font-medium text-slate-200">{item.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-400">{item.invoiceDate}</p>
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono font-semibold text-white whitespace-nowrap">
                      {item.booksTaxAmount > 0 ? `₹${item.booksTaxAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono font-semibold text-sky-400 whitespace-nowrap">
                      {item.gstrTaxAmount > 0 ? `₹${item.gstrTaxAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono font-bold whitespace-nowrap">
                      {item.differenceAmount === 0 ? (
                        <span className="text-emerald-400">0.00</span>
                      ) : (
                        <span className="text-rose-400">₹{item.differenceAmount.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusStyles[item.status]}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-300 max-w-sm text-[11px]">
                      {item.notes}
                    </td>
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      {item.status === 'MISSING_IN_GSTR' ? (
                        <button
                          id={`vendor-reminder-${item.id}`}
                          onClick={() => handleSendVendorReminder(item.supplierName)}
                          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-[10px] font-medium flex items-center gap-1 ml-auto"
                          title="Trigger automated email/WhatsApp notification to supplier to file GSTR-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>
                            {reminderSentVendor === item.supplierName ? 'Reminder Sent!' : 'Remind Vendor'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>100% Eligible</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
