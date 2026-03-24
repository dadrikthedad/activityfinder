// features/auth/hooks/useResetPassword.ts
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { PasswordResetErrorCode } from "@/core/errors/ErrorCode";
import { resetPasswordSchema, ResetPasswordFormValues } from "@/features/auth/models/schemas";
import {
  requestPasswordReset,
  verifyPasswordResetEmailCode,
  sendPasswordResetSms,
  verifyPasswordResetSms,
  resetPassword,
} from "@/features/auth/services/verificationService";
import { RootStackNavigationProp } from "@/types/navigation";
import type { Control, FieldErrors } from "react-hook-form";

export type ResetStep = "request" | "code" | "sms" | "password";

export interface UseResetPasswordReturn {
  // Steg-state
  step: ResetStep;
  email: string;
  setEmail: (email: string) => void;
  // E-postkode (steg 2)
  code: string;
  setCode: (code: string) => void;
  // SMS-kode (steg 3)
  smsCode: string;
  setSmsCode: (code: string) => void;
  isLoading: boolean;
  resendEmailCooldown: number;
  resendSmsCooldown: number;

  // rhf — kun aktivt i steg 4
  control: Control<ResetPasswordFormValues>;
  errors: FieldErrors<ResetPasswordFormValues>;
  isSubmitting: boolean;

  // Handlinger
  handleRequestReset: () => Promise<void>;
  handleVerifyEmailCode: () => Promise<void>;
  handleVerifySmsCode: () => Promise<void>;
  handleResendSms: () => Promise<void>;
  handleResetPassword: () => void;
}

/**
 * ViewModel for passord-reset-flyten (4 steg).
 * Steg 1–3 bruker enkel lokal state.
 * Steg 4 bruker react-hook-form + zod (resetPasswordSchema) — konsistent med useLogin.
 */
export function useResetPassword(): UseResetPasswordReturn {
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();

  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");         // E-postkode
  const [smsCode, setSmsCode] = useState("");    // SMS-kode
  const [isLoading, setIsLoading] = useState(false);
  const [resendEmailCooldown, setResendEmailCooldown] = useState(0);
  const [resendSmsCooldown, setResendSmsCooldown] = useState(0);

  // Nedtelling for e-post resend-knapp
  useEffect(() => {
    if (resendEmailCooldown <= 0) return;
    const timer = setInterval(() => setResendEmailCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendEmailCooldown]);

  // Nedtelling for SMS resend-knapp
  useEffect(() => {
    if (resendSmsCooldown <= 0) return;
    const timer = setInterval(() => setResendSmsCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendSmsCooldown]);

  // rhf + zod for steg 3
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // ========== Steg 1: Be om tilbakestillings-e-post ==========

  const handleRequestReset = async () => {
    if (!email.trim()) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.email"),
        customBody: t("auth.pleaseEnterEmail"),
        position: "top",
      });
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(email.trim());

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.resetEmailSentTitle"),
        customBody: t("auth.resetEmailSentBody"),
        position: "top",
      });
      setStep("code");
      setResendEmailCooldown(120);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.requestFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 2: Verifiser e-postkode ==========

  const handleVerifyEmailCode = async () => {
    if (code.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.invalidResetCode"),
        customBody: t("auth.pleaseEnter6Digit"),
        position: "top",
      });
      return;
    }

    setIsLoading(true);
    const verifyResult = await verifyPasswordResetEmailCode(email.trim(), code);

    if (!verifyResult.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.invalidResetCode"),
        customBody: t("auth.invalidOrExpired"),
        position: "top",
      });
      setIsLoading(false);
      return;
    }

    // E-postkode OK — send SMS-kode automatisk og naviger til SMS-steget
    const smsResult = await sendPasswordResetSms(email.trim());

    if (smsResult.success) {
      setResendSmsCooldown(120);
      setStep("sms");
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.smsSendFailed"),
        customBody: smsResult.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 3: Verifiser SMS-kode ==========

  const handleVerifySmsCode = async () => {
    if (smsCode.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.invalidResetCode"),
        customBody: t("auth.pleaseEnter6Digit"),
        position: "top",
      });
      return;
    }

    setIsLoading(true);
    const result = await verifyPasswordResetSms(email.trim(), smsCode);

    if (result.success) {
      setStep("password");
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.invalidResetCode"),
        customBody: t("auth.invalidOrExpired"),
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 3: Send SMS på nytt ==========

  const handleResendSms = async () => {
    if (resendSmsCooldown > 0) return;
    setIsLoading(true);

    const result = await sendPasswordResetSms(email.trim());

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.smsSentTitle"),
        customBody: t("auth.smsSentBody"),
        position: "top",
      });
      setResendSmsCooldown(120);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.smsResendFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 4: Sett nytt passord (via rhf + zod) ==========

  const onSubmitPassword = async (data: ResetPasswordFormValues) => {
    // SMS-koden er allerede verifisert i steg 3b — sender kun email og nytt passord
    const result = await resetPassword(email.trim(), data.newPassword);

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.passwordResetTitle"),
        customBody: t("auth.passwordResetBody"),
        position: "top",
      });
      setTimeout(() => navigation.replace("Login"), 2000);
      return;
    }

    // Sesjonen er utløpt eller ikke verifisert — send bruker tilbake til steg 1
    if (
      result.code === PasswordResetErrorCode.SessionExpired ||
      result.code === PasswordResetErrorCode.SessionNotVerified
    ) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.resetSessionExpiredTitle"),
        customBody: t("auth.resetSessionExpiredBody"),
        position: "top",
      });
      setStep("request");
      setEmail("");
      setCode("");
      setSmsCode("");
      return;
    }

    showNotificationToastNative({
      type: LocalToastType.CustomSystemError,
      customTitle: t("auth.resetFailed"),
      customBody: result.error,
      position: "top",
    });
  };

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    smsCode,
    setSmsCode,
    isLoading,
    resendEmailCooldown,
    resendSmsCooldown,
    control,
    errors,
    isSubmitting,
    handleRequestReset,
    handleVerifyEmailCode,
    handleVerifySmsCode,
    handleResendSms,
    handleResetPassword: handleSubmit(onSubmitPassword),
  };
}
