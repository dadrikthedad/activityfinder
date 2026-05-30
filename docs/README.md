# ActivityFinder — Dokumentasjonsleksikon

Teknisk referansedokumentasjon for AFBack (.NET) og AFMobile (React Native).
Hver fil dekker én flyt eller ett domene med både backend- og frontend-perspektiv.

## Innhold

### Auth
| Fil | Beskrivelse |
|-----|-------------|
| [auth/login.md](auth/login.md) | Innloggingsflyt steg 1 — passordvalidering, MFA-kode sendes, timing-beskyttelse |
| [auth/login-mfa.md](auth/login-mfa.md) | Innloggingsflyt steg 2 — MFA-kode verifiseres, tokens utstedes |
| [auth/signup.md](auth/signup.md) | Registreringsflyt, validering, e-postverifisering ved signup |
| [auth/email-verification.md](auth/email-verification.md) | E-postverifisering etter signup (VerificationScreen) |
| [auth/sms-verification.md](auth/sms-verification.md) | SMS-verifisering etter e-post (PhoneSmsVerificationScreen) |
| [auth/forgot-password.md](auth/forgot-password.md) | Glemt passord — 4-stegs flyt med e-post + SMS |

## Konvensjoner

- **Backend** — ASP.NET Core (.NET 10), Vertical Slice, PostgreSQL, EF Core
- **Frontend** — React Native 0.79, Expo 53, Unistyles 3.1.1, react-hook-form + zod
- **Feilhåndtering** — `Result<T, ErrorCode>`-pattern i frontend, `AppProblemDetails` med `code`-felt fra backend
- **Tema** — alltid `theme.colors.*` fra `useUnistyles()`, aldri hardkodede farger
- **Tekst** — alltid `t("nøkkel")` fra `useTranslation()`, aldri hardkodede strenger
