// screens/auth/LoginScreen.tsx - Oppdatert versjon
import React, { useMemo } from "react";
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
import { useLogin } from "@/hooks/auth/useLogin";
import FormFieldNative from "@/components/common/FormFieldNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import OptionModalNative from "@/components/common/modal/OptionModalNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { LoginScreenNavigationProp } from "@/types/navigation";

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isSubmitting,
    handleLogin,
    clearError,
    // *** NYE PROPERTIES FOR EMAIL VERIFICATION ***
    showVerificationPrompt,
    setShowVerificationPrompt,
    resendingEmail,
    handleResendVerificationEmail,
    handleNavigateToVerification,
  } = useLogin();

  const onLoginPress = async () => {
    try {
      await handleLogin();
      // AuthContext håndterer navigasjon automatisk hvis login er vellykket
    } catch (error) {
      // Error is already handled in the hook
      console.log("Login error handled by hook");
    }
  };

  const navigateToSignup = () => {
    navigation.navigate('Signup');
  };

  // Show error as toast if there's an error message
  React.useEffect(() => {
    if (errorMessage) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Login Error",
        customBody: errorMessage,
        position: 'top'
      });
      
      clearError();
    }
  }, [errorMessage, clearError]);

  // *** EMAIL VERIFICATION MODAL OPTIONS - Memoized for performance ***
  const verificationOptions = useMemo(() => [
    {
      label: "Verify Email Now",
      value: "verify"
    },
    {
      label: "Resend Verification Email", 
      value: "resend"
    }
  ], []);

  const handleVerificationAction = async (action: string) => {
    switch (action) {
      case "verify":
        handleNavigateToVerification();
        break;
      case "resend":
        await handleResendVerificationEmail();
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Email Sent!",
          customBody: "Verification email has been sent to your inbox.",
          position: 'top'
        });
        break;
    }
  };

  const handleModalClose = () => {
    setShowVerificationPrompt(false);
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
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Login to continue.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <FormFieldNative
              id="email"
              label="Email"
              type="email"
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              disabled={isSubmitting || resendingEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <PasswordFieldNative
              id="password"
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              disabled={isSubmitting || resendingEmail}
            />

            <ButtonNative
              text="Logg inn"
              loadingText={resendingEmail ? "Sending email..." : "Logging in..."}
              onPress={onLoginPress}
              loading={isSubmitting || resendingEmail}
              disabled={isSubmitting || resendingEmail}
              variant="primary"
              size="large"
              fullWidth
              style={styles.loginButton}
            />

            {/* Signup Button */}
            <View style={styles.signupContainer}>
              <Text style={styles.footerText}>No account? </Text>
              <ButtonNative
                text="Sign up here!"
                onPress={navigateToSignup}
                variant="ghost"
                size="medium"
                disabled={isSubmitting || resendingEmail}
                textStyle={styles.signupButtonText}
              />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Optionally add forgot password link here */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* *** EMAIL VERIFICATION MODAL - Vises automatisk når showVerificationPrompt er true *** */}
      {showVerificationPrompt && (
        <OptionModalNative
          key="verification-modal" // Gi modal en unik key for bedre ytelse
          title="Email Verification Required"
          options={verificationOptions}
          onSelect={handleVerificationAction}
          onClose={handleModalClose}
          blurBackground={true}
          dismissOnBackdrop={false} // Force user to make a choice
          autoShow={true}
        />
      )}
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
    marginTop: 60,
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
  form: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  loginButton: {
    marginTop: 24,
  },
  signupContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: "#6b7280",
  },
  signupButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});