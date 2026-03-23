// features/auth/screens/ResetPasswordScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';
import { formatTime } from '@/utils/formatTime';
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import AppHeader from '@/components/common/AppHeader';
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { validateSingleField } from "@shared/utils/validators";
import { ResetPasswordScreenNavigationProp, ResetPasswordScreenRouteProp } from '@/types/navigation';
import {
  requestPasswordReset,
  verifyPasswordResetEmailCode,
  resetPassword,
} from '@/features/auth/services/verificationService';

interface Props {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordScreenRouteProp;
}

const ResetPasswordScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const [step, setStep] = useState<'request' | 'code' | 'password'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ========== Steg 1: Be om tilbakestillings-e-post ==========

  const handleRequestReset = async () => {
    if (!email.trim()) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.email'),
        customBody: t('auth.pleaseEnterEmail'),
        position: 'top',
      });
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(email);

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t('auth.resetEmailSentTitle'),
        customBody: t('auth.resetEmailSentBody'),
        position: 'top',
      });
      setStep('code');
      setResendCooldown(120);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.requestFailed'),
        customBody: result.error,
        position: 'top',
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 2: Verifiser kode ==========

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.invalidResetCode'),
        customBody: t('auth.pleaseEnter6Digit'),
        position: 'top',
      });
      return;
    }

    setIsLoading(true);
    const result = await verifyPasswordResetEmailCode(email, code);

    if (result.success) {
      setStep('password');
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.invalidResetCode'),
        customBody: t('auth.invalidOrExpired'),
        position: 'top',
      });
    }

    setIsLoading(false);
  };

  // ========== Steg 3: Sett nytt passord ==========

  const handleResetPassword = async () => {
    const passwordError = validateSingleField("password", newPassword);
    if (passwordError) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.password'),
        customBody: passwordError,
        position: 'top',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.passwordMismatch'),
        customBody: t('auth.passwordsDoNotMatch'),
        position: 'top',
      });
      return;
    }

    setIsLoading(true);
    const result = await resetPassword(email, code, newPassword);

    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t('auth.passwordResetTitle'),
        customBody: t('auth.passwordResetBody'),
        position: 'top',
      });
      setTimeout(() => navigation.replace('Login'), 2000);
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t('auth.resetFailed'),
        customBody: result.error,
        position: 'top',
      });
    }

    setIsLoading(false);
  };

  // ========== Dynamiske header-verdier per steg ==========

  const headerIcon = step === 'request' ? 'key' : step === 'code' ? 'mail' : 'lock-closed';
  const stepTitle = step === 'request'
    ? t('auth.resetPassword')
    : step === 'code'
    ? t('auth.checkYourEmail')
    : t('auth.newPassword');
  const stepSubtitle = step === 'request'
    ? t('auth.enterEmailForReset')
    : step === 'code'
    ? t('auth.enterCodeWeSent')
    : t('auth.chooseStrongPassword');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t('auth.resetPassword')}
        subtitle={t('auth.resetSubtitle')}
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
        showBorder={true}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Ikon + steg-tittel */}
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
            <View style={{ marginBottom: theme.spacing.md }}>
              <Ionicons name={headerIcon as any} size={60} color={theme.colors.primary} />
            </View>
            <Text style={{
              fontSize: theme.typography.lg,
              fontWeight: theme.typography.bold,
              color: theme.colors.textPrimary,
              marginBottom: theme.spacing.xs,
              textAlign: 'center',
            }}>
              {stepTitle}
            </Text>
            <Text style={{
              fontSize: theme.typography.md,
              color: theme.colors.textSecondary,
              textAlign: 'center',
              marginBottom: theme.spacing.xs,
            }}>
              {stepSubtitle}
            </Text>
            {step === 'code' && (
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.primary,
                textAlign: 'center',
              }}>
                {email}
              </Text>
            )}
          </View>

          {/* Steg 1: E-post-inndata */}
          {step === 'request' && (
            <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <Text style={{
                fontSize: theme.typography.md,
                fontWeight: theme.typography.semibold,
                color: theme.colors.textPrimary,
                marginBottom: theme.spacing.xs,
              }}>
                {t('auth.emailAddress')}
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  fontSize: theme.typography.md,
                  backgroundColor: theme.colors.backgroundInput,
                  color: theme.colors.textPrimary,
                  marginBottom: theme.spacing.xs,
                }}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.enterYourEmail')}
                placeholderTextColor={theme.colors.textPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <ButtonNative
                text={t('auth.sendResetEmail')}
                loadingText={t('auth.sending')}
                onPress={handleRequestReset}
                variant="primary"
                size="medium"
                loading={isLoading}
                disabled={isLoading || !email.trim()}
                fullWidth
              />
            </View>
          )}

          {/* Steg 2: Kode-inndata */}
          {step === 'code' && (
            <>
              <View style={{ marginBottom: theme.spacing.lg }}>
                <Text style={{
                  fontSize: theme.typography.md,
                  fontWeight: theme.typography.semibold,
                  color: theme.colors.textPrimary,
                  marginBottom: theme.spacing.sm,
                  textAlign: 'center',
                }}>
                  {t('auth.enterResetCode')}
                </Text>
                <TextInput
                  style={{
                    borderWidth: 2,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.md,
                    fontSize: 24,
                    textAlign: 'center',
                    letterSpacing: 4,
                    marginBottom: theme.spacing.md,
                    backgroundColor: theme.colors.backgroundInput,
                    color: theme.colors.textPrimary,
                  }}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  placeholderTextColor={theme.colors.textPlaceholder}
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                />
                <ButtonNative
                  text={t('auth.verifyCode')}
                  loadingText={t('auth.verifying')}
                  onPress={handleVerifyCode}
                  variant="primary"
                  size="medium"
                  loading={isLoading}
                  disabled={code.length !== 6 || isLoading}
                  fullWidth
                />
              </View>

              {/* Send på nytt */}
              <View style={{
                alignItems: 'center',
                paddingVertical: theme.spacing.md,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
              }}>
                <Text style={{
                  fontSize: theme.typography.sm,
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.sm,
                }}>
                  {t('auth.didntReceiveEmail')}
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: theme.spacing.sm,
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: resendCooldown > 0 ? theme.colors.border : theme.colors.primary,
                    backgroundColor: resendCooldown > 0 ? theme.colors.backgroundAlt : theme.colors.surface,
                  }}
                  onPress={handleRequestReset}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{
                    color: resendCooldown > 0 ? theme.colors.textMuted : theme.colors.primary,
                    fontSize: theme.typography.sm,
                    fontWeight: theme.typography.medium,
                  }}>
                    {resendCooldown > 0
                      ? t('auth.resendIn', { time: formatTime(resendCooldown) })
                      : t('auth.sendAgain')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Steg 3: Nytt passord */}
          {step === 'password' && (
            <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <PasswordFieldNative
                id="newPassword"
                label={t('auth.newPassword')}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('auth.enterNewPassword')}
                touched={true}
              />
              <PasswordFieldNative
                id="confirmPassword"
                label={t('auth.confirmNewPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.confirmNewPasswordPlaceholder')}
                touched={true}
              />
              <ButtonNative
                text={t('auth.updatePassword')}
                loadingText={t('auth.updating')}
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

export default ResetPasswordScreen;
