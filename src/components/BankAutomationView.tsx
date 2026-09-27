import React, { useState, useRef } from 'react';
import { BankTransaction, Company } from '../types.ts';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Edit3,
  Copy,
  ChevronDown,
  Filter,
  Check,
  Building2,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react';

interface BankAutomationViewProps {
  transactions: BankTransaction[];
  companies?: Company[];
  selectedCompanyId?: string;
  onReviewTransaction: (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'MARK_DUPLICATE' | 'IGNORE_DUPLICATE' | 'EDIT',
    suggestedLedger?: string,
    category?: string
  ) => Promise<void>;
  onBulkReview?: (ids: string[], action: 'APPROVE' | 'REJECT' | 'IGNORE_DUPLICATE') => Promise<void>;
  onGenerateVouchers: () => Promise<void>;
  onUploadStatementFile: (file: File, companyId: string, customMappings?: any) => Promise<void>;
  onParseStatementText: (content: string, companyId: string) => Promise<void>;
  isProcessing?: boolean;
}

export const BankAutomationView: React.FC<BankAutomationViewProps> = ({
  transactions = [],
  companies = [],
  selectedCompanyId,
  onReviewTransaction,
  onBulkReview,
  onGenerateVouchers,
  onUploadStatementFile,
  onParseStatementText,
  isProcessing = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DUPLICATES' | 'PENDING' | 'APPROVED'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'FILE' | 'PASTE'>('FILE');

  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetCompanyId, setTargetCompanyId] = useState<string>(selectedCompanyId || companies[0]?.id || '');
  const [bankType, setBankType] = useState<string>('AUTO');
  const [statementText, setStatementText] = useState('');
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state for non-standard CSV/Excel
  const [columnMappings, setColumnMappings] = useState({
    dateCol: '',
    narrationCol: '',
    withdrawalCol: '',
    depositCol: '',
    balanceCol: '',
    refCol: '',
  });

  // Edit Ledger & Category Modal
  const [editingTxn, setEditingTxn] = useState<BankTransaction | null>(null);
  const [editLedger, setEditLedger] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Bulk Selection
  const [selectedTxnIds, setSelectedTxnIds] = useState<string[]>([]);

  // Filtering
  const filteredTransactions = transactions.filter(t => {
    if (activeFilter === 'DUPLICATES') return t.isDuplicate;
    if (activeFilter === 'PENDING') return t.reviewStatus === 'PENDING_REVIEW' || t.status === 'PENDING_REVIEW';
    if (activeFilter === 'APPROVED') return t.reviewStatus === 'APPROVED' || t.status === 'APPROVED';
    return true;
  });

  const totalDeposits = transactions.reduce((sum, t) => sum + (t.deposit || 0), 0);
  const totalWithdrawals = transactions.reduce((sum, t) => sum + (t.withdrawal || 0), 0);
  const duplicateCount = transactions.filter(t => t.isDuplicate).length;
  const pendingCount = transactions.filter(t => (t.reviewStatus || t.status) === 'PENDING_REVIEW').length;
  const approvedCount = transactions.filter(t => (t.reviewStatus || t.status) === 'APPROVED').length;
  const unvoucheredApprovedCount = transactions.filter(
    t => (t.reviewStatus === 'APPROVED' || t.status === 'APPROVED') && !t.voucherGenerated && !t.voucherId
  ).length;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadTab === 'FILE') {
      if (!selectedFile) return;
      const mappings = showColumnMapping ? columnMappings : undefined;
      await onUploadStatementFile(selectedFile, targetCompanyId, mappings);
      setShowUploadModal(false);
      setSelectedFile(null);
    } else {
      if (!statementText.trim()) return;
      await onParseStatementText(statementText, targetCompanyId);
      setShowUploadModal(false);
      setStatementText('');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTxn) return;
    await onReviewTransaction(editingTxn.id, 'EDIT', editLedger, editCategory);
    setEditingTxn(null);
  };

  const toggleSelectAll = () => {
    if (selectedTxnIds.length === filteredTransactions.length) {
      setSelectedTxnIds([]);
    } else {
      setSelectedTxnIds(filteredTransactions.map(t => t.id));
    }
  };

  const toggleSelectTxn = (id: string) => {
    setSelectedTxnIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedTxnIds.length === 0) return;
    if (onBulkReview) {
      await onBulkReview(selectedTxnIds, 'APPROVE');
    } else {
      for (const id of selectedTxnIds) {
        await onReviewTransaction(id, 'APPROVE');
      }
    }
    setSelectedTxnIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Bank Statement Automation</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Indian Multi-Bank Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Production-grade parsing for PDF, XLSX, XLS, and CSV statements with automated duplicate flagging and balanced voucher creation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="upload-statement-modal-btn"
            onClick={() => {
              setTargetCompanyId(selectedCompanyId || companies[0]?.id || '');
              setShowUploadModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Bank Statement</span>
          </button>

          <button
            id="generate-vouchers-btn"
            onClick={onGenerateVouchers}
            disabled={isProcessing || unvoucheredApprovedCount === 0}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Post double-entry vouchers for all approved transactions"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>
              {isProcessing ? 'Posting Vouchers...' : `Generate Vouchers (${unvoucheredApprovedCount})`}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Statement Volume</span>
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono">{transactions.length}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Inflow: ₹{totalDeposits.toLocaleString('en-IN')}</span>
            <span>Outflow: ₹{totalWithdrawals.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Duplicate Alerts Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400 font-mono">{duplicateCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Multi-factor (Date, amount &amp; narration)</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Pending Human Review</span>
            <ChevronDown className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-400 font-mono">{pendingCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Requires verification or ledger selection</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Approved &amp; Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">{approvedCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">{unvoucheredApprovedCount} pending voucher creation</p>
        </div>
      </div>

      {/* Filter Tabs & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="filter-all-btn"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Rows ({transactions.length})
          </button>
          <button
            id="filter-duplicates-btn"
            onClick={() => setActiveFilter('DUPLICATES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === 'DUPLICATES'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Duplicates</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-400">
              {duplicateCount}
            </span>
          </button>
          <button
            id="filter-pending-btn"
            onClick={() => setActiveFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === 'PENDING'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Pending Review</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-400">
              {pendingCount}
            </span>
          </button>
          <button
            id="filter-approved-btn"
            onClick={() => setActiveFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Approved</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-400">
              {approvedCount}
            </span>
          </button>
        </div>

        {/* Bulk Action Controls */}
        {selectedTxnIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {selectedTxnIds.length} selected:
            </span>
            <button
              onClick={handleBulkApprove}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Bulk Approve</span>
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table / Empty State */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <UploadCloud className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No Bank Statements Uploaded Yet</h3>
            <p className="text-xs text-slate-400">
              Upload an Indian bank statement (PDF, XLSX, XLS, or CSV) to extract transaction rows, detect duplicate entries, suggest double-entry ledgers, and export to Tally Prime.
            </p>
          </div>
          <button
            onClick={() => {
              setTargetCompanyId(selectedCompanyId || companies[0]?.id || '');
              setShowUploadModal(true);
            }}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Your First Bank Statement</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTxnIds.length === filteredTransactions.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 min-w-[200px]">Narration / Reference</th>
                  <th className="py-3 px-3 text-right">Debit (Withdrawal)</th>
                  <th className="py-3 px-3 text-right">Credit (Deposit)</th>
                  <th className="py-3 px-3">Suggested Ledger</th>
                  <th className="py-3 px-3">Duplicate / Risk Flag</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTransactions.map(txn => {
                  const isSelected = selectedTxnIds.includes(txn.id);
                  const isDebit = txn.withdrawal > 0;
                  const currentStatus = txn.reviewStatus || txn.status || 'PENDING_REVIEW';

                  return (
                    <tr
                      key={txn.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        txn.isDuplicate ? 'bg-amber-500/5' : ''
                      } ${isSelected ? 'bg-slate-800/60' : ''}`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectTxn(txn.id)}
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-200 whitespace-nowrap">
                        {txn.date}
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-white truncate" title={txn.narration}>
                          {txn.narration}
                        </div>
                        {txn.reference && (
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            Ref: {txn.reference}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-rose-400 whitespace-nowrap">
                        {txn.withdrawal > 0 ? `₹${txn.withdrawal.toLocaleString('en-IN')}` : '-'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-emerald-400 whitespace-nowrap">
                        {txn.deposit > 0 ? `₹${txn.deposit.toLocaleString('en-IN')}` : '-'}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-200 truncate max-w-[140px]" title={txn.suggestedLedger}>
                            {txn.suggestedLedger || 'Unmapped Ledger'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingTxn(txn);
                              setEditLedger(txn.suggestedLedger || '');
                              setEditCategory(txn.category || '');
                            }}
                            className="text-slate-500 hover:text-slate-200 p-0.5 rounded"
                            title="Edit suggested ledger"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {txn.category || 'General'}
                        </span>
                      </td>

                      {/* Duplicate Warning */}
                      <td className="py-3 px-3">
                        {txn.isDuplicate ? (
                          <div className="flex items-center gap-1 text-amber-400 text-[11px] font-medium" title={txn.duplicateReason}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[130px]">
                              {txn.duplicateReason || 'Potential Duplicate'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">Verified Unique</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {currentStatus === 'APPROVED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Approved
                          </span>
                        )}
                        {currentStatus === 'POSTED_TO_TALLY' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Voucher Posted
                          </span>
                        )}
                        {currentStatus === 'PENDING_REVIEW' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Review Required
                          </span>
                        )}
                        {currentStatus === 'REJECTED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {currentStatus !== 'APPROVED' && currentStatus !== 'POSTED_TO_TALLY' ? (
                            <>
                              <button
                                onClick={() => onReviewTransaction(txn.id, 'APPROVE')}
                                className="p-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                                title="Approve Transaction"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onReviewTransaction(txn.id, 'REJECT')}
                                className="p-1 rounded bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-colors"
                                title="Reject Transaction"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-medium">Ready</span>
                          )}

                          {txn.isDuplicate && (
                            <button
                              onClick={() => onReviewTransaction(txn.id, 'IGNORE_DUPLICATE')}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
                              title="Ignore duplicate alert and mark as legitimate"
                            >
                              Ignore Dup
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Real Bank Statement Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Import Indian Bank Statement</h2>
                  <p className="text-[11px] text-slate-400">Extract transactions, categorize ledgers &amp; detect duplicate entries</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white text-lg px-2"
              >
                &times;
              </button>
            </div>

            {/* Target Company Selection */}
            {companies.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Company / Books</label>
                <select
                  value={targetCompanyId}
                  onChange={e => setTargetCompanyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {companies.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.gstin})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Upload Method Switcher: File vs Paste */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setUploadTab('FILE')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  uploadTab === 'FILE'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload File (.pdf, .xlsx, .xls, .csv)
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('PASTE')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  uploadTab === 'PASTE'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Paste Text / CSV Rows
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadTab === 'FILE' ? (
                <div className="space-y-4">
                  {/* Bank Detection / Bank Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Bank Format</label>
                      <select
                        value={bankType}
                        onChange={e => setBankType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="AUTO">Auto-Detect Bank Format</option>
                        <option value="HDFC">HDFC Bank</option>
                        <option value="ICICI">ICICI Bank</option>
                        <option value="SBI">State Bank of India (SBI)</option>
                        <option value="AXIS">Axis Bank</option>
                        <option value="KOTAK">Kotak Mahindra Bank</option>
                        <option value="PNB">Punjab National Bank</option>
                        <option value="BOB">Bank of Baroda</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Column Mapping</label>
                      <button
                        type="button"
                        onClick={() => setShowColumnMapping(!showColumnMapping)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white flex items-center justify-between"
                      >
                        <span>{showColumnMapping ? 'Custom Mapping Enabled' : 'Auto Header Detection'}</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 bg-slate-950/60 hover:border-slate-600'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,.txt"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                    />

                    {selectedFile ? (
                      <div className="space-y-1">
                        <FileCheck2 className="w-8 h-8 mx-auto text-emerald-400" />
                        <p className="text-xs font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {(selectedFile.size / 1024).toFixed(1)} KB &bull; {selectedFile.type || 'Document'}
                        </p>
                        <p className="text-[10px] text-emerald-400 pt-1">Ready for automated extraction</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <UploadCloud className="w-8 h-8 mx-auto text-slate-500" />
                        <p className="text-xs font-medium text-slate-200">
                          Drag &amp; drop bank statement here, or <span className="text-emerald-400 font-semibold underline">browse</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Supports PDF, Excel (.xlsx, .xls), and CSV files up to 25MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional Custom Column Mapping */}
                  {showColumnMapping && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <p className="text-[11px] font-semibold text-slate-300">Custom Column Headers (Optional)</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400">Date Column</label>
                          <input
                            type="text"
                            placeholder="e.g. Txn Date, Value Date"
                            value={columnMappings.dateCol}
                            onChange={e => setColumnMappings({ ...columnMappings, dateCol: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Narration Column</label>
                          <input
                            type="text"
                            placeholder="e.g. Description, Particulars"
                            value={columnMappings.narrationCol}
                            onChange={e => setColumnMappings({ ...columnMappings, narrationCol: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Withdrawal / Debit</label>
                          <input
                            type="text"
                            placeholder="e.g. Debit, Withdrawal"
                            value={columnMappings.withdrawalCol}
                            onChange={e => setColumnMappings({ ...columnMappings, withdrawalCol: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Deposit / Credit</label>
                          <input
                            type="text"
                            placeholder="e.g. Credit, Deposit"
                            value={columnMappings.depositCol}
                            onChange={e => setColumnMappings({ ...columnMappings, depositCol: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Paste raw rows from a statement (format: Date, Narration, Amount):
                  </p>
                  <textarea
                    rows={8}
                    value={statementText}
                    onChange={e => setStatementText(e.target.value)}
                    placeholder="01/04/2026 UPI/Swiggy Food Order 450.00&#10;01/04/2026 NEFT/Client Retainer 12000.00"
                    className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isProcessing ||
                    (uploadTab === 'FILE' && !selectedFile) ||
                    (uploadTab === 'PASTE' && !statementText.trim())
                  }
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Statement...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Parse &amp; Extract Transactions</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ledger & Category Modal */}
      {editingTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl text-slate-100"
          >
            <h2 className="text-base font-bold text-white">Edit Ledger Suggestion</h2>
            <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p><span className="text-slate-500">Narration:</span> {editingTxn.narration}</p>
              <p><span className="text-slate-500">Amount:</span> ₹{(editingTxn.withdrawal || editingTxn.deposit).toLocaleString('en-IN')}</p>
              <p><span className="text-slate-500">Type:</span> {editingTxn.withdrawal > 0 ? 'Debit / Outflow' : 'Credit / Inflow'}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Accounting Ledger Name</label>
              <input
                type="text"
                value={editLedger}
                onChange={e => setEditLedger(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Office Expenses, Audit Fees, Swiggy Food Expenses"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Expense / Income Category</label>
              <input
                type="text"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Food & Refreshments, Utilities, Professional Fees"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTxn(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Save &amp; Approve
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
