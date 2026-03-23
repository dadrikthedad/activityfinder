// core/theme/themes.ts
// Tema-definisjoner for AFMobile.
//
// Lyst tema:  lysegrå bakgrunn (#efefef), hvite kort, gull-aksent, kull-header
//             — ingen grønt, nøytralt og elegant
// Mørkt tema: nesten-svart (#141414), mørkgrå surface (#2a2a2a), gull-primær
//             — matcher Sparks-logoen (gull på svart/mørkgrå)

import { Palette } from "./colors";

export type ThemeTokens = typeof lightTheme;

// ========== Lyst tema ==========

export const lightTheme = {
  colors: {
    primary:          Palette.gold[400],     // #D4A017
    primaryDark:      Palette.gold[600],     // #B8960C
    primaryLight:     Palette.gold[300],     // #F0C040
    onPrimary:        Palette.charcoal[900],

    accent:           Palette.gold[500],
    accentLight:      Palette.gold[300],
    accentDark:       Palette.gold[700],

    background:       Palette.gray[150],     // #efefef
    backgroundAlt:    Palette.gray[100],     // #f5f5f5
    backgroundInput:  Palette.white,

    surface:          Palette.white,
    surfaceAlt:       Palette.gray[100],
    surfaceInverse:   Palette.charcoal[800],

    textPrimary:      Palette.charcoal[800], // #1A1A1A
    textSecondary:    Palette.gray[600],     // #525252
    textMuted:        Palette.gray[500],     // #737373
    textDisabled:     Palette.gray[400],     // #a3a3a3
    textOnDark:       Palette.white,
    textPlaceholder:  Palette.gray[400],     // #a3a3a3

    border:           Palette.gray[300],     // #d4d4d4
    borderFocus:      Palette.gold[400],
    borderError:      Palette.red[600],

    error:            Palette.red[600],
    errorLight:       Palette.red[400],
    warning:          Palette.amber[500],
    success:          Palette.green[600],
    info:             Palette.blue[500],

    disabled:         Palette.gray[200],
    disabledText:     Palette.gray[400],

    navbar:           Palette.charcoal[800], // #1A1A1A
    navbarText:       Palette.gold[400],

    statusBar:        Palette.charcoal[800],
  },

  spacing: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
  },

  radii: {
    sm:   4,
    md:   8,
    lg:   16,
    full: 9999,
  },

  typography: {
    xs:   12,
    sm:   14,
    md:   16,
    lg:   18,
    xl:   24,
    xxl:  32,

    regular:  "400" as const,
    medium:   "500" as const,
    semibold: "600" as const,
    bold:     "700" as const,
  },
} as const;

// ========== Mørkt tema ==========

export const darkTheme = {
  colors: {
    primary:          Palette.gold[400],    // #D4A017
    primaryDark:      Palette.gold[600],    // #B8960C
    primaryLight:     Palette.gold[300],    // #F0C040
    onPrimary:        Palette.gray[950],

    accent:           Palette.gold[300],
    accentLight:      Palette.gold[200],
    accentDark:       Palette.gold[500],

    background:       Palette.gray[900],    // #141414
    backgroundAlt:    Palette.gray[850],    // #181818
    backgroundInput:  Palette.gray[750],    // #2a2a2a

    surface:          Palette.gray[750],    // #2a2a2a
    surfaceAlt:       Palette.gray[700],    // #404040
    surfaceInverse:   Palette.gray[100],

    textPrimary:      Palette.gray[50],     // #fafafa
    textSecondary:    Palette.gray[300],    // #d4d4d4
    textMuted:        Palette.gray[400],    // #a3a3a3
    textDisabled:     Palette.gray[600],    // #525252
    textOnDark:       Palette.white,
    textPlaceholder:  Palette.gray[500],    // #737373 — synlig mot #2a2a2a feltbakgrunn

    border:           Palette.gray[500],    // #737373 — tydelig mot #2a2a2a feltbakgrunn
    borderFocus:      Palette.gold[400],
    borderError:      Palette.red[400],

    error:            Palette.red[400],
    errorLight:       Palette.red[500],
    warning:          Palette.amber[400],
    success:          Palette.green[400],
    info:             Palette.blue[400],

    disabled:         Palette.gray[700],
    disabledText:     Palette.gray[600],

    navbar:           Palette.gray[950],    // #0D0D0D
    navbarText:       Palette.gold[400],

    statusBar:        Palette.gray[950],
  },

  spacing:    lightTheme.spacing,
  radii:      lightTheme.radii,
  typography: lightTheme.typography,
} as const;

// ========== Tema-registrering ==========

export const appThemes = {
  light: lightTheme,
  dark:  darkTheme,
} as const;

export type ThemeName = keyof typeof appThemes;
