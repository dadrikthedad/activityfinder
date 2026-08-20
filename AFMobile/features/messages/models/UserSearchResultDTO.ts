// features/messages/models/UserSearchResultDTO.ts
// Resultat fra brukersøk. id er en GUID-streng (matcher backend), ikke number.

export interface UserSearchResultDTO {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  countryCode?: string | null;
  proximityLevel?: number;
}
