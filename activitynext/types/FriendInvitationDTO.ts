// Brukes til å hente venneinvitasjoner til hook useFriendInvitation.ts som vises på friends/page.tsx. Henter FriendInvitationDTO.cs i backend
export interface UserSummaryDTO {
  id: number;
  fullName: string;
  profileImageUrl: string | null;
}

export interface FriendInvitationDTO {
  id: number;
  receiverId: number;
  userSummary: UserSummaryDTO;
  status: "pending" | "accepted" | "declined";
  sentAt: string;
}