// henter fra ProfileDTO.cs i backend
export interface Profile {
    userId: number;
    profileImageUrl: string;
    bio: string;
    websites: string[];
    updatedAt: string;
    totalLikesGiven: number;
    totalLikesRecieved: number;
    totalCommentsMade: number;
    totalMessagesRecieved: number;
  }
  