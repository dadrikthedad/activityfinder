// features/dev/models/DevUserDTO.ts
// Speiler DevUserDto i AFBack (Features/Dev/DTOs/DevUserDto.cs).
// Brukes kun av dev-innloggingsskjermen i Development.

export interface DevUserDTO {
  id: string;
  fullName: string;
  email: string;
  profileImageUrl?: string | null;
}
