// screens/auth/SignupScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

// Components
import ButtonNative from "@/components/common/buttons/ButtonNative";
import SignUpNameFieldsNative from "@/components/signup/SignUpNameFieldsNative";
import SignUpContactFieldsNative from "@/components/signup/SignUpContactFieldsNative";
import SignUpLocationFieldsNative from "@/components/signup/SignUpLocationFieldsNative";
import SignUpDemoFieldsNative from "@/components/signup/SignUpDemoFieldsNative";
import SignUpPasswordSimpleFieldNative from "@/components/signup/SignUpPasswordSimpleFieldNative";

// Hooks and utilities
import { useFormHandlers } from "@/hooks/useFormHandlers";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useRegisterUser } from "@/hooks/useRegisterUser";
import { handleSubmitNative } from "@/utils/form/handleSubmitNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";

// Types
import { SignupScreenNavigationProp } from "@/types/navigation";
import { RegisterResponseDTO } from "@shared/types/auth/RegisterResponseDTO";

export default function SignupScreen() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  
  const {
    formData,
    errors,
    setErrors,
    touchedFields,
    setTouchedFields,
    handleChange,
    handleBlur,
    validateAllFields,
    message,
    setMessage,
    setFormData,
  } = useFormHandlers({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    dateOfBirth: "",
    country: "",
    region: "",
    postalCode: "",
    gender: "",
  });

  const [isRegistered, setIsRegistered] = useState(false);

  const {
    countries,
    regions,
    countryCodes,
    fetchRegionsForCountry,
  } = useCountryAndRegion({
    country: formData.country,
    setFormData,
    editing: true,
  });

  const { registerUser, isSubmitting } = useRegisterUser({
    formData,
    countryCodes,
    setFormData,
    setErrors,
    setMessage,
    onSuccess: (_response: RegisterResponseDTO) => {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Registration Successful!",
        customBody: "Your account has been created. Check your email to verify your account.",
        position: 'top',
      });

      setTimeout(() => {
        setIsRegistered(true);
      }, 1500);
    },
  });

  // Vis feilmelding som toast
  useEffect(() => {
    if (message) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Registration Error",
        customBody: message,
        position: 'top',
      });
    }
  }, [message]);

  useEffect(() => {
    if (errors["general"]) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: errors["general"],
        position: 'top',
      });
    }
  }, [errors]);

  const handleAttemptSubmit = () => {
    handleSubmitNative({
      formData,
      setTouchedFields,
      validateAllFields,
      setErrors,
      setMessage,
      onSubmit: registerUser,
    });
  };

  // Redirect til login etter registrering
  useEffect(() => {
    if (isRegistered) {
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login', params: { fromSignup: true } }],
        });
      }, 500);
    }
  }, [isRegistered, navigation]);

  const navigateToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleCountryChange = async (selectedCountry: string) => {
    setFormData((prev) => ({
      ...prev,
      country: selectedCountry,
      region: "",
    }));
    await fetchRegionsForCountry(selectedCountry);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Register</Text>
            <Text style={styles.subtitle}>Create a new account.</Text>
          </View>

          <View style={styles.formContainer}>
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
            />
            <SignUpPasswordSimpleFieldNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />
            <SignUpLocationFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
              countries={countries}
              regions={regions}
              handleCountryChange={handleCountryChange}
            />
            <SignUpDemoFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />

            <View style={styles.buttonContainer}>
              <ButtonNative
                text="Sign up"
                loadingText="Submitting..."
                onPress={handleAttemptSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                variant="primary"
                size="large"
                fullWidth
                style={styles.signupButton}
              />
              <View style={styles.loginContainer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <ButtonNative
                  text="Login here!"
                  onPress={navigateToLogin}
                  variant="ghost"
                  size="medium"
                  disabled={isSubmitting}
                  textStyle={styles.loginButtonText}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1C6B1C",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  buttonContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  signupButton: {
    marginBottom: 16,
  },
  loginContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#6b7280",
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
