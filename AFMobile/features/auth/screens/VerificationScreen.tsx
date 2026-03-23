// features/auth/screens/VerificationScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, KeyboardAvoidingView,
  Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { formatTime } from "@/utils/formatTime";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { VerificationScreenNavigationProp, VerificationScreenRouteProp } from "@/types/navigation";
import { verifyEmailWithCode, resendVerificationEmail } from "@/features/auth/services/verificationService";

interface Props {
  navigation: VerificationScreenNavigationProp;
  route: VerificationScreenRouteProp;
}

const VerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);

  const email = route.params?.email || "";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ========== Verifiser kode ==========

  const verifyCode = async () => {
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
    const result = await verifyEmailWithCode(email, code);

    if (result.success) {
      setIsVerified(true);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.verifiedTitle"),
        customBody: t("auth.verifiedBody"),
        position: "top",
      });
      // E-post bekreftet — neste steg er SMS-verifisering.
      // PhoneSmsVerificationScreen sender SMS automatisk ved mount.
      setTimeout(() => navigation.replace("PhoneSmsVerificationScreen", { email }), 2000);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.verificationFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Send på nytt ==========

  const resendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);

    const result = await resendVerificationEmail(email);

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.emailSentTitle"),
        customBody: t("auth.emailSentBody"),
        position: "top",
      });
      setResendCooldown(120);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.resendFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Mørk navbar-header */}
        <View style={{
          backgroundColor: theme.colors.navbar,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.lg,
        }}>
          {/* Tilbake-knapp */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.xs,
              alignSelf: "flex-start",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: theme.radii.full,
              backgroundColor: "rgba(255,255,255,0.1)",
              marginBottom: theme.spacing.md,
            }}
          >
            <ArrowLeft size={18} color={theme.colors.navbarText} />
            <Text style={{
              fontSize: theme.typography.sm,
              color: theme.colors.navbarText,
              fontWeight: theme.typography.medium,
            }}>
              {t("common.back")}
            </Text>
          </TouchableOpacity>

          {/* Ikon, tittel og e-post */}
          <View style={{ alignItems: "center" }}>
            <Ionicons
              name={isVerified ? "checkmark-circle" : "mail"}
              size={52}
              color={isVerified ? theme.colors.success : theme.colors.primary}
              style={{ marginBottom: theme.spacing.sm }}
            />
            <Text style={{
              fontSize: theme.typography.xl,
              fontWeight: theme.typography.bold,
              color: theme.colors.navbarText,
              marginBottom: theme.spacing.xs,
              textAlign: "center",
            }}>
              {isVerified ? t("auth.emailVerified") : t("auth.verifyYourEmail")}
            </Text>
            <Text style={{
              fontSize: theme.typography.md,
              color: theme.colors.textMuted,
              textAlign: "center",
            }}>
              {isVerified ? t("auth.accountNowActive") : t("auth.weSentEmailTo")}
            </Text>
            {!isVerified && (
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.primary,
                textAlign: "center",
                marginTop: theme.spacing.xs,
              }}>
                {email}
              </Text>
            )}
          </View>
        </View>

        {/* Innhold */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
          }}>
            <Animated.View style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              maxWidth: 400,
              alignSelf: "center",
              width: "100%",
            }}>
              {!isVerified && (
                <View style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.lg,
                  padding: theme.spacing.lg,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 4,
                }}>
                  <Text style={{
                    fontSize: theme.typography.md,
                    fontWeight: theme.typography.semibold,
                    color: theme.colors.textPrimary,
                    marginBottom: theme.spacing.sm,
                    textAlign: "center",
                  }}>
                    {t("auth.enterVerificationCode")}
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
                  />

                  <ButtonNative
                    text={t("auth.verifyCode")}
                    loadingText={t("auth.verifying")}
                    onPress={verifyCode}
                    loading={isLoading}
                    disabled={code.length !== 6 || isLoading}
                    variant="primary"
                    size="large"
                    fullWidth
                  />

                  {/* Send på nytt */}
                  <View style={{
                    alignItems: "center",
                    marginTop: theme.spacing.lg,
                    paddingTop: theme.spacing.md,
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
                        borderColor: resendCooldown > 0 ? theme.colors.border : theme.colors.primary,
                        backgroundColor: resendCooldown > 0 ? theme.colors.backgroundAlt : theme.colors.surface,
                      }}
                      onPress={resendEmail}
                      disabled={resendCooldown > 0 || isLoading}
                    >
                      <Ionicons
                        name="refresh"
                        size={16}
                        color={resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={{
                        color: resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary,
                        fontSize: theme.typography.sm,
                        fontWeight: theme.typography.medium,
                      }}>
                        {resendCooldown > 0
                          ? t("auth.resendIn", { time: formatTime(resendCooldown) })
                          : t("auth.sendAgain")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerificationScreen;
