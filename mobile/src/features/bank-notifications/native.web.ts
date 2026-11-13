import type { BankTransactionNotification } from "../../../modules/bank-notifications";

export type { BankTransactionNotification };
export const nativeModuleAvailable = false;
export const bankNotifications = {
  hasAccess: () => false,
  openSettings: () => undefined,
  setActiveWorkspace: (_id: string | null) => undefined,
  getPending: (_workspaceId: string): BankTransactionNotification[] => [],
  acknowledge: (_id: string) => undefined,
};
