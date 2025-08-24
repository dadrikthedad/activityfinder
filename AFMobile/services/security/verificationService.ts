// services/verificationService.ts - Service for email verification og password reset
import { postRequestPublic, getRequestPublic } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";

// ========== EMAIL VERIFICATION ==========

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

// ========== PASSWORD RESET ==========

// Request password reset (forgot password)
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("🟡 Requesting password reset for:", email);
   
    // ✅ AuthController endepunkt
    const response = await postRequestPublic<{ success: boolean; message: string }, { email: string }>(
      `${API_BASE_URL}/api/email/forgot-password`,
      { email }
    );
    
    if (!response) {
      throw new Error("Password reset request failed - no response received");
    }
    
    console.log("✅ Password reset request response:", response);
    return response;
  } catch (error: any) {
    console.error("❌ Password reset request error:", error);
    return {
      success: false,
      message: error.message || 'Password reset request failed'
    };
  }
}

// Validate reset token or code  
export async function validateResetToken(tokenOrCode: string): Promise<{
  isValid: boolean;
}> {
  try {
    console.log("🟡 Validating reset token/code");
   
    // ✅ AuthController endepunkt
    const response = await getRequestPublic<{ isValid: boolean }>(
      `${API_BASE_URL}/api/email/validate-reset-token/${encodeURIComponent(tokenOrCode)}`
    );
    
    if (!response) {
      throw new Error("Token validation failed - no response received");
    }
    
    console.log("✅ Token validation response:", response);
    return response;
  } catch (error: any) {
    console.error("❌ Token validation error:", error);
    return {
      isValid: false
    };
  }
}

// Reset password with token/code
export async function resetPassword(
  tokenOrCode: string, 
  newPassword: string, 
  confirmPassword: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("🟡 Resetting password with token/code");
   
    // ✅ AuthController endepunkt
    const response = await postRequestPublic<
      { success: boolean; message: string }, 
      { tokenOrCode: string; newPassword: string; confirmPassword: string }
    >(
      `${API_BASE_URL}/api/email/reset-password`,
      { 
        tokenOrCode, 
        newPassword, 
        confirmPassword 
      }
    );
    
    if (!response) {
      throw new Error("Password reset failed - no response received");
    }
    
    console.log("✅ Password reset response:", response);
    return response;
  } catch (error: any) {
    console.error("❌ Password reset error:", error);
    return {
      success: false,
      message: error.message || 'Password reset failed'
    };
  }
}