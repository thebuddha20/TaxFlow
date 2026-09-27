import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  UserRole,
  Client,
  Company,
  AppDocument,
  BankTransaction,
  Voucher,
  Ledger,
  ExtractedInvoice,
  GstReconciliationItem,
  GstValidationRule,
  TallyConnection,
  TallySyncLog,
  AuditLog,
  VoucherType,
  Firm,
} from './types.ts';
import { Header } from './components/Header.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { BankAutomationView } from './components/BankAutomationView.tsx';
import { InvoiceOcrView } from './components/InvoiceOcrView.tsx';
import { AccountingVouchersView } from './components/AccountingVouchersView.tsx';
import { GstReconciliationView } from './components/GstReconciliationView.tsx';
import { TallyConnectorView } from './components/TallyConnectorView.tsx';
import { ReviewCenterView } from './components/ReviewCenterView.tsx';
import { ClientsCompaniesView } from './components/ClientsCompaniesView.tsx';
import { ReportsAuditView } from './components/ReportsAuditView.tsx';
import { AiAssistantView } from './components/AiAssistantView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function getRoleInitialTab(role?: UserRole): NavTab {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'dashboard';
    case 'FIRM_OWNER':
      return 'dashboard';
    case 'CA':
      return 'dashboard';
    case 'MANAGER':
      return 'dashboard';
    case 'ACCOUNTANT':
      return 'accounting';
    case 'GST_EXECUTIVE':
      return 'gst_center';
    case 'DATA_ENTRY_OPERATOR':
      return 'bank_automation';
    case 'REVIEWER':
      return 'review_center';
    case 'CLIENT':
      return 'dashboard';
    default:
      return 'dashboard';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Authentication & Firm State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('taxflow_auth_token') || sessionStorage.getItem('taxflow_auth_token');
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentFirm, setCurrentFirm] = useState<Firm | null>(null);

  // Client vs CA Mode State
  const [isClientMode, setIsClientMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedFY, setSelectedFY] = useState<string>('2025-2026');

  // Core Entity Collections
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [gstReconciliation, setGstReconciliation] = useState<GstReconciliationItem[]>([]);
  const [gstRules, setGstRules] = useState<GstValidationRule[]>([]);
  const [tallyConnection, setTallyConnection] = useState<TallyConnection>({
    status: 'CONNECTED',
    tallyHost: 'localhost',
    tallyPort: 9000,
    companyName: 'Apex Tech Solutions Pvt Ltd',
    lastSyncTime: new Date().toISOString(),
    syncedVouchersCount: 0,
    pendingVouchersCount: 0,
  });
  const [tallySyncLogs, setTallySyncLogs] = useState<TallySyncLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Action Loading States
  const [isProcessingBank, setIsProcessingBank] = useState(false);
  const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);
  const [isReconcilingGst, setIsReconcilingGst] = useState(false);
  const [isSyncingTally, setIsSyncingTally] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Helper for authenticated API calls
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('taxflow_auth_token') || sessionStorage.getItem('taxflow_auth_token') || authToken;
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('taxflow_auth_token');
      sessionStorage.removeItem('taxflow_auth_token');
      setAuthToken(null);
      setCurrentUser(null);
      setCurrentFirm(null);
      setSessionError('Your session has expired. Please login again.');
    }
    return res;
  }, [authToken]);

  // Initial Data Fetch
  const loadAllData = async (tokenOverride?: string, userOverride?: User) => {
    setIsLoading(true);
    try {
      const activeToken = tokenOverride || localStorage.getItem('taxflow_auth_token') || sessionStorage.getItem('taxflow_auth_token') || authToken;
      if (!activeToken) return;

      const headers = { Authorization: `Bearer ${activeToken}` };
      const [
        contextRes,
        bankRes,
        vouchersRes,
        ledgersRes,
        invoicesRes,
        gstRes,
        rulesRes,
        tallyRes,
        tallyLogsRes,
        auditRes,
      ] = await Promise.all([
        fetch('/api/firm-context', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/bank/transactions', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/accounting/vouchers', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/accounting/ledgers', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/invoices', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/gst/reconciliation', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/gst/rules', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/tally/status', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/tally/sync-logs', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/audit-logs', { headers }).then(r => r.json()).catch(() => ({})),
      ]);

      if (contextRes.firm) setCurrentFirm(contextRes.firm);
      if (contextRes.clients) {
        setClients(contextRes.clients);
        const user = userOverride || currentUser;
        if (user?.clientId) {
          setSelectedClientId(user.clientId);
        } else if (contextRes.clients.length > 0) {
          setSelectedClientId(prev => prev && contextRes.clients.some((c: Client) => c.id === prev) ? prev : contextRes.clients[0].id);
        }
      }
      if (contextRes.companies) {
        setCompanies(contextRes.companies);
        if (contextRes.companies.length > 0) {
          setSelectedCompanyId(prev => prev && contextRes.companies.some((c: Company) => c.id === prev) ? prev : contextRes.companies[0].id);
        }
      }
      if (contextRes.documents) setDocuments(contextRes.documents);
      if (bankRes.transactions) setBankTransactions(bankRes.transactions);
      if (vouchersRes.vouchers) setVouchers(vouchersRes.vouchers);
      if (ledgersRes.ledgers) setLedgers(ledgersRes.ledgers);
      if (invoicesRes.invoices) setInvoices(invoicesRes.invoices);
      if (gstRes.items) setGstReconciliation(gstRes.items);
      if (rulesRes.rules) setGstRules(rulesRes.rules);
      if (tallyRes.connection) setTallyConnection(tallyRes.connection);
      if (tallyLogsRes.logs) setTallySyncLogs(tallyLogsRes.logs);
      if (auditRes.logs) setAuditLogs(auditRes.logs);
    } catch (err: any) {
      console.error('Failed to load initial TaxFlow data:', err);
      showToast('error', 'Error connecting to backend services.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSession = async () => {
    setIsCheckingSession(true);
    setSessionError(null);
    const token = localStorage.getItem('taxflow_auth_token') || sessionStorage.getItem('taxflow_auth_token');

    if (!token) {
      setIsCheckingSession(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        localStorage.removeItem('taxflow_auth_token');
        sessionStorage.removeItem('taxflow_auth_token');
        setAuthToken(null);
        setCurrentUser(null);
        setCurrentFirm(null);
        if (res.status === 403) {
          setSessionError('Your account is inactive.');
        } else {
          setSessionError('Your session has expired. Please login again.');
        }
        setIsCheckingSession(false);
        return;
      }

      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        if (data.firm) setCurrentFirm(data.firm);
        const isClient = data.user.role === 'CLIENT';
        setIsClientMode(isClient);
        if (isClient && data.user.clientId) {
          setSelectedClientId(data.user.clientId);
        }
        setActiveTab(getRoleInitialTab(data.user.role));
        await loadAllData(token, data.user);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      setSessionError('Unable to connect to TaxFlow services.');
    } finally {
      setIsCheckingSession(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Mode & Context Handlers
  const handleToggleClientMode = (isClient: boolean) => {
    setIsClientMode(isClient);
    if (isClient) {
      const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];
      if (activeClient) {
        setSelectedClientId(activeClient.id);
        const clientComp = companies.find(c => c.clientId === activeClient.id);
        if (clientComp) setSelectedCompanyId(clientComp.id);
      }
      showToast('info', `Switched to Client Portal perspective: ${selectedClient?.name || 'Client'}`);
    } else {
      showToast('info', 'Returned to CA Practice Command Center');
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const clientComps = companies.filter(c => c.clientId === clientId);
    if (clientComps.length > 0) {
      setSelectedCompanyId(clientComps[0].id);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('taxflow_auth_token') || sessionStorage.getItem('taxflow_auth_token') || authToken;
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Ignore network errors on logout
      }
    }
    localStorage.removeItem('taxflow_auth_token');
    sessionStorage.removeItem('taxflow_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentFirm(null);
    setClients([]);
    setCompanies([]);
    setDocuments([]);
    setBankTransactions([]);
    setVouchers([]);
    setLedgers([]);
    setInvoices([]);
    setGstReconciliation([]);
    setGstRules([]);
    setTallySyncLogs([]);
    setAuditLogs([]);
    setSelectedClientId('');
    setSelectedCompanyId('');
    setSessionError(null);
    showToast('info', 'You have been signed out securely.');
  };

  const handleLoginSuccess = async (token: string, user: User, firm?: Firm | null) => {
    setAuthToken(token);
    setCurrentUser(user);
    if (firm) setCurrentFirm(firm);
    setSessionError(null);
    setIsAuthModalOpen(false);

    const isClient = user.role === 'CLIENT';
    setIsClientMode(isClient);
    if (isClient && user.clientId) {
      setSelectedClientId(user.clientId);
    }

    // Role-based landing
    const targetTab = getRoleInitialTab(user.role);
    setActiveTab(targetTab);

    showToast('success', `Welcome back, ${user.name}!`);
    await loadAllData(token, user);
  };

  // Real Bank Upload (Multipart File Support)
  const handleUploadBankStatement = async (file: File, companyId: string, customMappings?: any) => {
    setIsProcessingBank(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId || selectedCompanyId);
      formData.append('clientId', selectedClientId);
      if (customMappings) {
        formData.append('columnMappings', JSON.stringify(customMappings));
      }

      const res = await authFetch('/api/bank/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Bank statement processing failed');
      }

      if (data.transactions) {
        setBankTransactions(data.transactions);
      }
      showToast(
        'success',
        `Extracted ${data.totalDetected} transactions (${data.duplicatesCount} duplicate alerts, ${data.autoApprovedCount} auto-categorized)!`
      );

      // Refresh documents and audit logs
      const [docRes, auditRes] = await Promise.all([
        authFetch('/api/firm-context').then(r => r.json()).catch(() => ({})),
        authFetch('/api/audit-logs').then(r => r.json()).catch(() => ({})),
      ]);
      if (docRes.documents) setDocuments(docRes.documents);
      if (auditRes.logs) setAuditLogs(auditRes.logs);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to upload bank statement file.');
    } finally {
      setIsProcessingBank(false);
    }
  };

  // Raw Text Bank Statement Parser Fallback
  const handleParseStatementText = async (content: string, companyId: string) => {
    setIsProcessingBank(true);
    try {
      const res = await authFetch('/api/bank/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, companyId: companyId || selectedCompanyId }),
      });
      const data = await res.json();
      if (data.transactions) {
        setBankTransactions(data.transactions);
        showToast(
          'success',
          `Parsed ${data.transactions.length} rows (${data.duplicatesDetected} duplicate alerts, ${data.autoApproved} approved)!`
        );
        authFetch('/api/audit-logs')
          .then(r => r.json())
          .then(d => d.logs && setAuditLogs(d.logs));
      }
    } catch (err) {
      showToast('error', 'Failed to process statement text.');
    } finally {
      setIsProcessingBank(false);
    }
  };

  const handleReviewBankTransaction = async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'MARK_DUPLICATE' | 'IGNORE_DUPLICATE' | 'EDIT',
    suggestedLedger?: string,
    category?: string
  ) => {
    try {
      const res = await authFetch(`/api/bank/transactions/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, suggestedLedger, category }),
      });
      const data = await res.json();
      if (data.transaction) {
        setBankTransactions(prev => prev.map(t => (t.id === id ? data.transaction : t)));
        showToast('success', `Transaction updated: ${action}`);
        authFetch('/api/audit-logs')
          .then(r => r.json())
          .then(d => d.logs && setAuditLogs(d.logs));
      }
    } catch (err) {
      showToast('error', 'Failed to update transaction review.');
    }
  };

  const handleBulkReviewBank = async (ids: string[], action: 'APPROVE' | 'REJECT' | 'IGNORE_DUPLICATE') => {
    try {
      const res = await authFetch('/api/bank/transactions/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh transactions
        const bankRes = await authFetch('/api/bank/transactions').then(r => r.json());
        if (bankRes.transactions) setBankTransactions(bankRes.transactions);
        showToast('success', `Bulk updated ${ids.length} transactions!`);
      }
    } catch (err) {
      showToast('error', 'Failed to bulk update transactions.');
    }
  };

  const handleGenerateVouchersFromBank = async () => {
    setIsProcessingBank(true);
    try {
      const res = await authFetch('/api/bank/generate-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.vouchers) {
        setVouchers(data.vouchers);
        const [bankRes, ledgersRes, tallyRes] = await Promise.all([
          authFetch('/api/bank/transactions').then(r => r.json()),
          authFetch('/api/accounting/ledgers').then(r => r.json()),
          authFetch('/api/tally/status').then(r => r.json()),
        ]);
        if (bankRes.transactions) setBankTransactions(bankRes.transactions);
        if (ledgersRes.ledgers) setLedgers(ledgersRes.ledgers);
        if (tallyRes.connection) setTallyConnection(tallyRes.connection);

        showToast('success', `Generated ${data.vouchers.length} balanced double-entry vouchers!`);
      }
    } catch (err) {
      showToast('error', 'Failed to generate vouchers from bank transactions.');
    } finally {
      setIsProcessingBank(false);
    }
  };

  // Invoice OCR Handlers
  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      const res = await authFetch(`/api/invoices/${invoiceId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.invoice) {
        setInvoices(prev => prev.map(i => (i.id === invoiceId ? data.invoice : i)));
        if (data.voucher) {
          setVouchers(prev => [data.voucher, ...prev]);
        }
        showToast('success', `Invoice #${data.invoice.invoiceNumber} approved and Purchase voucher generated!`);
      }
    } catch (err) {
      showToast('error', 'Failed to approve invoice.');
    }
  };

  const handleProcessInvoice = async (invoiceText: string) => {
    setIsProcessingInvoice(true);
    try {
      const res = await authFetch('/api/invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: invoiceText, companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.invoice) {
        setInvoices(prev => [data.invoice, ...prev]);
        showToast('success', `AI extracted invoice #${data.invoice.invoiceNumber} with high confidence!`);
      }
    } catch (err) {
      showToast('error', 'Failed to extract invoice via AI.');
    } finally {
      setIsProcessingInvoice(false);
    }
  };

  // Accounting Handlers
  const handleCreateVoucher = async (vchData: {
    voucherType: VoucherType;
    date: string;
    narration: string;
    entries: Array<{ ledgerId: string; ledgerName: string; type: 'DEBIT' | 'CREDIT'; amount: number }>;
  }) => {
    try {
      const res = await authFetch('/api/accounting/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...vchData, companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.voucher) {
        setVouchers(prev => [data.voucher, ...prev]);
        showToast('success', `Voucher #${data.voucher.voucherNumber} posted successfully!`);
        authFetch('/api/tally/status')
          .then(r => r.json())
          .then(d => d.connection && setTallyConnection(d.connection));
        authFetch('/api/audit-logs')
          .then(r => r.json())
          .then(d => d.logs && setAuditLogs(d.logs));
      }
    } catch (err) {
      showToast('error', 'Failed to post voucher.');
    }
  };

  const handleCreateLedger = async (ledgerData: {
    name: string;
    group: string;
    openingBalance: number;
    balanceType: 'DR' | 'CR';
  }) => {
    try {
      const res = await authFetch('/api/accounting/ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ledgerData, companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.ledger) {
        setLedgers(prev => [...prev, data.ledger]);
        showToast('success', `Ledger "${data.ledger.name}" created!`);
      }
    } catch (err) {
      showToast('error', 'Failed to create ledger.');
    }
  };

  // GST Reconciliation Handlers
  const handleRefreshGstReconciliation = async () => {
    setIsReconcilingGst(true);
    try {
      const res = await authFetch('/api/gst/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.items) {
        setGstReconciliation(data.items);
        showToast('success', `GSTR-2B reconciled: ${data.matchedCount} matched, ${data.missingCount} missing.`);
      }
    } catch (err) {
      showToast('error', 'Failed to reconcile GSTR-2B.');
    } finally {
      setIsReconcilingGst(false);
    }
  };

  // Tally Handlers
  const handleSyncTally = async () => {
    setIsSyncingTally(true);
    try {
      const res = await authFetch('/api/tally/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const data = await res.json();
      if (data.connection) {
        setTallyConnection(data.connection);
        if (data.logs) setTallySyncLogs(data.logs);
        const vRes = await authFetch('/api/accounting/vouchers').then(r => r.json());
        if (vRes.vouchers) setVouchers(vRes.vouchers);
        showToast('success', `Synced ${data.syncedVouchers} vouchers to Tally Prime desktop!`);
      }
    } catch (err) {
      showToast('error', 'Failed to sync with Tally.');
    } finally {
      setIsSyncingTally(false);
    }
  };

  // Client / Company Creation
  const handleCreateClient = async (cData: { name: string; contactPerson: string; email: string; phone: string }) => {
    try {
      const res = await authFetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cData),
      });
      const data = await res.json();
      if (data.client) {
        setClients(prev => [...prev, data.client]);
        showToast('success', `Client ${data.client.name} registered.`);
      }
    } catch (err) {
      showToast('error', 'Failed to register client.');
    }
  };

  const handleCreateCompany = async (compData: {
    clientId: string;
    name: string;
    pan: string;
    gstin: string;
    stateCode: string;
    financialYear: string;
  }) => {
    try {
      const res = await authFetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compData),
      });
      const data = await res.json();
      if (data.company) {
        setCompanies(prev => [...prev, data.company]);
        setSelectedCompanyId(data.company.id);
        showToast('success', `Company ${data.company.name} created!`);
      }
    } catch (err) {
      showToast('error', 'Failed to create company.');
    }
  };

  // Filtered views when in Client Mode
  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const clientCompanyIds = companies.filter(c => c.clientId === selectedClientId).map(c => c.id);

  const activeBankTransactions = isClientMode
    ? bankTransactions.filter(t => !t.companyId || clientCompanyIds.includes(t.companyId))
    : bankTransactions;

  const activeVouchers = isClientMode
    ? vouchers.filter(v => !v.companyId || clientCompanyIds.includes(v.companyId))
    : vouchers;

  const activeDocuments = isClientMode
    ? documents.filter(d => !d.companyId || clientCompanyIds.includes(d.companyId))
    : documents;

  const activeInvoices = isClientMode
    ? invoices.filter(i => !i.companyId || clientCompanyIds.includes(i.companyId))
    : invoices;

  // Counts for Badges
  const duplicateCount = activeBankTransactions.filter(t => t.isDuplicate).length;
  const pendingReviewCount = activeBankTransactions.filter(
    t => (t.reviewStatus || t.status) === 'PENDING_REVIEW'
  ).length;
  const gstMismatchCount = gstReconciliation.filter(
    r => r.status === 'MISSING_IN_GSTR' || r.status === 'MISMATCH'
  ).length;
  const tallyPendingCount = tallyConnection.pendingVouchersCount;

  // 1. Initial Session Check Screen (Restoring session on refresh)
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center font-bold text-xl text-white shadow-xl shadow-emerald-950/60 border border-emerald-500/30">
            TF
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
            <span>Verifying authenticated session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Professional Login Screen (FIRST SCREEN OF APPLICATION)
  if (!currentUser || !authToken) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        initialError={sessionError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 bg-slate-900/95 border-slate-700 text-xs">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
          <span className="font-medium text-slate-200">{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Application Header */}
      <Header
        currentFirm={currentFirm}
        currentUser={currentUser}
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={handleSelectClient}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        selectedFY={selectedFY}
        onSelectFY={setSelectedFY}
        isClientMode={isClientMode}
        onToggleClientMode={handleToggleClientMode}
        pendingReviewsCount={duplicateCount + pendingReviewCount}
        onRefresh={() => loadAllData()}
        isRefreshing={isLoading}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main App Body */}
      <div className="flex-1 flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingReviewCount={pendingReviewCount}
          duplicateCount={duplicateCount}
          gstMismatchCount={gstMismatchCount}
          tallyPendingCount={tallyPendingCount}
          isClientMode={isClientMode}
        />

        {/* Content Workspace */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-xs gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
              <span>Connecting to TaxFlow firm services &amp; database...</span>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  firmName={currentFirm?.name || 'Sharma & Associates'}
                  currentUser={currentUser}
                  isClientMode={isClientMode}
                  selectedClient={selectedClient}
                  clients={clients}
                  companies={companies}
                  documents={activeDocuments}
                  bankTransactions={activeBankTransactions}
                  vouchers={activeVouchers}
                  gstReconciliation={gstReconciliation}
                  tallyConnection={tallyConnection}
                  auditLogs={auditLogs}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'bank_automation' && (
                <BankAutomationView
                  transactions={activeBankTransactions}
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onReviewTransaction={handleReviewBankTransaction}
                  onBulkReview={handleBulkReviewBank}
                  onGenerateVouchers={handleGenerateVouchersFromBank}
                  onUploadStatementFile={handleUploadBankStatement}
                  onParseStatementText={handleParseStatementText}
                  isProcessing={isProcessingBank}
                />
              )}

              {activeTab === 'invoice_ocr' && (
                <InvoiceOcrView
                  invoices={activeInvoices}
                  onApproveInvoice={handleApproveInvoice}
                  onProcessInvoice={handleProcessInvoice}
                  isProcessing={isProcessingInvoice}
                />
              )}

              {activeTab === 'accounting' && (
                <AccountingVouchersView
                  vouchers={activeVouchers}
                  ledgers={ledgers}
                  onCreateVoucher={handleCreateVoucher}
                  onCreateLedger={handleCreateLedger}
                />
              )}

              {activeTab === 'gst_center' && (
                <GstReconciliationView
                  reconciliationItems={gstReconciliation}
                  rules={gstRules}
                  onRefreshReconciliation={handleRefreshGstReconciliation}
                  isReconciling={isReconcilingGst}
                />
              )}

              {activeTab === 'tally_sync' && (
                <TallyConnectorView
                  connection={tallyConnection}
                  syncLogs={tallySyncLogs}
                  onSyncVouchers={handleSyncTally}
                  isSyncing={isSyncingTally}
                />
              )}

              {activeTab === 'review_center' && (
                <ReviewCenterView
                  pendingTransactions={activeBankTransactions.filter(
                    t => (t.reviewStatus || t.status) === 'PENDING_REVIEW'
                  )}
                  pendingInvoices={activeInvoices.filter(i => i.status !== 'APPROVED')}
                  onReviewTransaction={handleReviewBankTransaction}
                  onApproveInvoice={handleApproveInvoice}
                />
              )}

              {activeTab === 'clients_companies' && (
                <ClientsCompaniesView
                  clients={clients}
                  companies={companies}
                  activeCompanyId={selectedCompanyId}
                  onSelectCompany={setSelectedCompanyId}
                  onCreateClient={handleCreateClient}
                  onCreateCompany={handleCreateCompany}
                />
              )}

              {activeTab === 'reports_audit' && (
                <ReportsAuditView
                  auditLogs={auditLogs}
                  bankTransactions={activeBankTransactions}
                  vouchers={activeVouchers}
                  gstReconciliation={gstReconciliation}
                />
              )}

              {activeTab === 'ai_assistant' && <AiAssistantView />}
            </>
          )}
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        defaultRole={isClientMode ? 'CLIENT' : 'FIRM_OWNER'}
      />
    </div>
  );
}
