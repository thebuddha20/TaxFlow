import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  BookOpenCheck,
  Scale,
  Cpu,
  AlertCircle,
  Building,
  FileBarChart2,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'bank_automation'
  | 'invoice_ocr'
  | 'accounting'
  | 'gst_center'
  | 'tally_sync'
  | 'review_center'
  | 'clients_companies'
  | 'reports_audit'
  | 'ai_assistant';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviewCount?: number;
  duplicateCount?: number;
  gstMismatchCount?: number;
  tallyPendingCount?: number;
  isClientMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingReviewCount = 0,
  duplicateCount = 0,
  gstMismatchCount = 0,
  tallyPendingCount = 0,
  isClientMode = false,
}) => {
  // Tabs tailored for CA Mode vs Client Mode
  const caNavItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'bank_automation' as NavTab,
      label: 'Bank Automation',
      icon: FileSpreadsheet,
      badge: duplicateCount > 0 ? `${duplicateCount} Dups` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'invoice_ocr' as NavTab,
      label: 'Invoice AI & OCR',
      icon: Receipt,
      badge: null,
    },
    {
      id: 'accounting' as NavTab,
      label: 'Accounting & Vouchers',
      icon: BookOpenCheck,
      badge: null,
    },
    {
      id: 'gst_center' as NavTab,
      label: 'GST & 2B Recon',
      icon: Scale,
      badge: gstMismatchCount > 0 ? `${gstMismatchCount} Mismatch` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      id: 'tally_sync' as NavTab,
      label: 'Tally Prime Connector',
      icon: Cpu,
      badge: tallyPendingCount > 0 ? `${tallyPendingCount} Sync` : 'Connected',
      badgeColor:
        tallyPendingCount > 0
          ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'review_center' as NavTab,
      label: 'Human Review Queue',
      icon: AlertCircle,
      badge: pendingReviewCount > 0 ? `${pendingReviewCount}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'clients_companies' as NavTab,
      label: 'Clients & Companies',
      icon: Building,
      badge: null,
    },
    {
      id: 'reports_audit' as NavTab,
      label: 'Reports & Audit Trail',
      icon: FileBarChart2,
      badge: null,
    },
    {
      id: 'ai_assistant' as NavTab,
      label: 'TaxFlow AI Assistant',
      icon: Sparkles,
      badge: 'Gemini',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
  ];

  const clientNavItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Client Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'bank_automation' as NavTab,
      label: 'Bank Statements',
      icon: FileSpreadsheet,
      badge: duplicateCount > 0 ? `${duplicateCount} Dups` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'invoice_ocr' as NavTab,
      label: 'Bills & Invoice Vault',
      icon: Receipt,
      badge: null,
    },
    {
      id: 'reports_audit' as NavTab,
      label: 'Reports & Status',
      icon: FileBarChart2,
      badge: null,
    },
    {
      id: 'ai_assistant' as NavTab,
      label: 'Tax & Compliance AI',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
  ];

  const navItems = isClientMode ? clientNavItems : caNavItems;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isClientMode ? 'Client Portal' : 'Workflows & Automation'}
          </p>
          {isClientMode ? (
            <span className="text-[10px] text-sky-400 font-semibold">Client View</span>
          ) : (
            <span className="text-[10px] text-emerald-400 font-semibold">CA View</span>
          )}
        </div>

        <nav className="space-y-1" aria-label="Sidebar Navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Compliance status footer */}
      <div className="mt-auto p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span>Double-Entry Balance:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 100% Balanced
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Tally Prime Desktop:</span>
          <span className="text-sky-400 font-mono text-[10px]">localhost:9000</span>
        </div>
      </div>
    </aside>
  );
};
