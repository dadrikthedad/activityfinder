// screens/auth/LoginScreen.tsx - Oppdatert versjon med Forgot Password + Debug Key Clear
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLogin } from "@/hooks/auth/useLogin";
import FormFieldNative from "@/components/common/FormFieldNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import OptionModalNative from "@/components/common/modal/OptionModalNative";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { LoginScreenNavigationProp } from "@/types/navigation";
import { CryptoService } from "@/components/ende-til-ende/CryptoService"; // Import your crypto service

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [clearingKeys, setClearingKeys] = useState(false);
  
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

  // *** NY FUNKSJON FOR FORGOT PASSWORD ***
  const navigateToResetPassword = () => {
    navigation.navigate('ResetPasswordScreen');
  };

  // *** DEBUG FUNCTION - CLEAR ALL PRIVATE KEYS ***
  const handleClearPrivateKeys = () => {
  Alert.alert(
    "Complete Keychain Reset",
    "This will delete ALL private keys AND reset the entire keychain for this app. This gives you a completely clean slate. Continue?",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Reset Everything",
        style: "destructive",
        onPress: async () => {
          setClearingKeys(true);
          try {
            const crypto = CryptoService.getInstance();
            
            console.log('🔐 DEBUG: Starting complete keychain reset...');
            
            // Method 1: Try to clear known user IDs
            const userIds = [127, 128, 129, 130, 195, 200, 201, 202]; // Add more as needed
            
            for (const userId of userIds) {
              try {
                await crypto.clearPrivateKey(userId);
                console.log(`🔐 DEBUG: Cleared private key for user ${userId}`);
              } catch (error) {
                console.log(`🔐 DEBUG: No key found for user ${userId}`);
              }
            }
            
            // Method 2: Try to reset entire keychain (more aggressive)
            try {
              const Keychain = require('react-native-keychain');
              
              // Get all keychain items and delete them
              const credentials = await Keychain.getAllInternetCredentials();
              console.log('🔐 DEBUG: Found keychain items:', Object.keys(credentials || {}));
              
              // Clear each e2ee key we find
              for (const server of Object.keys(credentials || {})) {
                if (server.includes('e2ee_private_key_')) {
                  try {
                    await Keychain.resetInternetCredentials({ server });
                    console.log(`🔐 DEBUG: Cleared keychain entry: ${server}`);
                  } catch (e) {
                    console.log(`🔐 DEBUG: Could not clear: ${server}`);
                  }
                }
              }
              
            } catch (error) {
              console.log('🔐 DEBUG: Could not enumerate keychain:', error);
            }
            
            console.log('🔐 DEBUG: Complete keychain reset completed');
            
            showNotificationToastNative({
              type: LocalToastType.CustomSystemNotice,
              customTitle: "Complete Reset Done",
              customBody: "All encryption keys cleared. Next login will generate fresh keys.",
              position: 'top'
            });
            
          } catch (error) {
            console.error('🔐 ERROR: Failed to reset keychain:', error);
            
            showNotificationToastNative({
              type: LocalToastType.CustomSystemError,
              customTitle: "Reset Failed",
              customBody: "Failed to reset keychain. Check console for details.",
              position: 'top'
            });
          } finally {
            setClearingKeys(false);
          }
        }
      }
    ]
  );
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
              disabled={isSubmitting || resendingEmail || clearingKeys}
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
              disabled={isSubmitting || resendingEmail || clearingKeys}
            />

            {/* *** FORGOT PASSWORD LINK - Rett under password feltet *** */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity
                onPress={navigateToResetPassword}
                disabled={isSubmitting || resendingEmail || clearingKeys}
                style={styles.forgotPasswordButton}
              >
                <Text style={[
                  styles.forgotPasswordText,
                  (isSubmitting || resendingEmail || clearingKeys) && styles.forgotPasswordTextDisabled
                ]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            <ButtonNative
              text="Logg inn"
              loadingText={resendingEmail ? "Sending email..." : "Logging in..."}
              onPress={onLoginPress}
              loading={isSubmitting || resendingEmail}
              disabled={isSubmitting || resendingEmail || clearingKeys}
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
                disabled={isSubmitting || resendingEmail || clearingKeys}
                textStyle={styles.signupButtonText}
              />
            </View>

            {/* *** DEBUG SECTION - ONLY SHOW IN DEVELOPMENT *** */}
            {__DEV__ && (
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>Debug Tools</Text>
                <ButtonNative
                  text="Clear All Private Keys"
                  loadingText="Clearing keys..."
                  onPress={handleClearPrivateKeys}
                  loading={clearingKeys}
                  disabled={isSubmitting || resendingEmail || clearingKeys}
                  variant="danger"
                  size="medium"
                  fullWidth
                  style={styles.debugButton}
                />
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Optionally add other links here */}
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
  // *** NYE STYLES FOR FORGOT PASSWORD ***
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  forgotPasswordButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#1C6B1C',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  forgotPasswordTextDisabled: {
    color: '#9ca3af',
    textDecorationLine: 'none',
  },
  loginButton: {
    marginTop: 8, // Redusert siden forgot password har spacing
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
  // *** DEBUG STYLES ***
  debugSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  debugButton: {
    backgroundColor: '#ef4444',
  },
});