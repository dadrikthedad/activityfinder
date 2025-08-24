import { API_BASE_URL } from "@/constants/api/api";

// Types for requests and responses
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  success: boolean;
}

export interface ResetPasswordRequest {
  tokenOrCode: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

export interface ValidateResetTokenResponse {
  isValid: boolean;
}

// Send forgot password email (with both link and code)
export async function sendForgotPasswordEmail(email: string): Promise<ForgotPasswordResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/email/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email } as ForgotPasswordRequest),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      // Handle rate limiting and other errors
      if (data.retryAfter) {
        throw new Error(`${data.message} (Retry after: ${Math.ceil(data.retryAfter / 60)} minutes)`);
      }
      throw new Error(data.message || "Failed to send password reset email");
    }
    
    return data as ForgotPasswordResponse;
  } catch (error) {
    console.error("❌ Error sending forgot password email:", error);
    throw error;
  }
}

// Reset password using token or code
export async function resetPassword(tokenOrCode: string, newPassword: string): Promise<ResetPasswordResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/email/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        tokenOrCode, 
        newPassword 
      } as ResetPasswordRequest),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || "Failed to reset password");
    }
    
    return data as ResetPasswordResponse;
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    throw error;
  }
}

// Validate reset token or code
export async function validateResetToken(tokenOrCode: string): Promise<ValidateResetTokenResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/email/validate-reset-token/${encodeURIComponent(tokenOrCode)}`);
    
    if (!res.ok) {
      throw new Error("Failed to validate reset token");
    }
    
    const data = await res.json();
    return data as ValidateResetTokenResponse;
  } catch (error) {
    console.error("❌ Error validating reset token:", error);
    throw error;
  }
}