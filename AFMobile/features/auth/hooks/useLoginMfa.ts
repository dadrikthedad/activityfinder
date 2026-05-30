// features/auth/hooks/useLoginMfa.ts
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { verifyMfaCode } from "@/features/auth/services/authService";
import { RootStackNavigationProp } from "@/types/navigation";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { useTranslation } from "react-i18next";

export interface UseLoginMfaReturn {
  code: string;
  setCode: (code: string) => void;
  isLoading: boolean;
  resendCooldown: number;
  handleVerify: () => Promise<void>;
  handleResend: () => void;
}

/**
 * ViewModel for LoginMfaScreen.
 * Verifiserer MFA-koden sendt til brukerens epost etter vellykket passord-innlogging.
 *
 * Resend-knappen navigerer brukeren tilbake til Login for å starte flyten på nytt.
 * Dette er bevisst — vi ønsker ikke et eget resend-endepunkt uten passord-autentisering.
 */
export const useLoginMfa = (email: string): UseLoginMfaReturn => {
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Cooldown-timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ========== Verifiser MFA-kode ==========

  const handleVerify = async () => {
    if (code.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.invalidCodeTitle"),
        customBody: t("auth.invalidCodeBody"),
        position: "top",
      });
      return;
    }

    setIsLoading(true);
    const result = await verifyMfaCode(email, code);

    if (result.success) {
      // Tokens er allerede lagret i Keychain av authServiceNative.verifyMfa.
      // Naviger til E2EESetupScreen — den kaller login() etter nøkkeloppsett.
      navigation.navigate("E2EESetupScreen", {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.verificationFailed"),
        customBody: result.error,
        position: "top",
      });
      setCode("");
    }

    setIsLoading(false);
  };

  // ========== Send kode på nytt — naviger tilbake til Login ==========
  // Brukeren må taste passord igjen for å trigge ny MFA-epost.

  const handleResend = () => {
    if (resendCooldown > 0) return;
    navigation.navigate("Login");
  };

  return {
    code,
    setCode,
    isLoading,
    resendCooldown,
    handleVerify,
    handleResend,
  };
};
