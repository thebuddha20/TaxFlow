import React from 'react';
import {
  BankTransaction,
  Voucher,
  GstReconciliationItem,
  TallyConnection,
  AppDocument,
  Client,
  Company,
  AuditLog,
  User,
} from '../types.ts';
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Scale,
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  Receipt,
  BookOpenCheck,
  Building,
  CheckCircle2,
  Cpu,
  Clock,
  Plus,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  firmName?: string;
  currentUser?: User | null;
  isClientMode?: boolean;
  selectedClient?: Client | null;
  clients: Client[];
  companies: Company[];
  documents: AppDocument[];
  bankTransactions: BankTransaction[];
  vouchers: Voucher[];
  gstReconciliation: GstReconciliationItem[];
  tallyConnection: TallyConnection;
  auditLogs: AuditLog[];
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  firmName = 'TaxFlow Practice',
  currentUser,
  isClientMode = false,
  selectedClient,
  clients = [],
  companies = [],
  documents = [],
  bankTransactions = [],
  vouchers = [],
  gstReconciliation = [],
  tallyConnection,
  auditLogs = [],
  onNavigate,
}) => {
  const role = currentUser?.role || (isClientMode ? 'CLIENT' : 'FIRM_OWNER');

  const roleDashboardInfo: Record<string, { label: string; badge: string; subtitle: string }> = {
    SUPER_ADMIN: {
      label: 'Admin Dashboard',
      badge: 'Super Admin',
      subtitle: 'System governance, multi-tenant health, global audit trail, and security operations.',
    },
    FIRM_OWNER: {
      label: 'Firm Dashboard',
      badge: 'Firm Owner',
      subtitle: 'Firm performance, client books, double-entry vouchers, and practice profitability.',
    },
    CA: {
      label: 'CA Dashboard',
      badge: 'Chartered Accountant',
      subtitle: 'Statutory compliance, bank reconciliation oversight, GSTR-2B matching, and final voucher sign-offs.',
    },
    MANAGER: {
      label: 'Manager Dashboard',
      badge: 'Audit & Tax Manager',
      subtitle: 'Workflow allocation, document pipeline, pending reviews, and Tally Prime sync integrity.',
    },
    ACCOUNTANT: {
      label: 'Accountant Dashboard',
      badge: 'Accountant',
      subtitle: 'Voucher entry, ledger reconciliations, invoice OCR verification, and day-to-day books.',
    },
    GST_EXECUTIVE: {
      label: 'GST Dashboard',
      badge: 'GST Specialist',
      subtitle: 'GSTR-2B vs Books reconciliation, ITC validation, 100% tax mismatch detection, and vendor follow-up.',
    },
    DATA_ENTRY_OPERATOR: {
      label: 'Work Queue',
      badge: 'Data Processing',
      subtitle: 'Statement file uploads, invoice scans, OCR confidence verifications, and parsing queues.',
    },
    REVIEWER: {
      label: 'Review Queue',
      badge: 'Reviewer',
      subtitle: 'Multi-factor duplicate transaction verification, ledger anomaly checks, and QA sign-offs.',
    },
    CLIENT: {
      label: 'Client Dashboard',
      badge: 'Client Portal',
      subtitle: 'Client financial summary, document upload repository, and real-time compliance tracker.',
    },
  };

  const currentDashboardInfo = roleDashboardInfo[role] || {
    label: isClientMode ? 'Client Dashboard' : 'Firm Dashboard',
    badge: isClientMode ? 'Client Portal' : 'CA Practice',
    subtitle: 'Automated bank statement extraction, layered duplicate detection, GST 2B reconciliation, and 1-click double-entry posting.',
  };
  const totalInflow = bankTransactions.reduce((sum, t) => sum + (t.deposit || 0), 0);
  const totalOutflow = bankTransactions.reduce((sum, t) => sum + (t.withdrawal || 0), 0);
  const duplicateTxns = bankTransactions.filter(t => t.isDuplicate);
  const pendingReviewTxns = bankTransactions.filter(
    t => (t.reviewStatus || t.status) === 'PENDING_REVIEW'
  );
  const approvedTxns = bankTransactions.filter(
    t => (t.reviewStatus || t.status) === 'APPROVED'
  );

  const matchedItc = gstReconciliation
    .filter(r => r.status === 'MATCHED')
    .reduce((sum, r) => sum + r.booksTaxAmount, 0);

  const blockedItc = gstReconciliation
    .filter(r => r.status === 'MISSING_IN_GSTR')
    .reduce((sum, r) => sum + r.differenceAmount, 0);

  const tallyPendingCount = vouchers.filter(v => v.tallySyncStatus !== 'SYNCED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950/80 p-6 border border-emerald-900/40 shadow-sm text-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {currentDashboardInfo.badge}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {isClientMode
                  ? `Client: ${selectedClient?.name || 'Selected Client'}`
                  : `Firm: ${firmName}`}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              {currentDashboardInfo.label}
              <span className="text-slate-400 font-normal text-lg ml-2">
                — {isClientMode ? (selectedClient?.name || 'Client Portal') : firmName}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              {currentDashboardInfo.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="dashboard-goto-bank-btn"
              onClick={() => onNavigate('bank_automation')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Bank Statement</span>
            </button>

            {!isClientMode && (
              <button
                id="dashboard-goto-clients-btn"
                onClick={() => onNavigate('clients_companies')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span>Add Client / Company</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards - Real Data Driven */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bank Inflow */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Bank Receipts (Inflow)</span>
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white tracking-tight font-mono">
            ₹{totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{bankTransactions.length} Total Txns</span>
            <span className="text-emerald-400 font-medium">Verified Inflow</span>
          </div>
        </div>

        {/* Total Bank Outflow */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Disbursements (Outflow)</span>
            <span className="p-1.5 rounded-md bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white tracking-tight font-mono">
            ₹{totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Net: ₹{(totalInflow - totalOutflow).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-400 font-medium">Expenses &amp; Contra</span>
          </div>
        </div>

        {/* Duplicate & Review Alerts */}
        <div
          onClick={() => onNavigate('bank_automation')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm hover:border-amber-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Duplicate Alerts</span>
            <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-amber-400 font-mono">
              {duplicateTxns.length}
            </p>
            <span className="text-xs text-slate-400">
              ({pendingReviewTxns.length} need review)
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {duplicateTxns.length > 0 ? 'Action required' : 'No duplicates detected'}
            </span>
            <span className="text-amber-400 font-medium">
              Review &rarr;
            </span>
          </div>
        </div>

        {/* Vouchers & Tally Status */}
        <div
          onClick={() => onNavigate(isClientMode ? 'reports_audit' : 'tally_sync')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-sm hover:border-sky-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Balanced Vouchers</span>
            <span className="p-1.5 rounded-md bg-sky-500/10 text-sky-400">
              <BookOpenCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-sky-400 font-mono">
            {vouchers.length} Vouchers
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {tallyPendingCount > 0 ? `${tallyPendingCount} pending Tally sync` : 'All in sync'}
            </span>
            <span className="text-sky-400 font-medium">
              {isClientMode ? 'View Books &rarr;' : 'Tally &rarr;'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Modules & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Core Modules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                {isClientMode ? 'Your Portal Services' : 'Automation Workflows'}
              </h2>
              <span className="text-xs text-slate-400">
                {clients.length} Clients &bull; {companies.length} Companies
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bank Statement Automation Card */}
              <div
                onClick={() => onNavigate('bank_automation')}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                    {bankTransactions.length} Recorded
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Bank Statement Automation</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Multi-format parser (PDF, Excel, CSV) with duplicate detection &amp; ledger categorization.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-emerald-400 font-medium">
                  <span>Open Module</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Invoice OCR Card */}
              <div
                onClick={() => onNavigate('invoice_ocr')}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-sky-500/50 cursor-pointer transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                    {documents.length} Uploads
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {isClientMode ? 'Document & Bill Vault' : 'Invoice AI & OCR Engine'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extract Indian GSTINs, HSN codes, taxable values &amp; line items from vendor bills.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-sky-400 font-medium">
                  <span>Open Vault</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Accounting & Vouchers Card (CA Mode) */}
              {!isClientMode && (
                <div
                  onClick={() => onNavigate('accounting')}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-amber-500/50 cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center">
                      <BookOpenCheck className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {vouchers.length} Vouchers
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Double-Entry Vouchers</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Strict Dr = Cr balanced vouchers for Payments, Receipts, Contra, and Journal entries.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-amber-400 font-medium">
                    <span>View Vouchers</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* Tally Prime / Compliance Card */}
              {!isClientMode ? (
                <div
                  onClick={() => onNavigate('tally_sync')}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-purple-500/50 cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-purple-400 border border-slate-700">
                      Tally Connector
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Tally Prime Direct Sync</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sync vouchers directly into Tally Prime via XML over HTTP (port 9000).
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-purple-400 font-medium">
                    <span>Connector Settings</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => onNavigate('reports_audit')}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 hover:border-purple-500/50 cursor-pointer transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-purple-400 border border-slate-700">
                      Compliance
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Compliance &amp; Reports</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      View filed GST reports, verified ledger balances, and audit history.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-purple-400 font-medium">
                    <span>View Reports</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Real Audit Activity Stream */}
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Firm Audit Trail
              </h2>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No activity logged in current session.
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.slice(0, 6).map(log => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-400 text-[11px]">{log.action}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-snug">{log.details}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>{log.userName}</span>
                      <span className="font-mono">{log.entity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
