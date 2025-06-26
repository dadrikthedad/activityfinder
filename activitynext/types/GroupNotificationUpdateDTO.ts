import { MessageNotificationDTO } from "./MessageNotificationDTO";
import { UserSummaryDTO } from "./UserSummaryDTO";

export interface GroupNotificationUpdateDTO {
  userId: number;
  notification: MessageNotificationDTO;
  isNewNotification: boolean;
  groupEventType: GroupEventType;
  affectedUserNames: string[];
  affectedUsers: UserSummaryDTO[];
}

export enum GroupEventType {
  MemberInvited = 1,
  MemberAccepted = 2,
  MemberLeft = 3,
  MemberRemoved = 4,
  GroupCreated = 5,
  GroupNameChanged = 6,
  GroupImageChanged = 7
}