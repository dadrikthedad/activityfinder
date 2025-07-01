import { MessageNotificationDTO } from "./MessageNotificationDTO";

export interface GroupDisbandedDto {
  conversationId: number;
  groupName: string;
  groupImageUrl?: string;
  disbandedAt: string;
  notification?: MessageNotificationDTO; // Assuming you have this interface
}