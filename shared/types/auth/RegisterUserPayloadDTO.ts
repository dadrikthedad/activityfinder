// Tilsvarer SignupRequest i AFBack
export interface RegisterUserPayloadDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;   // ISO 8601: "1990-01-15"
  gender: number;        // Male = 0, Female = 1, Unspecified = 2
  countryCode: string;   // ISO 3166-1 alpha-2, f.eks. "NO"
  region?: string;
  city?: string;
  postalCode?: string;
}
