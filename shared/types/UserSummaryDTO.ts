// Interface til UserSummary som henter profilbilde, brukerid og fult navn
export interface UserSummaryDTO {
    id: number;
    fullName: string;
    profileImageUrl: string | null;

    // Ekstra logikk for samhandlig med andre brukere
    isFriend?: boolean;
    isBlocked?: boolean;
    hasBlockedMe?: boolean;
    lastUpdated?: number; // Unix timestamp
  }

  export enum GroupRequestStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Creator = 3
}