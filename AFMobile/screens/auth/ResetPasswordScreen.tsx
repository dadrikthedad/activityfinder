import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft } from 'lucide-react-native';
import { API_BASE_URL } from "@/constants/routes";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import AppHeader from '@/components/common/AppHeader';
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { validateSingleField } from "@shared/utils/validators";
import { 
  ResetPasswordScreenNavigationProp, 
  ResetPasswordScreenRouteProp  
} from '@/types/navigation';
import { 
  requestPasswordReset, 
  validateResetToken, 
  resetPassword 
} from '@/services/security/verificationService';

interface ResetPasswordScreenProps {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordScreenRouteProp;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ route, navigation }) => {
  const [step, setStep] = useState<'request' | 'code' | 'password'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tokenFromLink, setTokenFromLink] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Handle deep links (web reset links)
    const handleDeepLink = (url: string) => {
      if (url && url.includes('/reset-password')) {
        const token = url.split('token=')[1];
        if (token) {
          setTokenFromLink(token);
          setStep('password'); // Skip code step, go directly to password reset
        }
      }
    };

    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    return () => {
      linkingSubscription?.remove();
    };
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Email Required",
        customBody: "Please enter your email address",
        position: 'top'
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPasswordReset(email);

      if (result.success) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Reset Email Sent!",
          customBody: "Check your email for reset instructions with both a link and code. 📧",
          position: 'top'
        });
        setStep('code');
        setResendCooldown(120);
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Request Failed",
          customBody: result.message,
          position: 'top'
        });
      }
    } catch (error: any) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Network Error",
        customBody: error.message || "Failed to send reset email. Please try again.",
        position: 'top'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Invalid Code",
        customBody: "Please enter a 6-digit reset code",
        position: 'top'
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateResetToken(code);

      if (result.isValid) {
        setStep('password');
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Invalid Code",
          customBody: "The reset code is invalid or expired. Please try again.",
          position: 'top'
        });
      }
    } catch (error) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Verification Error",
        customBody: "Something went wrong. Please try again.",
        position: 'top'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    // Validation
    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Invalid Password",
        customBody: passwordError,
        position: 'top'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Password Mismatch",
        customBody: "Passwords do not match",
        position: 'top'
      });
      return;
    }

    setIsLoading(true);
    try {
      const tokenOrCode = tokenFromLink || code;
      const result = await resetPassword(tokenOrCode, newPassword, confirmPassword);

      if (result.success) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Password Reset!",
          customBody: "Your password has been updated successfully! ✅",
          position: 'top'
        });

        setTimeout(() => {
          navigation.replace('Login');
        }, 2000);
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Reset Failed",
          customBody: result.message,
          position: 'top'
        });
      }
    } catch (error: any) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Reset Error",
        customBody: error.message || "Something went wrong. Please try again.",
        position: 'top'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendResetEmail = async () => {
    if (resendCooldown > 0 || !email) return;
    await handleRequestReset();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getHeaderContent = () => {
    switch (step) {
      case 'request':
        return {
          icon: 'key' as const,
          title: 'Reset Password',
          subtitle: 'Enter your email to receive reset instructions'
        };
      case 'code':
        return {
          icon: 'mail' as const,
          title: 'Check Your Email',
          subtitle: 'Enter the 6-digit code we sent you'
        };
      case 'password':
        return {
          icon: 'lock-closed' as const,
          title: 'Create New Password',
          subtitle: 'Choose a strong password for your account'
        };
    }
  };

  const headerContent = getHeaderContent();

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Reset Password"
        subtitle="Recover access to your account"
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
        showBorder={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={headerContent.icon} 
                size={60} 
                color="#1C6B1C" 
              />
            </View>
            <Text style={styles.title}>{headerContent.title}</Text>
            <Text style={styles.subtitle}>{headerContent.subtitle}</Text>
            {step === 'code' && (
              <Text style={styles.email}>{email}</Text>
            )}
          </View>

          {/* Step 1: Request Reset */}
          {step === 'request' && (
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Email Address:</Text>
              <TextInput
                style={styles.emailInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              
              <ButtonNative
                text={isLoading ? "Sending..." : "Send Reset Email"}
                onPress={handleRequestReset}
                variant="primary"
                size="medium"
                loading={isLoading}
                disabled={isLoading || !email.trim()}
                fullWidth
              />
            </View>
          )}

          {/* Step 2: Enter Code */}
          {step === 'code' && (
            <>
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Enter reset code:</Text>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus={true}
                />
                
                <ButtonNative
                  text={isLoading ? "Verifying..." : "Verify Code"}
                  onPress={handleVerifyCode}
                  variant="primary"
                  size="medium"
                  loading={isLoading}
                  disabled={code.length !== 6 || isLoading}
                  fullWidth
                />
              </View>

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the email?</Text>
                
                <TouchableOpacity
                  style={[
                    styles.resendButton,
                    resendCooldown > 0 && styles.resendButtonDisabled
                  ]}
                  onPress={resendResetEmail}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  <Ionicons 
                    name="refresh" 
                    size={16} 
                    color={resendCooldown > 0 ? "#9ca3af" : "#1C6B1C"} 
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[
                    styles.resendButtonText,
                    resendCooldown > 0 && styles.resendButtonTextDisabled
                  ]}>
                    {resendCooldown > 0 ? `Resend in ${formatTime(resendCooldown)}` : 'Send Again'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Step 3: Reset Password */}
          {step === 'password' && (
            <View style={styles.formContainer}>
              <PasswordFieldNative
                id="newPassword"
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                touched={true}
              />

              <PasswordFieldNative
                id="confirmPassword"
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                touched={true}
              />

              <ButtonNative
                text={isLoading ? "Updating..." : "Update Password"}
                onPress={handleResetPassword}
                variant="primary"
                size="medium"
                loading={isLoading}
                disabled={isLoading || !newPassword || !confirmPassword}
                fullWidth
              />
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C6B1C',
    textAlign: 'center',
  },
  formContainer: {
    gap: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  codeContainer: {
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  resendContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    backgroundColor: 'white',
  },
  resendButtonDisabled: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  resendButtonText: {
    color: '#1C6B1C',
    fontSize: 14,
    fontWeight: '500',
  },
  resendButtonTextDisabled: {
    color: '#9ca3af',
  },
});

export default ResetPasswordScreen;