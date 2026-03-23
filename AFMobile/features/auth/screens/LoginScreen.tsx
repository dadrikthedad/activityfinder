// features/auth/screens/LoginScreen.tsx
import React from "react";
import {
  View, Text, ScrollView, SafeAreaView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Image, StatusBar,
} from "react-native";
import { Controller } from "react-hook-form";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { Sun, Moon } from "lucide-react-native";
import { useLogin } from "@/features/auth/hooks/useLogin";
import FormFieldNative from "@/components/common/FormFieldNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { LoginScreenNavigationProp, LoginScreenRouteProp } from "@/types/navigation";
import { useThemeStore } from "@/store/useThemeStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { type SupportedLanguage } from "@/core/i18n";

const LANGUAGES: SupportedLanguage[] = ["no", "en"];
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = { no: "🇳🇴", en: "🇬🇧" };

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const route = useRoute<LoginScreenRouteProp>();
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const { themeName, setTheme } = useThemeStore();
  const isDark = themeName === "dark";
  const handleToggleTheme = () => setTheme(isDark ? "light" : "dark");

  const { language, setLanguage } = useLanguageStore();
  const handleToggleLanguage = () => {
    const next = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
    setLanguage(next);
  };

  const fromVerification = route.params?.fromVerification ?? false;

  const { control, errors, errorMessage, isSubmitting, handleLogin, clearError } = useLogin();

  React.useEffect(() => {
    if (errorMessage) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.loginError"),
        customBody: errorMessage,
        position: "top",
      });
      clearError();
    }
  }, [errorMessage, clearError]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mørk header-seksjon */}
          <View style={{
            backgroundColor: theme.colors.navbar,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
          }}>
            {/* Kontrollrad — språk til venstre, tema til høyre */}
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: theme.spacing.md,
            }}>
              <TouchableOpacity
                onPress={handleToggleLanguage}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.xs,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: theme.radii.full,
                  backgroundColor: "rgba(255,255,255,0.1)",
                }}
              >
                <Text style={{ fontSize: 18 }}>{LANGUAGE_LABELS[language]}</Text>
                <Text style={{
                  fontSize: theme.typography.sm,
                  color: theme.colors.navbarText,
                  fontWeight: theme.typography.medium,
                }}>
                  {language.toUpperCase()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleTheme}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{
                  padding: 8,
                  borderRadius: theme.radii.full,
                  backgroundColor: "rgba(255,255,255,0.1)",
                }}
              >
                {isDark
                  ? <Sun size={20} color={theme.colors.navbarText} />
                  : <Moon size={20} color={theme.colors.navbarText} />
                }
              </TouchableOpacity>
            </View>

            {/* Logo og tittel */}
            <View style={{ alignItems: "center", marginTop: theme.spacing.sm }}>
              <Image
                source={require("@/assets/images/SparksLogoTransparant.png")}
                style={{ width: 140, height: 140 }}
                resizeMode="contain"
              />
              <Text style={{
                fontSize: theme.typography.xl,
                fontWeight: theme.typography.bold,
                color: theme.colors.navbarText,
                marginBottom: theme.spacing.xs,
                marginTop: theme.spacing.sm,
              }}>
                {t("auth.signInOrSignUp")}
              </Text>
              <Text style={{
                fontSize: theme.typography.md,
                color: theme.colors.textMuted,
                textAlign: "center",
              }}>
                {t("auth.tagline")}
              </Text>
            </View>
          </View>

          {/* Skjema-seksjon */}
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
          }}>
            <View style={{
              maxWidth: 400,
              alignSelf: "center",
              width: "100%",
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              padding: theme.spacing.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}>
              {/* "Klar til å logge inn"-banner etter fullført verifisering */}
              {fromVerification && (
                <View style={{
                  backgroundColor: theme.colors.success,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.lg,
                }}>
                  <Text style={{
                    fontSize: theme.typography.md,
                    fontWeight: theme.typography.semibold,
                    color: "#fff",
                    marginBottom: theme.spacing.xs,
                  }}>
                    {t("auth.accountReady")}
                  </Text>
                  <Text style={{
                    fontSize: theme.typography.sm,
                    color: "#fff",
                    lineHeight: 20,
                  }}>
                    {t("auth.accountReadyBody")}
                  </Text>
                </View>
              )}

              {/* E-post-felt */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormFieldNative
                    id="email"
                    label={t("auth.email")}
                    type="email"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    touched={!!errors.email}
                    placeholder={t("auth.emailPlaceholder")}
                    disabled={isSubmitting}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                )}
              />

              {/* Passord-felt */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordFieldNative
                    id="password"
                    label={t("auth.password")}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    touched={!!errors.password}
                    placeholder={t("auth.passwordPlaceholder")}
                    disabled={isSubmitting}
                  />
                )}
              />

              {/* Glemt passord */}
              <View style={{ alignItems: "flex-end", marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("ResetPasswordScreen")}
                  disabled={isSubmitting}
                  style={{ paddingVertical: theme.spacing.xs, paddingHorizontal: 4 }}
                >
                  <Text style={{
                    fontSize: theme.typography.sm,
                    color: isSubmitting ? theme.colors.disabledText : theme.colors.primary,
                    fontWeight: theme.typography.medium,
                    textDecorationLine: isSubmitting ? "none" : "underline",
                  }}>
                    {t("auth.forgotPassword")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Innloggingsknapp */}
              <ButtonNative
                text={t("auth.login")}
                loadingText={t("auth.loggingIn")}
                onPress={handleLogin}
                loading={isSubmitting}
                disabled={isSubmitting}
                variant="primary"
                size="large"
                fullWidth
                style={{ marginTop: theme.spacing.xs }}
              />

              {/* Registrer deg */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: theme.spacing.md,
              }}>
                <Text style={{
                  fontSize: theme.typography.sm,
                  color: theme.colors.textSecondary,
                }}>
                  {t("auth.noAccount")}
                </Text>
                <ButtonNative
                  text={t("auth.signUpHere")}
                  onPress={() => navigation.navigate("Signup")}
                  variant="ghost"
                  size="medium"
                  disabled={isSubmitting}
                  textStyle={{ fontSize: theme.typography.sm, fontWeight: theme.typography.semibold }}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
