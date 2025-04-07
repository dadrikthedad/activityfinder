export interface PublicProfileDTO {
    // User
    userId: number;
    fullName?: string;
    country?: string;
    region?: string;
    postalCode?: string;
    dateOfBirth: string; // DateTime i backend = string i frontend etter fetch
    gender?: "Male" | "Female" | "Unspecified";
  
    // Profile
    profileImageUrl?: string;
    bio?: string;
    websites: string[];
    contactEmail?: string;
    contactPhone?: string;
    updatedAt?: string;
    lastSeen?: string;
  
    totalLikesGiven: number;
    totalLikesRecieved: number;
    totalCommentsMade: number;
    totalMessagesRecieved: number;
    totalMessagesSendt: number;
  
    // UserSettings
    publicProfile: boolean;
    showGender: boolean;
    showEmail: boolean;
    showPhone: boolean;
    showRegion: boolean;
  
    // Kontroll
    isOwner: boolean;
  }