// mobile/App.tsx
import React, { useState } from "react";
import { SafeAreaView, StatusBar, View, Text, StyleSheet } from "react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { CreateWorkspaceScreen } from "./src/screens/CreateWorkspaceScreen";
import { colors, fonts, spacing } from "./src/theme";
import { Button } from "./src/components/Button";
import { Workspace } from "./src/api";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [creating, setCreating] = useState(false);

  let screen: React.ReactNode;
  if (!token) {
    screen = <LoginScreen onSignedIn={setToken} />;
  } else if (workspace) {
    screen = (
      <View style={styles.done}>
        <Text style={styles.doneTitle}>{workspace.name}</Text>
        <Text style={styles.doneText}>Members: {workspace.memberIds.join(", ")}</Text>
        <Button label="Create another" onPress={() => setWorkspace(null)} style={styles.gap} />
      </View>
    );
  } else {
    screen = <CreateWorkspaceScreen token={token} onCreated={setWorkspace} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      {screen}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  done: { flex: 1, padding: spacing.lg, justifyContent: "center", gap: spacing.md },
  doneTitle: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  doneText: { fontSize: 16, color: colors.textMuted },
  gap: { marginTop: spacing.md },
});