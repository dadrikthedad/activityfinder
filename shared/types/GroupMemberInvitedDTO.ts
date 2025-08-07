import { MessageNotificationDTO } from "./MessageNotificationDTO";
export interface GroupMemberInvitedDto {
  conversationId: number;
  inviterUserId: number;
  inviterName: string;
  invitedUserIds: number[];
  invitedUserNames: string[];
  invitedAt: Date;
  notification?: MessageNotificationDTO;
  isSilent?: boolean;
}