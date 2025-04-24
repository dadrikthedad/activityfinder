// Brukes ved sending av notfications, feks så kan vi se hvordan type notifcation det er i notifcation-menyen og vi bruker UserSummaryDTO til å se bilde, navn og link til siden dems
export interface UserSummaryDTO {
    id: number;
    fullName: string;
    profileImageUrl: string | null;
  }
  
  export interface NotificationDTO {
    id: number;
    type: string;
    message?: string;
    isRead: boolean;
    createdAt: string;
    relatedUser?: UserSummaryDTO | null;
  }