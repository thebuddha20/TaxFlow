/**
 * TaxFlow - Multi-tenant Persistent Data Store
 * Clean-room implementation for Indian CA & Enterprise accounting workflows
 * Strictly no fake data: persistent storage in server/taxflow-db.json
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  Firm,
  User,
  Client,
  Company,
  AppDocument,
  BankTransaction,
  Ledger,
  Voucher,
  ExtractedInvoice,
  GstReconciliationItem,
  TallyConnection,
  TallyCompanyMapping,
  LearnedMapping,
  TallySyncLog,
  Task,
  AuditLog,
} from '../src/types.ts';

export interface StoredUser extends User {
  passwordHash: string;
  resetToken?: string;
  resetTokenExpires?: number;
}

export interface DatabaseState {
  firms: Firm[];
  users: StoredUser[];
  clients: Client[];
  companies: Company[];
  documents: AppDocument[];
  bankTransactions: BankTransaction[];
  ledgers: Ledger[];
  vouchers: Voucher[];
  invoices: ExtractedInvoice[];
  gstReconciliation: GstReconciliationItem[];
  tallyConnection: TallyConnection;
  tallyCompanyMappings: TallyCompanyMapping[];
  tallySyncLogs: TallySyncLog[];
  learnedMappings: LearnedMapping[];
  tasks: Task[];
  auditLogs: AuditLog[];
}

const DB_FILE = path.resolve(process.cwd(), 'server', 'taxflow-db.json');

// Default initial firm
const INITIAL_FIRM_ID = 'firm_primary_01';
const INITIAL_FIRM: Firm = {
  id: INITIAL_FIRM_ID,
  name: 'TaxFlow CA Practice',
  registrationNumber: 'FRN-2026-IND',
  pan: 'AABCT1234F',
  email: 'admin@taxflow.in',
  phone: '+91 98200 12345',
  address: 'Suite 401, Nariman Point Commercial Hub',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400021',
  createdAt: new Date().toISOString(),
};

// Default initial admin user (password: TaxFlow@2026)
const INITIAL_ADMIN: StoredUser = {
  id: 'usr_owner_01',
  name: 'Principal CA',
  email: 'admin@taxflow.in',
  passwordHash: '$2b$10$hHkWT2FoGClTrZHssHzKs.JdiNJ6O.GeDrGXIkX0h/m66zk73kfwa', // bcrypt of TaxFlow@2026
  role: 'FIRM_OWNER',
  firmId: INITIAL_FIRM_ID,
  firmName: INITIAL_FIRM.name,
  phone: '+91 98200 12345',
  status: 'ACTIVE',
  permissions: ['ADMIN', 'VIEW', 'CREATE', 'EDIT', 'DELETE', 'UPLOAD', 'PROCESS', 'APPROVE', 'REJECT', 'SYNC', 'EXPORT', 'FILE'],
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
};

// Standard chart of accounts template for Indian entities
const DEFAULT_LEDGERS: Ledger[] = [
  { id: 'led_bank_default', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Bank Account (Primary)', group: 'Bank Accounts', openingBalance: 0, currentBalance: 0, balanceType: 'DR', isDefault: true },
  { id: 'led_cash_default', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Cash in Hand', group: 'Cash-in-hand', openingBalance: 0, currentBalance: 0, balanceType: 'DR', isDefault: true },
  { id: 'led_food', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Food & Refreshments', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_elec', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Electricity Expenses', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_rent', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Rent & Maintenance', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_salary', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Salaries & Wages', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_prof_fees', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Professional Fees Income', group: 'Direct Incomes', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_client_receipts', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Client Receipts', group: 'Direct Incomes', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_sales', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Sales Account', group: 'Sales Accounts', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_purchase', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Purchase Account', group: 'Purchase Accounts', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_office_exp', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Office Expenses', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_travel', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Travel & Conveyance', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_bank_charges', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Bank Charges & Commission', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_software', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Software & Technology Expenses', group: 'Indirect Expenses', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_tax_payment', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Direct Taxes / Advance Tax', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_gst_payment', firmId: INITIAL_FIRM_ID, companyId: '', name: 'GST Electronic Cash Ledger', group: 'Current Assets', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_output_cgst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Output CGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_output_sgst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Output SGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_output_igst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Output IGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'CR' },
  { id: 'led_input_cgst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Input CGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_input_sgst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Input SGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_input_igst', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Input IGST A/C', group: 'Duties & Taxes', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
  { id: 'led_suspense', firmId: INITIAL_FIRM_ID, companyId: '', name: 'Suspense Account', group: 'Suspense A/c', openingBalance: 0, currentBalance: 0, balanceType: 'DR' },
];

function createInitialState(): DatabaseState {
  return {
    firms: [INITIAL_FIRM],
    users: [INITIAL_ADMIN],
    clients: [], // Clean: strictly no demo clients
    companies: [], // Clean: strictly no demo companies
    documents: [], // Clean: strictly no demo documents
    bankTransactions: [], // Clean: strictly no fake transactions
    ledgers: DEFAULT_LEDGERS,
    vouchers: [], // Clean: strictly no fake vouchers
    invoices: [], // Clean: strictly no fake invoices
    gstReconciliation: [], // Clean: strictly no fake GST reconciliations
    tallyConnection: {
      id: 'tally_conn_default',
      companyId: '',
      companyName: 'Not Connected',
      tallyHost: 'localhost',
      tallyPort: 9000,
      status: 'OFFLINE',
      connectorVersion: 'v2.4.0-tallyprime',
      pendingVouchersCount: 0,
      syncedVouchersCount: 0,
    },
    tallyCompanyMappings: [],
    tallySyncLogs: [],
    learnedMappings: [],
    tasks: [],
    auditLogs: [
      {
        id: 'audit_init_01',
        firmId: INITIAL_FIRM_ID,
        userName: 'System',
        userRole: 'SUPER_ADMIN',
        action: 'CREATE',
        entity: 'SYSTEM',
        entityId: 'sys_init',
        details: 'TaxFlow database initialized with clean zero-demo state and enterprise security.',
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export class DataStore {
  private static state: DatabaseState = DataStore.loadFromDisk();

  private static loadFromDisk(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        // Verify critical arrays exist
        if (Array.isArray(parsed.users) && Array.isArray(parsed.firms)) {
          parsed.tallyCompanyMappings = parsed.tallyCompanyMappings || [];
          parsed.tallySyncLogs = parsed.tallySyncLogs || [];
          parsed.learnedMappings = parsed.learnedMappings || [];
          parsed.tasks = parsed.tasks || [];
          parsed.auditLogs = parsed.auditLogs || [];
          if (!parsed.tallyConnection) {
            parsed.tallyConnection = {
              id: 'tally_conn_default',
              companyId: '',
              companyName: 'Not Connected',
              tallyHost: 'localhost',
              tallyPort: 9000,
              status: 'OFFLINE',
              connectorVersion: 'v2.4.0-tallyprime',
              pendingVouchersCount: 0,
              syncedVouchersCount: 0,
            };
          } else if ((parsed.tallyConnection.status as string) === 'DISCONNECTED') {
            parsed.tallyConnection.status = 'OFFLINE';
          }
          if (!parsed.tallyConnection.connectorVersion) {
            parsed.tallyConnection.connectorVersion = 'v2.4.0-tallyprime';
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Could not read taxflow-db.json, initializing fresh clean state:', err);
    }
    const fresh = createInitialState();
    DataStore.saveToDisk(fresh);
    return fresh;
  }

  private static saveToDisk(stateToSave?: DatabaseState): void {
    try {
      const data = stateToSave || this.state;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving taxflow-db.json:', err);
    }
  }

  public static getState(): DatabaseState {
    return this.state;
  }

  public static commit(): void {
    this.saveToDisk();
  }

  // --- Audit Logging ---
  public static addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.state.auditLogs.unshift(entry);
    this.commit();
    return entry;
  }

  // --- Users & Auth ---
  public static getUserByEmail(email: string): StoredUser | undefined {
    return this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public static getUserById(id: string): StoredUser | undefined {
    return this.state.users.find(u => u.id === id);
  }

  public static createUser(user: StoredUser): StoredUser {
    this.state.users.push(user);
    this.commit();
    return user;
  }

  public static updateUser(id: string, updates: Partial<StoredUser>): StoredUser | undefined {
    const idx = this.state.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.state.users[idx] = { ...this.state.users[idx], ...updates };
    this.commit();
    return this.state.users[idx];
  }

  // --- Firms ---
  public static getFirmById(id: string): Firm | undefined {
    return this.state.firms.find(f => f.id === id);
  }

  public static createFirm(firm: Firm): Firm {
    this.state.firms.push(firm);
    this.commit();
    return firm;
  }

  // --- Clients ---
  public static getClients(firmId: string, clientIdFilter?: string): Client[] {
    return this.state.clients.filter(c => {
      if (c.firmId !== firmId) return false;
      if (clientIdFilter && c.id !== clientIdFilter) return false;
      return true;
    });
  }

  public static createClient(client: Client): Client {
    this.state.clients.unshift(client);
    this.commit();
    return client;
  }

  public static updateClient(id: string, firmId: string, updates: Partial<Client>): Client | undefined {
    const idx = this.state.clients.findIndex(c => c.id === id && c.firmId === firmId);
    if (idx === -1) return undefined;
    this.state.clients[idx] = { ...this.state.clients[idx], ...updates };
    this.commit();
    return this.state.clients[idx];
  }

  public static deleteClient(id: string, firmId: string): boolean {
    const idx = this.state.clients.findIndex(c => c.id === id && c.firmId === firmId);
    if (idx === -1) return false;
    this.state.clients.splice(idx, 1);
    // Cascade delete companies, bank txns for that client
    this.state.companies = this.state.companies.filter(c => c.clientId !== id);
    this.state.bankTransactions = this.state.bankTransactions.filter(t => t.clientId !== id);
    this.commit();
    return true;
  }

  // --- Companies ---
  public static getCompanies(firmId: string, clientIdFilter?: string): Company[] {
    return this.state.companies.filter(c => {
      if (c.firmId !== firmId) return false;
      if (clientIdFilter && c.clientId !== clientIdFilter) return false;
      return true;
    });
  }

  public static createCompany(company: Company): Company {
    this.state.companies.unshift(company);
    // Increment totalCompanies on parent client
    const client = this.state.clients.find(c => c.id === company.clientId);
    if (client) {
      client.totalCompanies = (client.totalCompanies || 0) + 1;
    }
    this.commit();
    return company;
  }

  public static updateCompany(id: string, firmId: string, updates: Partial<Company>): Company | undefined {
    const idx = this.state.companies.findIndex(c => c.id === id && c.firmId === firmId);
    if (idx === -1) return undefined;
    this.state.companies[idx] = { ...this.state.companies[idx], ...updates };
    this.commit();
    return this.state.companies[idx];
  }

  public static deleteCompany(id: string, firmId: string): boolean {
    const idx = this.state.companies.findIndex(c => c.id === id && c.firmId === firmId);
    if (idx === -1) return false;
    const comp = this.state.companies[idx];
    this.state.companies.splice(idx, 1);
    const client = this.state.clients.find(c => c.id === comp.clientId);
    if (client && client.totalCompanies > 0) {
      client.totalCompanies -= 1;
    }
    this.commit();
    return true;
  }

  // --- Bank Transactions ---
  public static getBankTransactions(firmId: string, companyId?: string, clientId?: string): BankTransaction[] {
    return this.state.bankTransactions.filter(t => {
      if (t.firmId !== firmId) return false;
      if (companyId && t.companyId && t.companyId !== companyId) return false;
      if (clientId && t.clientId && t.clientId !== clientId) return false;
      return true;
    });
  }

  public static addBankTransactions(txns: BankTransaction[]): void {
    this.state.bankTransactions.unshift(...txns);
    this.commit();
  }

  public static updateBankTransaction(id: string, firmId: string, updates: Partial<BankTransaction>): BankTransaction | undefined {
    const idx = this.state.bankTransactions.findIndex(t => t.id === id && t.firmId === firmId);
    if (idx === -1) return undefined;
    this.state.bankTransactions[idx] = {
      ...this.state.bankTransactions[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.commit();
    return this.state.bankTransactions[idx];
  }

  // --- Vouchers ---
  public static getVouchers(firmId: string, companyId?: string): Voucher[] {
    return this.state.vouchers.filter(v => {
      if (v.firmId !== firmId) return false;
      if (companyId && v.companyId && v.companyId !== companyId) return false;
      return true;
    });
  }

  public static addVouchers(vouchers: Voucher[]): void {
    this.state.vouchers.unshift(...vouchers);
    this.commit();
  }

  // --- Documents ---
  public static getDocuments(firmId: string, companyId?: string, clientId?: string): AppDocument[] {
    return this.state.documents.filter(d => {
      if (d.firmId !== firmId) return false;
      if (companyId && d.companyId && d.companyId !== companyId) return false;
      if (clientId && d.clientId && d.clientId !== clientId) return false;
      return true;
    });
  }

  public static addDocument(doc: AppDocument): AppDocument {
    this.state.documents.unshift(doc);
    this.commit();
    return doc;
  }

  public static updateDocument(id: string, firmId: string, updates: Partial<AppDocument>): AppDocument | undefined {
    const idx = this.state.documents.findIndex(d => d.id === id && d.firmId === firmId);
    if (idx === -1) return undefined;
    this.state.documents[idx] = { ...this.state.documents[idx], ...updates, updatedAt: new Date().toISOString() };
    this.commit();
    return this.state.documents[idx];
  }

  // --- Invoices ---
  public static getInvoices(companyId?: string): ExtractedInvoice[] {
    return this.state.invoices.filter(i => {
      if (companyId && i.companyId && i.companyId !== companyId) return false;
      return true;
    });
  }

  public static addInvoice(inv: ExtractedInvoice): ExtractedInvoice {
    this.state.invoices.unshift(inv);
    this.commit();
    return inv;
  }

  // --- GST Reconciliation ---
  public static getGstReconciliation(companyId?: string): GstReconciliationItem[] {
    return this.state.gstReconciliation.filter(g => {
      if (companyId && g.companyId && g.companyId !== companyId) return false;
      return true;
    });
  }

  public static addGstReconciliationItems(items: GstReconciliationItem[]): void {
    this.state.gstReconciliation.unshift(...items);
    this.commit();
  }

  // --- Tasks ---
  public static getTasks(firmId: string, companyId?: string, clientId?: string): Task[] {
    return this.state.tasks.filter(t => {
      if (t.firmId !== firmId) return false;
      if (companyId && t.companyId && t.companyId !== companyId) return false;
      if (clientId && t.clientId && t.clientId !== clientId) return false;
      return true;
    });
  }

  public static addTask(task: Task): Task {
    this.state.tasks.unshift(task);
    this.commit();
    return task;
  }

  public static updateTask(id: string, firmId: string, updates: Partial<Task>): Task | undefined {
    const idx = this.state.tasks.findIndex(t => t.id === id && t.firmId === firmId);
    if (idx === -1) return undefined;
    this.state.tasks[idx] = { ...this.state.tasks[idx], ...updates };
    this.commit();
    return this.state.tasks[idx];
  }

  // --- Ledger Master Methods ---
  public static getLedgers(firmId?: string, companyId?: string): Ledger[] {
    return this.state.ledgers.filter(l => {
      if (firmId && l.firmId && l.firmId !== firmId) return false;
      if (companyId && l.companyId && l.companyId !== companyId) return false;
      return true;
    });
  }

  public static getLedgerById(id: string): Ledger | undefined {
    return this.state.ledgers.find(l => l.id === id);
  }

  public static addLedger(ledger: Ledger): Ledger {
    this.state.ledgers.push(ledger);
    this.commit();
    return ledger;
  }

  public static updateLedger(id: string, updates: Partial<Ledger>): Ledger | undefined {
    const idx = this.state.ledgers.findIndex(l => l.id === id);
    if (idx === -1) return undefined;
    this.state.ledgers[idx] = { ...this.state.ledgers[idx], ...updates };
    this.commit();
    return this.state.ledgers[idx];
  }

  public static deleteLedger(id: string): boolean {
    const idx = this.state.ledgers.findIndex(l => l.id === id);
    if (idx === -1) return false;
    this.state.ledgers.splice(idx, 1);
    this.commit();
    return true;
  }

  // --- Learned Ledger Mappings ---
  public static getLearnedMappings(firmId: string, companyId?: string): LearnedMapping[] {
    return (this.state.learnedMappings || []).filter(m => {
      if (m.firmId !== firmId) return false;
      if (companyId && m.companyId && m.companyId !== companyId) return false;
      return true;
    });
  }

  public static addLearnedMapping(mapping: LearnedMapping): LearnedMapping {
    if (!this.state.learnedMappings) this.state.learnedMappings = [];
    // Check if pattern already exists
    const existing = this.state.learnedMappings.find(
      m => m.firmId === mapping.firmId && m.pattern.toLowerCase() === mapping.pattern.toLowerCase()
    );
    if (existing) {
      existing.targetLedger = mapping.targetLedger;
      existing.category = mapping.category || existing.category;
      existing.confidence = Math.min(0.99, existing.confidence + 0.05);
      existing.timesApplied += 1;
      existing.updatedAt = new Date().toISOString();
      this.commit();
      return existing;
    }
    this.state.learnedMappings.unshift(mapping);
    this.commit();
    return mapping;
  }

  public static updateLearnedMapping(id: string, updates: Partial<LearnedMapping>): LearnedMapping | undefined {
    const idx = (this.state.learnedMappings || []).findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    this.state.learnedMappings[idx] = {
      ...this.state.learnedMappings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.commit();
    return this.state.learnedMappings[idx];
  }

  public static deleteLearnedMapping(id: string): boolean {
    const idx = (this.state.learnedMappings || []).findIndex(m => m.id === id);
    if (idx === -1) return false;
    this.state.learnedMappings.splice(idx, 1);
    this.commit();
    return true;
  }

  public static findLearnedMapping(firmId: string, narration: string): LearnedMapping | undefined {
    if (!narration || !this.state.learnedMappings) return undefined;
    const cleanNarration = narration.toLowerCase();
    for (const rule of this.state.learnedMappings) {
      if (rule.firmId === firmId && cleanNarration.includes(rule.pattern.toLowerCase())) {
        rule.timesApplied += 1;
        rule.updatedAt = new Date().toISOString();
        this.commit();
        return rule;
      }
    }
    return undefined;
  }

  // --- Tally Company Mappings ---
  public static getTallyMappings(firmId: string): TallyCompanyMapping[] {
    return (this.state.tallyCompanyMappings || []).filter(m => m.firmId === firmId);
  }

  public static addTallyMapping(mapping: TallyCompanyMapping): TallyCompanyMapping {
    if (!this.state.tallyCompanyMappings) this.state.tallyCompanyMappings = [];
    // Remove if company already mapped
    this.state.tallyCompanyMappings = this.state.tallyCompanyMappings.filter(
      m => !(m.firmId === mapping.firmId && m.taxflowCompanyId === mapping.taxflowCompanyId)
    );
    this.state.tallyCompanyMappings.push(mapping);
    this.commit();
    return mapping;
  }

  public static updateTallyMapping(id: string, updates: Partial<TallyCompanyMapping>): TallyCompanyMapping | undefined {
    const idx = (this.state.tallyCompanyMappings || []).findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    this.state.tallyCompanyMappings[idx] = {
      ...this.state.tallyCompanyMappings[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.commit();
    return this.state.tallyCompanyMappings[idx];
  }

  public static deleteTallyMapping(id: string): boolean {
    const idx = (this.state.tallyCompanyMappings || []).findIndex(m => m.id === id);
    if (idx === -1) return false;
    this.state.tallyCompanyMappings.splice(idx, 1);
    this.commit();
    return true;
  }

  // --- Tally Connection & Sync Logs ---
  public static updateTallyConnection(updates: Partial<TallyConnection>): TallyConnection {
    this.state.tallyConnection = { ...this.state.tallyConnection, ...updates };
    this.commit();
    return this.state.tallyConnection;
  }

  public static addTallySyncLog(log: TallySyncLog): TallySyncLog {
    if (!this.state.tallySyncLogs) this.state.tallySyncLogs = [];
    this.state.tallySyncLogs.unshift(log);
    this.commit();
    return log;
  }

  public static updateVoucher(id: string, updates: Partial<Voucher>): Voucher | undefined {
    const idx = this.state.vouchers.findIndex(v => v.id === id);
    if (idx === -1) return undefined;
    this.state.vouchers[idx] = { ...this.state.vouchers[idx], ...updates };
    this.commit();
    return this.state.vouchers[idx];
  }

  public static getVoucherById(id: string): Voucher | undefined {
    return this.state.vouchers.find(v => v.id === id);
  }
}
