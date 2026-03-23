// features/auth/hooks/useLogin.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { loginUser } from "@/features/auth/services/authService";
import { AuthErrorCode } from "@/core/errors/ErrorCode";
import { loginSchema, LoginFormValues } from "@/features/auth/models/schemas";
import { RootStackNavigationProp } from "@/types/navigation";
import type { Control, FieldErrors } from "react-hook-form";

export interface UseLoginReturn {
  control: Control<LoginFormValues>;
  errors: FieldErrors<LoginFormValues>;
  errorMessage: string;
  isSubmitting: boolean;
  handleLogin: () => void;
  clearError: () => void;
}

/**
 * ViewModel for login-skjemaet.
 * Bruker react-hook-form + zod for validering,
 * og authService (Result-pattern) for API-kommunikasjon.
 *
 * Ved EmailNotVerified navigeres brukeren til VerificationScreen (e-post).
 * Ved PhoneNotVerified navigeres brukeren til PhoneSmsVerificationScreen (SMS).
 * Backend sender ny kode automatisk ved begge tilfeller — frontend trenger bare å navigere.
 */
export const useLogin = (): UseLoginReturn => {
  const [errorMessage, setErrorMessage] = useState("");

  const { login } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMessage("");

    const result = await loginUser(data.email.trim(), data.password);

    if (!result.success) {
      switch (result.code) {
        case AuthErrorCode.EmailNotVerified:
          navigation.navigate("VerificationScreen", { email: data.email.trim() });
          break;
        case AuthErrorCode.PhoneNotVerified:
          navigation.navigate("PhoneSmsVerificationScreen", { email: data.email.trim() });
          break;
        case AuthErrorCode.InvalidCredentials:
        case AuthErrorCode.AccountLocked:
        case AuthErrorCode.RateLimited:
        case AuthErrorCode.NetworkError:
        case AuthErrorCode.ServerError:
        case AuthErrorCode.Unknown:
        default:
          setErrorMessage(result.error);
          break;
      }
      return;
    }

    await login(result.data.accessToken, result.data.refreshToken);
    reset();
  };

  return {
    control,
    errors,
    errorMessage,
    isSubmitting,
    handleLogin: handleSubmit(onSubmit),
    clearError: () => setErrorMessage(""),
  };
};
