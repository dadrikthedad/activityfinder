export interface PublicProfileResponseDTO {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  isPrivate: boolean;
  countryCode: string | null;
  age: number | null;
  dateOfBirth: string | null;
  bio: string | null;
  websites: string[] | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
