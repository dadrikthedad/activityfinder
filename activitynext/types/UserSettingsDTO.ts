// Henter informasjon fra UserSettingsDTO Hvor brukes den?
export interface UserSettingsDTO {
    publicProfile?: boolean;
    showGender?: boolean;
    showEmail?: boolean;
    showPhone?: boolean;
    showRegion?: boolean;
    showPostalCode: boolean;
    showStats: boolean;
    showWebsites: boolean;
    language?: string;
    recieveEmailNotifications?: boolean;
    recievePushNotifications?: boolean;
  }