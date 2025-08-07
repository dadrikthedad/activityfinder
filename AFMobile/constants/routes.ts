// AFMobile/constants/api.ts
import Constants from 'expo-constants';

// Database URL-en for React Native/Expo
export const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl ||
  "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";