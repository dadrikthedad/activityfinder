// core/theme/colors.ts
// Fargepalletter for hvert tema.
// Disse er råfarger — ikke semantiske navn.
// Bruk semantiske tokens fra temaene i stedet for disse direkte.

export const Palette = {
  // ===== Sparks gull — fra logo =====
  gold: {
    50:  "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#F0C040", // Lys gull — gnister
    400: "#D4A017", // Gull — hovedelement
    500: "#C9A84C", // Gull — kant/ramme
    600: "#B8960C", // Mørk gull — kontur
    700: "#9A7D0A",
    800: "#7D6608",
    900: "#5C4A05",
  },

  // ===== Nøytrale — varm grå (ikke kald blågrå) =====
  gray: {
    50:  "#fafafa",
    100: "#f5f5f5",
    150: "#efefef", // Lyst tema bakgrunn
    200: "#e8e8e8",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    750: "#2a2a2a", // Mørkt tema surface
    800: "#1f1f1f",
    850: "#181818", // Mørkt tema backgroundAlt
    900: "#141414", // Mørkt tema background
    950: "#0D0D0D", // Mørkt tema dypeste / navbar
  },

  // ===== Kull — header/navbar i lyst tema =====
  charcoal: {
    700: "#2D2D2D",
    800: "#1A1A1A",
    900: "#111111",
  },

  // ===== Status =====
  red: {
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
  },
  amber: {
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
  },
  blue: {
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
  },
  green: {
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
  },

  // ===== Absolutte =====
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;
