# Refaktoreringsguide — AFMobile

Sjekkliste for å bringe gammel kode i tråd med prosjektmønsteret.
Bruk denne som utgangspunkt når du åpner en eldre skjerm, hook eller service.

---

## 1. Mappestruktur — Feature Slice

**Gammelt mønster:**
```
screens/support/ReportScreen.tsx
services/support/supportService.ts
hooks/support/useCompleteReport.ts
```

**Nytt mønster:**
```
features/reporting/
  screens/ReportUserScreen.tsx
  hooks/useSubmitReport.ts
  hooks/useReportAttachments.ts
  services/reportService.ts
  models/UserReportRequestDTO.ts
  models/UserReportResponseDTO.ts
  models/UserReportReason.ts
```

- Én feature per mappe under `features/`
- `screens/` for skjermkomponenter, `hooks/` for ViewModel-hooks, `services/` for API-kall, `models/` for DTOer
- Én ting per fil — ikke bland DTO, service og hook i samme fil
- Delte modeller som brukes av flere features → `core/models/`
- Oppdater alle imports etter flytting

---

## 2. DTOer — match backend-kontrakten

- Sjekk faktisk backend-respons før du skriver DTOer
- Felt-navn må matche backend nøyaktig (PascalCase i backend → camelCase i TypeScript)
- Slett gamle DTOer i `shared/types/` som bare brukes av én feature — flytt til `features/{feature}/models/`
- Enum-verdier i `UserReportReason`, `AppErrorCode` osv. må speile backend nøyaktig

**Sjekk:**
- [ ] Ingen felt som ikke finnes i backend
- [ ] Ingen felt backend krever som mangler
- [ ] Valgfrie felt er markert med `?`
- [ ] Enums er synkronisert med backend

---

## 3. Tema — useUnistyles

Fjern alle hardkodede farger og erstatt med `theme.colors.*`.

```typescript
// Slett:
color: "#1C6B1C"
backgroundColor: "#374151"
borderColor: "gray"

// Erstatt med:
const { theme } = useUnistyles();
color: theme.colors.success
backgroundColor: theme.colors.surface
borderColor: theme.colors.border
```

**Tilgjengelige tokens:**
```
theme.colors.primary / primaryDark / primaryLight / onPrimary
theme.colors.background / backgroundAlt / backgroundInput
theme.colors.surface / surfaceAlt
theme.colors.textPrimary / textSecondary / textMuted / textPlaceholder
theme.colors.border / borderFocus / borderError
theme.colors.error / warning / success / info
theme.colors.navbar / navbarText
theme.spacing.xs/sm/md/lg/xl/xxl    (4/8/16/24/32/48)
theme.radii.sm/md/lg/full           (4/8/16/9999)
theme.typography.xs/sm/md/lg/xl/xxl (12/14/16/18/24/32)
theme.typography.regular/medium/semibold/bold
```

Unntak (lov å hardkode): `rgba(0,0,0,x)` overlays, absolutt svart/hvit i mediaviser.

**Sjekk:**
- [ ] Ingen hardkodede hex-farger (`#...`)
- [ ] Ingen `StyleSheet.create` med hardkodede farger — bruk inline styles med theme-tokens
- [ ] Ingen `StyleSheet.create` i det hele tatt med mindre det er statiske layout-verdier uten farger

---

## 4. Globalisering — useTranslation

Fjern alle hardkodede strenger og erstatt med `t("nøkkel")`.

```typescript
// Slett:
<Text>Logg inn</Text>
title="Report User"
placeholder="Describe what happened"

// Erstatt med:
const { t } = useTranslation();
<Text>{t("auth.login")}</Text>
title={t("report.title")}
placeholder={t("report.descriptionPlaceholder")}
```

- Legg til nye nøkler i `core/i18n/locales/no.ts` og `en.ts` — alltid begge samtidig
- Namespace-konvensjon: `feature.nøkkel` (f.eks. `report.title`, `auth.login`, `profile.bio`)
- Slett hardkodede strenger som "Saving...", "NOT IMPLEMENTED YET", "Try Again" osv.

**Sjekk:**
- [ ] Ingen norske eller engelske hardkodede strenger i JSX eller props
- [ ] Tilsvarende nøkkel finnes i både `no.ts` og `en.ts`

---

## 5. Result-pattern

Services skal returnere `Result<T, ErrorCode>` — aldri kaste exceptions til hooks.

```typescript
// Gammelt (kast exception):
export async function submitReport(payload) {
  const response = await fetch(...);
  if (!response.ok) throw new Error("Failed");
  return response.json();
}

// Nytt (Result-pattern):
export async function submitUserReport(
  payload: UserReportRequestDTO
): Promise<Result<UserReportResponseDTO, ReportingErrorCode>> {
  try {
    const data = await postFormDataRequest<UserReportResponseDTO>(...);
    return Result.ok(data);
  } catch (error) {
    return mapReportError(error);
  }
}
```

**`mapXxxError` — switch på `appCode`, ikke `status`:**
```typescript
function mapReportError(error: unknown): Result<never, ReportingErrorCode> {
  if (error instanceof ApiError) {
    switch (error.appCode) {
      case AppErrorCode.Conflict:         return Result.fail(error.message, ReportingErrorCode.AlreadyReported);
      case AppErrorCode.TooManyRequests:  return Result.fail(error.message, ReportingErrorCode.RateLimited);
      case AppErrorCode.Forbidden:        return Result.fail(error.message, ReportingErrorCode.SelfReport);
    }
  }
  return Result.fail("Ukjent feil", ReportingErrorCode.ServerError);
}
```

**Hook — switch på `result.code`, ingen try/catch:**
```typescript
const result = await submitUserReport(payload);
if (!result.success) {
  switch (result.code) {
    case ReportingErrorCode.AlreadyReported:
      showNotificationToastNative({ type: LocalToastType.CustomSystemError, customTitle: t("report.errorTitle"), customBody: t("report.alreadyReported"), position: "top" });
      return;
  }
  return;
}
// suksess
```

**Sjekk:**
- [ ] Service returnerer `Result<T, ErrorCode>` — ikke `T` direkte og ikke `throw`
- [ ] `mapXxxError` switcher på `error.appCode` (ikke `error.status`)
- [ ] Hook har ingen `try/catch` — kun `if (!result.success)`
- [ ] Alle `AppErrorCode`-verdier som backend kan sende er håndtert
- [ ] `ReportingErrorCode` / `ProfileErrorCode` / osv. finnes i `core/errors/ErrorCode.ts`

---

## 6. Felles komponenter — gjenbruk før du lager nytt

Før du lager inline JSX, sjekk om det finnes en eksisterende komponent:

| Behov | Komponent |
|-------|-----------|
| Tekstfelt (enkelt eller multiline) | `FormFieldNative` — støtter `multiline`, `numberOfLines`, `maxLength`, `error`, `touched` |
| Passordfelt | `PasswordFieldNative` — støtter `tooltip` og `labelAlign` |
| Knapp | `ButtonNative` — `variant`: `primary / secondary / outline / muted / danger / ghost / dots` |
| Dato-picker | `DatePickerNative` |
| Modal med handlinger | `ActionSheetModalNative` |
| Søkbar select | `SearchableSelectModalNative` |
| Spinner / loading | `SpinnerNative` |
| Liten avatar | `MiniAvatarNative` |
| Liste | `FlashList` fra `@shopify/flash-list` — ikke `FlatList` |
| Toast | `showNotificationToastNative` med `LocalToastType.CustomSystemError` / `CustomSystemNotice` |

**Sjekk:**
- [ ] Ingen rå `TextInput` der `FormFieldNative` passer
- [ ] Ingen rå `TouchableOpacity` med tekst der `ButtonNative` passer
- [ ] Ingen `FlatList` — bruk `FlashList`
- [ ] Ingen `Alert.alert()` — bruk toast eller inline bekreftelses-UI

---

## 7. ViewModel-mønster (View / ViewModel / Model)

```
ReportUserScreen.tsx      →  View       (kun JSX, ingen forretningslogikk)
useSubmitReport.ts        →  ViewModel  (state, validering, actions)
reportService.ts          →  Model      (API-kall, returnerer Result<T>)
UserReportRequestDTO.ts   →  DTO        (typedefinisjoner)
```

- Skjermkomponenten (`Screen.tsx`) skal kun inneholde JSX og kall til hook
- All state og logikk hører hjemme i hooken
- Hooken kaller service — aldri API direkte fra skjerm

---

## 8. API-URL-er — routes.ts

Fjern hardkodede URL-er og bruk `ApiRoutes`:

```typescript
// Slett:
const response = await fetch("https://api.example.com/api/support/report");
const response = await fetch(`${API_URL}/api/support/report`);

// Erstatt med:
import { ApiRoutes } from "@/core/api/routes";
await postFormDataRequest(ApiRoutes.support.report, formData);
```

**Sjekk:**
- [ ] Ingen hardkodede URL-strenger i services
- [ ] Alle endepunkter finnes i `ApiRoutes` i `core/api/routes.ts`

---

## 9. Token-håndtering og autentiserte kall

```typescript
// Slett: direkte fetch med token
const token = await AsyncStorage.getItem("accessToken");
fetch(url, { headers: { Authorization: `Bearer ${token}` } });

// Bruk: autentiserte hjelpefunksjoner fra baseService
import { getRequest, postRequest, putRequest, deleteRequest } from "@/core/api/baseService";
const data = await getRequest<MyResponseDTO>(ApiRoutes.profile.me);
```

**Sjekk:**
- [ ] Ingen `AsyncStorage` for tokens — tokens håndteres av `authServiceNative`
- [ ] Ingen manuell `Authorization`-header — bruk `getRequest`/`postRequest` fra `baseService`

---

## 10. Navigasjon — RootStackParamList

Nye skjermer må registreres to steder:

```typescript
// types/navigation.ts
export type RootStackParamList = {
  ReportUserScreen: { reportedUserId: string; reportedUserName?: string };
  ReportBugScreen: undefined;
  // ...
};

// App.tsx
<Stack.Screen name="ReportUserScreen" component={ReportUserScreen} options={{ headerShown: false }} />
```

**Sjekk:**
- [ ] Ny skjerm finnes i `RootStackParamList`
- [ ] `Stack.Screen` er lagt til i riktig blokk (`isLoggedIn` / ikke innlogget)
- [ ] Ingen navigering til slettet skjerm noe sted i kodebasen

---

## 11. Tastatur — KeyboardAvoidingView

Alle skjermer med tekstfelt eller ScrollView skal bruke `KeyboardAvoidingView`. Se `components.md` for fullstendig mal.

**Sjekk:**
- [ ] `KeyboardAvoidingView` wraper `ScrollView` (ikke `SafeAreaView`)
- [ ] `behavior={Platform.OS === "ios" ? "padding" : "height"}`
- [ ] `keyboardShouldPersistTaps="handled"` på `ScrollView`

---

## 12. Sletting av gammel kode

Etter refaktorering — fjern det som er erstattet:

- Slett gamle screen-filer under `screens/support/`, `screens/profile/` osv. etter at nye er registrert
- Slett gamle services under `services/` etter at de er erstattet av `features/{feature}/services/`
- Slett gamle hooks under `hooks/` etter at de er erstattet
- Slett DTOer i `shared/types/` som kun brukes av én feature
- Søk etter imports av slettede filer — de er kompilerings-feil som ikke alltid vises i editor

```bash
# Finn gjenværende referanser til slettet fil:
grep -r "from.*screens/support/ReportScreen" AFMobile/
grep -r "import.*ReportScreen" AFMobile/
```

**Sjekk:**
- [ ] Ingen imports peker på slettede filer
- [ ] `RootStackParamList` har ikke typer for slettede skjermer
- [ ] `App.tsx` har ikke `Stack.Screen` for slettede skjermer
