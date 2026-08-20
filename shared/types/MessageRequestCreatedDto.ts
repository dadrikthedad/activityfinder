// Brukes når en bruker lager en meldingsforespørsel til en annen bruker og sender via backend
import { MessageNotificationDTO } from "./MessageNotificationDTO";
export interface MessageRequestCreatedDto {
  senderId: string;
  receiverId: string;
  conversationId: number;
  notification?: MessageNotificationDTO; // 👈 legg til denne linjen
}