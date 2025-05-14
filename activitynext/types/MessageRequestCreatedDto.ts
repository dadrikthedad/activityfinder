// Brukes når en bruker lager en meldingsforespørsel til en annen bruker og sender via backend
export interface MessageRequestCreatedDto {
  senderId: number;
  receiverId: number;
  conversationId: number;
}