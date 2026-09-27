/**
 * TaxFlow - GST Reconciliation & Rule Validation Engine
 * Indian GST Compliance: GSTR-1, GSTR-2B, IMS & ITC Eligibility
 */

import { GstReconciliationItem, GstValidationRule, GstReconStatus } from '../../src/types.ts';

export class GstEngine {
  /**
   * Validate Indian GSTIN format (15 characters)
   * 2 digits State Code + 10 chars PAN + 1 digit Entity count + 'Z' + 1 Check Digit
   */
  public static isValidGstin(gstin: string): boolean {
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return pattern.test(gstin.trim().toUpperCase());
  }

  /**
   * Standard Configurable GST Rules
   */
  public static getValidationRules(): GstValidationRule[] {
    return [
      {
        ruleId: 'GST-RULE-01',
        name: 'Invalid GSTIN Checksum Format',
        description: 'Verify if party GSTIN adheres to statutory 15-character alphanumeric format',
        severity: 'ERROR',
        category: 'GSTIN',
        message: 'Party GSTIN does not match official GSTN checksum pattern.',
        suggestedAction: 'Verify registration certificate on GST portal or request updated invoice from vendor.',
      },
      {
        ruleId: 'GST-RULE-02',
        name: 'GSTR-2B Missing ITC Risk (Sec 16(2)(aa))',
        description: 'Invoice present in Books but not reflected in supplier GSTR-1 / GSTR-2B',
        severity: 'CRITICAL',
        category: 'ITC',
        message: 'ITC cannot be availed under Sec 16(2)(aa) as supplier has not uploaded invoice in GSTR-1.',
        suggestedAction: 'Hold payment of GST portion to supplier and send automated reminder via TaxFlow.',
      },
      {
        ruleId: 'GST-RULE-03',
        name: 'Tax Rate & HSN Mismatch',
        description: 'Computed tax rate differs from prescribed GST council tariff rate for HSN/SAC',
        severity: 'WARNING',
        category: 'TAX_RATE',
        message: 'Effective tax calculated differs from standard slab rate (5%, 12%, 18%, 28%).',
        suggestedAction: 'Check line item bifurcation between Taxable Value, CGST, SGST and IGST.',
      },
      {
        ruleId: 'GST-RULE-04',
        name: 'Duplicate Invoice Number in Same Financial Year',
        description: 'Same supplier GSTIN and invoice number found more than once in books',
        severity: 'ERROR',
        category: 'DUPLICATE',
        message: 'Duplicate purchase voucher detected. Potential double claim of Input Tax Credit.',
        suggestedAction: 'Merge or reject duplicate purchase entry before filing GSTR-3B.',
      },
      {
        ruleId: 'GST-RULE-05',
        name: 'Place of Supply (POS) Interstate / Intrastate Check',
        description: 'Verify if CGST+SGST or IGST is correctly charged based on recipient State Code vs POS',
        severity: 'WARNING',
        category: 'GSTIN',
        message: 'Supplier state is interstate but CGST+SGST was recorded instead of IGST.',
        suggestedAction: 'Amend tax components to IGST to avoid notices under Section 77.',
      },
    ];
  }

  /**
   * Reconcile Books (Purchase Register) vs GSTR-2B
   */
  public static reconcileBooksAndGstr2b(
    booksInvoices: Array<{
      gstin: string;
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      taxableValue: number;
      taxAmount: number;
    }>,
    gstr2bInvoices: Array<{
      gstin: string;
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      taxableValue: number;
      taxAmount: number;
    }>,
    companyId: string,
    returnPeriod: string = '04-2026'
  ): GstReconciliationItem[] {
    const results: GstReconciliationItem[] = [];
    const matched2bIndices = new Set<number>();

    // Clean comparison helper
    const normalizeInvNo = (inv: string) => inv.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Pass 1: Compare each book entry with 2B
    booksInvoices.forEach((bInv, bIdx) => {
      const bInvNorm = normalizeInvNo(bInv.invoiceNumber);
      let matchedIndex = -1;

      for (let i = 0; i < gstr2bInvoices.length; i++) {
        if (matched2bIndices.has(i)) continue;
        const gInv = gstr2bInvoices[i];
        if (
          gInv.gstin.toUpperCase() === bInv.gstin.toUpperCase() &&
          normalizeInvNo(gInv.invoiceNumber) === bInvNorm
        ) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) {
        matched2bIndices.add(matchedIndex);
        const gInv = gstr2bInvoices[matchedIndex];
        const taxDiff = Math.abs(bInv.taxAmount - gInv.taxAmount);
        const taxableDiff = Math.abs(bInv.taxableValue - gInv.taxableValue);

        let status: GstReconStatus = 'MATCHED';
        let notes = 'Values match perfectly between Purchase Register and GSTR-2B';

        if (taxDiff <= 2.0 && taxableDiff <= 5.0) {
          status = 'MATCHED';
          notes = 'Eligible for 100% ITC in GSTR-3B table 4(A)(5)';
        } else if (taxDiff <= 50.0) {
          status = 'PARTIAL_MATCH';
          notes = `Tax difference of ₹${taxDiff.toFixed(2)}. Minor rounding or line discount difference.`;
        } else {
          status = 'MISMATCH';
          notes = `Significant tax discrepancy: Books ₹${bInv.taxAmount} vs 2B ₹${gInv.taxAmount}. Review required.`;
        }

        results.push({
          id: `recon_${Date.now()}_${bIdx}`,
          companyId,
          gstin: bInv.gstin,
          supplierName: bInv.supplierName,
          invoiceNumber: bInv.invoiceNumber,
          invoiceDate: bInv.invoiceDate,
          booksTaxableValue: bInv.taxableValue,
          booksTaxAmount: bInv.taxAmount,
          gstrTaxableValue: gInv.taxableValue,
          gstrTaxAmount: gInv.taxAmount,
          differenceAmount: Number((bInv.taxAmount - gInv.taxAmount).toFixed(2)),
          status,
          notes,
          itcEligible: status === 'MATCHED' || status === 'PARTIAL_MATCH',
          returnPeriod,
        });
      } else {
        // Missing in GSTR-2B! Vendor has not filed GSTR-1
        results.push({
          id: `recon_${Date.now()}_${bIdx}`,
          companyId,
          gstin: bInv.gstin,
          supplierName: bInv.supplierName,
          invoiceNumber: bInv.invoiceNumber,
          invoiceDate: bInv.invoiceDate,
          booksTaxableValue: bInv.taxableValue,
          booksTaxAmount: bInv.taxAmount,
          gstrTaxableValue: 0,
          gstrTaxAmount: 0,
          differenceAmount: bInv.taxAmount,
          status: 'MISSING_IN_GSTR',
          notes: 'Invoice in Books but missing in GSTR-2B. Ineligible for immediate ITC claim.',
          itcEligible: false,
          returnPeriod,
        });
      }
    });

    // Pass 2: Any 2B entry not in books
    gstr2bInvoices.forEach((gInv, gIdx) => {
      if (!matched2bIndices.has(gIdx)) {
        results.push({
          id: `recon_${Date.now()}_missing_${gIdx}`,
          companyId,
          gstin: gInv.gstin,
          supplierName: gInv.supplierName,
          invoiceNumber: gInv.invoiceNumber,
          invoiceDate: gInv.invoiceDate,
          booksTaxableValue: 0,
          booksTaxAmount: 0,
          gstrTaxableValue: gInv.taxableValue,
          gstrTaxAmount: gInv.taxAmount,
          differenceAmount: -gInv.taxAmount,
          status: 'MISSING_IN_BOOKS',
          notes: 'Present in GSTR-2B but unbooked in accounting. Unclaimed ITC available.',
          itcEligible: true,
          returnPeriod,
        });
      }
    });

    return results;
  }
}
