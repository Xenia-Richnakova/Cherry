import type { BankTransactionNotification } from "../../../modules/bank-notifications";

export type { BankTransactionNotification };
export const nativeModuleAvailable = false;
export const bankNotifications = {
  hasAccess: () => false,
  openSettings: () => undefined,
  getPending: (): BankTransactionNotification[] => [],
  acknowledge: (_id: string) => undefined,
};
