// utils/messages/extractErrorMessage.ts
// Felles hjelpefunksjon for å trekke ut lesbar feilmelding fra ukjent Error-type.
// Brukes av useSendMessage og useSendEncryptedMessage.

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      return parsed.details || parsed.message || err.message;
    } catch {
      return err.message;
    }
  }
  return "Noe gikk galt";
}
