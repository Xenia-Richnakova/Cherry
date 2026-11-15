import { toISODate } from "../statistics/statistics";

export type ParsedInvoiceFields = {
  amountCents?: number;
  date?: string;
};

function parseMoney(raw: string): number | null {
  let value = raw.replace(/[\s\u00a0\u202f]/g, "");
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    value = value.replace(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (comma >= 0) {
    const decimals = value.length - comma - 1;
    value = decimals >= 1 && decimals <= 2
      ? value.replace(",", ".")
      : value.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = value.length - dot - 1;
    if (decimals > 2) value = value.replace(/\./g, "");
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(value);
    if (!local) return null;
    day = Number(local[1]);
    month = Number(local[2]);
    year = Number(local[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function findInvoiceDate(text: string): string | undefined {
  const datePattern = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g;
  const lines = text.split(/[\r\n]+/);
  const preferredLabels = /(?:invoice\s+date|date\s+of\s+issue|issue\s+date|d[aá]tum\s+vystavenia|d[aá]tum\s+vystaven[ií]|vystaven[eé])/i;
  const excludedLabels = /(?:due\s+date|payment\s+deadline|splatnos[tť]|uhrad[ií]t\s+do)/i;

  for (const line of lines) {
    if (!preferredLabels.test(line) || excludedLabels.test(line)) continue;
    const match = datePattern.exec(line);
    datePattern.lastIndex = 0;
    if (match) {
      const parsed = parseDate(match[1]);
      if (parsed) return parsed;
    }
  }

  for (const line of lines) {
    if (excludedLabels.test(line)) continue;
    const match = datePattern.exec(line);
    datePattern.lastIndex = 0;
    if (match) {
      const parsed = parseDate(match[1]);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

function findInvoiceAmount(text: string): number | undefined {
  // Keep matches within a single OCR line. A whitespace character class that
  // includes newlines can accidentally merge several unrelated prices.
  const moneyPattern = /(?:\bEUR[ \t]*|€[ \t]*)(\d[\d ,.]*\d|\d)|(?<![\w])(?:(\d[\d ,.]*\d|\d))[ \t]*(?:EUR\b|€)/gi;
  const amounts: { cents: number; score: number; index: number }[] = [];
  const lines = text.split(/[\r\n]+/);
  let offset = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const context = `${lines[lineIndex - 1] ?? ""} ${line} ${lines[lineIndex + 1] ?? ""}`;
    let match: RegExpExecArray | null;
    moneyPattern.lastIndex = 0;
    while ((match = moneyPattern.exec(line)) !== null) {
      const cents = parseMoney(match[1] ?? match[2] ?? "");
      if (cents === null) continue;
      let score = 0;
      if (/(?:amount\s+due|total\s+due|grand\s+total|total\s+payable|total\s+to\s+pay|k\s+úhrade|k\s+uhrade|na\s+úhradu|na\s+uhradu)/i.test(context)) score = 3;
      else if (/(?:total|celkom|spolu|suma|sum\s+to\s+pay)/i.test(context)) score = 2;
      amounts.push({ cents, score, index: offset + match.index });
    }
    offset += line.length + 1;
  }

  amounts.sort((a, b) => b.score - a.score || b.cents - a.cents || b.index - a.index);
  return amounts[0]?.cents;
}

export function parseInvoiceText(text: string): ParsedInvoiceFields {
  const normalized = text
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[–−]/g, "-");
  const amountCents = findInvoiceAmount(normalized);
  const date = findInvoiceDate(normalized);
  return {
    ...(amountCents !== undefined ? { amountCents } : {}),
    ...(date ? { date } : {}),
  };
}

export function todayAsISODate(): string {
  return toISODate(new Date());
}
