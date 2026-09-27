import React, { useState } from 'react';
import { Voucher, Ledger, VoucherType, VoucherEntry } from '../types.ts';
import {
  BookOpenCheck,
  Plus,
  Scale,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ChevronRight,
} from 'lucide-react';

interface AccountingVouchersViewProps {
  vouchers: Voucher[];
  ledgers: Ledger[];
  onCreateVoucher: (voucher: {
    voucherType: VoucherType;
    date: string;
    narration: string;
    entries: Array<{ ledgerId: string; ledgerName: string; type: 'DEBIT' | 'CREDIT'; amount: number }>;
  }) => Promise<void>;
  onCreateLedger: (ledger: { name: string; group: string; openingBalance: number; balanceType: 'DR' | 'CR' }) => Promise<void>;
}

export const AccountingVouchersView: React.FC<AccountingVouchersViewProps> = ({
  vouchers,
  ledgers,
  onCreateVoucher,
  onCreateLedger,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'VOUCHERS' | 'LEDGERS'>('VOUCHERS');
  const [showNewVoucherModal, setShowNewVoucherModal] = useState(false);
  const [showNewLedgerModal, setShowNewLedgerModal] = useState(false);

  // New Voucher Form State
  const [newVchType, setNewVchType] = useState<VoucherType>('PAYMENT');
  const [newVchDate, setNewVchDate] = useState('01/04/2026');
  const [newVchNarration, setNewVchNarration] = useState('');
  const [newEntries, setNewEntries] = useState<Array<{ ledgerName: string; type: 'DEBIT' | 'CREDIT'; amount: number }>>([
    { ledgerName: 'Office Expenses', type: 'DEBIT', amount: 3500 },
    { ledgerName: 'HDFC Bank Current A/C', type: 'CREDIT', amount: 3500 },
  ]);

  // New Ledger Form State
  const [newLedName, setNewLedName] = useState('');
  const [newLedGroup, setNewLedGroup] = useState('Indirect Expenses');
  const [newLedBalance, setNewLedBalance] = useState('0');
  const [newLedBalanceType, setNewLedBalanceType] = useState<'DR' | 'CR'>('DR');

  // Compute live balancing for new voucher
  const totalDebit = newEntries
    .filter(e => e.type === 'DEBIT')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalCredit = newEntries
    .filter(e => e.type === 'CREDIT')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;

  const handleEntryChange = (index: number, field: string, value: any) => {
    const updated = [...newEntries];
    updated[index] = { ...updated[index], [field]: value };
    setNewEntries(updated);
  };

  const handleAddEntryLine = () => {
    setNewEntries([...newEntries, { ledgerName: 'Suspense Account', type: 'CREDIT', amount: diff > 0 ? diff : 0 }]);
  };

  const handleRemoveEntryLine = (index: number) => {
    if (newEntries.length <= 2) return;
    setNewEntries(newEntries.filter((_, i) => i !== index));
  };

  const handleVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;

    await onCreateVoucher({
      voucherType: newVchType,
      date: newVchDate,
      narration: newVchNarration,
      entries: newEntries.map(e => ({
        ledgerId: `led_${e.ledgerName.replace(/\s+/g, '_').toLowerCase()}`,
        ledgerName: e.ledgerName,
        type: e.type,
        amount: Number(e.amount),
      })),
    });

    setShowNewVoucherModal(false);
    setNewVchNarration('');
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedName) return;

    await onCreateLedger({
      name: newLedName,
      group: newLedGroup,
      openingBalance: parseFloat(newLedBalance) || 0,
      balanceType: newLedBalanceType,
    });

    setShowNewLedgerModal(false);
    setNewLedName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Double-Entry Accounting &amp; Ledgers</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Dr === Cr Strictly Enforced
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Standard Indian accounting vouchers (Sales, Purchase, Payment, Receipt, Contra, Journal) and Chart of Accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="open-new-ledger-modal-btn"
            onClick={() => setShowNewLedgerModal(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Ledger</span>
          </button>
          <button
            id="open-new-voucher-modal-btn"
            onClick={() => setShowNewVoucherModal(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post New Voucher</span>
          </button>
        </div>
      </div>

      {/* Sub tabs: Vouchers vs Ledgers */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          id="tab-vouchers-btn"
          onClick={() => setActiveSubTab('VOUCHERS')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeSubTab === 'VOUCHERS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Accounting Vouchers ({vouchers.length})
        </button>
        <button
          id="tab-ledgers-btn"
          onClick={() => setActiveSubTab('LEDGERS')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeSubTab === 'LEDGERS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Chart of Accounts / Ledgers ({ledgers.length})
        </button>
      </div>

      {activeSubTab === 'VOUCHERS' ? (
        /* Vouchers View */
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold border-b border-slate-700/80">
                  <tr>
                    <th className="px-3.5 py-3">Voucher #</th>
                    <th className="px-3.5 py-3">Type</th>
                    <th className="px-3.5 py-3">Date</th>
                    <th className="px-3.5 py-3">Bifurcated Ledger Entries (Debit / Credit)</th>
                    <th className="px-3.5 py-3">Narration</th>
                    <th className="px-3.5 py-3 text-right">Total Amount (₹)</th>
                    <th className="px-3.5 py-3 text-center">Tally Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {vouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-3 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {v.voucherNumber}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                          {v.voucherType}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-slate-400 whitespace-nowrap">
                        {v.date}
                      </td>
                      <td className="px-3.5 py-3 max-w-md space-y-1">
                        {v.entries.map((e, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] font-mono">
                            <span className={e.type === 'DEBIT' ? 'text-amber-300' : 'text-emerald-300'}>
                              {e.type === 'DEBIT' ? 'Dr ' : '  Cr '}
                              <span className="font-sans font-medium text-slate-200">{e.ledgerName}</span>
                            </span>
                            <span className="text-slate-400">₹{e.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-3.5 py-3 max-w-xs truncate text-slate-300">
                        {v.narration || '—'}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-bold text-white whitespace-nowrap">
                        ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            v.tallySyncStatus === 'SYNCED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {v.tallySyncStatus === 'SYNCED' ? 'Synced' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Ledgers View */
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold border-b border-slate-700/80">
                <tr>
                  <th className="px-4 py-3">Ledger Name</th>
                  <th className="px-4 py-3">Parent Group</th>
                  <th className="px-4 py-3 text-right">Opening Balance</th>
                  <th className="px-4 py-3 text-right">Current Balance (₹)</th>
                  <th className="px-4 py-3 text-center">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledgers.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100">{l.name}</td>
                    <td className="px-4 py-3 text-slate-400">{l.group}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      ₹{l.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      ₹{l.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.balanceType === 'DR'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {l.balanceType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Balanced Voucher Modal */}
      {showNewVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleVoucherSubmit}
            className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Create Balanced Accounting Voucher</h2>
                <p className="text-xs text-slate-400">Total Debit must match Total Credit before saving</p>
              </div>
              <button
                type="button"
                id="close-vch-modal-btn"
                onClick={() => setShowNewVoucherModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Voucher Type</label>
                <select
                  id="modal-vch-type"
                  value={newVchType}
                  onChange={e => setNewVchType(e.target.value as VoucherType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="PAYMENT">Payment Voucher</option>
                  <option value="RECEIPT">Receipt Voucher</option>
                  <option value="CONTRA">Contra (Cash &harr; Bank)</option>
                  <option value="JOURNAL">Journal Voucher</option>
                  <option value="SALES">Sales Voucher</option>
                  <option value="PURCHASE">Purchase Voucher</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                <input
                  type="text"
                  value={newVchDate}
                  onChange={e => setNewVchDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="DD/MM/YYYY"
                  required
                />
              </div>
            </div>

            {/* Line Entries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Accounting Line Entries</span>
                <button
                  type="button"
                  id="add-entry-line-btn"
                  onClick={handleAddEntryLine}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Row
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {newEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={entry.type}
                      onChange={e => handleEntryChange(idx, 'type', e.target.value)}
                      className="w-24 px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-bold text-amber-300 focus:outline-none"
                    >
                      <option value="DEBIT">Debit (Dr)</option>
                      <option value="CREDIT">Credit (Cr)</option>
                    </select>

                    <input
                      type="text"
                      value={entry.ledgerName}
                      onChange={e => handleEntryChange(idx, 'ledgerName', e.target.value)}
                      placeholder="Ledger Name (e.g. Office Expenses)"
                      className="flex-1 px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                      required
                    />

                    <input
                      type="number"
                      step="0.01"
                      value={entry.amount}
                      onChange={e => handleEntryChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                      className="w-28 px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-right text-white font-mono focus:outline-none"
                      required
                    />

                    {newEntries.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntryLine(idx)}
                        className="text-slate-500 hover:text-rose-400 text-sm px-1"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Balance Checker Strip */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-400 font-sans">Total Debit: </span>
                <span className="text-amber-400 font-bold">₹{totalDebit.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans">Total Credit: </span>
                <span className="text-emerald-400 font-bold">₹{totalCredit.toFixed(2)}</span>
              </div>
              <div>
                {isBalanced ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Balanced (0.00 Diff)
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center gap-1 font-sans">
                    <AlertCircle className="w-3.5 h-3.5" /> Unbalanced (Diff: ₹{diff.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Narration</label>
              <textarea
                rows={2}
                value={newVchNarration}
                onChange={e => setNewVchNarration(e.target.value)}
                placeholder="Details of accounting disbursement or receipt..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewVoucherModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-balanced-voucher-btn"
                disabled={!isBalanced}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Post Balanced Voucher
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Ledger Modal */}
      {showNewLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleLedgerSubmit}
            className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Create Ledger Account</h2>
              <button
                type="button"
                onClick={() => setShowNewLedgerModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ledger Name</label>
              <input
                type="text"
                value={newLedName}
                onChange={e => setNewLedName(e.target.value)}
                placeholder="e.g. Audit Fees Payable, Printing & Stationery"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Accounting Group</label>
              <select
                value={newLedGroup}
                onChange={e => setNewLedGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Indirect Expenses">Indirect Expenses</option>
                <option value="Direct Incomes">Direct Incomes</option>
                <option value="Bank Accounts">Bank Accounts</option>
                <option value="Cash-in-hand">Cash-in-hand</option>
                <option value="Duties & Taxes">Duties &amp; Taxes</option>
                <option value="Current Assets">Current Assets</option>
                <option value="Current Liabilities">Current Liabilities</option>
                <option value="Sundry Creditors">Sundry Creditors</option>
                <option value="Sundry Debtors">Sundry Debtors</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={newLedBalance}
                  onChange={e => setNewLedBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Balance Type</label>
                <select
                  value={newLedBalanceType}
                  onChange={e => setNewLedBalanceType(e.target.value as 'DR' | 'CR')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="DR">Debit (Dr)</option>
                  <option value="CR">Credit (Cr)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewLedgerModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Create Ledger
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
