// services/verificationService.ts - Ny service for email verification
import { postRequestPublic } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";

// Verify email with token
export async function verifyEmailWithToken(token: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("🟡 Verifying email token");
    
    // ✅ Bruk postRequestPublic som sender device headers automatisk
    const response = await postRequestPublic<{ success: boolean; message: string }, { token: string }>(
      `${API_BASE_URL}/api/email/verify`,
      { token }
    );

    if (!response) {
      throw new Error("Verification failed - no response received");
    }

    console.log("✅ Email verification response:", response);
    return response;
  } catch (error: any) {
    console.error("❌ Email verification error:", error);
    return {
      success: false,
      message: error.message || 'Verification failed'
    };
  }
}

// Resend verification email - reuse from authService for consistency
export { resendVerificationEmail } from "../user/authService";
