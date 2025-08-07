import { MessageNotificationDTO } from "./MessageNotificationDTO";

export interface GroupRequestCreatedDto {
  groupRequestId: number;
  senderId: number;
  receiverId: number;
  conversationId: number;
  groupName?: string;
  groupImageUrl?: string;
  creatorId?: number;
  requestedAt: Date;
  notification?: MessageNotificationDTO;
}