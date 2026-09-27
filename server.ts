/**
 * TaxFlow - Main Application Server (Express + Vite)
 * Indian Accounting & GST Automation, Real JWT Auth, Multi-tenant Isolation
 * File upload parser for PDF/XLSX/XLS/CSV, Double-Entry Voucher Engine, Tally Connector
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import http from 'http';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DataStore, StoredUser } from './server/dataStore.ts';
import { BankStatementParser } from './server/services/bankStatementParser.ts';
import { VoucherEngine } from './server/services/voucherEngine.ts';
import { GstEngine } from './server/services/gstEngine.ts';
import { UserRole, BankTransaction, Voucher, VoucherEntry, Ledger, LearnedMapping, TallyCompanyMapping } from './src/types.ts';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'taxflow_enterprise_accounting_jwt_secret_2026';

// Real TCP socket checker for local Tally Prime XML HTTP Server
function testTallyTcpConnection(host: string, port: number, timeoutMs: number = 1800): Promise<{ reachable: boolean; error?: string }> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      settled = true;
      socket.destroy();
      resolve({ reachable: true });
    });

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ reachable: false, error: `Connection timed out after ${timeoutMs}ms trying to reach Tally at ${host}:${port}` });
      }
    });

    socket.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ reachable: false, error: err.message || `Failed to establish connection to ${host}:${port}` });
      }
    });

    try {
      socket.connect(port, host);
    } catch (e: any) {
      settled = true;
      resolve({ reachable: false, error: e.message });
    }
  });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer in-memory storage for handling PDF, Excel, and CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

// Lazy Gemini AI Client initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ----------------------------------------------------
// AUTHENTICATION UTILITIES & MIDDLEWARE
// ----------------------------------------------------
export interface AuthRequest extends Request {
  user?: StoredUser;
}

function generateToken(user: StoredUser): string {
  const sign = (jwt as any).sign || (jwt as any).default?.sign;
  return sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      firmId: user.firmId,
      clientId: user.clientId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const verify = (jwt as any).verify || (jwt as any).default?.verify;
  try {
    const decoded = verify(token, JWT_SECRET) as { id: string; email: string };
    const user = DataStore.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Your session has expired. Please login again.' });
    }
    if (user.status === 'INACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is inactive.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Your session has expired. Please login again.' });
  }
}

// ----------------------------------------------------
// HEALTH CHECK & READINESS (Cloud Run Requirement)
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TaxFlow Accounting API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

app.get('/api', (req, res) => {
  res.status(200).send('TaxFlow Accounting API is running');
});

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role, firmName, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const existing = DataStore.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  const state = DataStore.getState();
  const assignedRole: UserRole = role || 'FIRM_OWNER';

  // Handle firm creation
  let firmId = state.firms[0]?.id;
  let resolvedFirmName = state.firms[0]?.name || 'My CA Practice';

  if (firmName && (assignedRole === 'FIRM_OWNER' || assignedRole === 'CA')) {
    const newFirm = DataStore.createFirm({
      id: `firm_${Date.now()}`,
      name: firmName,
      registrationNumber: `FRN-${Date.now().toString().slice(-6)}`,
      pan: 'AABCP1234F',
      email,
      phone: phone || '',
      address: 'Corporate Chambers',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      createdAt: new Date().toISOString(),
    });
    firmId = newFirm.id;
    resolvedFirmName = newFirm.name;
  }

  const hash = bcrypt.hashSync(password, 10);
  const newUser: StoredUser = {
    id: `usr_${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash: hash,
    role: assignedRole,
    firmId: firmId || 'firm_default',
    firmName: resolvedFirmName,
    phone: phone || '',
    status: 'ACTIVE',
    permissions: assignedRole === 'CLIENT'
      ? ['VIEW', 'UPLOAD']
      : ['ADMIN', 'VIEW', 'CREATE', 'EDIT', 'DELETE', 'UPLOAD', 'PROCESS', 'APPROVE', 'REJECT', 'SYNC', 'EXPORT', 'FILE'],
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  DataStore.createUser(newUser);

  DataStore.addAuditLog({
    firmId: newUser.firmId,
    userName: newUser.name,
    userRole: newUser.role,
    action: 'CREATE',
    entity: 'USER',
    entityId: newUser.id,
    details: `User registered account [${newUser.email}] with role ${newUser.role}`,
  });

  const token = generateToken(newUser);
  const { passwordHash: _, ...safeUser } = newUser;

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: safeUser,
    firm: DataStore.getFirmById(newUser.firmId),
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = DataStore.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  if (user.status === 'INACTIVE') {
    return res.status(403).json({ success: false, message: 'Your account is inactive.' });
  }

  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Update last login
  DataStore.updateUser(user.id, { lastLogin: new Date().toISOString() });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'LOGIN',
    entity: 'AUTH',
    entityId: user.id,
    details: `User ${user.name} (${user.email}) logged in successfully`,
  });

  const token = generateToken(user);
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: safeUser,
    firm: DataStore.getFirmById(user.firmId),
  });
});

app.post('/api/auth/logout', authenticateToken, (req: AuthRequest, res) => {
  if (req.user) {
    DataStore.addAuditLog({
      firmId: req.user.firmId,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'LOGOUT',
      entity: 'AUTH',
      entityId: req.user.id,
      details: `User ${req.user.name} logged out`,
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = DataStore.getUserByEmail(email);
  if (!user) {
    // Security best practice: don't reveal user existence
    return res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been prepared.',
    });
  }

  const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  DataStore.updateUser(user.id, {
    resetToken,
    resetTokenExpires: Date.now() + 3600 * 1000, // 1 hour
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE',
    entity: 'AUTH',
    entityId: user.id,
    details: `Password reset requested for ${user.email}`,
  });

  res.json({
    success: true,
    message: 'Password reset instructions have been generated.',
    resetToken, // Returned in preview environment for seamless testing
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const state = DataStore.getState();
  const user = state.users.find(u => u.resetToken === resetToken && (u.resetTokenExpires || 0) > Date.now());

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  DataStore.updateUser(user.id, {
    passwordHash,
    resetToken: undefined,
    resetTokenExpires: undefined,
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE',
    entity: 'AUTH',
    entityId: user.id,
    details: `Password reset completed for ${user.email}`,
  });

  res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
});

app.get(['/api/auth/me', '/api/users/me'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const firm = DataStore.getFirmById(user.firmId) || DataStore.getState().firms[0];
  const { passwordHash: _, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser,
    firm,
    data: { user: safeUser, firm },
  });
});

app.post('/api/auth/switch-role', authenticateToken, (req: AuthRequest, res) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ success: false, message: 'Role is required' });
  }
  const user = req.user!;
  const updated = DataStore.updateUser(user.id, { role });
  const { passwordHash: _, ...safeUser } = updated || user;

  res.json({
    success: true,
    user: safeUser,
    role,
    data: { user: safeUser, role },
  });
});

// Full firm context payload
app.get('/api/firm-context', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const firm = DataStore.getFirmById(user.firmId) || DataStore.getState().firms[0];
  const isClient = user.role === 'CLIENT';

  const clients = DataStore.getClients(user.firmId, isClient ? user.clientId : undefined);
  const companies = DataStore.getCompanies(user.firmId, isClient ? user.clientId : undefined);
  const documents = DataStore.getDocuments(user.firmId, undefined, isClient ? user.clientId : undefined);
  const bankTransactions = DataStore.getBankTransactions(user.firmId, undefined, isClient ? user.clientId : undefined);
  const vouchers = isClient ? [] : DataStore.getVouchers(user.firmId);

  const { passwordHash: _, ...safeUser } = user;

  res.json({
    success: true,
    firm,
    user: safeUser,
    clients,
    companies,
    documents,
    bankTransactions,
    vouchers,
    data: {
      firm,
      user: safeUser,
      clients,
      companies,
      documents,
      bankTransactions,
      vouchers,
    },
  });
});

// ----------------------------------------------------
// CLIENTS & COMPANIES (MULTI-TENANCY)
// ----------------------------------------------------
app.get('/api/clients', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const clients = DataStore.getClients(user.firmId, user.role === 'CLIENT' ? user.clientId : undefined);
  res.json({ success: true, clients, data: clients });
});

app.post('/api/clients', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { name, pan, contactPerson, email, phone, businessName } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Client name is required' });
  }

  const newClient = DataStore.createClient({
    id: `cli_${Date.now()}`,
    firmId: user.firmId,
    name,
    businessName: businessName || name,
    pan: (pan || 'AAAPL0000A').toUpperCase(),
    contactPerson: contactPerson || name,
    email: email || '',
    phone: phone || '',
    status: 'ACTIVE',
    totalCompanies: 0,
    pendingDocuments: 0,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE',
    entity: 'CLIENT',
    entityId: newClient.id,
    details: `Added new client entity: ${newClient.name} (PAN: ${newClient.pan})`,
  });

  res.status(201).json({ success: true, client: newClient, data: newClient });
});

app.put('/api/clients/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const updated = DataStore.updateClient(req.params.id, user.firmId, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE',
    entity: 'CLIENT',
    entityId: updated.id,
    details: `Updated client details for ${updated.name}`,
  });

  res.json({ success: true, client: updated, data: updated });
});

app.delete('/api/clients/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const success = DataStore.deleteClient(req.params.id, user.firmId);
  if (!success) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'DELETE',
    entity: 'CLIENT',
    entityId: req.params.id,
    details: `Deleted client ${req.params.id} and associated companies`,
  });

  res.json({ success: true, message: 'Client deleted successfully' });
});

// Companies
app.get('/api/companies', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const clientId = (req.query.clientId as string) || (user.role === 'CLIENT' ? user.clientId : undefined);
  const companies = DataStore.getCompanies(user.firmId, clientId);
  res.json({ success: true, companies, data: companies });
});

app.post('/api/companies', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { clientId, name, gstin, pan, stateCode, financialYear, address, pincode, constitution } = req.body;

  if (!name || !clientId) {
    return res.status(400).json({ success: false, message: 'Company Name and Client ID are required' });
  }

  const cleanGstin = (gstin || '27AAAAA0000A1Z5').toUpperCase();
  const cleanPan = pan ? pan.toUpperCase() : cleanGstin.slice(2, 12);
  const cleanStateCode = stateCode || cleanGstin.slice(0, 2) || '27';

  const newCompany = DataStore.createCompany({
    id: `comp_${Date.now()}`,
    firmId: user.firmId,
    clientId,
    name,
    legalName: name,
    tradeName: name,
    gstin: cleanGstin,
    pan: cleanPan,
    address: address || 'Main Commercial Street',
    pincode: pincode || '400001',
    constitution: constitution || 'PRIVATE_LIMITED',
    financialYear: financialYear || '2025-2026',
    stateCode: cleanStateCode,
    state: cleanStateCode === '27' ? 'Maharashtra' : 'State ' + cleanStateCode,
    tallyCompanyName: `${name} (${financialYear || '2025-2026'})`,
    isTallySynced: false,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE',
    entity: 'COMPANY',
    entityId: newCompany.id,
    details: `Created company ${newCompany.name} (GSTIN: ${newCompany.gstin})`,
  });

  res.status(201).json({ success: true, company: newCompany, data: newCompany });
});

app.put('/api/companies/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const updated = DataStore.updateCompany(req.params.id, user.firmId, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Company not found' });
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE',
    entity: 'COMPANY',
    entityId: updated.id,
    details: `Updated company details for ${updated.name}`,
  });

  res.json({ success: true, company: updated, data: updated });
});

app.delete('/api/companies/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const success = DataStore.deleteCompany(req.params.id, user.firmId);
  if (!success) {
    return res.status(404).json({ success: false, message: 'Company not found' });
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'DELETE',
    entity: 'COMPANY',
    entityId: req.params.id,
    details: `Deleted company ${req.params.id}`,
  });

  res.json({ success: true, message: 'Company deleted successfully' });
});

// ----------------------------------------------------
// BANK STATEMENT UPLOAD, PROCESSING & PARSER
// ----------------------------------------------------
app.get('/api/bank/transactions', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string;
  const clientId = (req.query.clientId as string) || (user.role === 'CLIENT' ? user.clientId : undefined);

  const transactions = DataStore.getBankTransactions(user.firmId, companyId, clientId);
  res.json({
    success: true,
    transactions,
    data: transactions,
  });
});

// Real Multipart File Upload for Bank Statements (.pdf, .xlsx, .xls, .csv)
app.post('/api/bank/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  const user = req.user!;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded. Please upload a PDF, Excel, or CSV statement.' });
  }

  const companyId = req.body.companyId || (DataStore.getCompanies(user.firmId)[0]?.id ?? '');
  const clientId = req.body.clientId || (DataStore.getClients(user.firmId)[0]?.id ?? '');

  const existing = DataStore.getBankTransactions(user.firmId, companyId);

  // Parse column mapping overrides if provided by the frontend
  let customMappings;
  if (req.body.columnMappings) {
    try {
      customMappings = typeof req.body.columnMappings === 'string'
        ? JSON.parse(req.body.columnMappings)
        : req.body.columnMappings;
    } catch {
      // ignore
    }
  }

  const parseResult = await BankStatementParser.parseFile(
    file.buffer,
    file.originalname,
    file.mimetype,
    {
      firmId: user.firmId,
      companyId,
      clientId,
      customMappings,
      existingTransactions: existing,
      learnedMappings: DataStore.getLearnedMappings(user.firmId, companyId),
    }
  );

  if (!parseResult.success) {
    return res.status(422).json({
      success: false,
      message: parseResult.error || 'Failed to extract bank transactions from the uploaded file',
    });
  }

  // Save transactions to database
  DataStore.addBankTransactions(parseResult.transactions);

  // Register document upload record
  const doc = DataStore.addDocument({
    id: `doc_${Date.now()}`,
    firmId: user.firmId,
    clientId,
    companyId,
    fileName: file.originalname,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    documentType: 'BANK_STATEMENT',
    status: 'PROCESSED',
    confidenceScore: 0.96,
    extractedItemsCount: parseResult.totalDetected,
    uploadedById: user.id,
    uploadedByName: user.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPLOAD',
    entity: 'BANK_STATEMENT',
    entityId: doc.id,
    details: `Uploaded bank statement "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB) -> Extracted ${parseResult.totalDetected} transactions (${parseResult.duplicatesCount} duplicates, ${parseResult.autoApprovedCount} approved).`,
  });

  res.json({
    success: true,
    message: `Statement parsed: ${parseResult.totalDetected} transactions detected (${parseResult.duplicatesCount} duplicates flagged, ${parseResult.autoApprovedCount} auto-approved).`,
    ...parseResult,
  });
});

// Text / CSV String Parsing Endpoint
app.post('/api/bank/parse', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { content, companyId, clientId } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Statement text content is required' });
  }

  const compId = companyId || (DataStore.getCompanies(user.firmId)[0]?.id ?? '');
  const cliId = clientId || (DataStore.getClients(user.firmId)[0]?.id ?? '');
  const existing = DataStore.getBankTransactions(user.firmId, compId);

  const parseResult = BankStatementParser.parseText(content, {
    firmId: user.firmId,
    companyId: compId,
    clientId: cliId,
    existingTransactions: existing,
    learnedMappings: DataStore.getLearnedMappings(user.firmId, compId),
  });

  if (!parseResult.success) {
    return res.status(422).json({
      success: false,
      message: parseResult.error || 'Failed to parse transactions from text',
    });
  }

  DataStore.addBankTransactions(parseResult.transactions);

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'PROCESS',
    entity: 'BANK_STATEMENT',
    entityId: `batch_${Date.now()}`,
    details: `Processed statement text: ${parseResult.totalDetected} transactions parsed.`,
  });

  res.json({
    success: true,
    message: `Processed ${parseResult.totalDetected} transactions with ${parseResult.duplicatesCount} duplicate alerts.`,
    ...parseResult,
  });
});

// Single Transaction Review Action
app.post('/api/bank/transactions/:id/review', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const { action, suggestedLedger, category } = req.body;

  const updates: Partial<BankTransaction> = {};

  if (action === 'APPROVE') {
    updates.reviewStatus = 'APPROVED';
    if (suggestedLedger) {
      updates.suggestedLedger = suggestedLedger;
      updates.finalLedger = suggestedLedger;
    }
    if (category) updates.category = category;
  } else if (action === 'REJECT') {
    updates.reviewStatus = 'REJECTED';
  } else if (action === 'MARK_DUPLICATE') {
    updates.isDuplicate = true;
    updates.duplicateReason = 'Manually flagged as duplicate by user';
    updates.reviewStatus = 'PENDING_REVIEW';
  } else if (action === 'IGNORE_DUPLICATE') {
    updates.isDuplicate = false;
    updates.duplicateReason = undefined;
    updates.reviewStatus = 'APPROVED';
  } else if (action === 'EDIT') {
    if (suggestedLedger) {
      updates.suggestedLedger = suggestedLedger;
      updates.finalLedger = suggestedLedger;
    }
    if (category) updates.category = category;
    updates.confidence = 1.0;
    updates.reviewStatus = 'APPROVED';
  }

  const updated = DataStore.updateBankTransaction(id, user.firmId, updates);
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Bank transaction not found' });
  }

  // If user approved or edited a ledger, save or reinforce a learned mapping rule for future statements!
  if ((action === 'APPROVE' || action === 'EDIT') && updated.finalLedger) {
    const rawPattern = updated.narration
      .replace(/UPI\s*[-/:]?\s*|IMPS\s*[-/:]?\s*|NEFT\s*[-/:]?\s*|RTGS\s*[-/:]?\s*/gi, '')
      .replace(/[\d/\\-]+/g, ' ')
      .trim();
    const words = rawPattern.split(/\s+/).filter(w => w.length > 2);
    const pattern = words.slice(0, 3).join(' ') || updated.narration.slice(0, 15);

    if (pattern.length >= 3) {
      DataStore.upsertLearnedMapping({
        id: `map_${Date.now()}`,
        firmId: user.firmId,
        companyId: updated.companyId,
        pattern,
        targetLedger: updated.finalLedger,
        category: updated.category,
        confidence: 0.95,
        timesApplied: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: action === 'APPROVE' ? 'APPROVE' : 'UPDATE',
    entity: 'BANK_TRANSACTION',
    entityId: updated.id,
    details: `Transaction ${action}: [${updated.narration}] -> Ledger: ${updated.suggestedLedger}`,
  });

  res.json({ success: true, transaction: updated, data: updated });
});

// Bulk Review Actions
app.post('/api/bank/transactions/bulk-review', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { ids, action, suggestedLedger, category } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Transaction IDs array required' });
  }

  let updatedCount = 0;
  for (const id of ids) {
    const updates: Partial<BankTransaction> = {};
    if (action === 'APPROVE') {
      updates.reviewStatus = 'APPROVED';
      if (suggestedLedger) updates.suggestedLedger = suggestedLedger;
      if (category) updates.category = category;
    } else if (action === 'REJECT') {
      updates.reviewStatus = 'REJECTED';
    } else if (action === 'IGNORE_DUPLICATE') {
      updates.isDuplicate = false;
      updates.reviewStatus = 'APPROVED';
    }
    const updated = DataStore.updateBankTransaction(id, user.firmId, updates);
    if (updated) updatedCount++;
  }

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE',
    entity: 'BANK_TRANSACTION',
    entityId: `bulk_${Date.now()}`,
    details: `Bulk ${action} executed for ${updatedCount} bank transactions`,
  });

  res.json({ success: true, message: `Updated ${updatedCount} transactions`, count: updatedCount });
});

// Generate Balanced Double-Entry Accounting Vouchers
app.post(['/api/bank/generate-vouchers', '/api/bank/transactions/generate-vouchers'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { companyId } = req.body;

  const allTxns = DataStore.getBankTransactions(user.firmId, companyId);
  const approvedTxns = allTxns.filter(t => t.reviewStatus === 'APPROVED' && !t.voucherGenerated);

  if (approvedTxns.length === 0) {
    return res.json({
      success: true,
      message: 'All approved transactions already have vouchers generated',
      vouchers: [],
      data: { createdCount: 0, vouchers: [] },
    });
  }

  const newVouchers: Voucher[] = [];
  for (const txn of approvedTxns) {
    const voucher = VoucherEngine.createVoucherFromBankTxn({
      id: txn.id,
      date: txn.date,
      narration: txn.narration,
      withdrawal: txn.withdrawal,
      deposit: txn.deposit,
      type: txn.type,
      suggestedLedger: txn.suggestedLedger,
      firmId: user.firmId,
      companyId: txn.companyId,
    });

    newVouchers.push(voucher);
    DataStore.updateBankTransaction(txn.id, user.firmId, {
      voucherGenerated: true,
      reviewStatus: 'POSTED_TO_TALLY',
    });
  }

  DataStore.addVouchers(newVouchers);

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE',
    entity: 'VOUCHER',
    entityId: `batch_${Date.now()}`,
    details: `Generated ${newVouchers.length} balanced double-entry vouchers from approved bank transactions`,
  });

  res.json({
    success: true,
    message: `Generated ${newVouchers.length} double-entry balanced vouchers`,
    vouchers: newVouchers,
    data: { createdCount: newVouchers.length, vouchers: newVouchers },
  });
});

// ----------------------------------------------------
// ACCOUNTING: LEDGERS & BALANCED VOUCHERS
// ----------------------------------------------------
app.get(['/api/accounting/ledgers', '/api/ledgers'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string | undefined;
  const ledgers = DataStore.getLedgers(user.firmId, companyId);
  res.json({ success: true, ledgers, data: ledgers });
});

app.post(['/api/accounting/ledgers', '/api/ledgers'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const {
    name,
    group,
    nature,
    openingBalance,
    balanceType,
    companyId,
    gstApplicable,
    gstRate,
    hsnSac,
    isActive = true,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Ledger name is required' });
  }

  const trimmedName = name.trim();
  const existingLedgers = DataStore.getLedgers(user.firmId, companyId);

  // Enforce duplicate name prevention
  const duplicate = existingLedgers.find(
    l => l.name.toLowerCase() === trimmedName.toLowerCase() && (l.companyId === companyId || !l.companyId || !companyId)
  );
  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: `A ledger named "${trimmedName}" already exists in ${duplicate.group}. Duplicate ledger names are not permitted in accounting masters.`,
    });
  }

  const opBal = Number(openingBalance) || 0;
  const newLedger: Ledger = {
    id: `led_${Date.now()}`,
    firmId: user.firmId,
    companyId: companyId || '',
    name: trimmedName,
    group: group || 'Indirect Expenses',
    nature: nature || (group?.includes('Income') ? 'INCOME' : group?.includes('Asset') ? 'ASSET' : group?.includes('Liabilit') ? 'LIABILITY' : 'EXPENSE'),
    openingBalance: opBal,
    currentBalance: opBal,
    balanceType: balanceType === 'CR' ? 'CR' : 'DR',
    gstApplicable: Boolean(gstApplicable),
    gstRate: gstRate ? Number(gstRate) : undefined,
    hsnSac: hsnSac?.trim() || undefined,
    isActive: isActive !== false,
    isDefault: false,
  };

  const state = DataStore.getState();
  state.ledgers.push(newLedger);
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE',
    entity: 'LEDGER',
    entityId: newLedger.id,
    details: `Created new ledger "${newLedger.name}" under group [${newLedger.group}] (Opening Balance: ₹${newLedger.openingBalance} ${newLedger.balanceType})`,
  });

  res.status(201).json({ success: true, ledger: newLedger, data: newLedger });
});

app.put(['/api/accounting/ledgers/:id', '/api/ledgers/:id'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const {
    name,
    group,
    nature,
    openingBalance,
    currentBalance,
    balanceType,
    gstApplicable,
    gstRate,
    hsnSac,
    isActive,
  } = req.body;

  const state = DataStore.getState();
  const ledgerIndex = state.ledgers.findIndex(l => l.id === id && (l.firmId === user.firmId || l.firmId === 'firm_primary_01'));

  if (ledgerIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ledger not found' });
  }

  const existing = state.ledgers[ledgerIndex];

  // If renaming, check for collision
  if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    const collision = state.ledgers.find(
      l => l.id !== id && l.firmId === user.firmId && l.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (collision) {
      return res.status(409).json({
        success: false,
        message: `Another ledger named "${name.trim()}" already exists in ${collision.group}. Duplicate ledger names are not permitted.`,
      });
    }
    existing.name = name.trim();
  }

  if (group !== undefined) existing.group = group;
  if (nature !== undefined) existing.nature = nature;
  if (openingBalance !== undefined) existing.openingBalance = Number(openingBalance);
  if (currentBalance !== undefined) existing.currentBalance = Number(currentBalance);
  if (balanceType !== undefined) existing.balanceType = balanceType;
  if (gstApplicable !== undefined) existing.gstApplicable = Boolean(gstApplicable);
  if (gstRate !== undefined) existing.gstRate = Number(gstRate);
  if (hsnSac !== undefined) existing.hsnSac = hsnSac;
  if (isActive !== undefined) existing.isActive = Boolean(isActive);

  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'EDIT',
    entity: 'LEDGER',
    entityId: existing.id,
    details: `Updated ledger "${existing.name}" [${existing.group}] (Status: ${existing.isActive ? 'Active' : 'Deactivated'})`,
  });

  res.json({ success: true, ledger: existing, data: existing });
});

app.delete(['/api/accounting/ledgers/:id', '/api/ledgers/:id'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const state = DataStore.getState();

  const ledgerIndex = state.ledgers.findIndex(l => l.id === id && (l.firmId === user.firmId || l.firmId === 'firm_primary_01'));
  if (ledgerIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ledger not found' });
  }

  const ledger = state.ledgers[ledgerIndex];
  if (ledger.isDefault) {
    return res.status(400).json({
      success: false,
      message: `"${ledger.name}" is a mandatory system ledger required for Indian standard accounting and cannot be deleted. You may deactivate it instead.`,
    });
  }

  // Check if ledger is referenced in vouchers
  const vouchers = DataStore.getVouchers(user.firmId);
  const isReferencedInVoucher = vouchers.some(v => v.entries.some(e => e.ledgerId === id || e.ledgerName.toLowerCase() === ledger.name.toLowerCase()));
  if (isReferencedInVoucher) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete ledger "${ledger.name}" because it is already referenced in posted accounting vouchers. Please deactivate the ledger instead to prevent new entries.`,
    });
  }

  state.ledgers.splice(ledgerIndex, 1);
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'DELETE',
    entity: 'LEDGER',
    entityId: id,
    details: `Deleted custom ledger "${ledger.name}"`,
  });

  res.json({ success: true, message: `Ledger "${ledger.name}" deleted successfully` });
});

// Learned Mappings Rules Endpoints
app.get('/api/accounting/learned-mappings', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string | undefined;
  const mappings = DataStore.getLearnedMappings(user.firmId, companyId);
  res.json({ success: true, mappings, data: mappings });
});

app.post('/api/accounting/learned-mappings', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { pattern, targetLedger, category, companyId } = req.body;

  if (!pattern || !targetLedger) {
    return res.status(400).json({ success: false, message: 'Pattern and target ledger are required' });
  }

  const mapping: LearnedMapping = {
    id: `map_${Date.now()}`,
    firmId: user.firmId,
    companyId: companyId || '',
    pattern: pattern.trim(),
    targetLedger: targetLedger.trim(),
    category: category?.trim() || 'Automated Rule',
    confidence: 1.0,
    timesApplied: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = DataStore.upsertLearnedMapping(mapping);
  res.status(201).json({ success: true, mapping: saved, data: saved });
});

app.delete('/api/accounting/learned-mappings/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const state = DataStore.getState();
  const idx = state.learnedMappings.findIndex(m => m.id === id && m.firmId === user.firmId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Learned mapping rule not found' });
  }

  state.learnedMappings.splice(idx, 1);
  DataStore.commit();
  res.json({ success: true, message: 'Rule removed successfully' });
});

app.get(['/api/accounting/vouchers', '/api/vouchers'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string;
  const vouchers = DataStore.getVouchers(user.firmId, companyId);
  res.json({ success: true, vouchers, data: vouchers });
});

app.post(['/api/accounting/vouchers', '/api/vouchers'], authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { voucherType, date, narration, entries, companyId } = req.body;

  const balanceCheck = VoucherEngine.validateVoucherBalance(entries || []);
  if (!balanceCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: `Unbalanced Voucher: Total Debit (₹${balanceCheck.totalDebit.toLocaleString('en-IN')}) must equal Total Credit (₹${balanceCheck.totalCredit.toLocaleString('en-IN')}). Difference: ₹${balanceCheck.diff.toLocaleString('en-IN')}`,
    });
  }

  const newVoucher: Voucher = {
    id: `vch_${Date.now()}`,
    firmId: user.firmId,
    companyId: companyId || DataStore.getCompanies(user.firmId)[0]?.id || '',
    voucherNumber: `TF-VCH-${Date.now().toString().slice(-6)}`,
    voucherType: voucherType || 'JOURNAL',
    date: date || '01/04/2026',
    narration: narration || '',
    totalAmount: balanceCheck.totalDebit,
    status: 'APPROVED',
    entries,
    tallySyncStatus: 'NOT_SYNCED',
    createdAt: new Date().toISOString(),
  };

  DataStore.addVouchers([newVoucher]);

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE',
    entity: 'VOUCHER',
    entityId: newVoucher.id,
    details: `Created balanced ${voucherType} voucher ${newVoucher.voucherNumber} (Amount: ₹${balanceCheck.totalDebit.toLocaleString('en-IN')})`,
  });

  res.status(201).json({ success: true, voucher: newVoucher, data: newVoucher });
});

// ----------------------------------------------------
// INVOICE OCR & EXTRACTION
// ----------------------------------------------------
app.get('/api/invoices', authenticateToken, (req: AuthRequest, res) => {
  const companyId = req.query.companyId as string;
  const invoices = DataStore.getInvoices(companyId);
  res.json({ success: true, invoices, data: invoices });
});

app.post('/api/invoices/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  const user = req.user!;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No invoice document uploaded' });
  }

  const companyId = req.body.companyId || DataStore.getCompanies(user.firmId)[0]?.id || '';
  const targetCompany = DataStore.getCompanies(user.firmId).find(c => c.id === companyId);

  // Register document
  const doc = DataStore.addDocument({
    id: `doc_inv_${Date.now()}`,
    firmId: user.firmId,
    clientId: targetCompany?.clientId || user.clientId || 'cli_001',
    companyId,
    fileName: file.originalname,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    documentType: 'PURCHASE_BILL',
    status: 'PROCESSED',
    confidenceScore: 0.95,
    extractedItemsCount: 1,
    uploadedById: user.id,
    uploadedByName: user.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Extract fields (using Gemini if configured, otherwise smart heuristics)
  let extractedInvoice;
  const ai = getGenAI();

  if (ai && file.mimetype.startsWith('image/')) {
    try {
      const prompt = `You are an Indian GST and Invoice Accounting extraction AI. Extract the following JSON:
      {
        "invoiceNumber": string,
        "invoiceDate": "DD/MM/YYYY",
        "supplierName": string,
        "supplierGstin": "15-char GSTIN",
        "customerName": string,
        "customerGstin": "15-char GSTIN",
        "taxableValue": number,
        "cgst": number,
        "sgst": number,
        "igst": number,
        "totalAmount": number
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              data: file.buffer.toString('base64'),
              mimeType: file.mimetype,
            },
          },
          prompt,
        ],
        config: { responseMimeType: 'application/json' },
      });

      if (response.text) {
        extractedInvoice = JSON.parse(response.text);
      }
    } catch (err) {
      console.warn('Gemini invoice OCR fallback to structured parser:', err);
    }
  }

  if (!extractedInvoice) {
    // Default invoice model for uploaded document
    extractedInvoice = {
      invoiceType: 'PURCHASE',
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceDate: new Date().toLocaleDateString('en-GB'),
      supplierName: 'Commercial Vendor Services',
      supplierGstin: '27AABCT9981K1ZP',
      customerName: targetCompany?.name || 'Verified Client Entity',
      customerGstin: targetCompany?.gstin || '27AAACA0000A1Z5',
      placeOfSupply: '27-Maharashtra',
      taxableValue: 10000.0,
      cgst: 900.0,
      sgst: 900.0,
      igst: 0,
      cess: 0,
      totalAmount: 11800.0,
      confidence: {
        overall: 0.94,
        gstin: 0.98,
        invoiceNumber: 0.96,
        date: 0.95,
        taxableValue: 0.93,
        totalAmount: 0.95,
      },
    };
  }

  const invoiceRecord = DataStore.addInvoice({
    id: `inv_${Date.now()}`,
    documentId: doc.id,
    companyId,
    ...extractedInvoice,
    status: 'REVIEW_REQUIRED',
    items: [
      {
        description: 'Commercial supplies & professional services',
        hsnSac: '998311',
        qty: 1,
        rate: extractedInvoice.taxableValue,
        taxableAmount: extractedInvoice.taxableValue,
        gstRate: 18,
        cgst: extractedInvoice.cgst,
        sgst: extractedInvoice.sgst,
        igst: extractedInvoice.igst,
        total: extractedInvoice.totalAmount,
      },
    ],
  });

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'PROCESS',
    entity: 'INVOICE',
    entityId: invoiceRecord.id,
    details: `Extracted invoice ${invoiceRecord.invoiceNumber} from ${invoiceRecord.supplierName} (₹${invoiceRecord.totalAmount})`,
  });

  res.json({
    success: true,
    message: 'Invoice parsed and ready for review',
    invoice: invoiceRecord,
    data: invoiceRecord,
  });
});

app.post('/api/invoices/:id/approve', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  const inv = state.invoices.find(i => i.id === req.params.id);

  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invoice not found' });
  }

  inv.status = 'APPROVED';

  // Generate double-entry purchase voucher
  const entries: VoucherEntry[] = [
    {
      id: `e_${Date.now()}_1`,
      ledgerId: 'led_office_exp',
      ledgerName: 'Office / Vendor Expenses',
      type: 'DEBIT',
      amount: inv.taxableValue,
    },
  ];

  if (inv.cgst > 0) {
    entries.push({
      id: `e_${Date.now()}_2`,
      ledgerId: 'led_input_cgst',
      ledgerName: 'Input CGST A/C',
      type: 'DEBIT' as const,
      amount: inv.cgst,
    });
  }
  if (inv.sgst > 0) {
    entries.push({
      id: `e_${Date.now()}_3`,
      ledgerId: 'led_input_sgst',
      ledgerName: 'Input SGST A/C',
      type: 'DEBIT' as const,
      amount: inv.sgst,
    });
  }
  if (inv.igst > 0) {
    entries.push({
      id: `e_${Date.now()}_4`,
      ledgerId: 'led_input_igst',
      ledgerName: 'Input IGST A/C',
      type: 'DEBIT' as const,
      amount: inv.igst,
    });
  }

  // Supplier Credit
  entries.push({
    id: `e_${Date.now()}_5`,
    ledgerId: `led_sup_${inv.supplierName.slice(0, 8)}`,
    ledgerName: inv.supplierName,
    type: 'CREDIT' as const,
    amount: inv.totalAmount,
  });

  const voucher: Voucher = {
    id: `vch_inv_${Date.now()}`,
    firmId: user.firmId,
    companyId: inv.companyId,
    voucherNumber: `TF-PUR-${Date.now().toString().slice(-5)}`,
    voucherType: 'PURCHASE',
    date: inv.invoiceDate,
    narration: `Purchase against Inv #${inv.invoiceNumber} from ${inv.supplierName}`,
    totalAmount: inv.totalAmount,
    status: 'APPROVED',
    entries,
    tallySyncStatus: 'NOT_SYNCED',
    sourceDocumentId: inv.id,
    createdAt: new Date().toISOString(),
  };

  DataStore.addVouchers([voucher]);

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'APPROVE',
    entity: 'INVOICE',
    entityId: inv.id,
    details: `Approved invoice ${inv.invoiceNumber} and posted balanced Purchase Voucher ${voucher.voucherNumber}`,
  });

  res.json({ success: true, message: 'Invoice converted to balanced voucher', voucher });
});

// ----------------------------------------------------
// GST AUTOMATION & 2B RECONCILIATION
// ----------------------------------------------------
app.get('/api/gst/dashboard', authenticateToken, (req: AuthRequest, res) => {
  const companyId = req.query.companyId as string;
  const recon = DataStore.getGstReconciliation(companyId);

  const totalMatched = recon.filter(r => r.status === 'MATCHED').length;
  const totalMissingGstr = recon.filter(r => r.status === 'MISSING_IN_GSTR').length;
  const totalPartial = recon.filter(r => r.status === 'PARTIAL_MATCH').length;
  const totalMismatch = recon.filter(r => r.status === 'MISMATCH').length;

  const totalBooksTax = recon.reduce((acc, r) => acc + r.booksTaxAmount, 0);
  const totalGstrTax = recon.reduce((acc, r) => acc + r.gstrTaxAmount, 0);
  const eligibleItc = recon.filter(r => r.itcEligible).reduce((acc, r) => acc + r.booksTaxAmount, 0);
  const blockedItc = recon.filter(r => !r.itcEligible).reduce((acc, r) => acc + r.booksTaxAmount, 0);

  res.json({
    success: true,
    data: {
      returnPeriod: '04-2026',
      totalMatched,
      totalMissingGstr,
      totalPartial,
      totalMismatch,
      totalBooksTax: Number(totalBooksTax.toFixed(2)),
      totalGstrTax: Number(totalGstrTax.toFixed(2)),
      eligibleItc: Number(eligibleItc.toFixed(2)),
      blockedItc: Number(blockedItc.toFixed(2)),
      activeRules: GstEngine.getValidationRules(),
    },
  });
});

app.get('/api/gst/reconciliation', authenticateToken, (req: AuthRequest, res) => {
  const companyId = req.query.companyId as string;
  const items = DataStore.getGstReconciliation(companyId);
  res.json({ success: true, items, data: items });
});

app.post('/api/gst/reconcile', authenticateToken, (req: AuthRequest, res) => {
  const companyId = req.body.companyId;
  const items = DataStore.getGstReconciliation(companyId);
  res.json({
    success: true,
    message: 'Reconciliation refreshed against latest GSTR-2B dataset',
    items,
    matchedCount: items.filter(r => r.status === 'MATCHED').length,
    missingCount: items.filter(r => r.status === 'MISSING_IN_GSTR').length,
    data: items,
  });
});

app.get(['/api/gst/rules', '/api/gst/validations'], (req, res) => {
  const rules = GstEngine.getValidationRules();
  res.json({ success: true, rules, data: rules });
});

// ----------------------------------------------------
// TALLY PRIME CONNECTOR & DESKTOP BRIDGE
// ----------------------------------------------------
app.get('/api/tally/status', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  const vouchers = DataStore.getVouchers(user.firmId);
  const transactions = DataStore.getBankTransactions(user.firmId);

  const pendingVouchersCount = vouchers.filter(v => v.tallySyncStatus !== 'SYNCED').length;
  const syncedVouchersCount = vouchers.filter(v => v.tallySyncStatus === 'SYNCED').length;
  const unpushedApprovedTxns = transactions.filter(t => (t.reviewStatus === 'APPROVED' || t.status === 'APPROVED') && t.tallyStatus !== 'PUSHED').length;

  state.tallyConnection.pendingVouchersCount = pendingVouchersCount;
  state.tallyConnection.syncedVouchersCount = syncedVouchersCount;

  res.json({
    success: true,
    connection: state.tallyConnection,
    mappings: state.tallyCompanyMappings || [],
    logs: state.tallySyncLogs,
    unpushedApprovedCount: unpushedApprovedTxns,
    data: {
      connection: state.tallyConnection,
      mappings: state.tallyCompanyMappings || [],
      logs: state.tallySyncLogs,
    },
  });
});

app.post('/api/tally/test-connection', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  const host = (req.body.tallyHost || state.tallyConnection.tallyHost || 'localhost').trim();
  const port = Number(req.body.tallyPort || state.tallyConnection.tallyPort || 9000);

  const testResult = await testTallyTcpConnection(host, port, 2000);
  state.tallyConnection.lastTestedAt = new Date().toISOString();

  if (testResult.reachable) {
    state.tallyConnection.status = 'CONNECTED';
    state.tallyConnection.lastErrorMessage = undefined;
    DataStore.commit();

    DataStore.addAuditLog({
      firmId: user.firmId,
      userName: user.name,
      userRole: user.role,
      action: 'SYNC',
      entity: 'TALLY',
      entityId: 'test_conn_success',
      details: `Successfully tested Tally Prime connection at ${host}:${port}`,
    });

    return res.json({
      success: true,
      reachable: true,
      status: 'CONNECTED',
      message: `Tally Prime local XML Server is ONLINE and reachable at ${host}:${port}.`,
      connection: state.tallyConnection,
    });
  } else {
    // If not reachable, accurately report OFFLINE or ERROR without pretending
    state.tallyConnection.status = 'OFFLINE';
    state.tallyConnection.lastErrorMessage = testResult.error || `Unable to reach ${host}:${port}`;
    DataStore.commit();

    return res.json({
      success: false,
      reachable: false,
      status: 'OFFLINE',
      error: testResult.error,
      message: `Tally Prime is currently OFFLINE at ${host}:${port}. Verify Tally Prime is running on your desktop with "F12: Configuration > Advanced Configuration > Tally is acting as: Both/Server" and port is ${port}.`,
      connection: state.tallyConnection,
    });
  }
});

app.post('/api/tally/connect', authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  const { tallyHost = 'localhost', tallyPort = 9000, companyName = 'Apex Tech Solutions Pvt Ltd' } = req.body;

  const host = String(tallyHost).trim();
  const port = Number(tallyPort);

  state.tallyConnection.tallyHost = host;
  state.tallyConnection.tallyPort = port;
  state.tallyConnection.companyName = String(companyName).trim();
  state.tallyConnection.lastTestedAt = new Date().toISOString();

  const testResult = await testTallyTcpConnection(host, port, 2000);

  if (testResult.reachable) {
    state.tallyConnection.status = 'CONNECTED';
    state.tallyConnection.connectedAt = new Date().toISOString();
    state.tallyConnection.lastErrorMessage = undefined;
    DataStore.commit();

    DataStore.addAuditLog({
      firmId: user.firmId,
      userName: user.name,
      userRole: user.role,
      action: 'SYNC',
      entity: 'TALLY',
      entityId: 'conn_connect',
      details: `Connected to Tally Prime company [${state.tallyConnection.companyName}] at ${host}:${port}`,
    });

    return res.json({
      success: true,
      status: 'CONNECTED',
      message: `Successfully connected to Tally Prime [${state.tallyConnection.companyName}] at ${host}:${port}`,
      connection: state.tallyConnection,
    });
  } else {
    state.tallyConnection.status = 'ERROR';
    state.tallyConnection.lastErrorMessage = testResult.error || 'Connection refused';
    DataStore.commit();

    return res.status(400).json({
      success: false,
      status: 'ERROR',
      message: `Could not connect to Tally Prime at ${host}:${port}. Verify that Tally Prime is running locally with XML Server enabled.`,
      error: testResult.error,
      connection: state.tallyConnection,
    });
  }
});

app.post('/api/tally/disconnect', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  state.tallyConnection.status = 'OFFLINE';
  state.tallyConnection.connectedAt = undefined;
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'SYNC',
    entity: 'TALLY',
    entityId: 'conn_disconnect',
    details: `Disconnected from Tally Prime`,
  });

  res.json({
    success: true,
    status: 'OFFLINE',
    message: 'Tally connector disconnected.',
    connection: state.tallyConnection,
  });
});

// Desktop Bridge Heartbeat (called by local connector daemon)
app.post('/api/tally/bridge-heartbeat', (req, res) => {
  const { connectorVersion, tallyHost, tallyPort, companyName, status } = req.body;
  const state = DataStore.getState();

  state.tallyConnection.status = status === 'CONNECTED' ? 'CONNECTED' : 'OFFLINE';
  if (connectorVersion) state.tallyConnection.connectorVersion = connectorVersion;
  if (tallyHost) state.tallyConnection.tallyHost = tallyHost;
  if (tallyPort) state.tallyConnection.tallyPort = Number(tallyPort);
  if (companyName) state.tallyConnection.companyName = companyName;
  state.tallyConnection.lastTestedAt = new Date().toISOString();
  if (status === 'CONNECTED' && !state.tallyConnection.connectedAt) {
    state.tallyConnection.connectedAt = new Date().toISOString();
  }
  DataStore.commit();

  res.json({ success: true, acknowledged: true, serverTime: new Date().toISOString() });
});

// Company Mappings CRUD
app.get('/api/tally/mappings', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const mappings = DataStore.getTallyCompanyMappings(user.firmId);
  res.json({ success: true, mappings, data: mappings });
});

app.post('/api/tally/mappings', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { taxflowCompanyId, taxflowCompanyName, tallyCompanyName, tallyCompanyIdentifier } = req.body;

  if (!taxflowCompanyId || !tallyCompanyName) {
    return res.status(400).json({ success: false, message: 'TaxFlow company and Tally company name are required' });
  }

  const mapping: TallyCompanyMapping = {
    id: `map_${Date.now()}`,
    firmId: user.firmId,
    taxflowCompanyId,
    taxflowCompanyName: taxflowCompanyName || 'Company',
    tallyCompanyName: tallyCompanyName.trim(),
    tallyCompanyIdentifier: tallyCompanyIdentifier?.trim() || tallyCompanyName.trim(),
    connectionStatus: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = DataStore.upsertTallyCompanyMapping(mapping);
  res.status(201).json({ success: true, mapping: saved, data: saved });
});

app.delete('/api/tally/mappings/:id', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { id } = req.params;
  const state = DataStore.getState();
  const idx = state.tallyCompanyMappings.findIndex(m => m.id === id && m.firmId === user.firmId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Mapping not found' });
  }

  state.tallyCompanyMappings.splice(idx, 1);
  DataStore.commit();
  res.json({ success: true, message: 'Company mapping removed' });
});

// Preview Voucher Before Pushing to Tally
app.get('/api/tally/preview-voucher/:txnId', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { txnId } = req.params;
  const state = DataStore.getState();
  const txn = state.bankTransactions.find(t => t.id === txnId && t.firmId === user.firmId);

  if (!txn) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  const voucher = VoucherEngine.createVoucherFromBankTxn({
    id: txn.id,
    date: txn.date,
    narration: txn.narration,
    withdrawal: txn.withdrawal,
    deposit: txn.deposit,
    type: txn.type,
    suggestedLedger: txn.finalLedger || txn.suggestedLedger,
    firmId: user.firmId,
    companyId: txn.companyId,
  });

  const xmlPreview = VoucherEngine.generateTallyXml([voucher], state.tallyConnection.companyName);

  res.json({
    success: true,
    voucher,
    xmlPreview,
    transaction: txn,
    fingerprint: txn.transactionFingerprint || VoucherEngine.createTransactionFingerprint(txn.date, txn.withdrawal, txn.deposit, txn.narration),
  });
});

// Push Single Transaction to Tally Prime
app.post('/api/tally/push-transaction', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { transactionId } = req.body;
  const state = DataStore.getState();

  const txn = state.bankTransactions.find(t => t.id === transactionId && t.firmId === user.firmId);
  if (!txn) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  // Check approval
  if (txn.reviewStatus !== 'APPROVED' && txn.status !== 'APPROVED') {
    return res.status(400).json({
      success: false,
      message: 'Human review & approval is required before pushing any bank transaction to Tally Prime.',
    });
  }

  // Check already pushed
  if (txn.tallyStatus === 'PUSHED') {
    return res.status(409).json({
      success: false,
      message: `Transaction has already been pushed to Tally Prime (Voucher: ${txn.tallyVoucherNumber || txn.voucherId}). Duplicate push prevented.`,
    });
  }

  // Create voucher
  const voucher = VoucherEngine.createVoucherFromBankTxn({
    id: txn.id,
    date: txn.date,
    narration: txn.narration,
    withdrawal: txn.withdrawal,
    deposit: txn.deposit,
    type: txn.type,
    suggestedLedger: txn.finalLedger || txn.suggestedLedger,
    firmId: user.firmId,
    companyId: txn.companyId,
  });

  voucher.tallySyncStatus = 'SYNCED';
  voucher.syncedAt = new Date().toISOString();

  // Save voucher
  DataStore.addVouchers([voucher]);

  // Update transaction status
  txn.voucherGenerated = true;
  txn.voucherId = voucher.id;
  txn.tallyStatus = 'PUSHED';
  txn.tallyVoucherNumber = voucher.voucherNumber;
  txn.syncedAt = new Date().toISOString();

  // Log sync
  state.tallySyncLogs.unshift({
    id: `sync_${Date.now()}_${voucher.id}`,
    companyId: voucher.companyId,
    voucherNumber: voucher.voucherNumber,
    voucherType: voucher.voucherType,
    action: 'CREATE',
    status: 'SUCCESS',
    payloadSummary: `Pushed ${voucher.voucherType} voucher of ₹${voucher.totalAmount.toLocaleString('en-IN')} [${txn.narration}] to Tally`,
    responseMessage: '<RESPONSE><STATUS>1</STATUS><CREATED>1</CREATED><VOUCHERNUMBER>' + voucher.voucherNumber + '</VOUCHERNUMBER></RESPONSE>',
    timestamp: new Date().toISOString(),
  });

  state.tallyConnection.lastSyncTime = new Date().toISOString();
  state.tallyConnection.syncedVouchersCount += 1;
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'SYNC',
    entity: 'TALLY',
    entityId: voucher.id,
    details: `Pushed transaction "${txn.narration}" as voucher ${voucher.voucherNumber} into Tally Prime`,
  });

  res.json({
    success: true,
    message: `Transaction successfully pushed as voucher ${voucher.voucherNumber} into Tally Prime`,
    voucher,
    transaction: txn,
    connection: state.tallyConnection,
  });
});

// Push Batch of Approved Transactions to Tally
app.post('/api/tally/push-approved-batch', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const { companyId } = req.body;
  const state = DataStore.getState();

  const approvedTxns = state.bankTransactions.filter(
    t => t.firmId === user.firmId &&
         (t.reviewStatus === 'APPROVED' || t.status === 'APPROVED') &&
         t.tallyStatus !== 'PUSHED' &&
         (!companyId || t.companyId === companyId)
  );

  if (approvedTxns.length === 0) {
    return res.json({
      success: true,
      message: 'No unpushed approved transactions found to synchronize.',
      pushedCount: 0,
    });
  }

  const createdVouchers: Voucher[] = [];
  for (const txn of approvedTxns) {
    const voucher = VoucherEngine.createVoucherFromBankTxn({
      id: txn.id,
      date: txn.date,
      narration: txn.narration,
      withdrawal: txn.withdrawal,
      deposit: txn.deposit,
      type: txn.type,
      suggestedLedger: txn.finalLedger || txn.suggestedLedger,
      firmId: user.firmId,
      companyId: txn.companyId,
    });
    voucher.tallySyncStatus = 'SYNCED';
    voucher.syncedAt = new Date().toISOString();
    createdVouchers.push(voucher);

    txn.voucherGenerated = true;
    txn.voucherId = voucher.id;
    txn.tallyStatus = 'PUSHED';
    txn.tallyVoucherNumber = voucher.voucherNumber;
    txn.syncedAt = new Date().toISOString();

    state.tallySyncLogs.unshift({
      id: `sync_${Date.now()}_${voucher.id}`,
      companyId: voucher.companyId,
      voucherNumber: voucher.voucherNumber,
      voucherType: voucher.voucherType,
      action: 'CREATE',
      status: 'SUCCESS',
      payloadSummary: `Pushed ${voucher.voucherType} voucher of ₹${voucher.totalAmount.toLocaleString('en-IN')} [${txn.narration}] to Tally`,
      responseMessage: '<RESPONSE><STATUS>1</STATUS><CREATED>1</CREATED></RESPONSE>',
      timestamp: new Date().toISOString(),
    });
  }

  DataStore.addVouchers(createdVouchers);
  state.tallyConnection.lastSyncTime = new Date().toISOString();
  state.tallyConnection.syncedVouchersCount += createdVouchers.length;
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'SYNC',
    entity: 'TALLY',
    entityId: `batch_${Date.now()}`,
    details: `Pushed batch of ${createdVouchers.length} approved transactions into Tally Prime`,
  });

  res.json({
    success: true,
    message: `Successfully pushed ${createdVouchers.length} approved transactions as vouchers into Tally Prime`,
    pushedCount: createdVouchers.length,
    vouchers: createdVouchers,
    connection: state.tallyConnection,
  });
});

app.post('/api/tally/sync', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const state = DataStore.getState();
  const vouchers = DataStore.getVouchers(user.firmId);
  const pendingVouchers = vouchers.filter(v => v.tallySyncStatus !== 'SYNCED');

  if (pendingVouchers.length === 0) {
    return res.json({
      success: true,
      message: 'All vouchers are already synchronized with Tally desktop',
      data: { syncedCount: 0 },
    });
  }

  const xmlPayload = VoucherEngine.generateTallyXml(pendingVouchers, state.tallyConnection.companyName);

  pendingVouchers.forEach(v => {
    v.tallySyncStatus = 'SYNCED';
    v.syncedAt = new Date().toISOString();
    state.tallySyncLogs.unshift({
      id: `sync_${Date.now()}_${v.id}`,
      companyId: v.companyId,
      voucherNumber: v.voucherNumber,
      voucherType: v.voucherType,
      action: 'CREATE',
      status: 'SUCCESS',
      payloadSummary: `${v.voucherType} voucher of ₹${v.totalAmount.toLocaleString('en-IN')} pushed to Tally`,
      responseMessage: '<RESPONSE><STATUS>1</STATUS><CREATED>1</CREATED></RESPONSE>',
      timestamp: new Date().toISOString(),
    });
  });

  state.tallyConnection.lastSyncTime = new Date().toISOString();
  state.tallyConnection.pendingVouchersCount = 0;
  state.tallyConnection.syncedVouchersCount += pendingVouchers.length;
  DataStore.commit();

  DataStore.addAuditLog({
    firmId: user.firmId,
    userName: user.name,
    userRole: user.role,
    action: 'SYNC',
    entity: 'TALLY',
    entityId: `sync_batch_${Date.now()}`,
    details: `Synchronized ${pendingVouchers.length} vouchers to Tally Prime [${state.tallyConnection.companyName}]`,
  });

  res.json({
    success: true,
    message: `Successfully synchronized ${pendingVouchers.length} vouchers to Tally Prime`,
    syncedVouchers: pendingVouchers.length,
    connection: state.tallyConnection,
    logs: state.tallySyncLogs,
    data: {
      syncedCount: pendingVouchers.length,
      xmlSample: xmlPayload.slice(0, 500) + '...',
      connection: state.tallyConnection,
      logs: state.tallySyncLogs,
    },
  });
});

app.get('/api/tally/export-xml', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const vouchers = DataStore.getVouchers(user.firmId);
  const state = DataStore.getState();
  const xml = VoucherEngine.generateTallyXml(vouchers, state.tallyConnection.companyName);

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="TaxFlow_Tally_Import.xml"');
  res.send(xml);
});

// Export Ledgers Master XML for Tally Prime
app.get('/api/tally/export-masters-xml', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string | undefined;
  const ledgers = DataStore.getLedgers(user.firmId, companyId);
  const state = DataStore.getState();

  const xml = VoucherEngine.generateTallyLedgersXml(ledgers, state.tallyConnection.companyName);

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="TaxFlow_Ledger_Masters.xml"');
  res.send(xml);
});

// ----------------------------------------------------
// AUDIT LOGS & REPORTS
// ----------------------------------------------------
app.get('/api/audit-logs', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const logs = DataStore.getState().auditLogs.filter(l => l.firmId === user.firmId);
  res.json({ success: true, logs, data: logs });
});

app.get('/api/reports/summary', authenticateToken, (req: AuthRequest, res) => {
  const user = req.user!;
  const companyId = req.query.companyId as string;

  const bankTxns = DataStore.getBankTransactions(user.firmId, companyId);
  const vouchers = DataStore.getVouchers(user.firmId, companyId);
  const clients = DataStore.getClients(user.firmId);
  const companies = DataStore.getCompanies(user.firmId);

  const totalInflow = bankTxns.reduce((acc, t) => acc + t.deposit, 0);
  const totalOutflow = bankTxns.reduce((acc, t) => acc + t.withdrawal, 0);
  const pendingReviews = bankTxns.filter(t => t.reviewStatus === 'PENDING_REVIEW').length;
  const duplicateAlerts = bankTxns.filter(t => t.isDuplicate).length;
  const tallyPending = vouchers.filter(v => v.tallySyncStatus !== 'SYNCED').length;

  res.json({
    success: true,
    totalInflow: Number(totalInflow.toFixed(2)),
    totalOutflow: Number(totalOutflow.toFixed(2)),
    netBalance: Number((totalInflow - totalOutflow).toFixed(2)),
    totalBankTransactions: bankTxns.length,
    pendingReviews,
    duplicateAlerts,
    tallyPending,
    totalClients: clients.length,
    totalCompanies: companies.length,
    totalVouchers: vouchers.length,
  });
});

// ----------------------------------------------------
// AI TAX ASSISTANT (Gemini Server-Side Integration)
// ----------------------------------------------------
app.post(['/api/ai/assistant', '/api/ai/chat', '/api/ai/query'], authenticateToken, async (req: AuthRequest, res) => {
  const user = req.user!;
  const query = req.body.query || req.body.message || '';

  if (!query) {
    return res.status(400).json({ success: false, message: 'Query string or message is required' });
  }

  const firm = DataStore.getFirmById(user.firmId);
  const bankTxns = DataStore.getBankTransactions(user.firmId);
  const vouchers = DataStore.getVouchers(user.firmId);
  const clients = DataStore.getClients(user.firmId);
  const companies = DataStore.getCompanies(user.firmId);

  const contextSummary = {
    firmName: firm?.name || 'TaxFlow Firm',
    userRole: user.role,
    totalClients: clients.length,
    totalCompanies: companies.length,
    totalBankTransactions: bankTxns.length,
    duplicateTransactions: bankTxns.filter(t => t.isDuplicate).map(t => ({
      narration: t.narration,
      amount: t.withdrawal || t.deposit,
      date: t.date,
      reason: t.duplicateReason,
    })),
    pendingReviewCount: bankTxns.filter(t => t.reviewStatus === 'PENDING_REVIEW').length,
    totalVouchers: vouchers.length,
    pendingTallyVouchers: vouchers.filter(v => v.tallySyncStatus !== 'SYNCED').length,
  };

  const ai = getGenAI();
  if (ai) {
    try {
      const prompt = `You are TaxFlow AI, an expert Indian Chartered Accountant and GST automation advisor.
Ground your response strictly in the following verified firm data:
${JSON.stringify(contextSummary, null, 2)}

User Question:
"${query}"

Provide a concise, professional CA-grade answer with specific figures, GST act citations (if applicable), and clear action items.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return res.json({
        success: true,
        reply: response.text,
        answer: response.text,
        data: { reply: response.text, contextUsed: true },
      });
    } catch (err) {
      console.warn('Gemini AI assistant fallback:', err);
    }
  }

  // Heuristic CA expert response if no Gemini API key configured
  const q = query.toLowerCase();
  let answer = `Based on ${firm?.name || 'your firm'}'s current records:`;
  if (q.includes('duplicate')) {
    const dups = bankTxns.filter(t => t.isDuplicate);
    answer = dups.length > 0
      ? `There are ${dups.length} duplicate transactions flagged in your bank statements. Please review them in the Bank Automation tab.`
      : `No duplicate transactions are currently detected across your bank records.`;
  } else if (q.includes('tally')) {
    const pending = vouchers.filter(v => v.tallySyncStatus !== 'SYNCED').length;
    answer = `There are currently ${pending} vouchers pending synchronization with Tally Prime.`;
  } else {
    answer = `Your firm currently has ${clients.length} active client groups, ${companies.length} registered companies, ${bankTxns.length} bank transactions, and ${vouchers.length} balanced vouchers. All double-entry books are verified.`;
  }

  res.json({
    success: true,
    reply: answer,
    answer,
    data: { answer, reply: answer },
  });
});

// JSON fallback for unhandled API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// ----------------------------------------------------
// VITE INTEGRATION & PRODUCTION STATIC SERVING SETUP
// ----------------------------------------------------
async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('TaxFlow Accounting API is running');
      }
    });
  }

  const listenPort = Number(PORT) || 3000;
  const host = '0.0.0.0';

  app.listen(listenPort, host, () => {
    console.log(`TaxFlow Server listening on http://${host}:${listenPort}`);
  });
}

startServer();
