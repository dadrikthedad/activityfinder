# Komponentregler — AFMobile

## ViewModel-mønster

```
LoginScreen.tsx        →  View       (kun JSX, ingen logikk)
useLogin.ts            →  ViewModel  (state, rhf+zod, actions)
authService.ts         →  Model      (API-kall, returnerer Result<T>)
LoginResponseDTO.ts    →  DTO        (typedefinisjoner)
```

## Tema — react-native-unistyles v3.1.1

Fargeidentitet: **gull (#D4A017) + kull-svart (#1A1A1A)** — aldri grønt som primærfarge.

```typescript
import { useUnistyles } from "react-native-unistyles";
const { theme } = useUnistyles();

// ALDRI hardkodede farger — alltid theme.colors.*:
color: theme.colors.primary          // ✅
color: "#D4A017"                     // ❌
```

**Tilgjengelige tokens:**
```
theme.colors.primary / primaryDark / primaryLight / onPrimary
theme.colors.accent / accentLight / accentDark
theme.colors.background / backgroundAlt / backgroundInput
theme.colors.surface / surfaceAlt / surfaceInverse
theme.colors.textPrimary / textSecondary / textMuted / textDisabled / textPlaceholder
theme.colors.border / borderFocus / borderError
theme.colors.error / warning / success / info
theme.colors.disabled / disabledText
theme.colors.navbar / navbarText
theme.spacing.xs/sm/md/lg/xl/xxl     // 4/8/16/24/32/48
theme.radii.sm/md/lg/full            // 4/8/16/9999
theme.typography.xs/sm/md/lg/xl/xxl  // 12/14/16/18/24/32
theme.typography.regular/medium/semibold/bold
```

Unntak for hardkodede farger: absolutt svart/hvit i mediaviser, `rgba(0,0,0,x)` overlays, tredjeparts komponenter.

## Passordfelt — PasswordFieldNative

Én felles komponent for hele appen: `components/common/PasswordFieldNative.tsx`.

```typescript
// Login / ResetPassword — sentrert label, ingen tooltip:
<PasswordFieldNative id="password" label={t("auth.password")} value={value} ... />

// Signup — venstrejustert label med tooltip:
<PasswordFieldNative id="password" label={t("auth.createPassword")} tooltip={t("auth.passwordTooltip")} labelAlign="left" value={value} ... />
```

## Zod-schemas — passordregler

Matcher Identity-konfigurasjon i AFBack (`RequireDigit/Lower/Upper = true`, `RequiredLength = 8`, maks 128):

```typescript
// loginSchema: min 8 tegn (ingen regex — backend gir presis feilmelding)
// resetPasswordSchema: 8-128 tegn + regex for stor/liten bokstav + tall
// Begge brukes med react-hook-form + zodResolver
```

## Globalisering — i18next

```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();

t("auth.login")   // ✅
"Logg inn"        // ❌ aldri hardkodet
```

## Datoformatering — date-fns

```typescript
import { format, formatDistanceToNow } from "date-fns";
import { nb, enUS } from "date-fns/locale";
const locale = language === "no" ? nb : enUS;
format(date, "HH:mm", { locale })
formatDistanceToNow(date, { addSuffix: true, locale })
```

## Skjerm-layout — obligatorisk struktur

Alle nye skjermer med tekstfelt eller ScrollView **skal** bruke `KeyboardAvoidingView` slik at innhold ikke skjules bak tastaturet.

```typescript
import { SafeAreaView, KeyboardAvoidingView, ScrollView, Platform } from "react-native";

export default function MyScreen() {
  const { theme } = useUnistyles();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader ... />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {/* innhold */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

**Sjekk:**
- [ ] `KeyboardAvoidingView` med `behavior={Platform.OS === "ios" ? "padding" : "height"}` wraper `ScrollView`
- [ ] `keyboardShouldPersistTaps="handled"` på `ScrollView` (hindrer at tastatur lukkes ved trykk på knapper)
- [ ] `SafeAreaView` ytterst, `KeyboardAvoidingView` innenfor header, `ScrollView` innerst

Unntak: skjermer uten tekstfelt og uten scrollbart innhold (f.eks. `BootstrapLoadingScreen`).

## Lister — @shopify/flash-list v2.3.0

```typescript
import { FlashList } from "@shopify/flash-list";
<FlashList
  data={messages}
  renderItem={({ item }) => <MessageItem message={item} />}
  keyExtractor={(item) => item.id}
/>
```
