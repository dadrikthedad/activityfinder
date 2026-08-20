// features/messages/models/CreateGroupConversationRequestDTO.ts
// Speil av CreateGroupConversationRequest.cs i AFBack (multipart/form-data).
// Sendes til POST /api/groupconversation/create.

import { RNFile } from "@/utils/files/FileFunctions";

export interface CreateGroupConversationRequestDTO {
  // Brukerene som skal motta gruppeforespørsel (GUID-strenger)
  receiverIds: string[];
  // Gruppenavn (1-100 tegn, påkrevd)
  groupName: string;
  // Valgfri gruppebeskrivelse (maks 1000 tegn)
  groupDescription?: string;
  // Valgfritt gruppebilde — lastes opp som del av multipart-requesten
  groupImage?: RNFile;
}
