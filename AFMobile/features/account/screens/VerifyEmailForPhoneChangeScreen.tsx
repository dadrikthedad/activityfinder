// features/account/screens/VerifyEmailForPhoneChangeScreen.tsx
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
import {
  verifyEmailForPhoneChange,
  requestPhoneChange,
} from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import VerifyCodeCard from "@/components/common/VerifyCodeCard";

type Props = StackScreenProps<RootStackParamList, "VerifyEmailForPhoneChangeScreen">;

export default function VerifyEmailForPhoneChangeScreen({ navigation, route }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { newPhone, currentPassword } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async (code: string) => {
    setIsSubmitting(true);
    const result = await verifyEmailForPhoneChange(code);
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

    navigation.replace("VerifyNewPhoneScreen", { newPhone });
  };

  const handleResend = async () => {
    const result = await requestPhoneChange(currentPassword, newPhone);

    if (!result.success) {
      let body = result.error;
      if (result.code === AccountErrorCode.RateLimited) body = t("profile.changePhoneRateLimit");

      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("profile.changePhoneErrorTitle"),
        customBody: body,
        position: "top",
      });
      return;
    }

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
          <VerifyCodeCard
            title={t("profile.verifyEmailForPhoneTitle")}
            description={t("profile.verifyEmailForPhoneDescription")}
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
