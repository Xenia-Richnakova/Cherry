import { requireNativeModule } from "expo-modules-core";

export interface BankTransactionNotification {
  id: string;
  amountCents: number;
  date: string;
  note: string;
}

export interface CherryBankNotificationsModule {
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): void;
  getPendingTransactions(): BankTransactionNotification[];
  acknowledgeTransaction(id: string): void;
}

export default requireNativeModule<CherryBankNotificationsModule>("CherryBankNotifications");
