// features/auth/models/RegisterUserPayloadDTO.ts
// Tilsvarer SignupRequest i AFBack
export interface RegisterUserPayloadDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;  // ISO 8601: "1990-01-15"
  countryCode: string;  // ISO 3166-1 alpha-2, f.eks. "NO"
}
