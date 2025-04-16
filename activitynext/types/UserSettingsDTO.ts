// Henter informasjon fra UserSettingsDTO, brukes i hook/useUpdateUserSettings.ts
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