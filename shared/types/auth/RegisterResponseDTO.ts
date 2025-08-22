export interface RegisterResponse {
  message: string;
  userId: number;
  email: string;
  emailConfirmationRequired: boolean;
  verificationMethods?: {
    webLink: string;
    mobileCode: string;
    deepLink: string;
  };
}