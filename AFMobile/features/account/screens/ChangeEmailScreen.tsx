// features/account/screens/ChangeEmailScreen.tsx
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
import { requestEmailChange } from "@/features/account/services/accountService";
import { AccountErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import AppHeader from "@/components/common/AppHeader";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import FormFieldNative from "@/components/common/FormFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";

type Props = StackScreenProps<RootStackParamList, "ChangeEmailScreen">;

export default function ChangeEmailScreen({ navigation }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = currentPassword.length > 0 && newEmail.includes("@") && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await requestEmailChange(currentPassword, newEmail);
    setIsSubmitting(false);

    if (!result.success) {
      let body = result.error;
      if (result.code === AccountErrorCode.InvalidCurrentPassword) body = t("profile.wrongCurrentPassword");
      if (result.code === AccountErrorCode.Conflict) body = t("profile.emailAlreadyInUse");
      if (result.code === AccountErrorCode.RateLimited) body = t("profile.changeEmailRateLimit");

      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("profile.changeEmailErrorTitle"),
        customBody: body,
        position: "top",
      });
      return;
    }

    navigation.replace("VerifyCurrentEmailForChangeScreen", { newEmail, currentPassword });
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
            {t("profile.changeEmailDescription")}
          </Text>

          <View style={{ gap: theme.spacing.md }}>
            <PasswordFieldNative
              id="currentPassword"
              label={t("auth.password")}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              disabled={isSubmitting}
            />

            <FormFieldNative
              id="newEmail"
              label={t("profile.newEmail")}
              type="email"
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder={t("profile.newEmailPlaceholder")}
              disabled={isSubmitting}
            />
          </View>

          <View style={{ marginTop: theme.spacing.xl }}>
            <ButtonNative
              text={t("profile.changeEmailSubmit")}
              loadingText={t("profile.changeEmailSubmitting")}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
