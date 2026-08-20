// features/messages/models/SendMessageToUserRequestDTO.ts
// Speil av SendMessageToUserRequest.cs i AFBack.
// Brukes ved første melding i en 1-til-1-samtale (POST /api/conversation/send-to-user).

export interface SendMessageToUserRequestDTO {
  // Mottakerens bruker-ID (GUID-streng)
  receiverId: string;

  // ── KrypteringsInfo ──
  // Kryptert meldingstekst (markør "encrypted" fra EncryptMessageService)
  encryptedText: string;
  // Per-mottaker forseglet nøkkel: { userId(GUID): base64 } — må inneholde både mottaker og avsender
  keyInfo: Record<string, string>;
  // Initialization Vector (base64)
  iv: string;
  // Krypteringsversjon
  version: number;
}
