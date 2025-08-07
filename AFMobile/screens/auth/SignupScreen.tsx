// screens/auth/SignupScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FormFieldNative from "@/components/common/FormFieldNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/ButtonNative";

// Type for navigation
type NavigationProps = {
  navigate: (screen: string) => void;
  goBack: () => void;
};

export default function SignupScreen() {
  const navigation = useNavigation<NavigationProps>();
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<{[key: string]: string}>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement signup logic with your API
      console.log("Signup data:", formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate to login or home based on your flow
      navigation.navigate('Login');
    } catch (error) {
      console.error("Signup error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join ActivityFinder today</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <FormFieldNative
              id="name"
              label="Full Name"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Your full name"
              disabled={isSubmitting}
              error={errors.name}
              touched={!!errors.name}
              autoCapitalize="words"
            />

            <FormFieldNative
              id="email"
              label="Email"
              type="email"
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              placeholder="Your email address"
              disabled={isSubmitting}
              error={errors.email}
              touched={!!errors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <PasswordFieldNative
              id="password"
              label="Password"
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              placeholder="Create a password"
              disabled={isSubmitting}
              error={errors.password}
              touched={!!errors.password}
            />

            <PasswordFieldNative
              id="confirmPassword"
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => handleInputChange('confirmPassword', text)}
              placeholder="Confirm your password"
              disabled={isSubmitting}
              error={errors.confirmPassword}
              touched={!!errors.confirmPassword}
            />

            <ButtonNative
              text="Create Account"
              loadingText="Creating account..."
              onPress={handleSignup}
              loading={isSubmitting}
              disabled={isSubmitting}
              variant="primary"
              size="large"
              fullWidth
              style={styles.signupButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity 
                onPress={navigateToLogin}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>Login here!</Text>
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
  form: {
    flex: 1,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  signupButton: {
    marginTop: 24,
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