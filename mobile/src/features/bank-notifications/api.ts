import { apiRequest } from "../../api";
import type { Expense } from "../../api";

export async function importNotificationExpense(
  token: string,
  workspaceId: string,
  transaction: { notificationId: string; amountCents: number; date: string; note: string }
): Promise<boolean> {
  const body = await apiRequest<Expense | { alreadyImported: true }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/bank-notifications/expenses`,
    { method: "POST", body: JSON.stringify(transaction) },
    token
  );
  return !("alreadyImported" in body && body.alreadyImported);
}
