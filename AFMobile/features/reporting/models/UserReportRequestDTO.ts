import { UserReportReason } from "./UserReportReason";

export interface UserReportRequestDTO {
  reportedUserId: string;
  reason: UserReportReason;
  description: string;
}
