import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { loginUser } from "@/services/user/authService";

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
}

export const useLogin = (): UseLoginReturn => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const validateInput = (): string | null => {
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
    
    return null;
  };

  const handleLogin = async () => {
    // Reset error and prevent double submission
    setErrorMessage("");
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Validate input
      const validationError = validateInput();
      if (validationError) {
        throw new Error(validationError);
      }

      console.log("🔑 AUTH: Attempting login for:", email);

      // Call the auth service
      const data = await loginUser(email.trim(), password);

      if (!data) {
        throw new Error("Login failed. No response from server.");
      }

      if (!data.token) {
        throw new Error(data.message || "Login failed. No token received.");
      }

      console.log("🔑 AUTH: Token received, calling login()...", data.token.substring(0, 20) + "...");
      
      // Use the login function from AuthContext
      login(data.token);
    
      // Clear form on successful login
      resetForm();

    } catch (error: unknown) {
      console.error("❌ AUTH: Login error:", error);
      
      if (error instanceof Error) {
        // Handle specific error messages
        let userFriendlyMessage = error.message;
        
        // Map common server errors to user-friendly messages
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

  const clearError = () => {
    setErrorMessage("");
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setErrorMessage("");
    setIsSubmitting(false);
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
  };
};