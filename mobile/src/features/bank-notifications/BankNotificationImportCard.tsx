import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { getMyWorkspaces, getWorkspaceExpenses } from "../../api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { colors, spacing } from "../../theme";
import { bankNotifications, nativeModuleAvailable } from "./native";
import { importNotificationExpense } from "./api";

interface Props {
  token: string;
  workspaceId: string;
  onExpensesChanged: () => void | Promise<void>;
}

export function BankNotificationImportCard({ token, workspaceId, onExpensesChanged }: Props) {
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const importingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const refreshAccess = () => setHasAccess(bankNotifications.hasAccess());
    refreshAccess();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAccess();
    });
    return () => subscription.remove();
  }, [workspaceId]);

  useEffect(() => {
    if (Platform.OS !== "android" || !hasAccess) return;
    let active = true;
    const importPending = async () => {
      if (importingRef.current) return;
      importingRef.current = true;
      setChecking(true);
      try {
        const pending = bankNotifications.getPending();
        if (pending.length === 0) {
          setSyncMessage(null);
          return;
        }
        const workspaces = await getMyWorkspaces(token);
        if (workspaces.length === 0) {
          setSyncMessage("Notification queued. Create a workspace to import it.");
          return;
        }
        let insertedInCurrentWorkspace = false;
        let importedCount = 0;
        for (const transaction of pending) {
          if (!active) break;
          try {
            for (const workspace of workspaces) {
              const inserted = await importNotificationExpense(token, workspace.id, {
                notificationId: transaction.id,
                amountCents: transaction.amountCents,
                date: transaction.date,
                note: transaction.note,
              });
              if (inserted) importedCount += 1;
              if (workspace.id === workspaceId && inserted) insertedInCurrentWorkspace = true;
            }
            bankNotifications.acknowledge(transaction.id);
          } catch {
            // Keep queued notifications; already imported workspaces dedupe retries.
            setSyncMessage("Could not reach the API. The notification is queued and will retry.");
            break;
          }
        }
        if (importedCount > 0) {
          setSyncMessage(`Added notification expense to ${importedCount} workspace${importedCount === 1 ? "" : "s"}.`);
        }
        if (active && insertedInCurrentWorkspace) await onExpensesChanged();
      } catch (err) {
        setSyncMessage(`Import failed: ${(err as Error).message}`);
      } finally {
        importingRef.current = false;
        if (active) setChecking(false);
      }
    };
    void importPending();
    const timer = setInterval(() => void importPending(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [hasAccess, onExpensesChanged, token, workspaceId]);

  if (Platform.OS !== "android") return null;
  return (
    <Card style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>Bank notifications</Text>
        <Text style={styles.subtitle}>
          {!nativeModuleAvailable
            ? "This app build does not include the Android notification module. Install Cherry’s development build; Expo Go is not supported."
            : hasAccess
              ? syncMessage ?? (checking ? "Checking for notifications…" : "Clear EUR debits will be added as Unknown expenses in all your workspaces.")
              : "Enable Android notification access to import clear EUR debits from bank apps."}
        </Text>
      </View>
      {nativeModuleAvailable && !hasAccess ? (
        <Button label="Enable" onPress={() => bankNotifications.openSettings()} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  text: { gap: spacing.xs },
  title: { color: colors.text, fontWeight: "700", fontSize: 16 },
  subtitle: { color: colors.textMuted, fontSize: 14 },
});
