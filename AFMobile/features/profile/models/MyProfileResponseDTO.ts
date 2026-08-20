export interface MyProfileResponseDTO {
  countryCode: string;
  dateOfBirth: string;
  age: number | null;
  bio: string | null;
  websites: string[];
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: string | null;
}
