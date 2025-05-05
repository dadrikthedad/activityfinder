// Interface til UserSummary som henter profilbilde, brukerid og fult navn
export interface UserSummaryDTO {
    id: number;
    fullName: string;
    profileImageUrl: string | null;
  }