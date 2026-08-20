# AFMobile — Neste økt

### NESTE ØKT — Oppryddingspass: tema/i18n + Result-pattern + Feature Slice-flytting

Mål: bringe gjenværende gammelt-mønster-filer i tråd med prosjektmønsteret — samme type pass som
tidligere (jf. `.claude/rules/refactoring.md`). Tre akser per fil:

1. **Tema/i18n:** `useUnistyles` + `makeStyles(theme)`-factory (typ `AppTheme = ReturnType<typeof useUnistyles>['theme']`),
   alle hardkodede farger → `theme.colors.*`, alle strenger → `t("...")` (nye nøkler i BÅDE `no.ts` og `en.ts`),
   `FlatList` → `FlashList`, fjern emoji. Gammel-grønn `#1C6B1C` → `theme.colors.primary` (gull).
2. **Result-pattern:** services returnerer `Result<T, ErrorCode>` (aldri throw til hook), `mapXxxError`
   switcher på `error.appCode` (ikke `status`), hooks uten try/catch — kun `if (!result.success)`.
3. **Feature Slice:** flytt filer til `features/[feature]/{screens,hooks,services,models,components}/`,
   én ting per fil, oppdater alle imports, slett død kode.

Kjente gjenstående mål (meldingsmodulen):
- `MessageInputNative` — tema/i18n + bytt `Alert.alert` (~133) til toast/inline-bekreftelse.
- `MessageSettingsModalNative` — tema/i18n; har hardkodet "Navnløs gruppe" + `/default-group.png` (~150).
- `PendingConversationsScreen` — siste gjenstående gammelt-mønster-komponent i lista.
- Transitive submoduler å flytte til `features/messaging/components/`: `MessageAttachmentsNative`,
  `ReplyPreviewNative`, `ParticipantsListNative` (ligger fortsatt i `components/messages/`).
- Konsolider `features/messages/` (NewMessage) inn i `features/messaging/`.

Mal = ferdige `MessageListNative` / `PendingRequestsListNative` (sistnevnte ble splittet — `PendingRequestActionsNative`
er godkjenn/avslå-knappene i egen fil).

---

### Dev-only admin/bruker-switch på login-skjermen — FULLFØRT

Mål: slippe å logge inn manuelt med hver av testbrukerne våre. Etter «Logg ut», på Login-skjermen,
skal det nederst ligge en knapp til en admin-skjerm SOM KUN ER SYNLIG I DEVELOPMENT. Admin-skjermen
lar oss velge en testbruker og logge inn med ett trykk.

Kritisk krav: alt dette skal være fullstendig usynlig/inaktivt i produksjon — gates på `__DEV__`
(standard React Native-global, brukes allerede i `Logger.ts` m.fl.). Hverken knappen, skjermen eller
testbruker-dataene skal kunne nå produksjon.

Plan:
1. Inngang på Login (`features/auth/screens/LoginScreen.tsx`, rute-navn `Login`):
   - Nederst: `{__DEV__ && <ButtonNative variant="ghost" ... onPress={() => navigation.navigate("AdminDevScreen")} />}`
   - Kun render når `__DEV__` er true.
2. Ny dev-skjerm — `features/admin/screens/AdminDevScreen.tsx` (Feature Slice):
   - Lister kjente testbrukere (navn/epost) som trykkbare rader.
   - Ett trykk → kall eksisterende `loginUser(email, password)` (`features/auth/services/authService`),
     og kjør samme post-login-flyt som `useLogin` (E2EE-setup, `login()` i AuthContext, bootstrap).
   - Bruk `useUnistyles` + tema-tokens. (i18n valgfritt for dev-verktøy — kan hardkodes for enkelhet.)
3. Navigasjon: legg til `AdminDevScreen: undefined` i `RootStackParamList` (`types/navigation.ts`) og en
   `Stack.Screen` i `App.tsx` — registrer den KUN når `__DEV__` (eller la skjermen selv returnere null i prod).
4. Kilde til testbruker-credentials (epost + passord) — MÅ avklares (se under). E2EE krever passordet for
   å utlede/gjenopprette nøkler, så «skip login» kan ikke unngå passordet helt.

Åpne avklaringer (ta før implementering):
- **Hvor lagres dev-credentials?** Forslag: en git-ignorert fil (f.eks. `features/admin/devUsers.ts` lagt i
  `.gitignore`, eller `.env.local`) som KUN importeres bak `__DEV__`. Ingen ekte passord committes.
- **E2EE ved bruker-bytte:** må rydde forrige brukers cachede nøkler og kjøre
  `CryptoService.initializeForUser` / restore for den nye brukeren (samme flyt som vanlig login). Verifiser
  at bytte mellom brukere ikke lekker forrige brukers nøkler.
- **MFA:** har testbrukerne MFA på? Hvis ja, vil `loginUser` returnere `MfaRequired` og flyten må enten
  navigere til `LoginMfaScreen` som vanlig, eller testbrukerne må ha MFA av i dev.
- **Modeller:** ingen nye backend-modeller/egenskaper uten bekreftelse fra Magee (jf. AGENTS.md). Hvis vi
  heller vil ha et dev-only backend-endepunkt for token-utstedelse, må det avklares separat.

Konvensjoner: Feature Slice, `useUnistyles`/tema-tokens, gjenbruk `ButtonNative`, ingen emojier.

---

### LØST: samtale finnes i søk men ikke i hovedlisten (gjenstår on-device-verifisering)

Symptom: en sendt 1:1-samtale vises IKKE i hovedlisten (`ConversationListNative`), men DUKKER OPP når
man søker.

AVKREFTET hypotese (pending-filter): Det er IKKE fordi vi filtrerer vekk pending.
- Avsender får status `Accepted` ved opprettelse — `AFBack/Features/Conversation/Services/DirectConversationService.cs:77-81`
  (`userParticipant.Status = Accepted, Role = PendingSender`). Mottaker får `Pending`.
- Active-listen henter nettopp `Status == Accepted` —
  `AFBack/Features/Conversation/Repository/ConversationRepository.cs:58-60` (`GetActiveConversationsAsync`).
- Konklusjon: backend RETURNERER samtalen i `GET /api/conversation/active` for avsenderen. Ingen
  pending-filter utelukker den.

SANNSYNLIG ÅRSAK (lokal store-staleness):
- Hovedlisten fylles KUN av bootstrap (`useBootstrap` → `setConversations(activeConversations)`).
  `usePaginatedConversations` (`hooks/messages/getMyConversations.ts`) gjør INGEN initiell henting —
  kun `loadMore` ved scroll. En tom liste kan ikke scrolles → ingen selvhelbredende re-henting.
- Den savnede samtalen ble opprettet FØR `refreshConversationFromBackend`-fiksen, så den nådde aldri
  den persisterte storen. Ved reload kjøres ikke full bootstrap på nytt (isBootstrapped persistert +
  cache gyldig), og recovery-sync ga `0 events` → `store.conversations` forblir tom/stale.
- Søk treffer backend live (`GET /api/conversation/search`) og omgår den stale storen → finner samtalen.

FIKS IMPLEMENTERT (to komplementære grep):
1. Bruk samtalen fra send-responsen direkte. Backend `SendMessageToUserResponse` inneholder allerede
   hele `Conversation` (ConversationResponse), men frontend kastet den og re-hentet via
   `refreshConversationFromBackend`. Nå:
   - `features/messages/models/SendMessageToUserResponseDTO.ts` — eksponerer `conversation: ConversationDTO`.
   - `features/messages/hooks/useNewMessage.ts` — `goToConversation(conversationId, conversation?)` legger
     samtalen rett i `useConversationStore` (1-til-1). Gruppe (ingen conversation) faller tilbake til
     `refreshConversationFromBackend`. Ingen ekstra `getConversationById`-runde for 1-til-1.
2. Initiell henting ved mount — selvhelbreder stale/tom persistert store. `hooks/messages/getMyConversations.ts`
   (`usePaginatedConversations`) henter nå `GET /api/conversation/active` ved mount og merger via
   `addConversation` (dedup). Fikser den gamle savnede samtalen uten re-login, og gjør listen
   motstandsdyktig når bootstrap ikke kjører på nytt ved reload.

tsc rent i alle tre filer. Gjenstår on-device: send ny samtale (skal vises umiddelbart) + bekreft at den
gamle savnede samtalen dukker opp etter reload (initiell henting).

---

### Store-split-rest fikset — tom samtaleliste etter sending (fullført, gjenstår on-device)

Symptom: "Ingen samtaler ennå" i samtalelisten selv etter å ha sendt til en bruker. Loggen viste
`Count: 0` med `hasLoadedConversations: true`.

Root cause: en utbredt rest etter `useChatStore`-splitten. 15 filer leste fortsatt samtale-/pending-felt
fra `useChatStore`, men disse bor nå i `useConversationStore` (`conversations`, `conversationIds`,
`addConversation`, `removeConversation`, `updateConversation`, `updateConversationTimestamp`,
`pendingMessageRequests`, `addPendingRequest`, `removePendingRequest`, `setPendingMessageRequests`,
`unreadConversationIds`, `setUnreadConversationIds`, `markConversationAsReadLocally`). Feltene var
`undefined` → enten krasj (`conversations.find of undefined` = #4 over) eller stille no-op.

Direkte årsak til symptomet: `refreshConversationFromBackend` (kalt av `useNewMessage.goToConversation`
etter sending) la den nye samtalen i feil store → den nådde aldri listen. `eventProcessorNative`
(sync `ConversationCreated`/`PendingConversationCreated`) hadde samme feil → samtaler kom verken inn
via sending eller sync.

Fiks: splittet `getState()`/hook-destrukturering presist — chat/melding/UI-felt fra `useChatStore`,
samtale-/pending-felt fra `useConversationStore`. 15 filer:
- `utils/messages/refreshConversationFromBackend.ts` (direkte årsak)
- `features/sync/eventProcessorNative.ts`, `features/sync/handlers/messageSyncHandlers.ts`,
  `features/sync/handlers/handleGroupInfoUpdated.ts`
- `components/signalr/handleIncomingMessage.ts`, `components/signalr/handlers/messageHandlers.ts`,
  `components/signalr/handlers/groupHandlers.ts`
- `utils/messages/ensureConversationExists.ts`, `hooks/messages/getConversationById.ts`,
  `utils/messages/restoreConversationLogic.ts`, `utils/messages/deleteConversationLogic.ts`,
  `utils/messages/rejectMesageRequestLogic.ts`, `utils/messages/PreloadMessagesForConversation.ts`
- `screens/messages/ConversationScreen.tsx`, `features/cryptoAttachments/BackgroundDecrypt/hooks/useBackgroundImageDecryption.ts`

(`finalizeConversationApproval.ts` og `syncPendingConversation.ts` var allerede korrekte.)

Verifisering: total tsc-feil falt fra ~251 → 204 (~47 "Property X does not exist on ChatStore"-feil
forsvant). Ingen gjenværende feil-store-lesninger av samtale-/pending-felt (bekreftet via tsc-sveip).
JS/TS-only → Metro-reload holder (ikke `--clear`).

Gjenstår on-device: send ny melding → samtalen skal dukke opp i listen umiddelbart; verifiser at listen
fylles etter fersk bootstrap.

To separate, pre-eksisterende forbehold avdekket:
- `updatePendingRequest` finnes ikke i NOEN store → `handleGroupInfoUpdated` sin pending-gren kaster
  fortsatt. Ikke lagt til ny store-action uten bekreftelse. Avklar om den skal implementeres.
- Steg 8-visning: `conv.isGroup`/`isPendingApproval` er `undefined` og deltaker-oppslaget i
  `ConversationListNative` bruker `p.id` (skal være `p.user.id`). Samtalen VISES, men navn/avatar kan
  bli feil til Steg 8 er gjort.

---

### Rute-drift-fikser i meldingslaget — fullført (gjenstår on-device-verifisering)

Verifiserte NESTE_OKT #1-#3 statisk (alle bekreftet i hevdet tilstand) og fikset gjenstående
rute-drift mot oppdaterte backend-kontrakter. Alle endrede filer kompilerer rent (tsc) — de
gjenværende feilene i `useSendEncryptedMessage.ts:121/214/241` er pre-eksisterende Steg 8-gjeld.

**Meldings-sending (kjernebugg):**
- `features/SendMessage/apiService/SendMessageApiService.ts` — rute `/api/sendmessage` (404) →
  `ApiRoutes.message.send` (`/api/message`). Rettet payload-type (`SendEncryptedMessageRequestDTO`)
  og respons-type (`SendEncryptedMessageResponseDTO`).
- `hooks/messages/useSendEncryptedMessage.ts:298` — respons-mapping rettet: backend
  `SendMessageResponse` sender `messageId` (ikke `id`) og returnerer IKKE `conversationId`.
  Leser nå `response.messageId` og bruker lokal `payload.conversationId`.

**Død kode fjernet:**
- `services/messages/messageNotificationService.ts` — slettet ubrukt `getUnreadConversationIds`
  (kalte ikke-eksisterende `/unread-conversations`; null callere — unread-IDer kommer via
  `/api/bootstrap/secondary`).

**Conversation-rute-klynge** (`services/messages/conversationService.ts`) — alle brukte gammelt
flertall `/api/conversations/...` eller legacy-stier mot backendens entall `/api/conversation/...`:

| Funksjon | Før (404) | Etter |
|----------|-----------|-------|
| `getConversationById` | `/api/conversations/{id}` | `/api/conversation/{id}` |
| `getMyConversations` | `/api/conversations/my-conversations?skip&take` | `/api/conversation/active?Page&PageSize` |
| `searchConversations` | `/api/conversations/search-conversations?query` | `/api/conversation/search?Query&Page&PageSize` + unwrap `.conversations` |
| `getRejectedConversations` | `/api/conversations/rejected` | `/api/conversation/rejected?Page&PageSize` + unwrap `.conversations` |

`search`/`rejected` pakker nå ut backendens `ConversationsResponse`-wrapper (gjenbrukte
`PagedConversationsResponseDTO` som kompatibel subset). `getConversationById` returnerer en enkelt
`ConversationResponse` (ingen unwrap nødvendig). `getMyConversations` konverterer skip/take →
Page/PageSize (1-indeksert) som `getMessagesForConversation`.

**Gjenstår on-device:** send melding i ConversationScreen, åpne fersk PendingRequest-samtale,
"load more"-paginering, re-test #4 (`some of undefined`). Søk og avslåtte-liste bør også verifiseres
nå som rutene er rettet.

---

### ConversationScreen-krasj etter ny melding — #1-#3 fikset, gjenstår verifisering

Etter at `NewMessageScreen` ble refaktorert sender og oppretter den samtaler korrekt og
navigerer til `ConversationScreen`. Da dukket flere **forhåndseksisterende** bugs i
meldings-/varslings-laget opp (rester etter store-split / Steg 8 / API-drift — IKKE fra
NewMessage-koden).

**Status:** #1, #2 og #3 er fikset. Gjenstår til neste økt:
- Verifisere hele flyten på enhet (se «Gjenstår å verifisere» under #3)
- #4 (`some of undefined`) — re-test, sannsynlig følgefeil av #3
- ~~`getUnreadConversationIds` mot manglende `/unread-conversations`-rute~~ — FIKSET (slettet, se toppseksjon)
- ~~`useSendEncryptedMessage.ts:293` feil rute `/api/sendmessage`~~ — FIKSET (se toppseksjon)
- Steg 8 DTO-opprydding (fortsatt blokkert på backend-DTO-endringer)

#### 1. `markConversationAsReadLocally is not a function` — FIKSET
Metoden ble flyttet til `useConversationStore` under store-split, men ble lest fra `useChatStore`
tre steder. Alle rettet til `useConversationStore`:
- `components/messages/MessageListNative.tsx:362`
- `components/signalr/handleIncomingReactions.ts` (+ `unreadConversationIds`/`setUnreadConversationIds`
  hentes nå også fra `useConversationStore.getState()`)
- `hooks/messages/useMarkConversationNotificationAsRead.ts:8`

#### 2. `405` på mark-as-read — FIKSET (rute + HTTP-metode-drift)
Backend `MessageNotificationsController` (`api/MessageNotifications`) bruker `PATCH`, ikke `POST`,
og andre stier. Rettet i `services/messages/messageNotificationService.ts`:
- `markConversationNotificationsAsRead` → `PATCH /api/MessageNotifications/conversation/{id}/read`
- `markMessageNotificationAsRead` → `PATCH /api/MessageNotifications/{id}`
- `markAllMessageNotificationsAsRead` → `PATCH /api/MessageNotifications/read-all`

GJENSTÅR i samme fil: `getUnreadConversationIds` kaller `GET /api/MessageNotifications/unread-conversations`
som IKKE finnes i backend. Controller har kun `GET /unread-count` (antall). Avklar om frontend skal
bruke `unread-count`, eller om et nytt backend-endepunkt for unread conversation-IDer trengs.

#### 3. `404` på henting av meldinger — FIKSET (route + dekryptering)
`conversationService.getMessagesForConversation` migrert til ny kontrakt:
- **Rute:** `GET /api/message/{conversationId}` (var feilaktig `/api/conversations/conversation/{id}`)
- **Paginering:** `skip`/`take` oversettes internt → `Page`/`PageSize` (1-indeksert).
  `page = floor(skip/take) + 1`. Beholder skip/take-signaturen så de 6 konsumentene er urørt.
- **Responsform:** pakker ut `MessagesResponse.messages` (`EncryptedMessageDTO[]`).
- **Dekryptering:** ny ren service `features/crypto/services/messageDecryption.ts`
  (`decryptMessagesToDto`) dekrypterer + mapper → `MessageDTO[]` (speiler bootstrap-mappingen,
  vedlegg lazy). Returtypen er fortsatt `MessageDTO[]` — konsumentene urørt.

Gjenstår å verifisere på enhet:
- **Paginering ved «load more»:** `usePaginatedMessages` bruker `skip = cachedCount`. Med
  floor-konvertering kan eldre sider re-hentes (dedup fanger det, ingen hull), men dypere
  paginering bør sjekkes manuelt.
- ~~**`senderId` GUID-debt:**~~ LØST (Steg 8, 2026-06-28). `senderId` er nå `string | null` i
  `EncryptedMessageDTO`/`MessageDTO`, og «er dette min melding?»-sjekkene sammenligner GUID===GUID korrekt.
- **Fersk `PendingRequest`-samtale:** verifiser at meldings-henting fungerer rett etter
  NewMessageScreen navigerer dit med `{ conversationId, fromNewMessage: true }`.
- **Pre-eksisterende crypto-debt:** `EncryptMessageService.ts` og `useBootstrapMessageDecryption.ts`
  har interne `tsc`-feil (ArrayBufferLike, string|number) fra før — påvirker ikke runtime, men bør
  ryddes i Steg 8.

#### 4. `Cannot read property 'some' of undefined` — adressert av store-split-sveipen (se toppseksjon)
Var nettopp denne klassen: samtale-/pending-felt lest fra feil store (`useChatStore`) ga `undefined`,
og `.some`/`.find` på undefined kastet. Fikset i 15 filer (se toppseksjonen «Store-split-rest fikset»).
Verifiser on-device at den ikke dukker opp lenger.

#### Relaterte oppgaver allerede notert
- ~~`useSendEncryptedMessage.ts:293` kaller feil rute `/api/sendmessage`~~ — FIKSET (se toppseksjon)
- Steg 8: `ConversationDTO` mangler `isGroup`/`isPendingApproval`, `ConversationParticipantDTO`
  vs `UserSummaryDTO`-mismatch gir mange `tsc`-feil i `MessageScreen`/`ConversationListNative` m.fl.

---

### Refaktorer NewMessageScreen — fullført

`NewMessageScreen` (ny Feature Slice `features/messages/`) erstatter gamle `NewConversationScreen`
+ `NewMessageModalNative` + `NewMessageInputNativ` (slettet).

**E2EE-wiring mot nye backend-kontrakter:**
- 1-til-1: `POST /api/conversation/send-to-user` med `{ receiverId(GUID), encryptedText, keyInfo, iv, version }`.
  `keyInfo` inkluderer mottaker + egen public key (hentet via `POST /api/encryption/users/public-keys`).
- Gruppe: `POST /api/groupconversation/create` (multipart, GUID-er + gruppebilde som fil), deretter
  valgfri kryptert førstemelding via `encryptForConversation` + `POST /api/message`.
- GUID-string lokalt i featuren (`UserSearchResultDTO.id: string`) — isolert fra utsatt Steg 8.

**Filer (features/messages/):**
- models: `UserSearchResultDTO`, `SendMessageToUserRequest/ResponseDTO`, `CreateGroupConversationRequest/ResponseDTO`
- services: `userSearchService`, `messageEncryptionService` (encryptForReceivers/encryptForConversation),
  `newMessageService`, `groupConversationService`, `mapMessagingError`
- hooks: `useNewMessageSearch`, `useNewMessage`
- components: `SearchResultItem`, `SelectedUserChip`, `GroupImagePicker`, `NewMessageComposer`
- screen: `NewMessageScreen`

**Øvrig:**
- `MessagingErrorCode` lagt til i `core/errors/ErrorCode.ts`
- `ApiRoutes`: `conversation.sendToUser`, `groupConversation.create`, `message.send`,
  `encryption.usersPublicKeys/conversationKeys`, `search.usersQuick`
- i18n: `newMessage.*` i `no.ts` + `en.ts`
- Rute omdøpt `NewConversationScreen` → `NewMessageScreen` (navigation.ts, App.tsx, MessageScreen, ProfileScreen)
- `MiniAvatarNative` fikset: hardkodet grønn/grå → `theme.colors.primary`/`border` via `useUnistyles`
- Ingen nye native-pakker → `npx expo start --clear` holder
- Snyk-scan ikke kjørt (auth feilet headless) — kjør `snyk auth` + scan manuelt senere

---

### Implementer ReportBugScreen — fullført

`ReportBugScreen` er implementert og følger Feature Slice-mønsteret fullt ut.

#### Backend-kontrakt

```
POST /api/support/ticket   [Authorize]   multipart/form-data
  Body: Title (string), Description (10-2000 tegn), StepsToReproduce (string, valgfritt),
        ExpectedBehavior (string, valgfritt), ActualBehavior (string, valgfritt)
  Valgfritt: inntil 5 vedlegg (maks 5 MB per fil)
  Svar: { ticketId: int, numberOfAttachments: int }
```

#### Hva som må gjøres

**1. Modeller — `features/reporting/models/`**
- `BugReportRequestDTO.ts` — `{ title: string, description: string, stepsToReproduce?: string, expectedBehavior?: string, actualBehavior?: string }`
- `BugReportResponseDTO.ts` — `{ ticketId: number, numberOfAttachments: number }`

**2. Service — `features/reporting/services/reportService.ts`**
Legg til `submitBugReport` ved siden av eksisterende `submitUserReport`:
```typescript
export async function submitBugReport(
  payload: BugReportRequestDTO,
  appendAttachments?: (formData: FormData) => void
): Promise<Result<BugReportResponseDTO, ReportingErrorCode>>
```
- Bygg `FormData` med alle felt (hopp over tomme valgfrie felt)
- Kall `postFormDataRequest<BugReportResponseDTO>(ApiRoutes.support.ticket, formData)`
- Bruk eksisterende `mapReportError` — feilkodene er identiske

**3. Hook — `features/reporting/hooks/useSubmitBugReport.ts`**
Samme struktur som `useSubmitReport`:
```typescript
export function useSubmitBugReport(opts: { onSuccess?: () => void })
// State: title, description, stepsToReproduce, expectedBehavior, actualBehavior, isSubmitting
// submit(): valider title (påkrevd), description (10-2000 tegn), kall submitBugReport
// Returnerer: alle state-felter + setters + isSubmitting + submit + attachments
```
- Valider: `title` påkrevd (1-200 tegn), `description` 10-2000 tegn
- Feilmeldinger via `showNotificationToastNative` med `LocalToastType.CustomSystemError`
- Suksess via `LocalToastType.CustomSystemNotice` + `opts.onSuccess()`
- Bruk `useReportAttachments` for vedlegg (samme hook som `useSubmitReport`)

**4. Skjerm — `features/reporting/screens/ReportBugScreen.tsx`**
Samme struktur som `ReportUserScreen`:
- `AppHeader` med `t("bug.title")` og tilbake-pil
- `SafeAreaView` + `ScrollView` med `padding: theme.spacing.md, gap: theme.spacing.lg`
- `FormFieldNative` for `title` (enkeltlinje, påkrevd)
- `FormFieldNative` for `description` (`multiline`, `numberOfLines={5}`, `maxLength={2000}`) + teller
- `FormFieldNative` for `stepsToReproduce` (`multiline`, `numberOfLines={3}`, valgfritt)
- `FormFieldNative` for `expectedBehavior` + `actualBehavior` (valgfrie, kortere)
- Vedlegg-seksjon identisk med `ReportUserScreen`
- `ButtonNative` variant="primary" for innsending

**5. Navigasjon**
- Legg til `ReportBugScreen: undefined` i `RootStackParamList` (`types/navigation.ts`)
- Legg til `Stack.Screen name="ReportBugScreen"` i `App.tsx` med `headerShown: false`
- Oppdater navbar-knappen i `MobilNavbarNative.tsx` (linje 283): `() => handleNavigate("ReportBugScreen")`

**6. routes.ts**
`ApiRoutes.support.ticket` finnes allerede — verifiser at URL-en er korrekt (`/api/support/ticket`).

**7. i18n — `no.ts` og `en.ts`**
Nye nøkler under `bug.*`:
```
bug.title              "Rapporter feil"
bug.titleLabel         "Tittel"
bug.titlePlaceholder   "Kort beskrivelse av feilen"
bug.descriptionLabel   "Beskrivelse"
bug.descriptionPlaceholder  "Beskriv feilen i detalj (10–2000 tegn)"
bug.stepsLabel         "Steg for å gjenskape (valgfritt)"
bug.stepsPlaceholder   "1. Gå til... 2. Trykk på..."
bug.expectedLabel      "Forventet oppførsel (valgfritt)"
bug.actualLabel        "Faktisk oppførsel (valgfritt)"
bug.attachmentsLabel   "Skjermbilder / vedlegg (valgfritt)"
bug.addAttachment      "Legg til vedlegg"
bug.attachmentLimit    "Maks 5 vedlegg, 5 MB per fil"
bug.submit             "Send feilrapport"
bug.submitting         "Sender..."
bug.successTitle       "Feilrapport sendt"
bug.successBody        "Takk! Vi ser på saken."
bug.validationTitleRequired  "Tittel er påkrevd."
bug.validationDescriptionMin "Beskrivelsen må være minst 10 tegn."
bug.errorTitle         "Rapporten ble ikke sendt"
```

#### Filer involvert

- `features/reporting/models/BugReportRequestDTO.ts` (ny)
- `features/reporting/models/BugReportResponseDTO.ts` (ny)
- `features/reporting/services/reportService.ts` (legg til `submitBugReport`)
- `features/reporting/hooks/useSubmitBugReport.ts` (ny)
- `features/reporting/screens/ReportBugScreen.tsx` (ny)
- `types/navigation.ts` — legg til `ReportBugScreen`
- `App.tsx` — legg til `Stack.Screen`
- `features/navbar/MobilNavbarNative.tsx` — aktiver bug-knappen
- `core/i18n/locales/no.ts` og `en.ts`

---

### Refaktorer blokker-funksjonalitet — fullført

Når brukeren trykker "Blokker bruker" i `ProfileActionMenuNative` åpnes en bekreftelses-modal. Hele blokker-flyten trenger en gjennomgang:

#### Hva som må gjøres

**1. Sjekk backend-kontrakten**
- Verifiser hva `POST /api/blocked/block/{userId}` og `DELETE /api/blocked/unblock/{userId}` faktisk returnerer
- Oppdater DTOer i `blockService.ts` til å matche — i dag ignoreres responsen helt
- Sjekk om endepunktene bruker GUID string eller int for `userId` (Steg 8-migrering gjelder her)

**2. Flytt til Feature Slice**
- Opprett `features/blocking/` som speiler backend-strukturen
- Flytt og refaktorer:
  - `services/block/blockService.ts` → `features/blocking/services/blockService.ts`
  - `hooks/block/useBlockUser.ts` → `features/blocking/hooks/useBlockUser.ts`
  - `hooks/block/useUnblockUser.ts` → `features/blocking/hooks/useUnblockUser.ts`
- Oppdater alle imports

**3. Feilmønster — bekreftelsesmodal**
- I dag brukes `useConfirmModalNative` for bekreftelse — sjekk at denne følger prosjektmønsteret
- Vurder om bekreftelses-UI skal ligge i `features/blocking/components/` som en dedikert komponent

**4. Result-pattern gjennomgang**
- `blockService.ts` er allerede migrert til Result-pattern
- Verifiser at feilmeldinger fra backend vises korrekt i toast
- Håndter edge case: bruker allerede blokkert / allerede ublokkert (konflikt-respons fra backend)

**5. Localization**
- Nøkler er allerede lagt til under `profile.*` i `no.ts` og `en.ts`
- Vurder om block-nøkler heller bør ligge under eget `block.*`-namespace

#### Filer involvert
- `features/blocking/` (ny)
- `components/profile/ProfileActionMenuNative.tsx`
- `services/block/blockService.ts`
- `hooks/block/useBlockUser.ts` / `useUnblockUser.ts`
- `store/useUserCacheStore.ts` — verifiser `updateUser` med `isBlocked`
- `core/i18n/locales/no.ts` og `en.ts`

---

### Bytt passord (SecurityCredsScreen) — fullført

Inline passordkort implementert direkte i `ProfileSettingsScreen`. `SecurityCredsScreen`, `EditablePasswordFieldsNative`, `EditableEmailFieldNative` og `services/user/security.ts` er slettet.

---

### Refaktorer CryptationScreen — fullført

- `features/profile/hooks/useEncryptionSettings.ts` — ny ViewModel-hook med phase-maskin
- `CryptationScreen.tsx` — fullstendig omskrevet: `useUnistyles`, `useTranslation`, ingen `Alert`, inline bekreftelseskort, ingen `StyleSheet.create`
- `expo-clipboard` installert — `Clipboard.setStringAsync` erstatter deprecated `Clipboard.setString`
- `CryptoServiceBackup.ts` fikset: `uploadPublicKeyToBackend` sender nå `privateKey` som `recoverySeed` (tom streng var feil mot backend-validering som krever 44 tegn)
- i18n-nøkler lagt til under `profile.encryption.*` i `no.ts` og `en.ts`

**Viktig:** `expo-clipboard` krever nytt native bygg — kjør `npx expo run:android` ved neste native bygg.

---

### Neste økt — Endre telefon (3-stegs flyt) — e-post er fullført

Begge flytene krever passordbekreftelse + tofaktor via kode. Mønsteret er identisk med auth-verifiseringsflytene.

#### E-postbytte (3 skjermer)

```
ProfileSettingsScreen
  → ChangeEmailScreen
      Felt: currentPassword + newEmail
      POST /api/account/request-email-change
      Kode sendes til GJELDENDE e-post
  → VerifyCurrentEmailForChangeScreen
      Felt: 6-sifret kode
      POST /api/account/verify-current-email-change
      Kode sendes videre til NY e-post
  → VerifyNewEmailScreen
      Felt: 6-sifret kode
      POST /api/account/verify-email-change
      → Suksess: tilbake til ProfileSettingsScreen
```

#### Telefonbytte (3 skjermer)

```
ProfileSettingsScreen
  → ChangePhoneScreen
      Felt: currentPassword + landskode-picker + newPhone
      POST /api/account/request-phone-change
      Kode sendes til GJELDENDE e-post
  → VerifyEmailForPhoneChangeScreen
      Felt: 6-sifret kode
      POST /api/account/verify-current-email-phone-change
      SMS-kode sendes til NY telefon
  → VerifyNewPhoneScreen
      Felt: 6-sifret kode
      POST /api/account/verify-phone-change
      → Suksess: tilbake til ProfileSettingsScreen
```

#### Felles mønstre
- Navigasjon: `navigation.replace(...)` mellom steg (ingen "tilbake" midt i flyten)
- Result-pattern + AppErrorCode-matching i alle services
- `routes.ts`: legg til `account.requestEmailChange`, `account.verifyCurrentEmailChange`, `account.verifyEmailChange`, `account.requestPhoneChange`, `account.verifyCurrentEmailPhoneChange`, `account.verifyPhoneChange`
- Navigation-typer: legg til alle skjermer i `RootStackParamList` med params (e-post/telefon videresendes mellom steg)
- i18n: nye nøkler under `profile.changeEmail.*` og `profile.changePhone.*`
- Oppdater `ProfileSettingsScreen` med knapper for "Endre e-post" og "Endre telefon"

#### Feilkoder å håndtere
- `AppErrorCode.Conflict` (1003) — e-post/telefon allerede i bruk
- `AppErrorCode.InvalidCode` (4000) — feil kode
- `AppErrorCode.ExpiredCode` (4001) — utgått kode
- `AppErrorCode.TooManyRequests` (1006) — rate limit

#### Nye delte komponenter

**Steg 1 — `components/common/ChangeContactScreen.tsx`**
Generisk skjerm for steg 1 i både e-post- og telefon-bytte. Props:
```typescript
type Props = {
  title: string
  description: string
  newValueField: 'email' | 'phone'   // bestemmer validering + tastatur + landskode-picker
  onSubmit: (currentPassword: string, newValue: string) => Promise<void>
  isSubmitting: boolean
}
```
Inneholder: `PasswordFieldNative` + e-postfelt eller telefonfelt med landskode-picker (gjenbruk fra `SignUpContactFieldsNative`).

**Steg 2 & 3 — `components/common/VerifyCodeCard.tsx`**
Gjenbrukbar 6-sifret kode-input med resend-knapp og nedtelling. Props:
```typescript
type Props = {
  title: string
  description: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  isSubmitting: boolean
}
```
Basert på eksisterende inline-implementasjon i `VerificationScreen` og `PhoneSmsVerificationScreen` (numeric input, maxLength 6, letterSpacing 4, 120s cooldown).

Nye profil-skjermer bruker disse komponentene. Eksisterende auth-skjermer (`VerificationScreen`, `PhoneSmsVerificationScreen`) refaktoreres til å bruke `VerifyCodeCard` **etter** at de nye skjermene er testet og fungerer.

---

### Skriv om AdditionalSettingsNative — fullført

Komponenten er nå i `features/profile/components/AdditionalSettingsNative.tsx` men inneholder fortsatt hardkodede farger, hardkodede strenger, ingen `useUnistyles`, ingen Result-pattern og bruker ikke SettingsController.

#### Backend-endepunkter

```
GET  /api/settings          [Authorize] → returnerer brukerens innstillinger
PUT  /api/settings          [Authorize] → oppdaterer innstillinger
Body: { language, receiveEmailNotifications, receivePushNotifications,
        publicProfile, showGender, showEmail, showPhone, showRegion,
        showPostalCode, showStats, showWebsites, showAge, showBirthday }
```

#### Plan

**1. `features/profile/services/settingsService.ts`** (ny fil)
```typescript
export async function getSettings(): Promise<Result<UserSettingsDTO, ProfileErrorCode>>
export async function updateSettings(settings: UpdateSettingsRequest): Promise<VoidResult<ProfileErrorCode>>
```
- `getSettings` → `getRequest` mot `ApiRoutes.settings.get`
- `updateSettings` → `putRequest` mot `ApiRoutes.settings.update`
- `mapSettingsError` håndterer vanlige `AccountErrorCode`-koder

**2. `ApiRoutes.settings`** — legg til i `routes.ts`:
```typescript
settings: {
  get:    `${API_BASE_URL}/api/settings`,
  update: `${API_BASE_URL}/api/settings`,
}
```

**3. `features/profile/models/UserSettingsDTO.ts`** (ny fil) — speil av backend-response

**4. Skriv om `AdditionalSettingsNative`:**
- `useUnistyles()` — fjern alle hardkodede farger (`#1C6B1C`, `#374151` osv.)
- `useTranslation()` — fjern alle hardkodede strenger ("Saving...", "Saved ✅", "Additional Settings" osv.)
- Hent innstillinger via `getSettings()` ved mount — ikke stol på `initialValues` fra parent
- Lagre via `updateSettings()` med Result-pattern + feilvisning
- `showNotificationToastNative` ved suksess med `t("profile.savedTitle")` / `t("profile.savedBody")`
- Fjern `StyleSheet.create` — bruk inline styles med theme-tokens (samme mønster som `ProfileSettingsScreen`)

**5. `ProfileSettingsScreen`** — fjern `useUpdateUserSettings`-hooken og `settings`-prop til `AdditionalSettingsNative` når komponenten henter data selv.

**6. i18n** — legg til manglende nøkler under `profile`:
- `additionalSettingsTitle`, `languageLabel`, `selectLanguage`
- `savePreferences`

#### Eksisterende problemer å fikse
- `CheckboxFieldNative` har hardkodede farger (`#1C6B1C`, `#ffffff`, `#d1d5db`) — tilpass til `theme.colors.*`
- `AdditionalSettingsNative` har `Alert`-import som ikke brukes — fjern
- Hardkodede `languageOptions`-labels ("NOT IMPLEMENTED YET") — vurder om språkvalg skal være aktivert ennå

### Tidligere neste økt — Fullfør profil-refaktorering (fullført)

**Hva som ble gjort:**
- `AdditionalSettingsNative`: definerer nå eget `AdditionalSettingsValues`-interface med riktig stavemåte (`receiveEmailNotifications`, `receivePushNotifications`). Ikke lenger avhengig av `PublicProfileDTO`.
- `ProfileScreen.tsx`: Refaktorert til å bruke `getPublicProfile(id)` + `PublicProfileResponseDTO`. Ny enkel visning med tema-tokens og i18n. `id` er nå string (ikke Number() lenger for API-kallet). `ProfileActionMenuNative` tar fortsatt `number` inntil Steg 8-migrering.
- `EditProfileScreen.tsx`: Refaktorert til å bruke `useProfileSettings` hook. Enkelt skjema med `FormFieldNative`-komponenter, Result-pattern feilhåndtering, tema-tokens og i18n.
- Slettet: `services/profile/profile.ts`, `components/profile/PublicProfileViewNative.tsx`, `components/ProfileInfoCard.tsx` (alle tre ble dead code etter refaktorering).
- `ProfileSettingsScreen.tsx`: oppdatert til å sende `receiveEmailNotifications`/`receivePushNotifications` (riktig stavemåte) til `AdditionalSettingsNative`.

### Tidligere neste økt — Refaktorer profil-feature (fullført)

**Hva som ble gjort:**
- Opprettet `features/profile/models/` — `MyProfileResponseDTO`, `PublicProfileResponseDTO`, `UpdateProfileRequestDTO`
- `ProfileErrorCode` lagt til i `core/errors/ErrorCode.ts`
- i18n-nøkler for profil lagt til i `no.ts` og `en.ts`
- `ApiRoutes.profile` lagt til i `routes.ts`
- `features/profile/services/profileService.ts` — `getMyProfile`, `getPublicProfile`, `updateProfile` med Result-pattern
- `features/profile/hooks/useMyProfile.ts` — henter profil på mount
- `features/profile/hooks/useProfileSettings.ts` — ViewModel for settings-skjermen
- `features/profile/screens/ProfileSettingsScreen.tsx` — theme tokens, i18n, Result-pattern, ingen hardkodede farger/tekst
- `App.tsx` peker nå på ny skjerm, gammel slettet
- Slettet `hooks/useUserSettings.ts` og `hooks/useProfile.ts`
- Backend: `MyProfileResponse` ryddet (kun `UserProfile`-felter), `PublicProfileResponse` mapper-bug fikset (`Id`, `FullName`, `ProfileImageUrl` populeres korrekt)
- Fjernet felt som ikke finnes i backend (`middleName`, `gender`, `region`, `postalCode`)

### Tidligere neste økt — Test login/logout (fullført)

### Tidligere neste økt — Verifiser SignalR (fullført)

1. Sjekk at alle SignalR-relaterte filer ligger under `features/` ✅
2. Verifiser at hub-metoder og event-navn stemmer med backend (`ChatHub.cs`) ✅
3. Verifiser at DTOer frontend mottar via SignalR matcher backend sine response-klasser ✅
4. Flytt filer og oppdater imports ved behov ✅

---

## Hva som ble gjort denne økten

### Store-split migrering — fullført

`useChatStore` ble delt i to stores i en tidligere økt, men ~16 filer refererte fortsatt til felt som ikke lenger eksisterte i noen store. Symptomet var `TypeError: Cannot read property 'length' of undefined` ved oppstart.

**Rot-årsak:** `pendingMessageRequests`, `hasLoadedPendingRequests`, `setPendingMessageRequests`, `addPendingRequest`, `removePendingRequest`, `setHasLoadedPendingRequests` og `pendingLockedConversationId` ble aldri lagt til noen store under split-migreringen.

**Løsning:**
- `useConversationStore`: lagt til `pendingMessageRequests`, `hasLoadedPendingRequests` og tilhørende actions
- `useChatStore`: lagt til `pendingLockedConversationId` og `setPendingLockedConversationId`
- Begge stores bumped til `version: 3` — trigger `migrate()` som rydder stale AsyncStorage
- 16+ filer migrert til riktig store: `usePendingMessageRequests.ts`, `PendingRequestsListNative.tsx`, `handleConversationSync.ts`, `finalizeConversationApproval.ts`, `syncPendingConversation.ts`, `useApproveMessageRequest.ts`, `approveMessageRequestLogic.ts`, `getMyConversations.ts`, `useConversationHeader.ts`, `useLeaveGroup.ts`, `MessageScreen.tsx`, `PendingConversationsScreen.tsx`, `handleConversationUpdated.ts`, `useGroupSettingsPopoverNative.ts`, `useUnreadConversationIds.ts`, `getMessagesForConversation.ts`

### MessageScreen.tsx — footer refaktorert

Footer med Søk, Varsler og Ny samtale refaktorert til prosjektmønsteret:

- `StyleSheet.create` fjernet — all styling er inline med `theme.*`
- Alle hardkodede farger → `theme.colors.*`
- Alle hardkodede strenger → `t("conversation.*")`
- Nye i18n-nøkler i `no.ts` og `en.ts`: `listSearchPlaceholder`, `listSearchNoResults`, `listSearchWriteHint`, `initializing`
- `FlatList` → `FlashList` for søkeresultater
- `console.log` fjernet, ubrukte imports fjernet
- `SafeAreaView` fra `react-native-safe-area-context`
- Notifikasjonsbadge rendres kun når `count > 0`

---

## Hva som ble gjort forrige økt

### Profil-feature — fullstendig refaktorering

**To separate profil-skjermer:**
- `features/profile/screens/MyProfileScreen.tsx` — eget profil, leser direkte fra bootstrap-storen (`currentUser` + `profile`), null nettverkskall
- `screens/profile/ProfileScreen.tsx` — andres profil, kaller `getPublicProfile(id)`, redirecter til `MyProfile` hvis `id === currentUserId`

**Delte komponenter i `features/profile/components/`:**
- `ProfileHeaderNative.tsx` — avatar, navn, bio, grunninfo (alder, land, kontaktinfo), nettsteder. Brukes av begge profil-skjermene.
- `WebsiteListInputNative.tsx` — individuelle URL-inputs med add/remove (fra gammel `ProfileInfoCardNative`-struktur)
- `CountryPickerFieldNative.tsx` — søkbar landpicker, gjenbruker `SearchableSelectModalNative` og `fetchCountries`

**Hooks i `features/profile/hooks/`:**
- `useCountryName.ts` — ISO-kode → landnavn via `fetchCountries` API, modul-nivå cache

**`EditProfileScreen.tsx`:**
- Bruker `useProfileSettings` + `DatePickerNative` (eksisterende) + `CountryPickerFieldNative` + `WebsiteListInputNative`
- Oppdaterer `useUserCacheStore.setProfile()` etter vellykket lagring → `MyProfileScreen` reflekterer endringer umiddelbart

**Navigasjon:**
- `MyProfile` lagt til i `RootStackParamList` (ingen params)
- Navbar → `MyProfile`, `ProfileSettingsScreen` → `MyProfile`
- Fikset feil param-navn `userId` → `id` i `UserActionPopover`, `NotificationsModalNative`, `NotificationToastNative`

**Andre fikser:**
- `ProfileAvatarNative` — avatar-ring byttet fra hardkodet grønn `#1C6B1C` til `theme.colors.primary` (gull)
- `AdditionalSettingsNative` — eget `AdditionalSettingsValues`-interface, riktig stavemåte `receiveEmailNotifications`
- Slettet dead code: `services/profile/profile.ts`, `components/profile/PublicProfileViewNative.tsx`, `components/ProfileInfoCard.tsx`

---

## Hva som ble gjort forrige økt

### SignalR — kontrakt og mappestruktur

**Event-navn fikset i `eventProcessorNative.ts`:**
- Byttet fra SCREAMING_SNAKE_CASE til PascalCase som matcher `SyncEventType`-enumen i backend
- `REQUEST_RECEIVED` → `PendingConversationCreated`
- `REACTION` → `ReactionUpdated` + `ReactionRemoved` (to separate backend-typer)
- `USER_PROFILE_UPDATED` → `UserProfileUpdated` + `MyProfileUpdated`
- `USER_BLOCKED_UPDATED` → `UserBlocked` + `UserUnblocked`

**Legacy events fjernet** (fantes ikke i backend `SyncEventTypes.cs`):
- `FRIEND_REQUEST_RECEIVED`, `FRIEND_ADDED`, `FRIEND_REQUEST_DECLINED`, `FRIEND_REMOVED`
- `MESSAGE_NOTIFICATION_CREATED`, `MARK_AS_READ`, `MARK_ALL_AS_READ`, `NOTIFICATION_CREATED`
- `REQUEST_RECEIVED`

**Filer slettet:**
- `features/sync/handlers/handleNotificationCreated.ts` — legacy debug-kode
- `features/sync/handlers/notificationSyncHandlers.ts` — 100% kommentert ut

**Feature Slice-rydding:**
- `hooks/signalr/useChatHub.ts` → `features/signalr/hooks/useChatHub.ts`
- `components/bootstrap/AppInitializerNative.tsx` → `features/bootstrap/AppInitializerNative.tsx`
- `components/bootstrap/` (tom mappe) — slettet

**`useChatHub` refaktorert:**
- Bruker nå singleton fra `chatHub.ts` via `createChatConnection()` — ingen duplikat tilkoblingslogikk
- Fjernet: egen `startConnection`, `setTimeout`-retry, duplikat `AppState`-lytter
- Fikset `userId: number` → `userId: string` (GUID-kontrakt)

### SignalR-arkitektur (avklart)

SignalR brukes til **to ting** — ikke til syncing:
1. **Real-time meldinger** — `useChatHub` mottar push-events direkte (`receivemessage`, `grouprequestcreated` osv.)
2. **Reconnect-trigger** — når SignalR reconnetter, starter `useSyncNative` en recovery sync via HTTP

**Selve syncing skjer via HTTP:**
- `GET /api/SyncEvent/sync` — backend returnerer events siden sist (persistert i DB via `DeviceSyncState`)
- Prosesseres av `eventProcessorNative` med korrekte PascalCase event-navn

---

## Hva som ble gjort forrige økt

### Bootstrap og navigasjonsflyt

**Ny navigasjonsflyt:**
```
Første innlogging:
  Login → MFA → E2EESetupScreen → login() → isLoggedIn = true
  → BootstrapLoadingScreen (passiv spinner)
  → AppInitializerNative kjører full bootstrap
  → phase = 'done' → navigation.reset() → Home

Returning user (app åpner):
  isLoggedIn = true → BootstrapLoadingScreen
  → AppInitializerNative: isBootstrapped + cache gyldig
  → goHome() umiddelbart
  → getSyncUpdates() bakgrunnen (ingen blokkering)
      requiresFullRefresh = true → full bootstrap i bakgrunnen
      events → apply events
```

**`AppInitializerNative`** — fullstendig omskrevet (nå i `features/bootstrap/`)
**`BootstrapLoadingScreen`** — rent passiv (kun ActivityIndicator)
**`useBootstrap`** — fullstendig ny med inline distribusjon til stores
**`useOnlineStatus`** — ny versjon i `features/bootstrap/hooks/`

### Sync-arkitektur (forenkling)

- `GET /api/SyncEvent/sync` — ingen parametere, backend tracker per enhet via JWT `device_id`
- `SyncResponseDTO` — fjernet `newSyncToken` og `message`
- Ingen client-side token nødvendig

---

## Arkitektur-oversikt

### Bootstrap-flyt (AppInitializerNative)

```
E2EE initialized?
  Nei → vent

Ja →
  isBootstrapped && cache gyldig?
    Ja (returning user) → goHome() umiddelbart
                        → getSyncUpdates() bakgrunnen
                            requiresFullRefresh → runBootstrap() bakgrunnen
                            events → apply events
    Nei (ny bruker)    → runBootstrap()
                        → phase = 'done' → goHome()
```

### Sync-flyt (useSyncNative — løpende etter Home)

```
SignalR reconnect  → performRecoverySync('recovery') via HTTP
App-foreground     → performRecoverySync('appstate') via HTTP
Nettverk tilbake   → performRecoverySync('network') via HTTP
```

### SignalR-flyt (useChatHub — sanntid)

```
receivemessage          → handleMessage (meldingsfeature)
grouprequestcreated     → handleGroupRequestCreated
messagerequestcreated   → handleMessageRequestReceived
groupnotificationupdated → handleGroupNotificationUpdated
messagedeleted          → handleMessageDeleted
userprofileupdated      → updateUser i cache
userblockedupdated      → setUser i cache
```

---

## Viktig teknisk info

### SignalR — backend håndterer presence
- Online: `OnConnectedAsync`
- Offline: `OnDisconnectedAsync`
- Heartbeat: `hub.invoke('Heartbeat')` hvert 30. sek
- `StaleConnectionCleanupTask` rydder connections uten heartbeat
- Hub-navn i backend: `UserHub` (ikke ChatHub)

### Sync — backend tracker state per enhet
- `DeviceSyncState` per `UserDevice` i DB
- Backend bestemmer hvilke events som er uleste basert på `LastSyncedEventTime`
- Ingen client-side token nødvendig
- > 30 events → `RequiresFullRefresh = true`
- Inaktiv > 7 dager → `RequiresFullRefresh = true`

### SyncEventType — backend enum (PascalCase)
```
NewMessage, ConversationCreated, PendingConversationCreated
ConversationAccepted, ConversationRequestAccepted, ConversationRejected
ConversationRestored, ConversationArchived, ConversationLeft
GroupInviteReceived, GroupInviteAccepted, GroupInviteAcceptedByMe
GroupInviteDeclined, GroupMemberLeft, GroupInfoUpdated
MessageDeleted, ReactionUpdated, ReactionRemoved
MyProfileUpdated, UserProfileUpdated, MyProfileDetailsUpdated, MySettingsUpdated
UserBlocked, UserUnblocked
```

### E2EE init
- Kjøres ved hver app-åpning (~200–400ms)
- Kjøres parallelt med AppInitializerNative (ikke blokkerende for returning user)

---

## Åpne punkter

### App kræsjer ved retur fra kamera / ekstern handling

Appen kræsjer når brukeren åpner kamera via "Legg til vedlegg", tar et bilde, og returnerer til appen. React Native kan drepe JS-tråden eller unmounte komponenten mens appen er i bakgrunnen (spesielt på Android med lav RAM).

#### Hva som må undersøkes

1. **`AppState`-håndtering i vedleggsskjermer** — sjekk om `AttachmentPicker` / kamera-flyten har noen `AppState`-lytter som kan forstyrre
2. **`expo-image-picker` / kamera-modul** — verifiser at kamera-kallet bruker `await` og at komponenten ikke er unmountet når resultatet returnerer
3. **Android `android:hardwareAccelerated` og minnegrenser** — på Android kan systemet drepe bakgrunnsappen; løsningen er gjerne `android:persistent` eller å sikre at state overlever en `AppState` `background → active`-syklus
4. **`useReportAttachments` + `AppState`** — vurder å ta vare på vedlegg i en `useRef` eller Zustand-store i stedet for lokal `useState`, slik at state overlever en app-restart
5. **Error boundary** — legg til en `ErrorBoundary` rundt rapporterings-skjermene som fanger krasj og viser en feilmelding i stedet for å kræsje hele appen

#### Filer å se på
- `features/reporting/hooks/useReportAttachments.ts`
- `components/files/filepicker/AttachmentPicker.tsx`
- `App.tsx` — sjekk om det finnes en global `ErrorBoundary`

---



### Steg 4 — Test gjenstående scenarioer (manuelt i appen)
- **Login/logout** — logg inn og ut flere ganger, verifiser SignalR kobler til/fra korrekt
- **Scenario B** — logg inn på samme enhet igjen, verifiser at E2EESetupScreen passerer gjennom uten UI
- **Scenario C** — avinstaller app, logg inn på nytt, skriv inn backup-phrase
- **Reset password** — test hele den nye 4-stegs flyten

### Steg 5 — EmailTemplates.LoginMfa
Opprett `EmailTemplates.LoginMfa(EmailCodeDto)` i AFBack — basert på `EmailTemplates.Verification`.

### Steg 6c — Gjenstående backend-opprydding
- `TokenService.RevokeTokenAsync` og `RevokeAllTokensForUserAsync` — mangler transaksjon
- `AuthService.ReportUnauthorizedChangeAsync` — flere `UpdateAsync`-kall uten transaksjon
- `LoginHistoryService`, `UserDeviceService` — sjekk om de mangler `ct`-parametere

### Steg 7 — Tema-gjennomgang av gjenværende skjermer
- `CryptationScreen` — hardkodede farger, ingen useUnistyles, ingen i18n, deprecated Clipboard

### Steg 4b — Skriv flere enhetstester
1. `features/auth/services/__tests__/encryptionService.test.ts`
2. `features/auth/hooks/__tests__/useE2EESetup.test.ts`
3. `features/auth/services/__tests__/authService.test.ts`
4. `features/auth/hooks/__tests__/useLogin.test.ts`

### Steg 8 — Bruker-id `number`→`string`-migrering — FULLFØRT (2026-06-28)
`UserSummaryDTO.id` + alle bruker-id-felt i delte DTO-er er nå `string` (GUID), matcher backend
`UserSummaryDto.Id`. `useUserCacheStore` nøkler nå `Record<string, ...>` (persist v2→v3, tømmer gammel
cache). `UserBootstrapDTO` er strukturelt tilordningsbar til `UserSummaryDTO` — `currentUser`-mismatchen
er borte, og den latente "er dette min melding?"-buggen (`string === number` → alltid false) er rettet.
~30 konsumentfiler oppdatert; `tsc` gir null nye feil vs baseline. Gjenstår: konsolider `features/messages/`
(NewMessage) inn i `features/messaging/` — del av Feature Slice-flyttingen i oppryddingspasset øverst.

### Steg 9 — Over-engineering og oppryddingsgjennomgang
- `useConversationUpdate` er en unødvendig wrapper
- `useGetDeletedConversations` og `useGetRejectedConversations` er identiske
- `useMessageNotifications` har `loading` i dependency-array

---

## Hurtigreferanse — all installert infrastruktur

### Tema
```tsx
const { theme } = useUnistyles();
color: theme.colors.primary          // gull (#D4A017) i begge temaer
backgroundColor: theme.colors.background
// ALDRI: hardkodede farger
```

### AppErrorCode / API-feil
```typescript
import { throwProblemDetails, ApiError } from "@/core/errors/ProblemDetails";
import { AppErrorCode } from "@shared/types/error/AppErrorCode";

if (error instanceof ApiError) {
  switch (error.appCode) {
    case AppErrorCode.EmailNotConfirmed: ...  // 2002
    case AppErrorCode.PhoneNotConfirmed: ...  // 2003
    case AppErrorCode.InvalidCredentials: ... // 2000
    case AppErrorCode.MfaRequired: ...        // 2006
    case AppErrorCode.TooManyRequests: ...    // 1006
    case AppErrorCode.InvalidCode: ...        // 4000
    case AppErrorCode.ExpiredCode: ...        // 4001
  }
}
```

### Result-pattern
```tsx
const result = await loginUser(email, password);
if (!result.success) {
  switch (result.code) {
    case AuthErrorCode.InvalidCredentials: ...
    case AuthErrorCode.EmailNotVerified: ...
    case AuthErrorCode.PhoneNotVerified: ...
    case AuthErrorCode.MfaRequired: ...
  }
  return;
}
```

### Globalisering
```tsx
const { t } = useTranslation();
t("auth.login")
// ALDRI: hardkodet tekst
```

### Kjøre lokalt
```bash
# Backend
cd C:\Users\fredr\ActivityFinder\AFBack && dotnet run

# Frontend (JS-endringer)
cd C:\Users\fredr\ActivityFinder\AFMobile && npx expo start --clear

# Frontend (ny native pakke installert)
npx expo run:android
```
