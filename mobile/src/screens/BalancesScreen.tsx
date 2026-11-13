// mobile/src/screens/BalancesScreen.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

// Sample data until the screen is connected to the API.
const sampleBalances = [
  { memberId: "anna", balanceCents: 2000 },
  { memberId: "ben", balanceCents: -1000 },
  { memberId: "cara", balanceCents: -1000 },
];

function formatAmount(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function BalancesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trip to Lisbon</Text>
      <Text style={styles.subtitle}>Who owes whom</Text>

      {sampleBalances.map((b) => {
        const owed = b.balanceCents > 0;
        const settled = b.balanceCents === 0;
        const amountColor = settled ? colors.textMuted : owed ? colors.positive : colors.primary;
        return (
          <Card key={b.memberId} style={styles.row}>
            <Text style={styles.name}>{b.memberId}</Text>
            <Text style={[styles.amount, { color: amountColor }]}>
              {formatAmount(b.balanceCents)}
            </Text>
          </Card>
        );
      })}

      <Button label="Settle up" onPress={() => {}} style={styles.cta} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  name: {
    fontSize: 17,
    color: colors.text,
    textTransform: "capitalize",
  },
  amount: {
    fontSize: 17,
    fontWeight: "700",
  },
  cta: {
    marginTop: spacing.lg,
  },
});