// core/api/routes.ts
// Sentral API-konfigurasjon for AFMobile
import Constants from 'expo-constants';

const PROD_API_URL = "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? PROD_API_URL;

export const ApiRoutes = {
  auth: {
    login:              `${API_BASE_URL}/api/auth/login`,
    verifyMfa:          `${API_BASE_URL}/api/auth/login/verify-mfa`,
    signup:             `${API_BASE_URL}/api/auth/signup`,
    logout:             `${API_BASE_URL}/api/auth/logout`,
    logoutAll:          `${API_BASE_URL}/api/auth/logout-all`,
    reportUnauthorized: `${API_BASE_URL}/api/auth/report-unauthorized-change`,
    verifyPassword:     `${API_BASE_URL}/api/auth/verify`,
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
  encryption: {
    myPublicKey:     `${API_BASE_URL}/api/encryption/public-key`,
    keys:            `${API_BASE_URL}/api/encryption/keys`,
    usersPublicKeys: `${API_BASE_URL}/api/encryption/users/public-keys`,
    conversationKeys: (conversationId: number) =>
      `${API_BASE_URL}/api/encryption/conversation/${conversationId}/keys`,
  },
  search: {
    usersQuick: (query: string) =>
      `${API_BASE_URL}/api/search/users/quick?SearchQuery=${encodeURIComponent(query)}`,
  },
  conversation: {
    sendToUser: `${API_BASE_URL}/api/conversation/send-to-user`,
    active:     `${API_BASE_URL}/api/conversation/active`,
    pending:    `${API_BASE_URL}/api/conversation/pending`,
    archived:   `${API_BASE_URL}/api/conversation/archived`,
    rejected:   `${API_BASE_URL}/api/conversation/rejected`,
    search:     `${API_BASE_URL}/api/conversation/search`,
    byId:       (conversationId: number) => `${API_BASE_URL}/api/conversation/${conversationId}`,
    restore:    (conversationId: number) => `${API_BASE_URL}/api/conversation/${conversationId}/restore`,
    accept:     (conversationId: number) => `${API_BASE_URL}/api/conversation/${conversationId}/accept`,
    reject:     (conversationId: number) => `${API_BASE_URL}/api/conversation/${conversationId}/reject`,
  },
  groupConversation: {
    create: `${API_BASE_URL}/api/groupconversation/create`,
  },
  message: {
    send:           `${API_BASE_URL}/api/message`,
    byConversation: (conversationId: number) => `${API_BASE_URL}/api/message/${conversationId}`,
    byId:           (messageId: number) => `${API_BASE_URL}/api/message/${messageId}`,
  },
  profile: {
    me:     `${API_BASE_URL}/api/profile`,
    update: `${API_BASE_URL}/api/profile`,
    public: (userId: string) => `${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`,
  },
  settings: {
    get:    `${API_BASE_URL}/api/settings`,
    update: `${API_BASE_URL}/api/settings`,
  },
  blocking: {
    block:         (userId: string) => `${API_BASE_URL}/api/blocking/${encodeURIComponent(userId)}`,
    unblock:       (userId: string) => `${API_BASE_URL}/api/blocking/unblock/${encodeURIComponent(userId)}`,
    blockedUsers:  `${API_BASE_URL}/api/blocking`,
  },
  bootstrap: {
    critical:  `${API_BASE_URL}/api/bootstrap/critical`,
    secondary: `${API_BASE_URL}/api/bootstrap/secondary`,
  },
  support: {
    report: `${API_BASE_URL}/api/support/report`,
    ticket: `${API_BASE_URL}/api/support`,
  },
  // Kun tilgjengelig i Development — DevController fjernes fra ruting i prod
  dev: {
    login: `${API_BASE_URL}/api/dev/login`,
    users: `${API_BASE_URL}/api/dev/users`,
  },
} as const;
