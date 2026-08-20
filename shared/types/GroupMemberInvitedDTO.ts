import { MessageNotificationDTO } from "./MessageNotificationDTO";
export interface GroupMemberInvitedDto {
  conversationId: number;
  inviterUserId: string;
  inviterName: string;
  invitedUserIds: string[];
  invitedUserNames: string[];
  invitedAt: Date;
  notification?: MessageNotificationDTO;
  isSilent?: boolean;
}