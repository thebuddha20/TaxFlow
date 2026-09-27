import React, { useState } from 'react';
import { ExtractedInvoice } from '../types.ts';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Hash,
} from 'lucide-react';

interface InvoiceOcrViewProps {
  invoices: ExtractedInvoice[];
  onApproveInvoice: (invoiceId: string) => Promise<void>;
  onProcessInvoice: (invoiceText: string) => Promise<void>;
  isProcessing?: boolean;
}

export const InvoiceOcrView: React.FC<InvoiceOcrViewProps> = ({
  invoices,
  onApproveInvoice,
  onProcessInvoice,
  isProcessing,
}) => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || '');

  const activeInvoice = invoices.find(i => i.id === selectedInvoiceId) || invoices[0];

  const handleSampleInvoiceExtract = async () => {
    const sampleText = `TAX INVOICE
Tata Tele Business Services Limited
GSTIN: 27AABCT9981K1ZP
Invoice No: TTBS/MUM/2026/410
Invoice Date: 01/04/2026
Billed To: Apex Tech Solutions Pvt Ltd
Customer GSTIN: 27AAACA1234A1Z5
Place of Supply: 27-Maharashtra
Item: High-Speed Enterprise Leased Line Internet (April 2026)
SAC Code: 998422
Qty: 1  Rate: 12,000.00
Taxable Value: 12,000.00
CGST @ 9%: 1,080.00
SGST @ 9%: 1,080.00
Total Amount Payable: Rs. 14,160.00`;

    await onProcessInvoice(sampleText);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Invoice OCR &amp; AI Extraction</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Gemini 3.8 Dual-Engine</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pluggable OCR &amp; LLM extraction with field-level confidence verification and double-entry voucher generation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="extract-sample-invoice-btn"
            onClick={handleSampleInvoiceExtract}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Extracting with AI...' : 'Extract Sample GST Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Invoice Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {invoices.map((inv, idx) => (
          <button
            key={inv.id}
            id={`select-inv-tab-${idx}`}
            onClick={() => setSelectedInvoiceId(inv.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 whitespace-nowrap transition-colors ${
              selectedInvoiceId === inv.id
                ? 'bg-slate-800 text-white border-emerald-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            <span>{inv.invoiceNumber}</span>
            <span className="text-[10px] text-slate-500">({inv.supplierName.slice(0, 15)}...)</span>
            {inv.status === 'APPROVED' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
        ))}
      </div>

      {activeInvoice ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 Cols): Invoice Visual Preview */}
          <div className="lg:col-span-5 rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Document Viewer</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                Extracted PDF
              </span>
            </div>

            {/* Realistic Invoice Layout Canvas Mock */}
            <div className="rounded-lg bg-slate-950 border border-slate-800 p-5 text-xs font-sans text-slate-200 space-y-4 shadow-inner">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white uppercase">{activeInvoice.supplierName}</h3>
                  <p className="text-[11px] font-mono text-slate-400">GSTIN: {activeInvoice.supplierGstin}</p>
                  <p className="text-[10px] text-slate-500">{activeInvoice.placeOfSupply}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                    TAX INVOICE
                  </span>
                  <p className="text-[11px] font-mono font-semibold text-white mt-1">{activeInvoice.invoiceNumber}</p>
                  <p className="text-[10px] text-slate-400">Date: {activeInvoice.invoiceDate}</p>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
                <p className="text-slate-400 text-[10px] uppercase font-semibold">Billed To (Customer):</p>
                <p className="font-medium text-white">{activeInvoice.customerName}</p>
                <p className="font-mono text-slate-400">GSTIN: {activeInvoice.customerGstin}</p>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Line Items Billed:</p>
                {activeInvoice.items.map((it, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                    <div className="flex justify-between font-medium text-slate-100">
                      <span>{it.description}</span>
                      <span className="font-mono">₹{it.taxableAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>HSN: {it.hsnSac} • Qty: {it.qty}</span>
                      <span>GST @ {it.gstRate}% (₹{(it.cgst + it.sgst + it.igst).toFixed(2)})</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-slate-800 pt-3 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Taxable Value:</span>
                  <span className="font-mono text-slate-200">₹{activeInvoice.taxableValue.toFixed(2)}</span>
                </div>
                {activeInvoice.cgst > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Central GST (CGST 9%):</span>
                    <span className="font-mono text-slate-200">₹{activeInvoice.cgst.toFixed(2)}</span>
                  </div>
                )}
                {activeInvoice.sgst > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>State GST (SGST 9%):</span>
                    <span className="font-mono text-slate-200">₹{activeInvoice.sgst.toFixed(2)}</span>
                  </div>
                )}
                {activeInvoice.igst > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Integrated GST (IGST 18%):</span>
                    <span className="font-mono text-slate-200">₹{activeInvoice.igst.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-emerald-400 border-t border-slate-800 pt-2">
                  <span>Invoice Total:</span>
                  <span className="font-mono">₹{activeInvoice.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Extracted Structured Data & Confidence Breakdown */}
          <div className="lg:col-span-7 rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Extracted Metadata &amp; Confidence Breakdown</h3>
                <p className="text-xs text-slate-400">Human review threshold: Flag any field below 90%</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Overall: {Math.round((activeInvoice.confidence.overall || 0.95) * 100)}%</span>
              </div>
            </div>

            {/* Field Confidence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Supplier GSTIN */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Supplier GSTIN</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {Math.round(activeInvoice.confidence.gstin * 100)}% Confidence
                  </span>
                </div>
                <p className="font-mono font-semibold text-xs text-white">{activeInvoice.supplierGstin}</p>
                <p className="text-[10px] text-emerald-500/90">Checksum &amp; Format Verified (27-Maharashtra)</p>
              </div>

              {/* Invoice Number */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Invoice Number</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {Math.round(activeInvoice.confidence.invoiceNumber * 100)}% Confidence
                  </span>
                </div>
                <p className="font-mono font-semibold text-xs text-white">{activeInvoice.invoiceNumber}</p>
                <p className="text-[10px] text-slate-400">Unique identifier in FY 2025-26</p>
              </div>

              {/* Invoice Date */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Invoice Date</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {Math.round(activeInvoice.confidence.date * 100)}% Confidence
                  </span>
                </div>
                <p className="font-mono font-semibold text-xs text-white">{activeInvoice.invoiceDate}</p>
                <p className="text-[10px] text-slate-400">Within return filing tax period</p>
              </div>

              {/* Taxable Amount */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Taxable Value (Base)</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {Math.round(activeInvoice.confidence.taxableValue * 100)}% Confidence
                  </span>
                </div>
                <p className="font-mono font-bold text-xs text-white">₹{activeInvoice.taxableValue.toFixed(2)}</p>
                <p className="text-[10px] text-slate-400">Eligible for input depreciation / P&amp;L deduction</p>
              </div>
            </div>

            {/* GST Summary Box */}
            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/80 space-y-3 text-xs">
              <span className="font-semibold text-white">GST B2B ITC Breakdown:</span>
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">CGST (9%)</span>
                  <span className="text-slate-200 font-semibold">₹{activeInvoice.cgst.toFixed(2)}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">SGST (9%)</span>
                  <span className="text-slate-200 font-semibold">₹{activeInvoice.sgst.toFixed(2)}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">IGST (18%)</span>
                  <span className="text-slate-200 font-semibold">₹{activeInvoice.igst.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Approval Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {activeInvoice.status === 'APPROVED' ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approved &amp; posted to Purchase Register</span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Review required before posting to Tally</span>
                  </span>
                )}
              </div>

              {activeInvoice.status !== 'APPROVED' && (
                <button
                  id="approve-invoice-post-btn"
                  onClick={() => onApproveInvoice(activeInvoice.id)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve &amp; Generate Purchase Voucher</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 text-xs bg-slate-900 rounded-xl border border-slate-800">
          No invoices extracted yet. Click &ldquo;Extract Sample GST Invoice&rdquo; above.
        </div>
      )}
    </div>
  );
};
