# AFMobile — Kjøre appen

## Koble til telefon

```bash
adb reverse tcp:8081 tcp:8081
```

## Start appen

```bash
# Vanlig utvikling (JS/TS-endringer)
npx expo start --clear

# Ny native pakke installert (sjeldent, tar 10–15 min)
npx expo run:android
```

> Appen bruker **expo-dev-client** — kan ikke åpnes i Expo Go.

## Feilsøking

```bash
# Signaturkonflikt (appen krasjer ved installasjon)
adb uninstall com.dadrikthedad.AFMobile
```
