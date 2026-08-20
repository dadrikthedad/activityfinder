export interface BlockedUserResponseDTO {
  userId: string;
  fullName: string;
  profileImageUrl: string | null;
  blockedAt: string;
}
