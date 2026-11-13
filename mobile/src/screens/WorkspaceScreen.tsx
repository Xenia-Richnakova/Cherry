import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  addWorkspaceExpense,
  createWorkspaceCategory,
  deleteWorkspaceExpense,
  Expense,
  getWorkspaceCategories,
  getWorkspaceExpenses,
  updateWorkspaceExpense,
  Workspace,
} from "../api";
import { BankNotificationImportCard } from "../features/bank-notifications/BankNotificationImportCard";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { colors, fonts, radius, spacing } from "../theme";

interface Props {
  token: string;
  workspace: Workspace;
  onBackToWorkspaces: () => void;
}

type DateWindow = "7 days" | "30 days" | "3 months" | "1 year";
const DATE_WINDOWS: DateWindow[] = ["7 days", "30 days", "3 months", "1 year"];

function todayAsISODate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value?: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function subtractMonths(date: Date, months: number): Date {
  const firstOfTargetMonth = new Date(date.getFullYear(), date.getMonth() - months, 1);
  const lastDay = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate();
  return new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth(),
    Math.min(date.getDate(), lastDay)
  );
}

function isInDateWindow(value: string | undefined, window: DateWindow): boolean {
  const expenseDate = parseDateOnly(value ?? todayAsISODate());
  const today = parseDateOnly(todayAsISODate());
  if (!expenseDate || !today || expenseDate > today) return false;

  const start = new Date(today);
  if (window === "7 days") start.setDate(start.getDate() - 6);
  else if (window === "30 days") start.setDate(start.getDate() - 29);
  else if (window === "3 months") return expenseDate >= subtractMonths(today, 3);
  else return expenseDate >= subtractMonths(today, 12);
  return expenseDate >= start;
}

function displayExpenseDate(value?: string): string {
  const date = parseDateOnly(value);
  return date
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "Date unavailable";
}

function parseAmount(value: string): number | null {
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function formatAmount(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

export function WorkspaceScreen({ token, workspace, onBackToWorkspaces }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayAsISODate());
  const [note, setNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [payerId, setPayerId] = useState(workspace.memberIds[0] ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(workspace.memberIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateWindow, setDateWindow] = useState<DateWindow>("30 days");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [noteSearch, setNoteSearch] = useState("");

  const reloadExpenses = useCallback(async () => {
    setExpenses(await getWorkspaceExpenses(token, workspace.id));
  }, [token, workspace.id]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getWorkspaceExpenses(token, workspace.id)
        .then((items) => {
          if (active) {
            setExpenses(items);
            setLoadError(null);
          }
        })
        .catch((err: unknown) => {
          if (active) setLoadError((err as Error).message);
        }),
      getWorkspaceCategories(token, workspace.id)
        .then((categoryItems) => {
          if (active) {
            setCategories(categoryItems);
            setSelectedCategory((current) => current || categoryItems[0] || "");
            setCategoryError(null);
          }
        })
        .catch((err: unknown) => {
          if (active) setCategoryError(`Could not load categories: ${(err as Error).message}`);
        }),
    ])
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, workspace.id]);

  const filteredExpenses = expenses.filter((expense) => {
    if (!isInDateWindow(expense.date, dateWindow)) return false;
    const expenseCategory = expense.category || "Uncategorized";
    if (categoryFilter !== "All categories" && expenseCategory !== categoryFilter) return false;
    const search = noteSearch.trim().toLowerCase();
    if (search && !(expense.note || expense.description || "").toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
  const categoryFilterOptions = [
    "All categories",
    ...categories,
    ...(expenses.some((expense) => !expense.category) && !categories.includes("Uncategorized")
      ? ["Uncategorized"]
      : []),
  ];
  const hasActiveFilters =
    dateWindow !== "30 days" || categoryFilter !== "All categories" || noteSearch.trim() !== "";
  const calendarDays = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate();
  const calendarLeadingDays = (new Date(
    calendarMonth.getFullYear(), calendarMonth.getMonth(), 1
  ).getDay() + 6) % 7;
  const monthLabel = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  function startNewExpense() {
    setEditingExpense(null);
    setAmount("");
    setExpenseDate(todayAsISODate());
    setNote("");
    setFormError(null);
    setShowForm(true);
  }

  function startEditingExpense(expense: Expense) {
    setEditingExpense(expense);
    setSelectedCategory(expense.category || categories[0] || "");
    setAmount(formatAmount(expense.amountCents));
    setExpenseDate(expense.date || todayAsISODate());
    setNote(expense.note || expense.description || "");
    setPayerId(expense.payerId);
    setParticipantIds(expense.participantIds);
    setFormError(null);
    setShowForm(true);
  }

  function closeExpenseForm() {
    setShowForm(false);
    setEditingExpense(null);
    setFormError(null);
  }

  async function deleteCurrentExpense() {
    if (!editingExpense) return;
    setDeleting(true);
    setFormError(null);
    try {
      await deleteWorkspaceExpense(token, workspace.id, editingExpense.id);
      setExpenses((current) => current.filter((expense) => expense.id !== editingExpense.id));
      closeExpenseForm();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteExpense() {
    Alert.alert("Delete expense?", "This expense will be removed from the workspace.", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: () => void deleteCurrentExpense() },
    ]);
  }

  async function submitExpense() {
    setFormError(null);
    const isEditing = editingExpense !== null;
    const isBankExpense = Boolean(editingExpense?.sourceNotificationId);
    const amountCents = parseAmount(amount);
    if (!selectedCategory) {
      setFormError("Choose a category for this expense.");
      return;
    }
    if ((!isEditing || !isBankExpense) && !parseDateOnly(expenseDate)) {
      setFormError("Enter a valid date in YYYY-MM-DD format.");
      return;
    }
    if ((!isEditing || !isBankExpense) && amountCents === null) {
      setFormError("Enter an amount greater than 0 with up to 2 decimal places.");
      return;
    }
    if (!isEditing && !payerId) {
      setFormError("Choose who paid.");
      return;
    }
    if (!isEditing && participantIds.length === 0) {
      setFormError("Choose at least one person to split this expense with.");
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        const updated = await updateWorkspaceExpense(token, workspace.id, editingExpense.id, {
          category: selectedCategory,
          note: note.trim() || undefined,
          ...(!isBankExpense ? { amountCents: amountCents as number, date: expenseDate } : {}),
        });
        setExpenses((current) => current.map((item) => item.id === updated.id ? updated : item));
        closeExpenseForm();
      } else {
        const expense = await addWorkspaceExpense(token, workspace.id, {
          category: selectedCategory,
          date: expenseDate,
          note: note.trim() || undefined,
          amountCents: amountCents as number,
          payerId,
          participantIds,
        });
        setExpenses((current) => [...current, expense]);
        setAmount("");
        setExpenseDate(todayAsISODate());
        setNote("");
        setShowForm(false);
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory() {
    setCategoryError(null);
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCategoryError("Enter a category name.");
      return;
    }
    if (trimmedName.length > 40) {
      setCategoryError("Category names can be up to 40 characters.");
      return;
    }
    const existing = categories.find(
      (category) => category.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      setSelectedCategory(existing);
      setCategoryError(`“${existing}” is already in the list and has been selected.`);
      return;
    }

    setCategorySaving(true);
    try {
      const added = await createWorkspaceCategory(token, workspace.id, trimmedName);
      setCategories((current) => [...current, added]);
      setSelectedCategory(added);
      setNewCategoryName("");
    } catch (err) {
      setCategoryError((err as Error).message);
    } finally {
      setCategorySaving(false);
    }
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.eyebrow}>WORKSPACE</Text>
      <Text style={styles.title}>{workspace.name}</Text>
      <Text style={styles.subtitle}>Members: {workspace.memberIds.join(", ")}</Text>

      <BankNotificationImportCard
        token={token}
        workspaceId={workspace.id}
        onExpensesChanged={reloadExpenses}
      />

      <View style={styles.topActions}>
        <Button
          label="Add expense"
          onPress={startNewExpense}
          style={styles.topAddButton}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to all workspaces"
          onPress={onBackToWorkspaces}
          style={styles.backToWorkspacesButton}
        >
          <Text style={styles.backToWorkspacesIcon}>←</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <View style={styles.expenseTitleRow}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <Text style={styles.count}>{filteredExpenses.length}</Text>
        </View>
        <View style={styles.sectionActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectMode ? "Exit expense selection" : "Select an expense"}
            accessibilityState={{ selected: selectMode }}
            onPress={() => setSelectMode((current) => !current)}
            style={[styles.selectButton, selectMode && styles.selectButtonActive]}
          >
            <Text style={[styles.selectButtonText, selectMode && styles.selectButtonTextActive]}>
              {selectMode ? "Done" : "Select"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasActiveFilters ? "Filters, active" : "Filters"}
            onPress={() => setShowFilters(true)}
            style={styles.filterButton}
          >
            <View style={styles.filterIcon}>
              <View style={[styles.filterLine, styles.filterLineLong]} />
              <View style={[styles.filterLine, styles.filterLineMedium]} />
              <View style={[styles.filterLine, styles.filterLineShort]} />
              <View style={styles.filterStem} />
            </View>
            {hasActiveFilters ? <View style={styles.activeFilterDot} /> : null}
          </Pressable>
        </View>
      </View>

      {selectMode ? <Text style={styles.selectionHint}>Tap an expense to edit or delete it.</Text> : null}

      {loading ? <Text style={styles.muted}>Loading expenses…</Text> : null}
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {!loading && !loadError && expenses.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.muted}>Add the first shared expense to get started.</Text>
        </Card>
      ) : null}

      {!loading && !loadError && expenses.length > 0 && filteredExpenses.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No matching expenses</Text>
          <Text style={styles.muted}>Try a different time window or filter.</Text>
        </Card>
      ) : null}

      {[...filteredExpenses].reverse().map((expense) => (
        <Pressable
          key={expense.id}
          disabled={!selectMode}
          accessibilityRole={selectMode ? "button" : undefined}
          accessibilityLabel={selectMode ? `Edit expense ${expense.category || expense.description || "Uncategorized"}` : undefined}
          onPress={() => startEditingExpense(expense)}
          style={({ pressed }) => [pressed && selectMode && styles.expensePressed]}
        >
          <Card style={styles.expenseCard}>
            <View style={styles.expenseTop}>
              <Text style={styles.expenseName}>
                {expense.category || expense.description || "Uncategorized"}
              </Text>
              <Text style={styles.expenseAmount}>{formatAmount(expense.amountCents)}</Text>
            </View>
            <Text style={styles.muted}>
              {displayExpenseDate(expense.date)} · Paid by {expense.payerId} · Split with {expense.participantIds.join(", ")}
            </Text>
            {expense.note || expense.description ? (
              <Text style={styles.note}>{expense.note || expense.description}</Text>
            ) : null}
            {selectMode ? <Text style={styles.editHint}>Tap to edit or delete</Text> : null}
          </Card>
        </Pressable>
      ))}

      {showForm && (
        <Modal
          visible={showForm}
          animationType="slide"
          onRequestClose={closeExpenseForm}
        >
          <View style={styles.formScreen}>
            <View style={styles.formScreenHeader}>
              <Text style={styles.sheetTitle}>{editingExpense ? "Edit expense" : "New expense"}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close expense form"
                onPress={closeExpenseForm}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.formScreenContent}
              keyboardShouldPersistTaps="handled"
            >
        <Card style={styles.formCard}>

          <Text style={styles.label}>Category</Text>
          <View style={styles.choices}>
            {categories.map((category) => {
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.choice, selected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {categories.length === 0 ? <Text style={styles.hint}>Loading categories…</Text> : null}

          <View style={styles.addCategoryRow}>
            <TextInput
              style={[styles.input, styles.categoryInput]}
              placeholder="New category"
              placeholderTextColor={colors.textMuted}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              maxLength={40}
              returnKeyType="done"
            />
            <Button
              label={categorySaving ? "Adding…" : "Add"}
              variant="ghost"
              onPress={submitCategory}
              disabled={categorySaving || saving}
              style={styles.addCategoryButton}
            />
          </View>
          {categoryError ? <Text style={styles.hint}>{categoryError}</Text> : null}

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={[styles.input, editingExpense?.sourceNotificationId && styles.inputDisabled]}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={!editingExpense?.sourceNotificationId}
          />
          <Text style={styles.hint}>
            {editingExpense?.sourceNotificationId
              ? "Bank notification amounts cannot be edited."
              : "Enter a positive amount with up to 2 decimal places."}
          </Text>

          <View style={styles.optionalFieldsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(editingExpense?.sourceNotificationId) }}
              disabled={Boolean(editingExpense?.sourceNotificationId)}
              onPress={() => {
                const selected = parseDateOnly(expenseDate) ?? new Date();
                setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
                setShowDatePicker(true);
              }}
              style={[styles.optionalFieldButton, editingExpense?.sourceNotificationId && styles.inputDisabled]}
            >
              <Text style={styles.optionalFieldLabel}>Date</Text>
              <Text style={styles.optionalFieldValue}>{displayExpenseDate(expenseDate)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowNoteEditor(true)}
              style={styles.optionalFieldButton}
            >
              <Text style={styles.optionalFieldLabel}>Note</Text>
              <Text style={styles.optionalFieldValue} numberOfLines={1}>
                {note.trim() || "Add note"}
              </Text>
            </Pressable>
          </View>

          {!editingExpense ? <>
          <Text style={styles.label}>Who paid?</Text>
          <View style={styles.choices}>
            {workspace.memberIds.map((memberId) => {
              const selected = payerId === memberId;
              return (
                <Pressable
                  key={memberId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPayerId(memberId)}
                  style={[styles.choice, selected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {memberId}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Split equally with</Text>
          <View style={styles.choices}>
            {workspace.memberIds.map((memberId) => {
              const selected = participantIds.includes(memberId);
              return (
                <Pressable
                  key={memberId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleParticipant(memberId)}
                  style={[styles.choice, selected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {selected ? "✓ " : ""}{memberId}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          </> : null}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <View style={styles.formButtons}>
            {editingExpense ? (
              <>
                <Button
                  label={saving ? "Saving…" : "Save changes"}
                  onPress={submitExpense}
                  disabled={saving || deleting}
                  style={styles.formActionButton}
                />

                <Button
                  label={deleting ? "Deleting…" : "Delete"}
                  variant="ghost"
                  onPress={confirmDeleteExpense}
                  disabled={saving || deleting}
                  style={styles.formActionButton}
                />

              </>
            ) : (
              <>
                <Button
                  label={saving ? "Saving…" : "Save expense"}
                  onPress={submitExpense}
                  disabled={saving || deleting}
                  style={styles.formActionButton}
                />

              </>
            )}
          </View>
        </Card>
            </ScrollView>
            {showDatePicker ? (
              <View style={styles.entryOverlay}>
                <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)} />
                <View style={styles.entrySheet}>
                  <View style={styles.calendarHeader}>
                    <Text style={styles.sheetTitle}>Choose date</Text>
                    <Pressable onPress={() => setShowDatePicker(false)} style={styles.closeButton}>
                      <Text style={styles.closeText}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.monthNavigation}>
                    <Pressable onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthArrow}>
                      <Text style={styles.monthArrowText}>‹</Text>
                    </Pressable>
                    <Text style={styles.monthTitle}>{monthLabel}</Text>
                    <Pressable onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthArrow}>
                      <Text style={styles.monthArrowText}>›</Text>
                    </Pressable>
                  </View>
                  <View style={styles.calendarGrid}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <Text key={day} style={styles.weekday}>{day}</Text>
                    ))}
                    {Array.from({ length: calendarLeadingDays }, (_, index) => (
                      <View key={`blank-${index}`} style={styles.calendarDay} />
                    ))}
                    {Array.from({ length: calendarDays }, (_, index) => {
                      const day = index + 1;
                      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                      const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const selected = dateValue === expenseDate;
                      return (
                        <Pressable key={day} onPress={() => { setExpenseDate(dateValue); setShowDatePicker(false); }} style={[styles.calendarDay, selected && styles.calendarDaySelected]}>
                          <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected]}>{day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Button label="Today" variant="ghost" onPress={() => { setExpenseDate(todayAsISODate()); setCalendarMonth(new Date()); setShowDatePicker(false); }} />
                </View>
              </View>
            ) : null}
            {showNoteEditor ? (
              <View style={styles.entryOverlay}>
                <Pressable style={styles.modalBackdrop} onPress={() => setShowNoteEditor(false)} />
                <View style={styles.entrySheet}>
                  <View style={styles.calendarHeader}>
                    <Text style={styles.sheetTitle}>Expense note</Text>
                    <Pressable onPress={() => setShowNoteEditor(false)} style={styles.closeButton}>
                      <Text style={styles.closeText}>×</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, styles.noteInput]}
                    placeholder="Add a note (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={note}
                    onChangeText={setNote}
                    maxLength={500}
                    multiline
                    autoFocus
                  />
                  <Button label="Done" onPress={() => setShowNoteEditor(false)} />
                </View>
              </View>
            ) : null}
          </View>
        </Modal>
      )}

      </ScrollView>

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            style={styles.modalBackdrop}
            onPress={() => setShowFilters(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <View>
                <Text style={styles.sheetTitle}>Filter expenses</Text>
                <Text style={styles.sheetSubtitle}>{filteredExpenses.length} matching</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setShowFilters(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.filterBody}
              contentContainerStyle={styles.filterContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Time window</Text>
              <View style={styles.choices}>
                {DATE_WINDOWS.map((window) => {
                  const selected = dateWindow === window;
                  return (
                    <Pressable
                      key={window}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setDateWindow(window)}
                      style={[styles.choice, selected && styles.choiceSelected]}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                        {window}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Filter by category</Text>
              <View style={styles.choices}>
                {categoryFilterOptions.map((category) => {
                  const selected = categoryFilter === category;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setCategoryFilter(category)}
                      style={[styles.choice, selected && styles.choiceSelected]}
                    >
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Search notes</Text>
              <TextInput
                style={styles.input}
                placeholder="Type any part of a note"
                placeholderTextColor={colors.textMuted}
                value={noteSearch}
                onChangeText={setNoteSearch}
                autoCapitalize="none"
              />
            </ScrollView>

            <View style={styles.filterFooter}>
              <Button
                label="Reset"
                variant="ghost"
                onPress={() => {
                  setDateWindow("30 days");
                  setCategoryFilter("All categories");
                  setNoteSearch("");
                }}
                style={styles.footerButton}
              />
              <Button
                label="Done"
                onPress={() => setShowFilters(false)}
                style={styles.footerButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.sm },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  expenseTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  count: {
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: "hidden",
  },
  filterButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  selectButton: {
    minWidth: 72,
    height: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  selectButtonActive: { borderColor: colors.primary, backgroundColor: colors.darkAccent },
  selectButtonText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  selectButtonTextActive: { color: colors.text },
  selectionHint: { color: colors.textMuted, fontSize: 13, marginTop: -spacing.xs },
  expensePressed: { opacity: 0.75 },
  editHint: { color: colors.primary, fontSize: 12, marginTop: spacing.xs },
  filterIcon: { width: 22, height: 23, alignItems: "center", justifyContent: "center", gap: 3 },
  filterLine: { height: 2, borderRadius: 1, backgroundColor: colors.text },
  filterLineLong: { width: 20 },
  filterLineMedium: { width: 14 },
  filterLineShort: { width: 8 },
  filterStem: { width: 2, height: 5, borderRadius: 1, backgroundColor: colors.text },
  activeFilterDot: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  filterSheet: {
    maxHeight: "88%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.md,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sheetTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 23 },
  sheetSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  closeText: { color: colors.text, fontSize: 28, lineHeight: 30 },
  filterBody: { flexShrink: 1 },
  filterContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  filterFooter: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButton: { flex: 1 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: spacing.xs },
  expenseCard: { padding: spacing.md, gap: spacing.xs },
  expenseTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  expenseName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" },
  expenseAmount: { color: colors.text, fontSize: 16, fontWeight: "700" },
  note: { color: colors.text, fontSize: 14, lineHeight: 20 },
  topActions: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.sm },
  topAddButton: { flex: 1, minWidth: 0, paddingVertical: spacing.md },
  backToWorkspacesButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  backToWorkspacesIcon: { color: colors.primary, fontSize: 30, lineHeight: 34, fontWeight: "900" },
  optionalFieldsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  optionalFieldButton: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  optionalFieldLabel: { color: colors.textMuted, fontSize: 12 },
  optionalFieldValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  formCard: { gap: spacing.sm, marginTop: spacing.sm },
  formScreen: { flex: 1, backgroundColor: colors.background },
  formScreenHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formScreenContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  label: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputDisabled: { opacity: 0.5 },
  hint: { color: colors.textMuted, fontSize: 12 },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  entrySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  entryOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    justifyContent: "flex-end",
  },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthNavigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrowText: { color: colors.text, fontSize: 28, lineHeight: 32 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", color: colors.textMuted, fontSize: 12, paddingVertical: spacing.sm },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  calendarDaySelected: { backgroundColor: colors.primary },
  calendarDayText: { color: colors.text, fontSize: 15 },
  calendarDayTextSelected: { fontWeight: "700" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  addCategoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  categoryInput: { flex: 1 },
  addCategoryButton: { minWidth: 84 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  choiceSelected: { backgroundColor: colors.darkAccent, borderColor: colors.primary },
  choiceText: { color: colors.textMuted, fontSize: 14 },
  choiceTextSelected: { color: colors.text, fontWeight: "700" },
  error: { color: colors.primary, fontSize: 14, marginTop: spacing.xs },
  formButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  formActionButton: { flex: 1, minWidth: 0 },
  anotherButton: { marginTop: spacing.md },
});
