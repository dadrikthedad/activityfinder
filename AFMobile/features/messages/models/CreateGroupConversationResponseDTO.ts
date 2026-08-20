// features/messages/models/CreateGroupConversationResponseDTO.ts
// Speil av CreateGroupConversationResponse.cs i AFBack.

export interface CreateGroupConversationResponseDTO {
  // Den nyopprettede gruppe-samtalens ID
  conversationId: number;
  // Feilmelding hvis gruppebilde-opplasting feilet (null hvis OK eller ikke sendt)
  groupImageUploadError?: string | null;
}
