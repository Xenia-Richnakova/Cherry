import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { getWorkspaceExpenses } from "../../api";
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
  const importingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    bankNotifications.setActiveWorkspace(workspaceId);
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
        const pending = bankNotifications.getPending(workspaceId);
        let insertedAny = false;
        for (const transaction of pending) {
          if (!active) break;
          try {
            const inserted = await importNotificationExpense(token, workspaceId, {
              notificationId: transaction.id,
              amountCents: transaction.amountCents,
              date: transaction.date,
              note: transaction.note,
            });
            insertedAny ||= inserted;
            bankNotifications.acknowledge(transaction.id);
          } catch {
            // Leave queued notifications in place so the API request can retry.
            break;
          }
        }
        if (active && insertedAny) await onExpensesChanged();
      } catch {
        // The workspace remains usable when the API is temporarily offline.
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
        <Text style={styles.title}>Tatra banka notifications</Text>
        <Text style={styles.subtitle}>
          {!nativeModuleAvailable
            ? "This app build does not include the Android notification module. Install Cherry’s development build; Expo Go is not supported."
            : hasAccess
              ? checking ? "Checking for transactions…" : "Clear card payments will be added as Unknown expenses."
              : "Enable Android notification access to import clear card payments."}
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
