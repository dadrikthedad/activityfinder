// services/security/verificationService.ts
import { ApiRoutes } from "@/constants/routes";
import { postRequestPublic } from "@/services/baseService";

// ========== E-POST VERIFISERING ==========

// Verifiserer epost med 6-sifret kode
export async function verifyEmailWithCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Verifying email code for:", email);

    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.verification.verifyEmail,
      { email, code }
    );

    console.log("✅ Email verified successfully");
    return { success: true, message: "Email verified successfully" };
  } catch (error: any) {
    console.error("❌ Email verification error:", error);
    return { success: false, message: error.message || "Verification failed" };
  }
}

// Gammel funksjon beholdt for bakoverkompatibilitet med eksisterende screens
// TODO: Oppdater VerificationScreen til å sende email + code
export async function verifyEmailWithToken(code: string): Promise<{ success: boolean; message: string }> {
  console.warn("⚠️ verifyEmailWithToken er deprecated — bruk verifyEmailWithCode(email, code)");
  return { success: false, message: "Deprecated — email required" };
}

// Sender ny verifiseringsepost
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Resending verification email to:", email);

    await postRequestPublic<void, { email: string }>(
      ApiRoutes.verification.resend,
      { email }
    );

    console.log("✅ Verification email sent");
    return { success: true, message: "Verification email sent successfully" };
  } catch (error: any) {
    console.error("❌ Resend verification error:", error);
    return { success: false, message: error.message || "Failed to send verification email" };
  }
}

// ========== PASSORD RESET ==========

// Steg 1: Send passord-reset epost
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Requesting password reset for:", email);

    await postRequestPublic<void, { email: string }>(
      ApiRoutes.passwordReset.forgot,
      { email }
    );

    return { success: true, message: "Reset email sent" };
  } catch (error: any) {
    console.error("❌ Password reset request error:", error);
    return { success: false, message: error.message || "Failed to send reset email" };
  }
}

// Steg 2: Verifiser epost-kode
export async function verifyPasswordResetEmailCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Verifying password reset code for:", email);

    await postRequestPublic<void, { email: string; code: string }>(
      ApiRoutes.passwordReset.verifyEmail,
      { email, code }
    );

    return { success: true, message: "Code verified" };
  } catch (error: any) {
    console.error("❌ Verify reset code error:", error);
    return { success: false, message: error.message || "Invalid or expired code" };
  }
}

// Gammel validateResetToken beholdt for bakoverkompatibilitet
// TODO: Oppdater ResetPasswordScreen til å bruke verifyPasswordResetEmailCode
export async function validateResetToken(code: string): Promise<{ isValid: boolean }> {
  console.warn("⚠️ validateResetToken er deprecated — bruk verifyPasswordResetEmailCode(email, code)");
  return { isValid: false };
}

// Steg 4: Sett nytt passord
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log("🟡 Resetting password for:", email);

    await postRequestPublic<void, { email: string; code: string; newPassword: string }>(
      ApiRoutes.passwordReset.reset,
      { email, code, newPassword }
    );

    return { success: true, message: "Password reset successfully" };
  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    return { success: false, message: error.message || "Failed to reset password" };
  }
}
