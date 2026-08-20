// features/messages/models/SendMessageToUserResponseDTO.ts
// Speil av SendMessageToUserResponse.cs i AFBack.
// Backend sender den fulle samtalen i responsen, så vi bruker den direkte til å legge
// samtalen i listen (ingen ekstra getConversationById-runde nødvendig).

import { ConversationDTO } from "@shared/types/ConversationDTO";

export interface SendMessageToUserResponseDTO {
  // Samtale-ID (ny eller eksisterende)
  conversationId: number;
  // True hvis dette er en nyopprettet samtale
  isNewConversation: boolean;
  // True hvis mottaker aksepterte en pending-samtale ved å motta melding
  wasAccepted: boolean;
  // Hele samtalen (ConversationResponse) — brukes til å fylle listen direkte
  conversation: ConversationDTO;
}
