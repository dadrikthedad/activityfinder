// Brukes til å hente venneinvitasjoner til hook useFriendInvitation.ts som vises på friends/page.tsx. Henter FriendInvitationDTO.cs i backend
export interface FriendInvitationDTO
{
    id: number;
  senderId: number;
  receiverId: number;
  status: "pending" | "accepted" | "declined"; // kan gjøres mer type-safe
  sentAt: string;
}
