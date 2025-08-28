import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { registerUser } from "@/services/user/authService";
import { RootStackNavigationProp } from "@/types/navigation";

export interface UseRegisterReturn {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (password: string) => void;
  name: string;
  setName: (name: string) => void;
  errorMessage: string;
  isSubmitting: boolean;
  handleRegister: () => Promise<void>;
  clearError: () => void;
  resetForm: () => void;
}

export const useRegister = (): UseRegisterReturn => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation<RootStackNavigationProp>();

  const validateInput = (): string | null => {
    if (!name.trim()) {
      return "Name is required.";
    }
    
    if (!email.trim()) {
      return "Email is required.";
    }
    
    // Basic email validation
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
    
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    
    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
    }
    
    return null;
  };

  const handleRegister = async () => {
    setErrorMessage("");
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const validationError = validateInput();
      if (validationError) {
        throw new Error(validationError);
      }

      console.log("👤 AUTH: Attempting registration for:", email);

      const response = await registerUser(
        email.trim(), 
        password, 
        name.trim(), 
        confirmPassword
      );

      if (!response) {
        throw new Error("Registration failed. No response from server.");
      }

      console.log("✅ AUTH: Registration successful");
      
      // Navigate to verification screen instead of auto-login
      navigation.navigate('VerificationScreen', { 
        email: email.trim(),
        fromRegistration: true 
      });
      
      // Clear form after successful registration
      resetForm();

    } catch (error: unknown) {
      console.error("❌ AUTH: Registration error:", error);
      
      if (error instanceof Error) {
        let userFriendlyMessage = error.message;
        
        if (error.message.includes('Email already exists') || 
            error.message.includes('already registered')) {
          userFriendlyMessage = "An account with this email already exists. Please try logging in instead.";
        } else if (error.message.includes('400')) {
          userFriendlyMessage = "Invalid registration data. Please check your information and try again.";
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

  const clearError = () => {
    setErrorMessage("");
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setErrorMessage("");
    setIsSubmitting(false);
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    name,
    setName,
    errorMessage,
    isSubmitting,
    handleRegister,
    clearError,
    resetForm,
  };
};