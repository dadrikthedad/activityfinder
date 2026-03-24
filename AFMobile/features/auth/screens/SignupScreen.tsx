// features/auth/screens/SignupScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import AppHeader from "@/components/common/AppHeader";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import SignUpNameFieldsNative from "@/features/auth/components/SignUpNameFieldsNative";
import SignUpContactFieldsNative from "@/features/auth/components/SignUpContactFieldsNative";
import SignUpPasswordSimpleFieldNative from "@/features/auth/components/SignUpPasswordSimpleFieldNative";
import SignUpCountryFieldNative from "@/features/auth/components/SignUpCountryFieldNative";
import DatePickerNative from "@/components/common/DatePickerNative";
import { useFormHandlers } from "@/hooks/useFormHandlers";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useRegisterUser } from "@/features/auth/hooks/useRegisterUser";
import { handleSubmitNative } from "@/utils/form/handleSubmitNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { SignupScreenNavigationProp } from "@/types/navigation";
import { RegisterResponseDTO } from "@/features/auth/models/RegisterResponseDTO";

export default function SignupScreen() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  // Snapshotter e-posten før skjemaet nullstilles i useRegisterUser — formData.email er "" på navigasjonstidspunktet
  const registeredEmailRef = useRef("");

  const {
    formData, errors, setErrors, touchedFields, setTouchedFields,
    handleChange, handleBlur, validateAllFields, message, setMessage, setFormData,
  } = useFormHandlers({
    firstName: "", lastName: "",
    email: "", password: "", confirmPassword: "",
    country: "", dateOfBirth: "",
    middleName: "", phone: "", region: "", postalCode: "", gender: "",
  });

  const [isRegistered, setIsRegistered] = useState(false);

  const { countries, countryCodes, dialCode } = useCountryAndRegion({
    country: formData.country,
    setFormData,
    editing: true,
  });

  const { registerUser, isSubmitting } = useRegisterUser({
    formData, countryCodes, setFormData, setErrors, setMessage,
    onSuccess: (_response: RegisterResponseDTO) => {
      // Snapshot e-posten NÅ — useRegisterUser nullstiller skjemaet rett etter dette kallet
      registeredEmailRef.current = formData.email.trim();
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("auth.accountCreated"),
        customBody: t("auth.accountCreatedBody"),
        position: "top",
      });
      setTimeout(() => setIsRegistered(true), 1500);
    },
  });

  useEffect(() => {
    if (message) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("common.error"),
        customBody: message,
        position: "top",
      });
    }
  }, [message]);

  useEffect(() => {
    if (errors["general"]) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("common.error"),
        customBody: errors["general"],
        position: "top",
      });
    }
  }, [errors]);

  useEffect(() => {
    if (isRegistered) {
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{
            name: "VerificationScreen",
            params: { email: registeredEmailRef.current, fromRegistration: true },
          }],
        });
      }, 500);
    }
  }, [isRegistered, navigation]);

  const handleAttemptSubmit = () => {
    handleSubmitNative({ formData, setTouchedFields, validateAllFields, setErrors, setMessage, onSubmit: registerUser });
  };

  const handleBackToLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t("auth.register")}
        subtitle={t("auth.registerSubtitle")}
        onBackPress={handleBackToLogin}
        backIcon={ArrowLeft}
        showBorder={true}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Skjema */}
          <View style={{ flex: 1, maxWidth: 400, alignSelf: "center", width: "100%" }}>
            <SignUpNameFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />
            <SignUpContactFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
              suggestedDialCode={dialCode}
            />
            <SignUpPasswordSimpleFieldNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />
            <SignUpCountryFieldNative
              formData={formData}
              handleChange={handleChange}
              errors={errors}
              touchedFields={touchedFields}
              countries={countries}
            />
            <DatePickerNative
              id="dateOfBirth"
              label={t("auth.dateOfBirth")}
              value={formData.dateOfBirth}
              onChangeText={(value) => handleChange("dateOfBirth", value)}
              onBlur={() => handleBlur("dateOfBirth")}
              error={errors.dateOfBirth}
              touched={touchedFields.dateOfBirth}
              tooltip={t("auth.dateOfBirthTooltip")}
              maxDate={new Date()}
              minDate={new Date(1900, 0, 1)}
            />

            {/* Knapper */}
            <View style={{ marginTop: theme.spacing.lg, alignItems: "center" }}>
              <ButtonNative
                text={t("auth.signUp")}
                loadingText={t("auth.submitting")}
                onPress={handleAttemptSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                variant="primary"
                size="large"
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
