import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LockKeyholeOpen, CheckCircle, XCircle } from 'lucide-react-native';
import { validateMnemonic, wordlists } from 'bip39';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import { CryptoServiceBackup } from '@/components/ende-til-ende/CryptoServiceBackup';
import { useAuth } from '@/context/AuthContext';

interface E2EERestoreModalProps {
  visible: boolean;
  onRestore: () => void;
  onSkip: () => void;
  onClose: () => void;
  restoreMode?: 'normal' | 'old';
}

export default function E2EERestoreModal({
  visible,
  onRestore,
  onSkip,
  onClose,
  restoreMode = 'normal',
}: E2EERestoreModalProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { userId } = useAuth();

  const [backupPhrase, setBackupPhrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOld = restoreMode === 'old';

  const findSimilarWords = (invalidWord: string, wordList: string[]): string[] => {
    return wordList
      .filter((word) => {
        if (Math.abs(word.length - invalidWord.length) > 2) return false;
        let matches = 0;
        const minLength = Math.min(word.length, invalidWord.length);
        for (let i = 0; i < minLength; i++) {
          if (word[i] === invalidWord[i]) matches++;
        }
        return matches >= minLength * 0.6;
      })
      .slice(0, 3);
  };

  const validatePhrase = (phrase: string): { isValid: boolean; error: string | null } => {
    if (!phrase.trim()) return { isValid: false, error: null };

    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const words = normalized.split(' ');

    if (words.length === 1 && words[0] === '') return { isValid: false, error: null };

    if (words.length < 24) {
      return {
        isValid: false,
        error: t('profile.encryption.restoreModal.validationTooFew', {
          count: 24 - words.length,
          current: words.length,
        }),
      };
    }

    if (words.length > 24) {
      return {
        isValid: false,
        error: t('profile.encryption.restoreModal.validationTooMany', {
          count: words.length - 24,
          current: words.length,
        }),
      };
    }

    const invalidChars = words.filter((w) => w.length === 0 || !/^[a-z]+$/.test(w));
    if (invalidChars.length > 0) {
      return { isValid: false, error: t('profile.encryption.restoreModal.validationInvalidChars') };
    }

    const bip39Words = wordlists.english;
    const invalidBip39 = words.filter((w) => !bip39Words.includes(w));
    if (invalidBip39.length > 0) {
      const first = invalidBip39[0];
      const suggestions = findSimilarWords(first, bip39Words);
      return {
        isValid: false,
        error:
          suggestions.length > 0
            ? t('profile.encryption.restoreModal.validationUnknownWord', {
                word: first,
                suggestions: suggestions.join(', '),
              })
            : t('profile.encryption.restoreModal.validationUnknownWordNoSuggestion', { word: first }),
      };
    }

    try {
      if (!validateMnemonic(normalized)) {
        return { isValid: false, error: t('profile.encryption.restoreModal.validationChecksum') };
      }
    } catch {
      return { isValid: false, error: t('profile.encryption.restoreModal.validationFormat') };
    }

    return { isValid: true, error: null };
  };

  const handlePhraseChange = (text: string) => {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    setBackupPhrase(normalized);
    setValidationError(validatePhrase(normalized).error);
    setResult(null);
    setErrorMessage(null);
  };

  const handleRestore = async () => {
    if (!userId) {
      setResult('error');
      setErrorMessage(t('profile.encryption.restoreModal.errorNotAuthenticated'));
      return;
    }

    const normalized = backupPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const validation = validatePhrase(normalized);

    if (!validation.isValid) {
      setResult('error');
      setErrorMessage(validation.error ?? t('profile.encryption.restoreModal.errorInvalidPhrase'));
      return;
    }

    setIsRestoring(true);
    setResult(null);
    setErrorMessage(null);
    try {
      const cryptoBackup = CryptoServiceBackup.getInstance();
      await cryptoBackup.restoreE2EEFromBackup(normalized, userId, isOld);
      setResult('success');
      setBackupPhrase('');
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      let body = t('profile.encryption.restoreModal.errorGeneral');
      if (msg.includes('Invalid BIP39')) {
        body = t('profile.encryption.restoreModal.errorInvalidPhrase');
      } else if (msg.includes('does not match')) {
        body = t('profile.encryption.restoreModal.errorNoMatch');
      } else if (msg.includes('network') || msg.includes('timeout')) {
        body = t('profile.encryption.restoreModal.errorNetwork');
      }
      setResult('error');
      setErrorMessage(body);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    if (!isRestoring) {
      setBackupPhrase('');
      setValidationError(null);
      setResult(null);
      setErrorMessage(null);
      onClose();
      onSkip();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        </TouchableWithoutFeedback>

        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: isOld ? theme.colors.error : theme.colors.border,
          maxWidth: 500,
          width: '90%',
          maxHeight: '90%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        }}>
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
            nestedScrollEnabled
          >
            {/* Header */}
            <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: isOld ? theme.colors.error : theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <LockKeyholeOpen size={32} color={theme.colors.onPrimary} />
              </View>
              <Text style={{ fontSize: theme.typography.xl, fontWeight: theme.typography.bold, color: isOld ? theme.colors.error : theme.colors.primary, textAlign: 'center' }}>
                {isOld ? t('profile.encryption.restoreModal.titleOld') : t('profile.encryption.restoreModal.titleNormal')}
              </Text>
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 24 }}>
                {isOld ? t('profile.encryption.restoreModal.subtitleOld') : t('profile.encryption.restoreModal.subtitleNormal')}
              </Text>
            </View>

            {/* Input */}
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ fontSize: theme.typography.md, fontWeight: theme.typography.medium, color: theme.colors.textPrimary }}>
                {isOld ? t('profile.encryption.restoreModal.inputLabelOld') : t('profile.encryption.restoreModal.inputLabelNormal')}
              </Text>
              <TextInput
                style={{
                  borderWidth: validationError ? 2 : 1,
                  borderColor: validationError ? theme.colors.borderError : theme.colors.border,
                  borderRadius: theme.radii.sm,
                  padding: theme.spacing.md,
                  fontSize: theme.typography.md,
                  backgroundColor: theme.colors.backgroundInput,
                  color: theme.colors.textPrimary,
                  minHeight: 80,
                  maxHeight: 120,
                  textAlignVertical: 'top',
                }}
                value={backupPhrase}
                onChangeText={handlePhraseChange}
                placeholder={t('profile.encryption.restoreModal.inputPlaceholder')}
                placeholderTextColor={theme.colors.textPlaceholder}
                multiline
                numberOfLines={3}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                editable={!isRestoring}
                scrollEnabled={false}
              />
              {validationError && (
                <Text style={{ fontSize: theme.typography.sm, color: theme.colors.error, fontWeight: theme.typography.medium }}>
                  {validationError}
                </Text>
              )}
              <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted, fontStyle: 'italic' }}>
                {t('profile.encryption.restoreModal.inputHelp')}
              </Text>
            </View>

            {/* Suksess / feil-feedback */}
            {result === 'success' && (
              <View style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.success,
                alignItems: 'center',
              }}>
                <CheckCircle size={18} color={theme.colors.success} />
                <Text style={{ flex: 1, fontSize: theme.typography.sm, color: theme.colors.success, fontWeight: theme.typography.medium }}>
                  {t('profile.encryption.restoreModal.successTitle')} — {isOld ? t('profile.encryption.restoreModal.successBodyOld') : t('profile.encryption.restoreModal.successBodyNormal')}
                </Text>
              </View>
            )}
            {result === 'error' && errorMessage && (
              <View style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                backgroundColor: theme.colors.backgroundAlt,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.error,
                alignItems: 'center',
              }}>
                <XCircle size={18} color={theme.colors.error} />
                <Text style={{ flex: 1, fontSize: theme.typography.sm, color: theme.colors.error, fontWeight: theme.typography.medium }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Knapper */}
            <View style={{ gap: theme.spacing.md }}>
              <ButtonNative
                text={isOld ? t('profile.encryption.restoreModal.restoreButtonOld') : t('profile.encryption.restoreModal.restoreButtonNormal')}
                loadingText={t('profile.encryption.restoreModal.restoring')}
                onPress={handleRestore}
                loading={isRestoring}
                disabled={isRestoring || result === 'success' || !backupPhrase.trim() || !!validationError}
                variant={isOld ? 'danger' : 'primary'}
                size="large"
                fullWidth
              />
              <ButtonNative
                text={t('profile.encryption.restoreModal.cancelButton')}
                onPress={handleClose}
                disabled={isRestoring}
                variant="secondary"
                size="large"
                fullWidth
              />
            </View>

            {/* Footer */}
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md }}>
              <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
                {isOld ? t('profile.encryption.restoreModal.footerOld') : t('profile.encryption.restoreModal.footerNormal')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
