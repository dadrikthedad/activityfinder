# Rate Limiting System

## Oversikt

Rate limiting konfigureres i `RateLimiterExtensions` og bruker ASP.NET Core sin innebygde `RateLimiter`-middleware med sliding window-algoritme. Systemet partisjonerer brukere basert på autentiseringsstatus og device-type for å gi rettferdig begrensning.

## Arkitektur

```
Request → RateLimiter Middleware
              ├── Global limiter (alle requests)
              └── Policy limiter (per endepunkt)
                    │
                    ├── Under grense → request går videre
                    └── Over grense → 429 + HandleRateLimitRejection
                                          ├── Strike < terskel → logg info/warning
                                          └── Strike ≥ terskel → SuspiciousActivityService → IpBan
```

## Partisjonering

`RateLimitHelper.GetPartitionKey(context)` bestemmer nøkkelen:

- **Autentiserte brukere**: Partisjoneres per bruker-ID (IP er irrelevant)
- **Uautentiserte mobile brukere**: Partisjoneres per IP + device fingerprint
- **Uautentiserte web-brukere**: Partisjoneres per IP + browser fingerprint

## Policyer

### Global Limiter
Sikkerhetsnett for alle endepunkter. Kjører i tillegg til policy-spesifikke limitere.

### `auth`
Streng policy for login, registrering og e-postverifisering. Alltid uautentisert → IP + fingerprint.

### `messaging`
Hot-path for chat-meldinger. Alltid autentisert → per bruker-ID. Mer generøs.

### `public`
Offentlige endepunkter med høy kapasitet.

## Strike-system

Når en request avvises (429), håndterer `HandleRateLimitRejection` et strike-system via `IMemoryCache`:

1. **Strike-teller** økes for hver avvist request per partisjonsnøkkel
2. **Under terskel - 2**: Logger `Information`
3. **Mellom terskel - 2 og terskel**: Logger `Warning`
4. **På eller over terskel**: Rapporterer til `SuspiciousActivityService` som kan trigge IP-ban

Strike-telleren utløper automatisk etter `StrikeWindowMinutes`.

## Response til klient

- HTTP 429 status
- `Retry-After`-header med antall sekunder før klienten bør prøve igjen
- Body: "Too many requests. Please slow down."

Frontend bruker `Retry-After`-headeren til å vente før nye requests sendes.

## Fingerprinting

`FingerprintUtils` genererer anonymiserte fingerprints for partisjonering:

### Mobile (`GetMobileDeviceFingerprint`)
Basert på custom headers satt av appen:
- `X-Device-ID`
- `X-App-Version`
- `X-Device-Platform`
- `X-Build-Number`

### Web (`GetWebFingerprint`)
Basert på nettleser-headers:
- Browser-familie og major-versjon (fra User-Agent)
- Primærspråk (fra Accept-Language, uten region)

Alle fingerprints hashes med SHA256 og trunceres til 12 tegn URL-safe base64.

## Konfigurasjon

All konfigurasjon ligger i `RateLimitConfig`:

- `GlobalPermitLimit`, `GlobalWindowMinutes`, `GlobalSegmentsPerWindow`, `GlobalQueueLimit`
- `AuthPermitLimit`, `AuthWindowMinutes`, `AuthSegmentsPerWindow`, `AuthQueueLimit`
- `MessagingPermitLimit`, `MessagingWindowMinutes`, `MessagingSegmentsPerWindow`, `MessagingQueueLimit`
- `PublicPermitLimit`, `PublicWindowMinutes`, `PublicSegmentsPerWindow`, `PublicQueueLimit`
- `StrikeWindowMinutes` — hvor lenge strikes huskes
- `StrikesBeforeBan` — antall strikes før rapportering til `SuspiciousActivityService`

## Integrasjon med IpBan

Rate limiting er det første forsvarlaget. Når strikes akkumuleres nok, eskaleres det til `SuspiciousActivityService` → `IpBanService`:

```
RateLimiter (per-request) → Strikes (IMemoryCache) → SuspiciousActivity (database) → IpBan
```

Hvert lag har sitt ansvar og sin egen terskel.
