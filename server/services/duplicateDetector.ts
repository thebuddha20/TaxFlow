/**
 * TaxFlow - Bank Duplicate Detection Engine
 * Intelligent multi-factor duplicate scoring using date, amount, direction, reference, and fuzzy narration
 */

export interface TransactionInput {
  id?: string;
  date: string;
  narration: string;
  referenceNumber?: string;
  withdrawal: number;
  deposit: number;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  score: number;
  reason?: string;
  pairId?: string;
}

export function normalizeNarration(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeNarration(str1);
  const s2 = normalizeNarration(str2);
  if (s1 === s2 && s1.length > 0) return 1.0;
  if (!s1 || !s2) return 0.0;

  const words1 = new Set(s1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(s2.split(' ').filter(w => w.length > 1));
  if (words1.size === 0 || words2.size === 0) return 0.0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export function detectDuplicates(
  newTransactions: TransactionInput[],
  existingTransactions: TransactionInput[] = []
): Map<number, DuplicateResult> {
  const results = new Map<number, DuplicateResult>();

  // Default all to not duplicate
  for (let i = 0; i < newTransactions.length; i++) {
    results.set(i, { isDuplicate: false, score: 0 });
  }

  // 1. Check against existing transactions in the database first
  if (existingTransactions.length > 0) {
    for (let i = 0; i < newTransactions.length; i++) {
      const t1 = newTransactions[i];
      const amount1 = t1.withdrawal > 0 ? t1.withdrawal : t1.deposit;
      const isDebit1 = t1.withdrawal > 0;

      for (const ex of existingTransactions) {
        const amount2 = ex.withdrawal > 0 ? ex.withdrawal : ex.deposit;
        const isDebit2 = ex.withdrawal > 0;

        if (isDebit1 !== isDebit2) continue;

        let score = 0;
        const reasons: string[] = [];

        // Exact amount
        if (Math.abs(amount1 - amount2) < 0.01 && amount1 > 0) {
          score += 40;
          reasons.push(`Exact amount match (₹${amount1.toLocaleString('en-IN')})`);
        }

        // Date match
        if (t1.date === ex.date) {
          score += 25;
          reasons.push(`Identical date (${t1.date})`);
        }

        // Reference number
        if (t1.referenceNumber && ex.referenceNumber && t1.referenceNumber === ex.referenceNumber) {
          score += 25;
          reasons.push(`Matching reference (${t1.referenceNumber})`);
        }

        // Narration similarity
        const sim = calculateStringSimilarity(t1.narration, ex.narration);
        if (sim > 0.6) {
          score += Math.round(sim * 20);
          reasons.push(`High narration similarity (${Math.round(sim * 100)}%)`);
        }

        if (score >= 65) {
          results.set(i, {
            isDuplicate: true,
            score: Math.min(100, score),
            reason: `Possible duplicate of existing transaction: ${reasons.join(', ')}`,
            pairId: ex.id || 'EXISTING_DB_MATCH',
          });
          break;
        }
      }
    }
  }

  // 2. Pairwise comparison within the current batch
  for (let i = 0; i < newTransactions.length; i++) {
    const t1 = newTransactions[i];
    const amount1 = t1.withdrawal > 0 ? t1.withdrawal : t1.deposit;
    const isDebit1 = t1.withdrawal > 0;

    for (let j = i + 1; j < newTransactions.length; j++) {
      const t2 = newTransactions[j];
      const amount2 = t2.withdrawal > 0 ? t2.withdrawal : t2.deposit;
      const isDebit2 = t2.withdrawal > 0;

      if (isDebit1 !== isDebit2) continue;

      let score = 0;
      const reasons: string[] = [];

      // Amount match
      if (Math.abs(amount1 - amount2) < 0.01 && amount1 > 0) {
        score += 40;
        reasons.push(`Exact amount match (₹${amount1.toLocaleString('en-IN')})`);
      }

      // Date match
      if (t1.date === t2.date) {
        score += 25;
        reasons.push(`Identical date (${t1.date})`);
      }

      // Reference number match
      if (t1.referenceNumber && t2.referenceNumber && t1.referenceNumber === t2.referenceNumber) {
        score += 25;
        reasons.push(`Matching reference (${t1.referenceNumber})`);
      }

      // Narration similarity
      const sim = calculateStringSimilarity(t1.narration, t2.narration);
      if (sim > 0.6) {
        score += Math.round(sim * 20);
        reasons.push(`High narration similarity (${Math.round(sim * 100)}%)`);
      }

      if (score >= 65) {
        const pairId = `DUP-BATCH-${i + 1}-${j + 1}`;
        const reasonStr = `Possible duplicate of Row #${i + 1}: ${reasons.join(', ')}`;

        results.set(j, {
          isDuplicate: true,
          score: Math.min(100, score),
          reason: reasonStr,
          pairId,
        });

        // Also flag the earlier transaction in the pair if not already flagged
        const current1 = results.get(i)!;
        if (!current1.isDuplicate) {
          results.set(i, {
            isDuplicate: true,
            score: Math.min(100, score),
            reason: `Possible duplicate paired with Row #${j + 1}: ${reasons.join(', ')}`,
            pairId,
          });
        }
      }
    }
  }

  return results;
}
