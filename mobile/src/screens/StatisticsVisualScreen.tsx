import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Expense, Workspace } from "../api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { colors, fonts, radius, spacing } from "../theme";
import {
  displayISODate,
  filterStatisticsExpenses,
  formatCents,
  StatisticsReport,
} from "../features/statistics/statistics";

interface Props {
  workspace: Workspace;
  report: StatisticsReport;
  onBack: () => void;
  onClose: () => void;
}

function categoryColor(index: number): string {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 68%, 56%)`;
}

type CategoryTotal = { category: string; cents: number; color: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatList(expenses: Expense[]): string {
  return expenses
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .map((expense) => {
      const row = [
        `<td>${escapeHtml(displayISODate(expense.date ?? ""))}</td>`,
        `<td>${escapeHtml(expense.category || "Uncategorized")}</td>`,
        `<td>${escapeHtml(formatCents(expense.amountCents))}</td>`,
        `<td>${escapeHtml(expense.payerId)}</td>`,
        `<td>${escapeHtml(expense.participantIds.join(", "))}</td>`,
        `<td>${escapeHtml(expense.note || expense.description || "")}</td>`,
      ].join("");
      return `<tr>${row}</tr>`;
    })
    .join("");
}

export function StatisticsVisualScreen({ workspace, report, onBack, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const expenses = useMemo(
    () => filterStatisticsExpenses(report.expenses, report.query),
    [report]
  );
  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const category = expense.category || "Uncategorized";
      totals.set(category, (totals.get(category) ?? 0) + expense.amountCents);
    }
    return Array.from(totals.entries())
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category))
      .map((item, index) => ({ ...item, color: categoryColor(index) }));
  }, [expenses]);
  const totalCents = categoryTotals.reduce((total, item) => total + item.cents, 0);
  const titleRange = `${displayISODate(report.query.startDate)} – ${displayISODate(report.query.endDate)}`;
  const memberSummary = report.query.memberIds.length === workspace.memberIds.length
    ? "Everyone"
    : report.query.memberIds.join(", ");

  const slices = useMemo(() => {
    if (totalCents <= 0) return [];
    const center = 120;
    const radiusValue = 106;
    let angle = -90;
    return categoryTotals.map((item) => {
      const sweep = (item.cents / totalCents) * 360;
      if (sweep >= 359.999) {
        angle += sweep;
        return { ...item, path: "", fullCircle: true };
      }
      const start = (angle * Math.PI) / 180;
      const end = ((angle + sweep) * Math.PI) / 180;
      const startX = center + radiusValue * Math.cos(start);
      const startY = center + radiusValue * Math.sin(start);
      const endX = center + radiusValue * Math.cos(end);
      const endY = center + radiusValue * Math.sin(end);
      const largeArc = sweep > 180 ? 1 : 0;
      const path = `M ${center} ${center} L ${startX} ${startY} A ${radiusValue} ${radiusValue} 0 ${largeArc} 1 ${endX} ${endY} Z`;
      angle += sweep;
      return { ...item, path, fullCircle: false };
    });
  }, [categoryTotals, totalCents]);

  async function downloadExpenseList() {
    setExporting(true);
    try {
      const rows = formatList(expenses);
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, sans-serif; color: #251d1f; }
  h1 { margin: 0 0 6px; color: #a90f34; font-size: 22px; }
  .meta { color: #65595c; font-size: 12px; margin-bottom: 20px; line-height: 1.6; }
  .total { font-size: 16px; font-weight: bold; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f4e9ec; }
  th, td { padding: 8px 6px; border-bottom: 1px solid #ded4d6; vertical-align: top; }
  td:nth-child(3), th:nth-child(3) { text-align: right; white-space: nowrap; }
</style></head><body>
  <h1>${escapeHtml(workspace.name)} — expense list</h1>
  <div class="meta">${escapeHtml(titleRange)}<br>People: ${escapeHtml(memberSummary)}<br>Matching expenses: ${expenses.length}</div>
  <p class="total">Total: ${escapeHtml(formatCents(totalCents))}</p>
  <table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Paid by</th><th>Split with</th><th>Note</th></tr></thead>
  <tbody>${rows || `<tr><td colspan="6">No expenses match these answers.</td></tr>`}</tbody></table>
</body></html>`;

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("PDF created", `The PDF is saved in the app's temporary files: ${file.uri}`);
        return;
      }
      await Sharing.shareAsync(file.uri, {
        dialogTitle: "Download list of expenses",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert("Could not create PDF", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change statistics answers" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>WORKSPACE STATISTICS</Text>
          <Text style={styles.title}>Spending</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to workspace" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.workspaceName}>{workspace.name}</Text>
        <Text style={styles.subtitle}>{titleRange} · {memberSummary}</Text>
        <Card style={styles.summaryCard}>
          <Text style={styles.totalLabel}>Total spending</Text>
          <Text style={styles.totalAmount}>{formatCents(totalCents)}</Text>
          <Text style={styles.subtitle}>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</Text>
        </Card>

        {categoryTotals.length > 0 ? (
          <Card style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Spending by category</Text>
            <View style={styles.chartWrap}>
              <Svg width="100%" height={250} viewBox="0 0 240 240" accessibilityLabel="Pie chart of spending by category">
                {slices.map((slice) => slice.fullCircle
                  ? <Circle key={slice.category} cx={120} cy={120} r={106} fill={slice.color} />
                  : <Path key={slice.category} d={slice.path} fill={slice.color} />
                )}
              </Svg>
            </View>
            <View style={styles.legend}>
              {categoryTotals.map((item) => (
                <View key={item.category} style={styles.legendRow}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                    <Text style={styles.legendName}>{item.category}</Text>
                  </View>
                  <Text style={styles.legendAmount}>{formatCents(item.cents)} · {totalCents > 0 ? ((item.cents / totalCents) * 100).toFixed(1) : "0.0"}%</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>No expenses in this selection</Text>
            <Text style={styles.subtitle}>Try a wider time window or different categories and people.</Text>
          </Card>
        )}

        <Button
          label={exporting ? "Preparing PDF…" : "Download list of expenses"}
          onPress={downloadExpenseList}
          disabled={exporting}
          style={styles.downloadButton}
        />
        <Button label="Change answers" variant="ghost" onPress={onBack} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  backIcon: { color: colors.primary, fontSize: 28, fontWeight: "900", lineHeight: 32 },
  headingText: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 25 },
  closeButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.text, fontSize: 27, lineHeight: 30 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  workspaceName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  summaryCard: { gap: spacing.xs },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalAmount: { color: colors.text, fontFamily: fonts.display, fontSize: 34, fontWeight: "700" },
  chartCard: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  chartWrap: { width: "100%", alignItems: "center", justifyContent: "center" },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  legendLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendSwatch: { width: 14, height: 14, borderRadius: 4 },
  legendName: { color: colors.text, flexShrink: 1, fontSize: 14 },
  legendAmount: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  emptyCard: { gap: spacing.sm },
  downloadButton: { marginTop: spacing.xs },
});
