import React, { useState } from 'react';
import { TallyConnection, TallySyncLog } from '../types.ts';
import {
  Cpu,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileCode,
  Terminal,
} from 'lucide-react';

interface TallyConnectorViewProps {
  connection: TallyConnection;
  syncLogs: TallySyncLog[];
  onSyncVouchers: () => Promise<void>;
  isSyncing?: boolean;
}

export const TallyConnectorView: React.FC<TallyConnectorViewProps> = ({
  connection,
  syncLogs,
  onSyncVouchers,
  isSyncing,
}) => {
  const [copiedXml, setCopiedXml] = useState(false);
  const [showXmlInspector, setShowXmlInspector] = useState(true);

  const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${connection.companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TF-VCH-00101</VOUCHERNUMBER>
            <NARRATION>NEFT/Client Retainer received from client</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Bank Current A/C</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-12000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Client Receipts</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>12000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const handleCopyXml = () => {
    navigator.clipboard.writeText(sampleXml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Tally Prime &amp; ERP 9 Connector</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live XML Bridge
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated bi-directional synchronization of Masters, Groups, and Balanced Double-Entry Vouchers with Tally desktop.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            id="download-tally-xml-btn"
            href="/api/tally/export-xml"
            download="TaxFlow_Tally_Import.xml"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export Tally XML</span>
          </a>

          <button
            id="sync-tally-now-btn"
            onClick={onSyncVouchers}
            disabled={isSyncing || connection.pendingVouchersCount === 0}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'Syncing to Tally...'
                : connection.pendingVouchersCount > 0
                ? `Sync ${connection.pendingVouchersCount} Vouchers`
                : 'All Vouchers Synced'}
            </span>
          </button>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <span className="text-slate-400">Connection Status</span>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-base font-bold text-white uppercase">{connection.status}</span>
          </div>
          <p className="text-[10px] font-mono text-slate-500">HTTP XML Server: {connection.tallyHost}:{connection.tallyPort}</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <span className="text-slate-400">Active Tally Company</span>
          <p className="text-sm font-semibold text-slate-200 truncate">{connection.companyName}</p>
          <p className="text-[10px] text-emerald-400">Ledger Mapping: 100% Matched</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <span className="text-slate-400">Vouchers Synced</span>
          <p className="text-xl font-bold text-emerald-400">{connection.syncedVouchersCount}</p>
          <p className="text-[10px] text-slate-400">No XML parsing errors</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <span className="text-slate-400">Pending Push</span>
          <p className="text-xl font-bold text-amber-400">{connection.pendingVouchersCount}</p>
          <p className="text-[10px] text-slate-400">Awaiting user sync trigger</p>
        </div>
      </div>

      {/* Tally XML Payload Inspector */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Tally XML Import Payload Inspector
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="copy-tally-xml-btn"
              onClick={handleCopyXml}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              {copiedXml ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedXml ? 'Copied' : 'Copy XML'}</span>
            </button>
            <button
              onClick={() => setShowXmlInspector(!showXmlInspector)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {showXmlInspector ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showXmlInspector && (
          <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-60 leading-relaxed shadow-inner">
            {sampleXml}
          </pre>
        )}
      </div>

      {/* Sync Logs Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Tally Synchronization Audit Trail</h2>
          <span className="text-xs text-slate-400">{syncLogs.length} Sync Events Logged</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase font-semibold">
              <tr>
                <th className="px-3.5 py-2.5">Timestamp</th>
                <th className="px-3.5 py-2.5">Voucher #</th>
                <th className="px-3.5 py-2.5">Type</th>
                <th className="px-3.5 py-2.5">Payload Summary</th>
                <th className="px-3.5 py-2.5">Tally Response Message</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {syncLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-emerald-400 font-semibold">{log.voucherNumber}</td>
                  <td className="px-3.5 py-2.5">{log.voucherType}</td>
                  <td className="px-3.5 py-2.5 text-slate-300 max-w-sm truncate">{log.payloadSummary}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[10px] text-slate-400">{log.responseMessage}</td>
                  <td className="px-3.5 py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
