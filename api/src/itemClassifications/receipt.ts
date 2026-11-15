// api/src/receipt.ts
export interface ReceiptItem {
  description: string;   // raw text as printed on the receipt
  amountCents: number;   // integer cents, always positive
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  unparsedLines: string[]; // lines that looked like items but had no valid price
}

// Matches a trailing price such as "1,29", "1.29", "12,5", optionally with a
// currency sign or letter after it, e.g. "1,29 EUR" or "1,29 €".
const PRICE_AT_END = /(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|EUR|eur|€)?\s*[A-Za-z]?\s*$/;

export function parseReceipt(text: string): ParsedReceipt {
  const items: ReceiptItem[] = [];
  const unparsedLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const match = PRICE_AT_END.exec(line);
    if (!match) {
      // Totals, dates, store headers and similar lines do not end in a price,
      // so they are skipped quietly rather than reported as errors.
      continue;
    }

    const amountCents = toCents(match[1]);
    const description = line.slice(0, match.index).replace(/[\s.:-]+$/, "").trim();

    if (amountCents === null || amountCents <= 0 || description.length === 0) {
      unparsedLines.push(line);
      continue;
    }

    items.push({ description, amountCents });
  }

  return { items, unparsedLines };
}

// "1,29" -> 129, "1.2" -> 120, "12" -> 1200. Returns null if not a valid price.
export function toCents(value: string): number | null {
  const normalised = value.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const [whole, fraction = ""] = normalised.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}