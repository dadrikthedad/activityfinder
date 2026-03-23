// services/user/signUpService.ts
// Re-eksporterer fra features/auth/services/signUpService for bakoverkompatibilitet.
// Ny kode skal importere direkte fra @/features/auth/services/signUpService
export {
  fetchCountries,
  fetchRegions,
  registerUserAPI,
} from '@/features/auth/services/signUpService';

export type { Country } from '@/features/auth/services/signUpService';
