// Brukes til å hente vennene til hook useFriends.ts som vises på freinds/page.tsx. Henter FriendsDTO.cs i backend
export interface FriendUserDTO {
    id: number;
    fullName: string;
    profileImageUrl: string | null;
  }
  
  export interface FriendDTO {
    currentUserId: number;
    friendId: number; // Behold gjerne hvis du bruker den som nøkkel
    friendUser: FriendUserDTO; // ← Ny: for navn og bilde
    createdAt: string;
    userToFriendUserScore: number;
    friendUserToUserScore: number;
  }