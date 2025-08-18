// screens/auth/LoginScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useLogin } from "@/hooks/auth/useLogin";
import FormFieldNative from "@/components/common/FormFieldNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { LoginScreenNavigationProp } from "@shared/types/navigation";

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
  } = useLogin();

  const onLoginPress = async () => {
    try {
      await handleLogin();
      // AuthContext håndterer navigasjon automatisk
    } catch (error) {
      // Error is already handled in the hook
      console.log("Login error handled by hook");
    }
  };

  const navigateToSignup = () => {
    navigation.navigate('Signup');
  };

  // Show error as alert if there's an error message
  React.useEffect(() => {
    if (errorMessage) {
      Alert.alert(
        "Login Error",
        errorMessage,
        [
          {
            text: "OK",
            onPress: clearError,
          },
        ]
      );
    }
  }, [errorMessage, clearError]);

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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />

            <ButtonNative
              text="Logg inn"
              loadingText="Logging in..."
              onPress={onLoginPress}
              loading={isSubmitting}
              disabled={isSubmitting}
              variant="primary"
              size="large"
              fullWidth
              style={styles.loginButton}
            />

            {/* Error message display (alternative to Alert) */}
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerText}>No account? </Text>
              <TouchableOpacity 
                onPress={navigateToSignup}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>Sign up here!</Text>
              </TouchableOpacity>
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
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 16,
  },
  footerTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#6b7280",
  },
  linkText: {
    color: "#1C6B1C",
    fontWeight: "600",
    fontSize: 14,
  },
});