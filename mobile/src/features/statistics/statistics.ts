import { Expense } from "../../api";

export type StatisticsQuery = {
  startDate: string;
  endDate: string;
  categoryMode: "all" | "include" | "exclude";
  categories: string[];
  memberIds: string[];
};

export type StatisticsReport = {
  query: StatisticsQuery;
  expenses: Expense[];
};

export function filterStatisticsExpenses(expenses: Expense[], query: StatisticsQuery): Expense[] {
  const selectedMembers = new Set(query.memberIds);
  const selectedCategories = new Set(query.categories.map((category) => category.toLowerCase()));

  return expenses.filter((expense) => {
    const date = expense.date ?? "";
    if (date < query.startDate || date > query.endDate) return false;

    const category = expense.category || "Uncategorized";
    if (query.categoryMode === "include" && !selectedCategories.has(category.toLowerCase())) {
      return false;
    }
    if (query.categoryMode === "exclude" && selectedCategories.has(category.toLowerCase())) {
      return false;
    }

    if (
      selectedMembers.size > 0 &&
      !selectedMembers.has(expense.payerId) &&
      !expense.participantIds.some((memberId) => selectedMembers.has(memberId))
    ) {
      return false;
    }
    return true;
  });
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function displayISODate(value: string): string {
  const date = parseISODate(value);
  return date
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : value;
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
