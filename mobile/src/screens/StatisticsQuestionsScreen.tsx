import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getWorkspaceCategories, getWorkspaceExpenses, Workspace, Expense } from "../api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { colors, fonts, radius, spacing } from "../theme";
import {
  displayISODate,
  parseISODate,
  StatisticsQuery,
  StatisticsReport,
  toISODate,
} from "../features/statistics/statistics";

interface Props {
  token: string;
  workspace: Workspace;
  initialQuery?: StatisticsQuery;
  onBack: () => void;
  onGenerate: (report: StatisticsReport) => void;
}

type PeriodChoice = "30 days" | "custom days" | "date range";
type CalendarTarget = "start" | "end";

function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function defaultRangeStart(): string {
  const start = todayDate();
  start.setDate(start.getDate() - 29);
  return toISODate(start);
}

export function StatisticsQuestionsScreen({ token, workspace, initialQuery, onBack, onGenerate }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>(() => {
    const isDefaultThirtyDays = initialQuery?.startDate === defaultRangeStart() && initialQuery?.endDate === toISODate(todayDate());
    return initialQuery && !isDefaultThirtyDays ? "date range" : "30 days";
  });
  const [customDays, setCustomDays] = useState("30");
  const [rangeStart, setRangeStart] = useState(() => initialQuery?.startDate ?? defaultRangeStart());
  const [rangeEnd, setRangeEnd] = useState(() => initialQuery?.endDate ?? toISODate(todayDate()));
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = todayDate();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [categoryMode, setCategoryMode] = useState<StatisticsQuery["categoryMode"]>(initialQuery?.categoryMode ?? "all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialQuery?.categories ?? []);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(initialQuery?.memberIds ?? workspace.memberIds);
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getWorkspaceExpenses(token, workspace.id), getWorkspaceCategories(token, workspace.id)])
      .then(([items, categoryItems]) => {
        if (!active) return;
        const options = [
          ...categoryItems,
          ...(items.some((expense) => !expense.category) && !categoryItems.includes("Uncategorized")
            ? ["Uncategorized"]
            : []),
        ];
        setExpenses(items);
        setCategories(options);
        setSelectedCategories((current) => current.filter((category) => options.includes(category)));
        setSelectedMemberIds((current) =>
          current.filter((memberId) => workspace.memberIds.includes(memberId)).length > 0
            ? current.filter((memberId) => workspace.memberIds.includes(memberId))
            : workspace.memberIds
        );
      })
      .catch((error: unknown) => {
        if (active) setLoadError((error as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, workspace.id, workspace.memberIds, reloadKey]);

  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const leadingDays = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7;
  const monthLabel = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function toggleCategory(category: string) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  }

  function chooseCategoryMode(mode: StatisticsQuery["categoryMode"]) {
    setCategoryMode(mode);
    if (mode === "include" && selectedCategories.length === 0) {
      setSelectedCategories(categories);
    }
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => {
      if (current.includes(memberId)) {
        return current.length > 1 ? current.filter((id) => id !== memberId) : current;
      }
      return [...current, memberId];
    });
  }

  function openCalendar(target: CalendarTarget) {
    const selected = parseISODate(target === "start" ? rangeStart : rangeEnd) ?? todayDate();
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setCalendarTarget(target);
  }

  function selectDate(value: string) {
    if (calendarTarget === "start") {
      setRangeStart(value);
      if (value > rangeEnd) setRangeEnd(value);
    } else if (calendarTarget === "end") {
      setRangeEnd(value);
      if (value < rangeStart) setRangeStart(value);
    }
    setCalendarTarget(null);
  }

  function submit() {
    setFormError(null);
    if (loading || loadError) return;
    if (workspace.memberIds.length > 1 && selectedMemberIds.length === 0) {
      setFormError("Choose at least one person.");
      return;
    }

    let startDate = defaultRangeStart();
    let endDate = toISODate(todayDate());
    if (periodChoice === "custom days") {
      const days = Number(customDays);
      if (!Number.isSafeInteger(days) || days < 1 || days > 36500) {
        setFormError("Enter a number of days between 1 and 36,500.");
        return;
      }
      const start = todayDate();
      start.setDate(start.getDate() - days + 1);
      startDate = toISODate(start);
    } else if (periodChoice === "date range") {
      if (!parseISODate(rangeStart) || !parseISODate(rangeEnd) || rangeStart > rangeEnd) {
        setFormError("Choose a valid start and end date.");
        return;
      }
      startDate = rangeStart;
      endDate = rangeEnd;
    }

    if (categoryMode === "include" && selectedCategories.length === 0) {
      setFormError("Choose at least one category, or select All categories.");
      return;
    }

    const query: StatisticsQuery = {
      startDate,
      endDate,
      categoryMode,
      categories: selectedCategories,
      memberIds: selectedMemberIds,
    };
    setGenerating(true);
    onGenerate({ query, expenses });
    setGenerating(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to workspace" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>WORKSPACE STATISTICS</Text>
          <Text style={styles.title}>Set up statistics</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.questionCard}>
          <Text style={styles.question}>For what time window?</Text>
          <View style={styles.choices}>
            {(["30 days", "custom days", "date range"] as PeriodChoice[]).map((choice) => {
              const selected = periodChoice === choice;
              const label = choice === "custom days" ? "Custom days" : choice === "date range" ? "Date range" : choice;
              return (
                <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setPeriodChoice(choice)} style={[styles.choice, selected && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {periodChoice === "custom days" ? (
            <View style={styles.daysRow}>
              <TextInput
                accessibilityLabel="Number of days from today"
                style={[styles.input, styles.daysInput]}
                value={customDays}
                onChangeText={setCustomDays}
                keyboardType="number-pad"
                maxLength={5}
              />
              <Text style={styles.muted}>days ending today</Text>
            </View>
          ) : null}
          {periodChoice === "date range" ? (
            <View style={styles.dateRow}>
              <Pressable accessibilityRole="button" onPress={() => openCalendar("start")} style={styles.dateButton}>
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>{displayISODate(rangeStart)}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => openCalendar("end")} style={styles.dateButton}>
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>{displayISODate(rangeEnd)}</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        <Card style={styles.questionCard}>
          <Text style={styles.question}>What categories?</Text>
          <View style={styles.choices}>
            {([
              ["all", "All categories"],
              ["include", "Only selected"],
            ] as const).map(([mode, label]) => {
              const selected = categoryMode === mode;
              return (
                <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => chooseCategoryMode(mode)} style={[styles.choice, selected && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {categoryMode !== "all" ? (
            <>
              <Text style={styles.helperText}>
                {categoryMode === "include" ? "Select the categories to include." : "Select categories to leave out."}
              </Text>
              {categories.length === 0 ? <Text style={styles.muted}>No categories are available yet.</Text> : null}
              <View style={styles.choices}>
                {categories.map((category) => {
                  const selected = selectedCategories.includes(category);
                  return (
                    <Pressable key={category} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleCategory(category)} style={[styles.choice, selected && styles.choiceSelected]}>
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{selected ? "✓ " : ""}{category}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Card>

        {workspace.memberIds.length > 1 ? (
          <Card style={styles.questionCard}>
            <Text style={styles.question}>Which people?</Text>
            <Text style={styles.helperText}>Expenses paid by or split with a selected person are counted once, at their full amount.</Text>
            <View style={styles.choices}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedMemberIds.length === workspace.memberIds.length }}
                onPress={() => setSelectedMemberIds(workspace.memberIds)}
                style={[styles.choice, selectedMemberIds.length === workspace.memberIds.length && styles.choiceSelected]}
              >
                <Text style={[styles.choiceText, selectedMemberIds.length === workspace.memberIds.length && styles.choiceTextSelected]}>Everyone</Text>
              </Pressable>
              {workspace.memberIds.map((memberId) => {
                const selected = selectedMemberIds.includes(memberId);
                return (
                  <Pressable key={memberId} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleMember(memberId)} style={[styles.choice, selected && styles.choiceSelected]}>
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{selected ? "✓ " : ""}{memberId}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Button
          label={loading ? "Loading expenses…" : generating ? "Generating…" : "Generate statistics"}
          onPress={submit}
          disabled={loading || Boolean(loadError) || generating}
          style={styles.generateButton}
        />
        {loadError ? (
          <Button
            label="Try again"
            variant="ghost"
            onPress={() => {
              setLoading(true);
              setLoadError(null);
              setReloadKey((key) => key + 1);
            }}
          />
        ) : null}
      </ScrollView>

      <Modal transparent visible={calendarTarget !== null} animationType="fade" onRequestClose={() => setCalendarTarget(null)}>
        <View style={styles.calendarOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setCalendarTarget(null)} />
          <View style={styles.calendarSheet}>
            <View style={styles.calendarHeader}>
              <Text style={styles.question}>Choose {calendarTarget === "start" ? "start" : "end"} date</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setCalendarTarget(null)} style={styles.calendarClose}>
                <Text style={styles.calendarCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.monthNavigation}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.dateValue}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthArrow}>
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
              {Array.from({ length: leadingDays }, (_, index) => <View key={`blank-${index}`} style={styles.calendarDay} />)}
              {Array.from({ length: monthDays }, (_, index) => {
                const day = index + 1;
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const value = toISODate(date);
                const selected = value === (calendarTarget === "start" ? rangeStart : rangeEnd);
                const future = value > toISODate(todayDate());
                return (
                  <Pressable key={day} disabled={future} accessibilityRole="button" accessibilityState={{ selected, disabled: future }} onPress={() => selectDate(value)} style={[styles.calendarDay, selected && styles.calendarDaySelected, future && styles.futureDay]}>
                    <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  questionCard: { gap: spacing.md },
  question: { color: colors.text, fontSize: 18, fontWeight: "700" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  choiceSelected: { backgroundColor: colors.darkAccent, borderColor: colors.primary },
  choiceText: { color: colors.textMuted, fontSize: 14 },
  choiceTextSelected: { color: colors.text, fontWeight: "700" },
  daysRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  daysInput: { width: 90 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  dateRow: { flexDirection: "row", gap: spacing.sm },
  dateButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  dateLabel: { color: colors.textMuted, fontSize: 12 },
  dateValue: { color: colors.text, fontSize: 15, fontWeight: "600" },
  helperText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.primary, fontSize: 14 },
  generateButton: { marginTop: spacing.xs },
  calendarOverlay: { flex: 1, justifyContent: "center", padding: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.7)" },
  calendarSheet: { backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calendarClose: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  calendarCloseText: { color: colors.text, fontSize: 26, lineHeight: 30 },
  monthNavigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthArrow: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  monthArrowText: { color: colors.text, fontSize: 27, lineHeight: 30 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: colors.textMuted, fontSize: 12, paddingVertical: spacing.sm },
  calendarDay: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  calendarDaySelected: { backgroundColor: colors.primary },
  calendarDayText: { color: colors.text, fontSize: 15 },
  calendarDayTextSelected: { color: colors.text, fontWeight: "700" },
  futureDay: { opacity: 0.3 },
});
