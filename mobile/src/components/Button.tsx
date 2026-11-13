// mobile/src/components/Button.tsx
import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", style, disabled = false }: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed && (isPrimary ? styles.primaryPressed : styles.ghostPressed),
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.label, !isPrimary && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.darkAccent,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostPressed: {
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  ghostLabel: {
    color: colors.primary,
  },
});
