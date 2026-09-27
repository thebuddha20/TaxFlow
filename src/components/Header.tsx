import React, { useState } from 'react';
import { User, Firm, Company, Client, UserRole } from '../types.ts';
import {
  Building2,
  Calendar,
  ShieldCheck,
  Bell,
  RefreshCw,
  Search,
  CheckCircle2,
  LogOut,
  UserCheck,
  User as UserIcon,
  ChevronDown,
  Layers,
  Briefcase,
} from 'lucide-react';

interface HeaderProps {
  currentFirm?: Firm | null;
  currentUser?: User | null;
  clients?: Client[];
  selectedClientId?: string;
  onSelectClient?: (clientId: string) => void;
  companies?: Company[];
  selectedCompanyId?: string;
  onSelectCompany?: (companyId: string) => void;
  selectedFY?: string;
  onSelectFY?: (fy: string) => void;
  isClientMode?: boolean;
  onToggleClientMode?: (isClient: boolean) => void;
  onRoleChange?: (role: UserRole) => void;
  pendingReviewsCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onLogout?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentFirm,
  currentUser,
  clients = [],
  selectedClientId,
  onSelectClient,
  companies = [],
  selectedCompanyId,
  onSelectCompany,
  selectedFY = '2025-2026',
  onSelectFY,
  isClientMode = false,
  onToggleClientMode,
  onRoleChange,
  pendingReviewsCount = 0,
  onRefresh,
  isRefreshing = false,
  onLogout,
  onOpenAuth,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const filteredCompanies = selectedClientId
    ? companies.filter(c => c.clientId === selectedClientId)
    : companies;
  const currentCompany = companies.find(c => c.id === selectedCompanyId) || filteredCompanies[0] || companies[0];

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    FIRM_OWNER: 'CA / Firm Owner',
    CA: 'Chartered Accountant',
    MANAGER: 'Audit Manager',
    ACCOUNTANT: 'Accountant',
    GST_EXECUTIVE: 'GST Executive',
    CLIENT: 'Client Portal',
    AUDITOR: 'Statutory Auditor',
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand & Active Firm */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-lg shadow-inner">
              TF
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">TaxFlow</span>
                {isClientMode ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wide">
                    Client Mode
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                    CA Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[220px]" title={currentFirm?.name}>
                Firm: <span className="text-slate-300 font-medium">{currentFirm?.name || 'TaxFlow Practice'}</span>
              </p>
            </div>
          </div>

          {/* Context Switchers: Mode, Client, Company, FY */}
          <div className="hidden lg:flex items-center gap-2">
            {/* Mode Switcher Toggle */}
            <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => onToggleClientMode?.(false)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  !isClientMode
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CA Practice
              </button>
              <button
                type="button"
                onClick={() => onToggleClientMode?.(true)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isClientMode
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Client Portal
              </button>
            </div>

            {/* Client Selector */}
            {clients.length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs">
                <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Client:</span>
                <select
                  id="client-selector"
                  value={selectedClientId || selectedClient?.id || ''}
                  onChange={e => onSelectClient?.(e.target.value)}
                  className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer max-w-[130px] truncate"
                >
                  {clients.map(cli => (
                    <option key={cli.id} value={cli.id} className="bg-slate-900 text-white">
                      {cli.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Company Selector */}
            {companies.length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs">
                <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Company:</span>
                <select
                  id="company-selector"
                  value={currentCompany?.id || ''}
                  onChange={e => onSelectCompany?.(e.target.value)}
                  className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  {(filteredCompanies.length > 0 ? filteredCompanies : companies).map(comp => (
                    <option key={comp.id} value={comp.id} className="bg-slate-900 text-white">
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Financial Year Selector */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">FY:</span>
              <select
                id="fy-selector"
                value={selectedFY}
                onChange={e => onSelectFY?.(e.target.value)}
                className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer"
              >
                <option value="2025-2026" className="bg-slate-900 text-white">2025-26</option>
                <option value="2026-2027" className="bg-slate-900 text-white">2026-27</option>
              </select>
            </div>
          </div>

          {/* Right Actions: Refresh, Reviews Badge, Profile Menu */}
          <div className="flex items-center gap-2">
            {/* Quick Refresh */}
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              title="Refresh ledger state"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Review Badge */}
            {pendingReviewsCount > 0 && (
              <div
                title={`${pendingReviewsCount} items requiring review`}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>{pendingReviewsCount} Reviews</span>
              </div>
            )}

            {/* User Profile & Logout Dropdown */}
            <div className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-emerald-400">
                  {currentUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'CA'}
                </div>
                <div className="hidden md:block text-left text-xs">
                  <p className="font-semibold text-slate-200 leading-tight max-w-[120px] truncate">
                    {currentUser?.name || 'CA Practice User'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {roleLabels[currentUser?.role || 'FIRM_OWNER'] || 'Chartered Accountant'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-xs text-slate-200 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="font-semibold text-white truncate">{currentUser?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 font-mono">
                      {currentUser?.role}
                    </span>
                  </div>

                  <div className="px-1 py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAuth?.();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch Account / Sign In</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout?.();
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-300 hover:text-rose-200 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
