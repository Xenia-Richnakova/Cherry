// mobile/src/theme.ts
// Colours taken from the "Cherry - Business & Technical Documentation" palette.
export const colors = {
  primary: "#E62E52",       // Cherry Red: main actions, highlights
  darkAccent: "#520014",    // Dark Cherry: deeper surfaces, pressed states
  positive: "#267A32",      // Natural Green: settled, positive balances
  background: "#21181A",    // Night Dark: page background
  surface: "#2E2226",       // slightly lifted card colour derived from the background
  text: "#FFF9F9",          // Soft Off-White: primary text
  textMuted: "#B8A9AC",     // muted text derived from the off-white
  border: "#3D2E33",        // subtle dividers
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// Font families. Expo loads these via expo-font; the system fallbacks keep the
// app usable before the fonts are added.
export const fonts = {
  display: "Georgia",   // elegant serif for headings
  body: "System",       // clean sans-serif for body text
} as const;