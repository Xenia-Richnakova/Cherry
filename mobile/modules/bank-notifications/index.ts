import { requireNativeModule } from "expo-modules-core";

export interface BankTransactionNotification {
  id: string;
  workspaceId: string;
  amountCents: number;
  date: string;
  note: string;
}

export interface CherryBankNotificationsModule {
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): void;
  setActiveWorkspace(workspaceId: string | null): void;
  getPendingTransactions(workspaceId: string): BankTransactionNotification[];
  acknowledgeTransaction(id: string): void;
}

export default requireNativeModule<CherryBankNotificationsModule>("CherryBankNotifications");
