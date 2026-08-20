// features/account/screens/VerifyNewPhoneScreen.tsx
import React, { useState } from "react";
import {
  Text, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import AppHeader from "@/components/common/AppHeader";
import { verifyNewPhone } from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import VerifyCodeCard from "@/components/common/VerifyCodeCard";
import { useUserCacheStore } from "@/store/useUserCacheStore";

type Props = StackScreenProps<RootStackParamList, "VerifyNewPhoneScreen">;

export default function VerifyNewPhoneScreen({ navigation, route }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { newPhone } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useUserCacheStore((s) => s.currentUser);
  const setCurrentUser = useUserCacheStore((s) => s.setCurrentUser);

  const handleVerify = async (code: string) => {
    setIsSubmitting(true);
    const result = await verifyNewPhone(code);
    setIsSubmitting(false);

    if (!result.success) {
      let body = result.error;
      if (result.code === AccountErrorCode.InvalidCode || result.code === AccountErrorCode.ExpiredCode)
        body = t("profile.invalidOrExpiredCode");
      if (result.code === AccountErrorCode.RateLimited)
        body = t("profile.changePhoneRateLimit");

      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("profile.changePhoneErrorTitle"),
        customBody: body,
        position: "top",
      });
      return;
    }

    if (currentUser) {
      setCurrentUser({ ...currentUser, phoneNumber: newPhone });
    }

    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("profile.phoneChangedTitle"),
      customBody: t("profile.phoneChangedBody"),
      position: "top",
    });

    navigation.reset({ index: 0, routes: [{ name: "ProfileSettingsScreen" }] });
  };

  // SMS kan ikke sendes på nytt uten å starte flyten på nytt — vi viser ingen resend her
  const handleResend = async () => {
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("auth.emailSentTitle"),
      customBody: t("auth.emailSentBody"),
      position: "top",
    });
  };

  const goBack = () =>
    navigation.reset({ index: 0, routes: [{ name: "ProfileSettingsScreen" }] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
      <AppHeader
        title={t("profile.changePhoneTitle")}
        onBackPress={goBack}
        backIcon={ArrowLeft}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
            paddingBottom: theme.spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{
            fontSize: theme.typography.sm,
            color: theme.colors.textSecondary,
            textAlign: "center",
            marginBottom: theme.spacing.xl,
          }}>
            {newPhone}
          </Text>

          <VerifyCodeCard
            title={t("profile.verifyNewPhoneTitle")}
            description={t("profile.verifyNewPhoneDescription")}
            onVerify={handleVerify}
            onResend={handleResend}
            isSubmitting={isSubmitting}
            initialCooldown={120}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
