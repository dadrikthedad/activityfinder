import { MessageNotificationDTO } from "./MessageNotificationDTO";
export interface PaginatedNotifications {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  notifications: MessageNotificationDTO[];
}