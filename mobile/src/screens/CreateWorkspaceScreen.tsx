// mobile/src/screens/CreateWorkspaceScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView } from "react-native";
import { colors, fonts, spacing, radius } from "../theme";
import { Button } from "../components/Button";
import { createWorkspace, Workspace } from "../api";

interface Props {
  token: string;
  onCreated: (workspace: Workspace) => void;
  onCancel: () => void;
}

export function CreateWorkspaceScreen({ token, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [membersText, setMembersText] = useState("");
  const [yourMemberId, setYourMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split "anna, ben, cara" into trimmed, non-empty names.
  const memberIds = membersText
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  async function submit() {
    setError(null);

    if (name.trim().length === 0) {
      setError("Give the workspace a name.");
      return;
    }
    if (memberIds.length === 0) {
      setError("Add at least one member name, separated by commas.");
      return;
    }
    if (!memberIds.includes(yourMemberId.trim())) {
      setError(`"Which one are you?" must exactly match one of: ${memberIds.join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      const workspace = await createWorkspace(token, name.trim(), memberIds, yourMemberId.trim());
      onCreated(workspace);
    } catch (err) {
      const message = (err as Error).message;
      console.log("createWorkspace failed:", message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New workspace</Text>
      <Text style={styles.subtitle}>A trip, household or event you share costs for</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Trip to Lisbon"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Members (separated by commas)</Text>
      <TextInput
        style={styles.input}
        placeholder="anna, ben, cara"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        value={membersText}
        onChangeText={setMembersText}
      />

      <Text style={styles.label}>Which one are you?</Text>
      <TextInput
        style={styles.input}
        placeholder="anna"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        value={yourMemberId}
        onChangeText={setYourMemberId}
      />

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <Button
        label={busy ? "Creating…" : "Create workspace"}
        onPress={submit}
        disabled={busy}
        style={styles.cta}
      />
      <Button label="Back to workspaces" variant="ghost" onPress={onCancel} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.md },
  label: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  error: { color: colors.primary, fontSize: 15, marginTop: spacing.sm },
  cta: { marginTop: spacing.lg },
});
