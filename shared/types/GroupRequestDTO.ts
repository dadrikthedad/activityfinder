import { MessageNotificationDTO } from "./MessageNotificationDTO";

export interface GroupRequestCreatedDto {
  groupRequestId: number;
  senderId: string;
  receiverId: string;
  conversationId: number;
  groupName?: string;
  groupImageUrl?: string;
  creatorId?: string;
  requestedAt: Date;
  notification?: MessageNotificationDTO;
}