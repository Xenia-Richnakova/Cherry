import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMyWorkspaces, Workspace } from "../api";
import { Button } from "../components/Button";
import { colors, fonts, radius, spacing } from "../theme";

interface Props {
  token: string;
  onSelect: (workspace: Workspace) => void;
  onCreate: () => void;
}

export function WorkspacesScreen({ token, onSelect, onCreate }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMyWorkspaces(token)
      .then((items) => {
        if (active) {
          setWorkspaces(items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CHERRY</Text>
      <Text style={styles.title}>Your workspaces</Text>
      <Text style={styles.subtitle}>Choose a shared space to continue.</Text>

      {loading ? <Text style={styles.message}>Loading your workspaces…</Text> : null}
      {error ? (
        <View style={styles.messageBlock}>
          <Text style={styles.error}>{error}</Text>
          <Button label="Try again" variant="ghost" onPress={() => setReloadKey((key) => key + 1)} />
        </View>
      ) : null}
      {!loading && !error && workspaces.length === 0 ? (
        <View style={styles.messageBlock}>
          <Text style={styles.emptyTitle}>No workspaces yet</Text>
          <Text style={styles.message}>Create one to start sharing expenses.</Text>
        </View>
      ) : null}

      {workspaces.map((workspace) => (
        <Pressable
          key={workspace.id}
          accessibilityRole="button"
          onPress={() => onSelect(workspace)}
          style={({ pressed }) => [styles.workspace, pressed && styles.workspacePressed]}
        >
          <View style={styles.workspaceTop}>
            <Text style={styles.workspaceName}>{workspace.name}</Text>
            <Text style={styles.arrow}>›</Text>
          </View>
          <Text style={styles.members}>
            {workspace.memberIds.length} {workspace.memberIds.length === 1 ? "member" : "members"}
            {workspace.memberIds.length > 0 ? ` · ${workspace.memberIds.join(", ")}` : ""}
          </Text>
        </Pressable>
      ))}

      <Button label="Create workspace" onPress={onCreate} style={styles.createButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.sm },
  messageBlock: { gap: spacing.sm, paddingVertical: spacing.lg },
  message: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  error: { color: colors.primary, fontSize: 14 },
  workspace: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  workspacePressed: { borderColor: colors.primary, opacity: 0.85 },
  workspaceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  workspaceName: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "700" },
  arrow: { color: colors.primary, fontSize: 28, lineHeight: 30 },
  members: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  createButton: { marginTop: spacing.sm },
});
