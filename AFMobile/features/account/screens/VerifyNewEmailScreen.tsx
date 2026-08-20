// features/account/screens/VerifyNewEmailScreen.tsx
import React, { useState } from "react";
import {
  View, Text, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import AppHeader from "@/components/common/AppHeader";
import { verifyNewEmail } from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import VerifyCodeCard from "@/components/common/VerifyCodeCard";
import { useUserCacheStore } from "@/store/useUserCacheStore";

type Props = StackScreenProps<RootStackParamList, "VerifyNewEmailScreen">;

export default function VerifyNewEmailScreen({ navigation, route }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { newEmail } = route.params;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useUserCacheStore((s) => s.currentUser);
  const setCurrentUser = useUserCacheStore((s) => s.setCurrentUser);

  const handleVerify = async (code: string) => {
    setIsSubmitting(true);
    const result = await verifyNewEmail(code);
    setIsSubmitting(false);

    if (!result.success) {
      let body = result.error;
      if (result.code === AccountErrorCode.InvalidCode || result.code === AccountErrorCode.ExpiredCode)
        body = t("profile.invalidOrExpiredCode");
      if (result.code === AccountErrorCode.RateLimited)
        body = t("profile.changeEmailRateLimit");

      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("profile.changeEmailErrorTitle"),
        customBody: body,
        position: "top",
      });
      return;
    }

    if (currentUser) {
      setCurrentUser({ ...currentUser, email: newEmail });
    }

    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("profile.emailChangedTitle"),
      customBody: t("profile.emailChangedBody"),
      position: "top",
    });

    navigation.reset({ index: 0, routes: [{ name: "ProfileSettingsScreen" }] });
  };

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
        title={t("profile.changeEmailTitle")}
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
          <Text
            style={{
              fontSize: theme.typography.sm,
              color: theme.colors.textSecondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl,
            }}
          >
            {newEmail}
          </Text>

          <VerifyCodeCard
            title={t("profile.verifyNewEmailTitle")}
            description={t("profile.verifyNewEmailDescription")}
            onVerify={handleVerify}
            onResend={handleResend}
            isSubmitting={isSubmitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
