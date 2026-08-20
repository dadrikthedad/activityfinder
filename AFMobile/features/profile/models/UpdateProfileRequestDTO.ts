export interface UpdateProfileRequestDTO {
  countryCode: string;
  dateOfBirth: string;
  bio?: string;
  websites?: string[];
  contactEmail?: string;
  contactPhone?: string;
}
