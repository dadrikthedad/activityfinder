// services/user/authService.ts
// Re-eksporterer fra features/auth/services/authService for bakoverkompatibilitet.
// Ny kode skal importere direkte fra @/features/auth/services/authService
export {
  loginUser,
  logoutUser,
  isAuthenticated,
  getAccessToken,
  isEmailVerificationRequired,
  isLoginSuccessful,
} from '@/features/auth/services/authService';
