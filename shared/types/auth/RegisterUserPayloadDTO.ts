// Type for registrering
export interface RegisterUserPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  dateOfBirth: string;
  country: string;
  region?: string;
  postalCode?: string;
  gender: string;
}