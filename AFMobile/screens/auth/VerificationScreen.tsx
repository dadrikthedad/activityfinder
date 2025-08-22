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
import { 
  VerificationScreenNavigationProp, 
  VerificationScreenRouteProp  
} from '@/types/navigation';

interface EmailVerificationScreenProps {
  navigation: VerificationScreenNavigationProp;
  route: VerificationScreenRouteProp;
}

const VerificationScreen: React.FC<EmailVerificationScreenProps> = ({ route, navigation }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  
  // Get email from navigation params
  const email = route.params?.email || '';
  
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

    // Handle deep links
    const handleDeepLink = (url: string) => {
      if (url && url.includes('/verify-email')) {
        const token = url.split('token=')[1];
        if (token) {
          verifyWithToken(token);
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

  const verifyWithToken = async (token: string) => {
    setIsLoading(true);
    try {
      const url = `${API_BASE_URL}/api/email/verify`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data?.success) {
        setIsVerified(true);
        // Success animation
        Animated.sequence([
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        // Show success toast
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Email Verified!",
          customBody: "Your email has been verified successfully! ✅",
          position: 'top'
        });

        // Navigate to login after a short delay
        setTimeout(() => {
          navigation.replace('Login');
        }, 2000);
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Verification Failed",
          customBody: data?.message || 'Invalid verification code',
          position: 'top'
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
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

  const verifyCode = () => {
    if (code.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Invalid Code",
        customBody: "Please enter a 6-digit verification code",
        position: 'top'
      });
      return;
    }
    verifyWithToken(code);
  };

  const resendEmail = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const url = `${API_BASE_URL}/api/email/resend-verification`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data?.emailSent) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Email Sent!",
          customBody: "A new verification email has been sent to your inbox. 📧",
          position: 'top'
        });
        setResendCooldown(120); // 2 minutes cooldown
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Resend Failed",
          customBody: data?.message || 'Failed to resend email',
          position: 'top'
        });
      }
    } catch (error) {
      console.error('Resend email error:', error);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Network Error",
        customBody: "Failed to resend email. Please try again.",
        position: 'top'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppHeader */}
      <AppHeader
        title="Verify Your Email"
        subtitle="Check your inbox and verify your account"
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
                name={isVerified ? "checkmark-circle" : "mail"} 
                size={60} 
                color={isVerified ? "#22c55e" : "#1C6B1C"} 
              />
            </View>
            <Text style={styles.title}>
              {isVerified ? 'Email Verified!' : 'Check Your Email'}
            </Text>
            <Text style={styles.subtitle}>
              {isVerified 
                ? 'Your account is now active and ready to use!'
                : `We sent a verification email to:`
              }
            </Text>
            {!isVerified && (
              <Text style={styles.email}>{email}</Text>
            )}
          </View>

          {!isVerified && (
            <>
              {/* Instructions */}
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>How to verify:</Text>
                
                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepText}>1</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Click "Open in Web" from the email
                  </Text>
                </View>

                <View style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepText}>2</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Or enter the 6-digit code below
                  </Text>
                </View>
              </View>

              {/* Code Input */}
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Enter verification code:</Text>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus={false}
                />
                
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    code.length === 6 ? styles.verifyButtonActive : styles.verifyButtonInactive
                  ]}
                  onPress={verifyCode}
                  disabled={code.length !== 6 || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Resend Section */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the email?</Text>
                
                <TouchableOpacity
                  style={[
                    styles.resendButton,
                    resendCooldown > 0 && styles.resendButtonDisabled
                  ]}
                  onPress={resendEmail}
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

          {/* Bottom Actions - Fjernet siden vi har AppHeader */}
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
  instructionsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1C6B1C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
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
  verifyButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  verifyButtonActive: {
    backgroundColor: '#1C6B1C',
  },
  verifyButtonInactive: {
    backgroundColor: '#d1d5db',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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

export default VerificationScreen;