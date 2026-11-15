// api/src/categorize.ts
import { ReceiptItem } from "./receipt";

export interface CategoryDefinition {
  key: string;        // matches workspace_categories.category_key
  name: string;       // display name
  keywords: string[]; // lowercase, accent-free stems; used for matching
}

export interface CategorizedItem extends ReceiptItem {
  categoryKey: string;
  confidence: number; // 0..1, share of the item's tokens that matched the winner
}

export const FALLBACK_KEY = "other";

// Lowercase, remove diacritics, replace punctuation and digits with spaces.
export function normalise(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

// A token matches a keyword if one is a prefix of the other, so "mlieko"
// matches "mlieka" and "mlieko" alike. Keywords must be at least 3 letters to
// avoid accidental matches on short tokens.
function tokenMatches(token: string, keyword: string): boolean {
  if (keyword.length < 3) return token === keyword;
  return token.startsWith(keyword) || keyword.startsWith(token);
}

export function categorizeItem(
  item: ReceiptItem,
  categories: CategoryDefinition[]
): CategorizedItem {
  const tokens = normalise(item.description);

  let bestKey = FALLBACK_KEY;
  let bestScore = 0;

  for (const category of categories) {
    // Count tokens that match at least one keyword. Each token counts once.
    const score = tokens.filter((token) =>
      category.keywords.some((keyword) => tokenMatches(token, keyword))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestKey = category.key;
    }
  }

  const confidence = tokens.length === 0 ? 0 : bestScore / tokens.length;
  return { ...item, categoryKey: bestKey, confidence };
}

export function categorizeReceipt(
  items: ReceiptItem[],
  categories: CategoryDefinition[]
): CategorizedItem[] {
  return items.map((item) => categorizeItem(item, categories));
}