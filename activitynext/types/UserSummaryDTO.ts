// Interface til UserSummary som henter profilbilde, brukerid og fult navn
export interface UserSummaryDTO {
    id: number;
    fullName: string;
    profileImageUrl: string | null;
    groupRequestStatus?: GroupRequestStatus | string | null;
  }

  export enum GroupRequestStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Creator = 3
}