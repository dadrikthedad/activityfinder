// components/crypto/E2EERestoreModal.tsx - Fixed scrolling version with BIP39 validation
// Flow: Ny enhet login → Ingen lokal key → Server har key → Modal vises [VI ER HER] → User restores → Keys synced → E2EE ready

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Dimensions,
} from 'react-native';
import { LockKeyholeOpen } from 'lucide-react-native';
import { validateMnemonic, wordlists } from 'bip39';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import { showNotificationToastNative, LocalToastType } from '@/components/toast/NotificationToastNative';
import { CryptoServiceBackup } from '@/components/ende-til-ende/CryptoServiceBackup';
import { useAuth } from '@/context/AuthContext';

interface E2EERestoreModalProps {
  visible: boolean;
  onRestore: () => void;
  onSkip: () => void;
  onClose: () => void;
  restoreMode?: 'normal' | 'old';
}

const { height: screenHeight } = Dimensions.get('window');

export default function E2EERestoreModal({ 
  visible,
  onRestore, 
  onSkip,
  onClose,
  restoreMode = 'normal'
}: E2EERestoreModalProps) {
  const [backupPhrase, setBackupPhrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { userId } = useAuth();

  const findSimilarWords = (invalidWord: string, wordList: string[]): string[] => {
    // Simple similarity check - find words that are close matches
    const similar = wordList.filter(word => {
      // Check if words are similar length and have similar characters
      if (Math.abs(word.length - invalidWord.length) > 2) return false;
      
      // Calculate simple character overlap
      let matches = 0;
      const minLength = Math.min(word.length, invalidWord.length);
      for (let i = 0; i < minLength; i++) {
        if (word[i] === invalidWord[i]) matches++;
      }
      
      return matches >= minLength * 0.6; // 60% character match
    });
    
    return similar.slice(0, 3); // Return top 3 suggestions
  };

  const validatePhrase = (phrase: string): { isValid: boolean; error: string | null } => {
    if (!phrase.trim()) {
      return { isValid: false, error: null }; // Don't show error for empty input
    }

    const normalizedPhrase = phrase.trim().toLowerCase().replace(/\s+/g, ' '); // Normalize whitespace
    const words = normalizedPhrase.split(' ');
    
    if (words.length === 1 && words[0] === '') {
      return { isValid: false, error: null };
    }
    
    if (words.length < 24) {
      return { 
        isValid: false, 
        error: `Need ${24 - words.length} more word${24 - words.length === 1 ? '' : 's'} (${words.length}/24)` 
      };
    }
    
    if (words.length > 24) {
      return { 
        isValid: false, 
        error: `Too many words. Remove ${words.length - 24} word${words.length - 24 === 1 ? '' : 's'} (${words.length}/24)` 
      };
    }
    
    // Check for empty words or invalid characters
    const invalidWords = words.filter(word => word.length === 0 || !/^[a-z]+$/.test(word));
    if (invalidWords.length > 0) {
      return { 
        isValid: false, 
        error: "Words should only contain lowercase letters and be separated by single spaces" 
      };
    }

    // Check if all words are in BIP39 wordlist
    const bip39Words = wordlists.english;
    const invalidBip39Words = words.filter(word => !bip39Words.includes(word));
    
    if (invalidBip39Words.length > 0) {
      const firstInvalidWord = invalidBip39Words[0];
      const suggestions = findSimilarWords(firstInvalidWord, bip39Words);
      
      if (suggestions.length > 0) {
        return { 
          isValid: false, 
          error: `"${firstInvalidWord}" is not a valid word. Did you mean: ${suggestions.join(', ')}?` 
        };
      } else {
        return { 
          isValid: false, 
          error: `"${firstInvalidWord}" is not a valid BIP39 word. Please check your backup phrase.` 
        };
      }
    }

    // Final BIP39 validation (checksum)
    try {
      if (!validateMnemonic(normalizedPhrase)) {
        return { 
          isValid: false, 
          error: "Invalid backup phrase checksum. Please check that all words are correct and in the right order." 
        };
      }
    } catch (bip39Error) {
      console.warn('BIP39 validation error:', bip39Error);
      return { 
        isValid: false, 
        error: "Invalid backup phrase format. Please check your words." 
      };
    }
    
    return { isValid: true, error: null };
  };

  const handlePhraseChange = (text: string) => {
    // Normalize input: lowercase, single spaces
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
    setBackupPhrase(normalizedText);
    const validation = validatePhrase(normalizedText);
    setValidationError(validation.error);
  };

  const handleRestore = async () => {
    if (!userId) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: "User not authenticated",
        position: 'top'
      });
      return;
    }

    const normalizedPhrase = backupPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    
    const validation = validatePhrase(normalizedPhrase);
    if (!validation.isValid) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Invalid Backup Phrase",
        customBody: validation.error || "Please enter exactly 24 valid BIP39 words separated by spaces",
        position: 'top'
      });
      return;
    }

    setIsRestoring(true);
    
    try {
      const cryptoBackup = CryptoServiceBackup.getInstance();
      
      // Use skipServerValidation based on restore mode
      const skipServerValidation = restoreMode === 'old';
      await cryptoBackup.restoreE2EEFromBackup(normalizedPhrase, userId, skipServerValidation);
      
      const successMessage = restoreMode === 'old' 
        ? "Old encryption keys restored! You can now access messages encrypted with your previous keys."
        : "Encryption restored! You can now access your encrypted messages from all devices";
      
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Encryption Restored!",
        customBody: successMessage,
        position: 'top'
      });
      
      // Reset state and close modal
      setBackupPhrase('');
      onClose();
      onRestore();
      
    } catch (error) {
      console.error('E2EE restore failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      let userFriendlyMessage = "Failed to restore encryption keys";
      
      if (restoreMode === 'old') {
        if (errorMessage.includes('Invalid BIP39')) {
          userFriendlyMessage = "Invalid backup phrase. Please check that all 24 words are correct BIP39 words and try again";
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          userFriendlyMessage = "Network error. Please check your connection and try again";
        } else {
          userFriendlyMessage = "Failed to restore old encryption keys. Please try again.";
        }
      } else {
        if (errorMessage.includes('Invalid BIP39')) {
          userFriendlyMessage = "Invalid backup phrase. Please check that all 24 words are correct BIP39 words and try again";
        } else if (errorMessage.includes('does not match')) {
          userFriendlyMessage = "This backup phrase doesn't match your account";
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          userFriendlyMessage = "Network error. Please check your connection and try again";
        }
      }
      
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Restore Failed",
        customBody: userFriendlyMessage,
        position: 'top'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Encryption Restore?",
      "You can restore your encrypted messages later in Settings. Without restoring, you won't be able to read encrypted messages from your other devices.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Skip for Now",
          style: "default",
          onPress: () => {
            setBackupPhrase('');
            onClose();
            onSkip();
          }
        }
      ]
    );
  };

  const handleBackdropPress = () => {
    // Only allow closing if not currently restoring
    if (!isRestoring) {
      setBackupPhrase('');
      onClose();
    }
  };

  const handleModalPress = (e: any) => {
    // Prevent event bubbling to backdrop
    e.stopPropagation();
  };

  const formatPlaceholder = () => {
    return "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24";
  };

  const getHeaderContent = () => {
    if (restoreMode === 'old') {
      return {
        title: "Restore Old Encryption Keys",
        subtitle: "Enter your old 24-word backup phrase to restore access to previously encrypted messages. This will replace your current encryption keys."
      };
    }
    return {
      title: "Restore Encrypted Messages",
      subtitle: "Enter your 24-word backup phrase to access encrypted messages from your other devices"
    };
  };

  const headerContent = getHeaderContent();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <LockKeyholeOpen size={32} color="rgba(255, 255, 255, 1)" />
              </View>
              <Text style={styles.title}>{headerContent.title}</Text>
              <Text style={styles.subtitle}>
                {headerContent.subtitle}
              </Text>
            </View>

            {/* Updated Info Box based on mode */}
            <View style={[
                styles.infoContainer,
                restoreMode === 'old' && styles.warningInfoContainer
                ]}>
              <Text style={styles.infoTitle}>
                {restoreMode === 'old' ? "⚠️ Important Warning" : "Why is this needed?"}
              </Text>
              <Text style={styles.infoText}>
                {restoreMode === 'old' 
                  ? "This will replace your current encryption keys with your old ones. You'll lose access to messages encrypted with your current keys, but regain access to messages encrypted with the old keys."
                  : "Your encrypted messages are secured with keys that are unique to each device. To read messages from your other devices, we need to restore your encryption keys using your backup phrase."
                }
              </Text>
            </View>

            {/* Input Section */}
           <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                {restoreMode === 'old' ? "Old Backup Phrase (24 words)" : "Backup Phrase (24 words)"}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  validationError && styles.textInputError
                ]}
                value={backupPhrase}
                onChangeText={handlePhraseChange}
                placeholder={formatPlaceholder()}
                placeholderTextColor="#9ca3af"
                multiline={true}
                numberOfLines={3}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                editable={!isRestoring}
                textAlignVertical="top"
                scrollEnabled={false}
              />
              {validationError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>⚠️ {validationError}</Text>
                </View>
              )}
              <Text style={styles.helpText}>
                Enter each word separated by a single space. Words will be automatically converted to lowercase.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <ButtonNative
                text={restoreMode === 'old' ? "Replace Current Keys" : "Restore Access"}
                loadingText="Restoring..."
                onPress={handleRestore}
                loading={isRestoring}
                disabled={isRestoring || backupPhrase.trim().length === 0 || !!validationError}
                variant={restoreMode === 'old' ? "danger" : "primary"}
                size="large"
                fullWidth
                style={styles.restoreButton}
              />

              <ButtonNative
                text="Cancel"
                onPress={handleSkip}
                disabled={isRestoring}
                variant="secondary"
                size="large"
                fullWidth
                style={styles.skipButton}
              />
            </View>

            {/* Footer Note */}
            <View style={styles.footerNote}>
              <Text style={styles.footerText}>
                {restoreMode === 'old' 
                  ? "This action cannot be undone. Make sure you have your current backup phrase saved before proceeding."
                  : "You can restore your encryption keys later in Settings if you skip now."
                }
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1C6B1C',
    maxWidth: 500,
    width: '90%',
    maxHeight: screenHeight * 0.90, // 85% of screen height
    minHeight: screenHeight * 0.80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 20,
    marginVertical: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 30,
    minHeight: 400, // Ensure minimum content height for scrolling
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C6B1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C6B1C',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoContainer: {
    backgroundColor: '#1C6B1C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#1C6B1C',
  },
    warningInfoContainer: {
    backgroundColor: '#dc2626', // Red background for warning
    borderLeftColor: '#dc2626',
    },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 1)',
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
    minHeight: 80,
    maxHeight: 120, // Limit height to prevent excessive growth
    textAlignVertical: 'top',
  },
  textInputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  restoreButton: {
    backgroundColor: '#1C6B1C',
  },
  skipButton: {
    // Uses default ghost button styling
  },
  footerNote: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});