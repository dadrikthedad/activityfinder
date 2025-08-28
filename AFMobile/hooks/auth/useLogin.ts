import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { 
  loginUser
} from "@/services/user/authService"; // Oppdatert import path
import { resendVerificationEmail } from "@/services/security/verificationService";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { RootStackNavigationProp } from "@/types/navigation";

export interface UseLoginReturn {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  errorMessage: string;
  isSubmitting: boolean;
  handleLogin: () => Promise<void>;
  clearError: () => void;
  resetForm: () => void;
  showVerificationPrompt: boolean;
  setShowVerificationPrompt: (show: boolean) => void;
  resendingEmail: boolean;
  handleResendVerificationEmail: () => Promise<void>;
  handleNavigateToVerification: () => void;
}

export const useLogin = (): UseLoginReturn => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  
  const { login } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();

  const validateInput = (): string | null => {
    if (!email.trim()) {
      return "Email is required.";
    }
   
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address.";
    }
   
    if (!password.trim()) {
      return "Password is required.";
    }
   
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }
   
    return null;
  };

  const handleLogin = async () => {
    setErrorMessage("");
    setShowVerificationPrompt(false);
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const validationError = validateInput();
      if (validationError) {
        throw new Error(validationError);
      }

      console.log("🔑 AUTH: Attempting login for:", email);
      
      const data = await loginUser(email.trim(), password);

      // Hvis vi kommer hit, var login vellykket
      console.log("🔑 AUTH: Login successful, updating context...");
      
      // Send begge tokens til AuthContext
      await login(data.accessToken, data.refreshToken);
      
      resetForm();
      // AuthContext håndterer navigasjon automatisk

    } catch (error: unknown) {
      console.error("❌ AUTH: Login error:", error);
     
      if (error instanceof Error) {
        // Sjekk om det er email verification error
        if (error.message.includes("verify your email") || error.message.includes("email verification")) {
          console.log("AUTH: Email verification required");
          setShowVerificationPrompt(true);
          return;
        }
        
        let userFriendlyMessage = error.message;
       
        if (error.message.includes('Invalid credentials') ||
            error.message.includes('401') ||
            error.message.includes('Unauthorized')) {
          userFriendlyMessage = "Invalid email or password. Please try again.";
        } else if (error.message.includes('Network') ||
                   error.message.includes('fetch')) {
          userFriendlyMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('500') ||
                   error.message.includes('Server')) {
          userFriendlyMessage = "Server error. Please try again later.";
        }
       
        setErrorMessage(userFriendlyMessage);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    setResendingEmail(true);
    setErrorMessage("");

    try {
      const result = await resendVerificationEmail(email.trim());
      
      if (result.success) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Email Sent!",
          customBody: result.message,
          position: 'top'
        });
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Error",
          customBody: result.message,
          position: 'top'
        });
      }
    } catch (_error) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: "Failed to resend verification email. Please try again.",
        position: 'top'
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleNavigateToVerification = () => {
    navigation.navigate('VerificationScreen', { email: email.trim() });
  };

  const clearError = () => {
    setErrorMessage("");
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setErrorMessage("");
    setIsSubmitting(false);
    setShowVerificationPrompt(false);
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isSubmitting,
    handleLogin,
    clearError,
    resetForm,
    showVerificationPrompt,
    setShowVerificationPrompt,
    resendingEmail,
    handleResendVerificationEmail,
    handleNavigateToVerification,
  };
};