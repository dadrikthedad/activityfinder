// Her henter vi infromasjon fra alle klassene User, Profile og Settings for å vise i profil samt innstillinger til profil. Henter tilsvarende fra Backend med samme navn
export interface PublicProfileDTO {
    // User
    userId: number;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
    country?: string;
    region?: string;
    postalCode?: string;
    dateOfBirth: string; // DateTime i backend = string i frontend etter fetch
    age?: number;
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
    showPostalCode: boolean;
    showStats: boolean;
    showWebsites: boolean;
    showAge: boolean;
    showBirthday: boolean;
    language: string;
    recieveEmailNotifications: boolean;
    recievePushNotifications: boolean;
  
    // Kontroll
    isOwner: boolean;
  }