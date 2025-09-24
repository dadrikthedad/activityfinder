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

// Native field components
import SignUpNameFieldsNative from "@/components/signup/SignUpNameFieldsNative";
import SignUpContactFieldsNative from "@/components/signup/SignUpContactFieldsNative";
import SignUpPasswordFieldsNative from "@/components/signup/SignUpPasswordFieldsNative";
import SignUpLocationFieldsNative from "@/components/signup/SignUpLocationFieldsNative";
import SignUpDemoFieldsNative from "@/components/signup/SignUpDemoFieldsNative";
import SignUpPasswordSimpleFieldNative from "@/components/signup/SignUpPasswordSimpleFieldNative";

// Hooks and utilities
import { useFormHandlers } from "@/hooks/useFormHandlers";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useRegisterUser } from "@/hooks/useRegisterUser";
import { checkEmailAvailability } from "@/services/user/signUpService";
import { handleSubmitNative } from "@/utils/form/handleSubmitNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";

// Types
import { SignupScreenNavigationProp } from "@/types/navigation";

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

  // Hook for å registrere bruker
  const { registerUser, isSubmitting } = useRegisterUser({
    formData,
    countryCodes,
    setFormData,
    setErrors,
    setMessage,
    onSuccess: () => {
      // Show success toast
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Registration Successful!",
        customBody: "Your account has been created successfully. Redirecting to login...",
        position: 'top'
      });
      
      // Set registered state after a short delay
      setTimeout(() => {
        setIsRegistered(true);
      }, 1500);
    },
  });

  // Show error as toast if there's an error message
  useEffect(() => {
    if (message) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Registration Error",
        customBody: message,
        position: 'top'
      });
    }
  }, [message]);

  // Show general errors as toast
  useEffect(() => {
    if (errors["general"]) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: errors["general"],
        position: 'top'
      });
    }
  }, [errors]);

  // Håndterer og gir en error hvis ikke alt er fylt og vi klikker på submit
  const handleAttemptSubmit = () => {
    handleSubmitNative({
      formData,
      setTouchedFields,
      validateAllFields,
      setErrors,
      setMessage,
      onSubmit: registerUser,
      extraValidation: async () => {
        const errors: Record<string, string> = {};
        if (!formData.email) return errors; // skip API call

        const normalizedEmail = formData.email.trim().toLowerCase();
        
        // Grunnleggende email format validering før API kall
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          errors.email = "Please enter a valid email address.";
          return errors;
        }

        // Sjekk for mistenkelige mønstre som backend ikke liker
        const suspiciousPatterns = [
          "test@", "admin@", "root@", "postmaster@",
          "noreply@", "no-reply@", "@test", "@example"
        ];
        
        const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
          normalizedEmail.includes(pattern.toLowerCase())
        );
        
        if (hasSuspiciousPattern) {
          errors.email = "Invalid email.";
          return errors;
        }

        try {
          const emailAvailable = await checkEmailAvailability(normalizedEmail);
          if (!emailAvailable) {
            errors.email = "An account with this email already exists.";
          }
        } catch (error) {
          console.error('Email availability check failed:', error);
          
          // Prøv å parse backend error message
          let errorMessage = "Could not verify email availability. Please try again.";
          
          if (error && typeof error === 'object' && 'message' in error) {
            const backendMessage = (error as any).message;
            if (typeof backendMessage === 'string') {
              if (backendMessage.includes('Invalid email format')) {
                errorMessage = "Please enter a valid email address.";
              } else if (backendMessage.includes('empty')) {
                errorMessage = "Email address is required.";
              } else if (backendMessage.includes('Database error')) {
                errorMessage = "Server error. Please try again later.";
              } else {
                // Vis backend error message direkte hvis den er forståelig
                errorMessage = backendMessage;
              }
            }
          }
          
          errors.email = errorMessage;
        }
        
        return errors;
      },
    });
  };

  // Debug errors
  useEffect(() => {
    console.log("Akkurat nå, errors:", errors);
  }, [errors]);

  // Redirect til login etter registrering
  useEffect(() => {
  if (isRegistered) {
    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Login', 
          params: { fromSignup: true } // 👈 Send parameteret
        }],
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
      region: "", // Reset region when country changes
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Register</Text>
            <Text style={styles.subtitle}>Create a new user.</Text>
          </View>

          {/* Form Grid Container */}
          <View style={styles.formContainer}>
            
            {/* Name Fields */}
            <SignUpNameFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />

            {/* Contact Fields */}
            <SignUpContactFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />

            {/* Password Fields */}
            <SignUpPasswordSimpleFieldNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />

            {/* Location Fields */}
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

            {/* Demo Fields (Birthday & Postal) */}
            <SignUpDemoFieldsNative
              formData={formData}
              handleChange={handleChange}
              handleBlur={handleBlur}
              errors={errors}
              touchedFields={touchedFields}
            />

            {/* Sign Up Button */}
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

              {/* Login Navigation Button */}
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