// Brukes ved sending av notfications, feks så kan vi se hvordan type notifcation det er i notifcation-menyen og vi bruker UserSummaryDTO til å se bilde, navn og link til siden dems
import { UserSummaryDTO } from "./UserSummaryDTO";

export type NotificationEntityType =
  | "None"
  | "Post"
  | "Comment"
  | "FriendInvitation"
  | "FriendInvAccepted"
  | "EventInvitation";

export interface NotificationDTO {
  id: number;
  type: NotificationEntityType;
  message?: string;
  isRead: boolean;
  createdAt: string;

  postId?: number | null;
  commentId?: number | null;
  friendInvitationId?: number | null;
  eventInvitationId?: number | null;
  conversationId?: number | null;

  relatedUser?: UserSummaryDTO | null;
}