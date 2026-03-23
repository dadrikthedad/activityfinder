// services/security/verificationService.ts
// Re-eksporterer fra features/auth/services/verificationService for bakoverkompatibilitet.
// Ny kode skal importere direkte fra @/features/auth/services/verificationService
export {
  verifyEmailWithCode,
  resendVerificationEmail,
  requestPasswordReset,
  verifyPasswordResetEmailCode,
  resetPassword,
} from '@/features/auth/services/verificationService';
