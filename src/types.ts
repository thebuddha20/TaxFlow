/**
 * TaxFlow - Comprehensive Accounting & GST Platform Types
 * Clean-room implementation for Indian CA & Enterprise accounting workflows
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'FIRM_OWNER'
  | 'CA'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'GST_EXECUTIVE'
  | 'DATA_ENTRY_OPERATOR'
  | 'REVIEWER'
  | 'CLIENT';

export type Permission =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'UPLOAD'
  | 'PROCESS'
  | 'APPROVE'
  | 'REJECT'
  | 'SYNC'
  | 'EXPORT'
  | 'FILE'
  | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  firmId: string;
  firmName?: string;
  clientId?: string;
  avatar?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  permissions: string[];
  assignedClients?: string[];
  assignedCompanies?: string[];
  createdAt: string;
  lastLogin?: string;
}

export interface Firm {
  id: string;
  name: string;
  registrationNumber?: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  createdAt: string;
}

export interface Client {
  id: string;
  firmId: string;
  name: string;
  businessName?: string;
  pan: string;
  contactPerson: string;
  email: string;
  phone: string;
  assignedStaff?: string;
  status: 'ACTIVE' | 'INACTIVE';
  totalCompanies: number;
  pendingDocuments: number;
  createdAt: string;
  lastActivity?: string;
}

export interface Company {
  id: string;
  firmId: string;
  clientId: string;
  name: string;
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  address?: string;
  pincode?: string;
  constitution: 'PRIVATE_LIMITED' | 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PUBLIC_LIMITED';
  financialYear: string;
  stateCode: string;
  state: string;
  tallyCompanyName?: string;
  isTallySynced: boolean;
  assignedAccountant?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export type DocumentType =
  | 'BANK_STATEMENT'
  | 'SALES_INVOICE'
  | 'PURCHASE_BILL'
  | 'EXPENSE_BILL'
  | 'GST_RETURN'
  | 'OTHER';

export type DocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED';

export interface AppDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl?: string;
  documentType: DocumentType;
  status: DocumentStatus;
  confidenceScore?: number;
  extractedItemsCount?: number;
  uploadedById: string;
  uploadedByName: string;
  firmId: string;
  clientId: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'UNKNOWN';

export type TransactionReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'POSTED_TO_TALLY';

export interface BankTransaction {
  id: string;
  date: string;
  valueDate?: string;
  narration: string;
  referenceNumber?: string;
  reference?: string;
  withdrawal: number;
  deposit: number;
  balance?: number;
  type: TransactionType;
  category: string;
  suggestedLedger: string;
  finalLedger?: string;
  confidence: number;
  reason: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateScore?: number;
  duplicatePairId?: string;
  status: TransactionReviewStatus;
  reviewStatus?: TransactionReviewStatus;
  voucherGenerated?: boolean;
  voucherId?: string;
  tallyStatus?: 'PENDING' | 'PUSHED' | 'FAILED' | 'ALREADY_SYNCED' | 'PENDING_TALLY_SYNC' | 'NOT_APPLICABLE';
  tallyVoucherId?: string;
  tallyVoucherNumber?: string;
  syncedAt?: string;
  syncError?: string;
  transactionFingerprint?: string;
  learnedRuleApplied?: boolean;
  firmId: string;
  clientId: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ledger {
  id: string;
  firmId: string;
  companyId: string;
  name: string;
  code?: string;
  group: string; // e.g. 'Indirect Expenses', 'Direct Incomes', 'Current Assets', 'Sundry Debtors', etc.
  nature?: 'EXPENSE' | 'INCOME' | 'ASSET' | 'LIABILITY';
  gstApplicable?: boolean;
  gstRate?: number; // 0, 5, 12, 18, 28
  hsnSac?: string;
  openingBalance: number;
  currentBalance: number;
  balanceType: 'DR' | 'CR';
  isActive?: boolean;
  isDefault?: boolean;
  tallyLedgerId?: string;
  tallySyncedAt?: string;
}

export interface LearnedMapping {
  id: string;
  firmId: string;
  companyId?: string;
  pattern: string;
  targetLedger: string;
  category?: string;
  confidence: number;
  timesApplied: number;
  createdAt: string;
  updatedAt: string;
}

export type VoucherType =
  | 'SALES'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE';

export interface VoucherEntry {
  id: string;
  ledgerId: string;
  ledgerName: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  narration?: string;
}

export interface Voucher {
  id: string;
  firmId: string;
  companyId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  date: string;
  narration: string;
  totalAmount: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  entries: VoucherEntry[];
  tallySyncStatus: 'NOT_SYNCED' | 'SYNCED' | 'FAILED' | 'PENDING_TALLY_SYNC' | 'ALREADY_SYNCED';
  tallyVoucherId?: string;
  tallyVoucherNumber?: string;
  reference?: string;
  costCentre?: string;
  syncError?: string;
  syncedAt?: string;
  sourceDocumentId?: string;
  createdAt: string;
}

export interface ExtractedInvoice {
  id: string;
  documentId: string;
  companyId: string;
  invoiceType: 'SALES' | 'PURCHASE';
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGstin: string;
  customerName: string;
  customerGstin: string;
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  confidence: {
    overall: number;
    gstin: number;
    invoiceNumber: number;
    date: number;
    taxableValue: number;
    totalAmount: number;
  };
  items: Array<{
    description: string;
    hsnSac: string;
    qty: number;
    rate: number;
    taxableAmount: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>;
  status: 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED';
}

export type GstReconStatus =
  | 'MATCHED'
  | 'PARTIAL_MATCH'
  | 'MISMATCH'
  | 'MISSING_IN_BOOKS'
  | 'MISSING_IN_GSTR'
  | 'DUPLICATE'
  | 'REVIEW_REQUIRED';

export interface GstReconciliationItem {
  id: string;
  companyId: string;
  gstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  booksTaxableValue: number;
  booksTaxAmount: number;
  gstrTaxableValue: number;
  gstrTaxAmount: number;
  differenceAmount: number;
  status: GstReconStatus;
  notes?: string;
  itcEligible: boolean;
  returnPeriod: string; // e.g. "04-2026"
}

export interface GstValidationRule {
  ruleId: string;
  name: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: 'GSTIN' | 'TAX_RATE' | 'HSN' | 'ITC' | 'DUPLICATE';
  message: string;
  suggestedAction: string;
}

export interface TallyConnection {
  id: string;
  companyId: string;
  companyName: string;
  tallyHost: string;
  tallyPort: number;
  status: 'CONNECTED' | 'OFFLINE' | 'ERROR' | 'SYNCING';
  connectorVersion?: string;
  lastErrorMessage?: string;
  lastSyncTime?: string;
  connectedAt?: string;
  lastTestedAt?: string;
  pendingVouchersCount: number;
  syncedVouchersCount: number;
}

export interface TallyCompanyMapping {
  id: string;
  firmId: string;
  taxflowCompanyId: string;
  taxflowCompanyName: string;
  tallyCompanyName: string;
  tallyCompanyIdentifier: string;
  connectionStatus: 'CONNECTED' | 'OFFLINE' | 'UNMAPPED';
  lastSyncTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TallySyncLog {
  id: string;
  companyId: string;
  voucherNumber: string;
  voucherType: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUSH';
  status: 'SUCCESS' | 'FAILED' | 'ALREADY_SYNCED' | 'PENDING_TALLY_SYNC';
  amount?: number;
  tallyCompany?: string;
  payloadSummary: string;
  responseMessage?: string;
  error?: string;
  timestamp: string;
}

export interface Task {
  id: string;
  firmId: string;
  clientId: string;
  companyId: string;
  title: string;
  description?: string;
  assignedToName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
  dueDate: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  firmId: string;
  userName: string;
  userRole: string;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'APPROVE'
    | 'REJECT'
    | 'UPLOAD'
    | 'PROCESS'
    | 'SYNC'
    | 'EXPORT'
    | 'LOGIN'
    | 'LOGOUT';
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}
