// mobile/src/screens/LoginScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, fonts, spacing, radius } from "../theme";
import { Button } from "../components/Button";
import { login, register } from "../api";

interface Props {
  onSignedIn: (token: string) => void;
}

export function LoginScreen({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: "login" | "register") {
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") await register(email, password);
      const token = await login(email, password);
      onSignedIn(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Cherry</Text>
      <Text style={styles.subtitle}>Sign in to manage your shared budgets</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (at least 8 characters)"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button label="Sign in" onPress={() => submit("login")} disabled={busy} style={styles.gap} />
      <Button
        label="Create account"
        variant="ghost"
        onPress={() => submit("register")}
        disabled={busy}
        style={styles.gap}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && <Text style={styles.subtitle}>Please wait…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.md },
  error: { color: colors.primary, fontSize: 14, lineHeight: 20 },
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
  gap: { marginTop: spacing.sm },
});
