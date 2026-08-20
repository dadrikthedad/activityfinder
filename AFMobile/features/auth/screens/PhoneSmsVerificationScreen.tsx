// features/auth/screens/PhoneSmsVerificationScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, KeyboardAvoidingView,
  Platform, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import VerifyCodeCard from "@/components/common/VerifyCodeCard";
import { PhoneSmsVerificationScreenNavigationProp, PhoneSmsVerificationScreenRouteProp } from "@/types/navigation";
import { verifySmsCode, resendSmsVerification } from "@/features/auth/services/verificationService";

interface Props {
  navigation: PhoneSmsVerificationScreenNavigationProp;
  route: PhoneSmsVerificationScreenRouteProp;
}

const PhoneSmsVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [isLoading, setIsLoading] = useState(false);
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

  // Send SMS automatisk ved mount — backend sin rate limit hindrer dobbelsending
  useEffect(() => {
    const sendInitialSms = async () => {
      if (!email) return;
      await resendSmsVerification(email);
    };
    sendInitialSms();
  }, []);

  // ========== Verifiser SMS-kode ==========

  const handleVerify = async (code: string) => {
    setIsLoading(true);
    const result = await verifySmsCode(email, code);

    if (result.success) {
      setIsVerified(true);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.smsVerifiedTitle"),
        customBody: t("auth.smsVerifiedBody"),
        position: "top",
      });
      // fromVerification: true viser "klar til å logge inn"-banneret på Login
      setTimeout(() => navigation.replace("Login", { fromVerification: true }), 2000);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.smsVerificationFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setIsLoading(false);
  };

  // ========== Send SMS på nytt ==========

  const handleResend = async () => {
    const result = await resendSmsVerification(email);

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.smsSentTitle"),
        customBody: t("auth.smsSentBody"),
        position: "top",
      });
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("auth.smsResendFailed"),
        customBody: result.error,
        position: "top",
      });
    }
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
              name={isVerified ? "checkmark-circle" : "phone-portrait"}
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
              {isVerified ? t("auth.phoneVerified") : t("auth.verifyYourPhone")}
            </Text>
            <Text style={{
              fontSize: theme.typography.md,
              color: theme.colors.textMuted,
              textAlign: "center",
            }}>
              {isVerified ? t("auth.phoneNowActive") : t("auth.weSentSmsTo")}
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
                <VerifyCodeCard
                  title={t("auth.enterSmsCode")}
                  description={t("auth.didntReceiveSms")}
                  onVerify={handleVerify}
                  onResend={handleResend}
                  isSubmitting={isLoading}
                  initialCooldown={120}
                />
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default PhoneSmsVerificationScreen;
