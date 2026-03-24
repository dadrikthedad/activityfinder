// core/api/routes.ts
// Sentral API-konfigurasjon for AFMobile
import Constants from 'expo-constants';

const PROD_API_URL = "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? PROD_API_URL;

export const ApiRoutes = {
  auth: {
    login:              `${API_BASE_URL}/api/auth/login`,
    signup:             `${API_BASE_URL}/api/auth/signup`,
    logout:             `${API_BASE_URL}/api/auth/logout`,
    logoutAll:          `${API_BASE_URL}/api/auth/logout-all`,
    reportUnauthorized: `${API_BASE_URL}/api/auth/report-unauthorized-change`,
  },
  token: {
    refresh: `${API_BASE_URL}/api/token/refresh`,
  },
  verification: {
    resend:       `${API_BASE_URL}/api/verification/resend-verification`,
    verifyEmail:  `${API_BASE_URL}/api/verification/verify-email`,
    // Begge SMS-endepunkter bruker email som identifikator (ikke phoneNumber)
    resendPhone:  `${API_BASE_URL}/api/verification/resend-phone-verification`,
    verifyPhone:  `${API_BASE_URL}/api/verification/verify-phone`,
  },
  passwordReset: {
    forgot:         `${API_BASE_URL}/api/password-reset/forgot-password`,
    verifyEmail:    `${API_BASE_URL}/api/password-reset/verify-password-reset-email`,
    sendSms:        `${API_BASE_URL}/api/password-reset/send-password-reset-sms`,
    verifySms:      `${API_BASE_URL}/api/password-reset/verify-password-reset-sms`,
    reset:          `${API_BASE_URL}/api/password-reset/reset-password`,
    changePassword: `${API_BASE_URL}/api/password-reset/change-password`,
  },
  geography: {
    countries:   `${API_BASE_URL}/api/geography/countries`,
    regions:     (countryCode: string) => `${API_BASE_URL}/api/geography/regions/${encodeURIComponent(countryCode)}`,
    geolocation: `${API_BASE_URL}/api/geography/geolocation`,
  },
  account: {
    requestEmailChange:      `${API_BASE_URL}/api/account/request-email-change`,
    verifyCurrentEmail:      `${API_BASE_URL}/api/account/verify-current-email-change`,
    verifyEmailChange:       `${API_BASE_URL}/api/account/verify-email-change`,
    requestPhoneChange:      `${API_BASE_URL}/api/account/request-phone-change`,
    verifyCurrentEmailPhone: `${API_BASE_URL}/api/account/verify-current-email-phone-change`,
    verifyPhoneChange:       `${API_BASE_URL}/api/account/verify-phone-change`,
    updateName:              `${API_BASE_URL}/api/account/name`,
    updateProfileImage:      `${API_BASE_URL}/api/account/profileimage`,
    removeProfileImage:      `${API_BASE_URL}/api/account/profileimage`,
  },
} as const;
