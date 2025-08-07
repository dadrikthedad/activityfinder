// Brukes når en bruker lager en meldingsforespørsel til en annen bruker og sender via backend
import { MessageNotificationDTO } from "./MessageNotificationDTO";
export interface MessageRequestCreatedDto {
  senderId: number;
  receiverId: number;
  conversationId: number;
  notification?: MessageNotificationDTO; // 👈 legg til denne linjen
}