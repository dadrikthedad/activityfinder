// Brukes når en bruker lager en meldingsforespørsel til en annen bruker og sender via backend
export interface MessageRequestCreatedDto {
  SenderId: number;
  ReceiverId: number;
  ConversationId: number;
}