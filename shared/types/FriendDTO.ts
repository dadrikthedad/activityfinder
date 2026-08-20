// Brukes til å hente vennene til hook useFriends.ts som vises på freinds/page.tsx. Henter FriendsDTO.cs i backend

  
export interface FriendDTO {
    currentUserId: string;
    createdAt: string;
    userToFriendUserScore: number;
    friendUserToUserScore: number;
    friend: {
      id: string;
      fullName: string;
      profileImageUrl: string | null;
    };
  }