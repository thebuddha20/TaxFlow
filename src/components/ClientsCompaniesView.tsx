import React, { useState } from 'react';
import { Client, Company } from '../types.ts';
import {
  Building2,
  Plus,
  Briefcase,
  CheckCircle2,
  FileSpreadsheet,
  Globe,
  Hash,
} from 'lucide-react';

interface ClientsCompaniesViewProps {
  clients: Client[];
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onCreateClient: (client: { name: string; contactPerson: string; email: string; phone: string }) => Promise<void>;
  onCreateCompany: (company: { clientId: string; name: string; pan: string; gstin: string; stateCode: string; financialYear: string }) => Promise<void>;
}

export const ClientsCompaniesView: React.FC<ClientsCompaniesViewProps> = ({
  clients,
  companies,
  activeCompanyId,
  onSelectCompany,
  onCreateClient,
  onCreateCompany,
}) => {
  const [showClientModal, setShowClientModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // New Client state
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // New Company state
  const [companyClientId, setCompanyClientId] = useState(clients[0]?.id || '');
  const [compName, setCompName] = useState('');
  const [compPan, setCompPan] = useState('');
  const [compGstin, setCompGstin] = useState('');
  const [compStateCode, setCompStateCode] = useState('27');
  const [compFy, setCompFy] = useState('2025-2026');

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    await onCreateClient({
      name: clientName,
      contactPerson,
      email: clientEmail,
      phone: clientPhone,
    });
    setShowClientModal(false);
    setClientName('');
    setContactPerson('');
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName || !compGstin) return;
    await onCreateCompany({
      clientId: companyClientId,
      name: compName,
      pan: compPan || compGstin.slice(2, 12),
      gstin: compGstin,
      stateCode: compStateCode,
      financialYear: compFy,
    });
    setShowCompanyModal(false);
    setCompName('');
    setCompGstin('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Client Entities &amp; Companies</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              CA Multi-Client Vault
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-company mandates, GSTINs, PANs, states, and separate chart of accounts for each entity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowClientModal(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Client</span>
          </button>
          <button
            onClick={() => setShowCompanyModal(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company / GSTIN</span>
          </button>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(comp => {
          const client = clients.find(c => c.id === comp.clientId);
          const isActive = comp.id === activeCompanyId;

          return (
            <div
              key={comp.id}
              className={`p-5 rounded-xl border transition-all space-y-4 shadow-sm ${
                isActive
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-emerald-950/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    {client?.name || 'Primary Client'}
                  </span>
                  <h3 className="font-bold text-sm text-white mt-0.5">{comp.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">PAN: {comp.pan}</p>
                </div>
                {isActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectCompany(comp.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Switch to This
                  </button>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">GSTIN:</span>
                  <span className="text-slate-200">{comp.gstin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">State Code:</span>
                  <span className="text-slate-300">{comp.stateCode} ({comp.stateCode === '27' ? 'Maharashtra' : comp.stateCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Financial Year:</span>
                  <span className="text-slate-300">{comp.financialYear}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 text-slate-400">
                <span>Double-Entry Books: Ready</span>
                <span>Tally Mapping: 100%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={handleClientSubmit} className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Add New Client Group</h2>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Client / Business Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Reliance Retail Ventures"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="e.g. Rajesh Singhania"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="accounts@clientdomain.com"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Save Client
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={handleCompanySubmit} className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Add Company / GSTIN Registration</h2>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent Client</label>
              <select
                value={companyClientId}
                onChange={e => setCompanyClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Legal Company Name</label>
              <input
                type="text"
                value={compName}
                onChange={e => setCompName(e.target.value)}
                placeholder="e.g. Apex Tech Solutions (Bangalore Branch)"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">15-Digit GSTIN</label>
              <input
                type="text"
                value={compGstin}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setCompGstin(val);
                  if (val.length >= 2) setCompStateCode(val.slice(0, 2));
                  if (val.length >= 12) setCompPan(val.slice(2, 12));
                }}
                maxLength={15}
                placeholder="27AAACA1234A1Z5"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">State Code</label>
                <input
                  type="text"
                  value={compStateCode}
                  onChange={e => setCompStateCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Financial Year</label>
                <input
                  type="text"
                  value={compFy}
                  onChange={e => setCompFy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Create Company
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
