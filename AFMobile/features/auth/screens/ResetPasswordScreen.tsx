// features/auth/screens/ResetPasswordScreen.tsx
import React, { useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { formatTime } from "@/utils/formatTime";
import AppHeader from "@/components/common/AppHeader";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import { ResetPasswordScreenNavigationProp, ResetPasswordScreenRouteProp } from "@/types/navigation";

interface Props {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordScreenRouteProp;
}

const ResetPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const {
    step, email, setEmail, code, setCode, smsCode, setSmsCode,
    isLoading, resendEmailCooldown, resendSmsCooldown,
    control, errors, isSubmitting,
    handleRequestReset, handleVerifyEmailCode,
    handleVerifySmsCode, handleResendSms, handleResetPassword,
  } = useResetPassword();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ========== Dynamiske header-verdier per steg ==========

  const headerIcon =
    step === "request" ? "key" :
    step === "code"    ? "mail" :
    step === "sms"     ? "phone-portrait" :
                         "lock-closed";

  const stepTitle =
    step === "request" ? t("auth.resetPassword") :
    step === "code"    ? t("auth.checkYourEmail") :
    step === "sms"     ? t("auth.verifyYourPhone") :
                         t("auth.newPassword");

  const stepSubtitle =
    step === "request" ? t("auth.enterEmailForReset") :
    step === "code"    ? t("auth.enterCodeWeSent") :
    step === "sms"     ? t("auth.weSentSmsTo") :
                         t("auth.chooseStrongPassword");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t("auth.resetPassword")}
        subtitle={t("auth.resetSubtitle")}
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
        showBorder={true}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Ikon + steg-tittel */}
          <View style={{ alignItems: "center", marginBottom: theme.spacing.xl }}>
            <View style={{ marginBottom: theme.spacing.md }}>
              <Ionicons name={headerIcon as any} size={60} color={theme.colors.primary} />
            </View>
            <Text style={{
              fontSize: theme.typography.lg,
              fontWeight: theme.typography.bold,
              color: theme.colors.textPrimary,
              marginBottom: theme.spacing.xs,
              textAlign: "center",
            }}>
              {stepTitle}
            </Text>
            <Text style={{
              fontSize: theme.typography.md,
              color: theme.colors.textSecondary,
              textAlign: "center",
              marginBottom: theme.spacing.xs,
            }}>
              {stepSubtitle}
            </Text>
            {step === "code" && (
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.primary,
                textAlign: "center",
              }}>
                {email}
              </Text>
            )}
          </View>

          {/* Steg 1: E-post-inndata */}
          {step === "request" && (
            <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.textPrimary,
                marginBottom: theme.spacing.xs,
              }}>
                {t("auth.emailAddress")}
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  fontSize: theme.typography.md,
                  backgroundColor: theme.colors.backgroundInput,
                  color: theme.colors.textPrimary,
                  marginBottom: theme.spacing.xs,
                }}
                value={email}
                onChangeText={setEmail}
                placeholder={t("auth.enterYourEmail")}
                placeholderTextColor={theme.colors.textPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ButtonNative
                text={t("auth.sendResetEmail")}
                loadingText={t("auth.sending")}
                onPress={handleRequestReset}
                variant="primary"
                size="medium"
                loading={isLoading}
                disabled={isLoading || !email.trim()}
                fullWidth
              />
            </View>
          )}

          {/* Steg 2: E-postkode */}
          {step === "code" && (
            <>
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={{
                  fontSize: theme.typography.md,
                  fontWeight: theme.typography.semibold,
                  color: theme.colors.textPrimary,
                  marginBottom: theme.spacing.sm,
                  textAlign: "center",
                }}>
                  {t("auth.enterResetCode")}
                </Text>
                <TextInput
                  style={{
                    borderWidth: 2,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.md,
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 4,
                    marginBottom: theme.spacing.md,
                    backgroundColor: theme.colors.backgroundInput,
                    color: theme.colors.textPrimary,
                  }}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                />
                <ButtonNative
                  text={t("auth.verifyCode")}
                  loadingText={t("auth.verifying")}
                  onPress={handleVerifyEmailCode}
                  variant="primary"
                  size="medium"
                  loading={isLoading}
                  disabled={code.length !== 6 || isLoading}
                  fullWidth
                />
              </View>

              {/* Send e-post på nytt */}
              <View style={{
                alignItems: "center",
                paddingVertical: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}>
                <Text style={{
                  fontSize: theme.typography.sm,
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.sm,
                }}>
                  {t("auth.didntReceiveEmail")}
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: resendEmailCooldown > 0 ? theme.colors.border : theme.colors.primary,
                    backgroundColor: resendEmailCooldown > 0 ? theme.colors.backgroundAlt : theme.colors.surface,
                  }}
                  onPress={handleRequestReset}
                  disabled={resendEmailCooldown > 0 || isLoading}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={resendEmailCooldown > 0 ? theme.colors.textMuted : theme.colors.primary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{
                    color: resendEmailCooldown > 0 ? theme.colors.textMuted : theme.colors.primary,
                    fontSize: theme.typography.sm,
                    fontWeight: theme.typography.medium,
                  }}>
                    {resendEmailCooldown > 0
                      ? t("auth.resendIn", { time: formatTime(resendEmailCooldown) })
                      : t("auth.sendAgain")}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Steg 3: SMS-kode */}
          {step === "sms" && (
            <>
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={{
                  fontSize: theme.typography.md,
                  fontWeight: theme.typography.semibold,
                  color: theme.colors.textPrimary,
                  marginBottom: theme.spacing.sm,
                  textAlign: "center",
                }}>
                  {t("auth.enterSmsCode")}
                </Text>
                <TextInput
                  style={{
                    borderWidth: 2,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.md,
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 4,
                    marginBottom: theme.spacing.md,
                    backgroundColor: theme.colors.backgroundInput,
                    color: theme.colors.textPrimary,
                  }}
                  value={smsCode}
                  onChangeText={(text) => setSmsCode(text.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                />
                <ButtonNative
                  text={t("auth.verifySmsCode")}
                  loadingText={t("auth.verifyingSms")}
                  onPress={handleVerifySmsCode}
                  variant="primary"
                  size="medium"
                  loading={isLoading}
                  disabled={smsCode.length !== 6 || isLoading}
                  fullWidth
                />
              </View>

              {/* Send SMS på nytt */}
              <View style={{
                alignItems: "center",
                paddingVertical: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}>
                <Text style={{
                  fontSize: theme.typography.sm,
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.sm,
                }}>
                  {t("auth.didntReceiveSms")}
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: resendSmsCooldown > 0 ? theme.colors.border : theme.colors.primary,
                    backgroundColor: resendSmsCooldown > 0 ? theme.colors.backgroundAlt : theme.colors.surface,
                  }}
                  onPress={handleResendSms}
                  disabled={resendSmsCooldown > 0 || isLoading}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={resendSmsCooldown > 0 ? theme.colors.textMuted : theme.colors.primary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{
                    color: resendSmsCooldown > 0 ? theme.colors.textMuted : theme.colors.primary,
                    fontSize: theme.typography.sm,
                    fontWeight: theme.typography.medium,
                  }}>
                    {resendSmsCooldown > 0
                      ? t("auth.resendIn", { time: formatTime(resendSmsCooldown) })
                      : t("auth.sendAgain")}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Steg 4: Nytt passord — rhf + zod via Controller */}
          {step === "password" && (
            <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <Controller
                control={control}
                name="newPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordFieldNative
                    id="newPassword"
                    label={t("auth.newPassword")}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.newPassword?.message}
                    touched={!!errors.newPassword}
                    placeholder={t("auth.enterNewPassword")}
                    disabled={isSubmitting}
                  />
                )}
              />
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordFieldNative
                    id="confirmPassword"
                    label={t("auth.confirmNewPassword")}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.confirmPassword?.message}
                    touched={!!errors.confirmPassword}
                    placeholder={t("auth.confirmNewPasswordPlaceholder")}
                    disabled={isSubmitting}
                  />
                )}
              />
              <ButtonNative
                text={t("auth.updatePassword")}
                loadingText={t("auth.updating")}
                onPress={handleResetPassword}
                variant="primary"
                size="medium"
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
              />
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
