import { requireOptionalNativeModule } from "expo-modules-core";
import type { BankTransactionNotification } from "../../../modules/bank-notifications";
import type { CherryBankNotificationsModule } from "../../../modules/bank-notifications";

export type { BankTransactionNotification };
const NativeBankNotifications = requireOptionalNativeModule<CherryBankNotificationsModule>(
  "CherryBankNotifications"
);
export const nativeModuleAvailable = NativeBankNotifications !== null;

export const bankNotifications = {
  hasAccess: () => NativeBankNotifications?.hasNotificationAccess() ?? false,
  openSettings: () => NativeBankNotifications?.openNotificationAccessSettings(),
  getPending: () => NativeBankNotifications?.getPendingTransactions() ?? [],
  acknowledge: (id: string) => NativeBankNotifications?.acknowledgeTransaction(id),
};
