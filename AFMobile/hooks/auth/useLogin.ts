import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import { 
  loginUser, 
  isLoginSuccessful, 
  isEmailVerificationRequired,
  resendVerificationEmail 
} from "@/services/user/authService";
import { RootStackNavigationProp } from "@/types/navigation"; // *** IMPORT RIKTIG TYPE ***

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
  const navigation = useNavigation<RootStackNavigationProp>(); // *** TYPE NAVIGATION ***

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

      if (isEmailVerificationRequired(data)) {
        console.log("📧 AUTH: Email verification required");
        setShowVerificationPrompt(true);
        return;
      }

      if (isLoginSuccessful(data)) {
        console.log("🔑 AUTH: Token received, calling login()...", data.token!.substring(0, 20) + "...");
        login(data.token!);
        resetForm();
      } else {
        throw new Error(data.message || "Login failed. No token received.");
      }

    } catch (error: unknown) {
      console.error("❌ AUTH: Login error:", error);
     
      if (error instanceof Error) {
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
        Alert.alert(
          "Email Sent!",
          result.message,
          [{ text: "OK" }]
        );
      } else {
        setErrorMessage(result.message);
      }
    } catch (_error) {
      setErrorMessage("Failed to resend verification email. Please try again.");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleNavigateToVerification = () => {
    // *** RIKTIG NAVIGATION MED TYPING ***
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