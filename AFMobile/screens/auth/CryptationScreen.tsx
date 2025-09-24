import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Clipboard,
} from "react-native";
import { ArrowLeft, Shield } from "lucide-react-native";
import AppHeader from "@/components/common/AppHeader";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import PasswordFieldNative from "@/components/common/PasswordFieldNative";
import { useFullCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { CryptoServiceBackup } from "@/components/ende-til-ende/CryptoServiceBackup";
import { CryptoService } from "@/components/ende-til-ende/CryptoService";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { verifyPassword } from "@/services/user/userService";
import E2EERestoreModal from "@/features/crypto/components/E2EERestoreModal";

export default function CryptationScreen() {
  const { user, loading, error } = useFullCurrentUser();
  const { logout } = useAuth();
  const navigation = useNavigation();
  
  // Password verification state
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Existing states
  const [backupStatusLoading, setBackupStatusLoading] = useState(false);
  const [showPhraseLoading, setShowPhraseLoading] = useState(false);
  const [createKeysLoading, setCreateKeysLoading] = useState(false);
  
  const [hasBackupPhrase, setHasBackupPhrase] = useState<boolean | null>(null);
  const [currentBackupPhrase, setCurrentBackupPhrase] = useState<string | null>(null);
  const [showBackupPhrase, setShowBackupPhrase] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'normal' | 'old'>('normal');

  const cryptoBackupService = CryptoServiceBackup.getInstance();
  const cryptoService = CryptoService.getInstance();

  // Verify password function
  const handleVerifyPassword = async () => {
    if (!password || password.length < 4) {
      setPasswordError("Password must be at least 4 characters long");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Invalid Password",
        customBody: "Password must be at least 4 characters long",
        position: 'top'
      });
      return;
    }

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const isValid = await verifyPassword(password);
      
      if (isValid) {
        setIsPasswordVerified(true);
        setPassword(""); // Clear password from memory
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Access Granted",
          customBody: "Password verified successfully",
          position: 'top'
        });
      } else {
        setPasswordError("Incorrect password");
        showNotificationToastNative({
          type: LocalToastType.CustomSystemError,
          customTitle: "Access Denied",
          customBody: "Incorrect password. Please try again.",
          position: 'top'
        });
      }
    } catch (error) {
      setPasswordError("Failed to verify password");
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: "Failed to verify password. Please try again.",
        position: 'top'
      });
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  useEffect(() => {
    if (user?.userId && isPasswordVerified) {
      checkBackupPhraseStatus();
    }
  }, [user?.userId, isPasswordVerified]);

  const checkBackupPhraseStatus = async () => {
    if (!user?.userId) return;
    
    try {
      setBackupStatusLoading(true);
      const initResult = await cryptoBackupService.initializeForUser(user.userId);
      setHasBackupPhrase(!initResult.needsSetup && !initResult.needsRestore);
    } catch (error) {
      console.error('Error checking backup phrase status:', error);
      setHasBackupPhrase(false);
    } finally {
      setBackupStatusLoading(false);
    }
  };

  const handleShowBackupPhrase = async () => {
    if (!user?.userId) return;

    Alert.alert(
      "Show Backup Phrase",
      "This will display your 24-word backup phrase. Make sure you're in a secure location before proceeding.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Show Phrase",
          onPress: async () => {
            try {
              setShowPhraseLoading(true);
              
              const privateKey = await cryptoService.getPrivateKeySafe(user.userId);
              
              if (!privateKey) {
                showNotificationToastNative({
                  type: LocalToastType.CustomSystemError,
                  customTitle: "Error",
                  customBody: "No encryption keys found. Please set up encryption first.",
                  position: 'top'
                });
                return;
              }

              const backupPhrase = await cryptoBackupService.generateBackupPhrase(privateKey);
              setCurrentBackupPhrase(backupPhrase);
              setShowBackupPhrase(true);
              
            } catch (error) {
              showNotificationToastNative({
                type: LocalToastType.CustomSystemError,
                customTitle: "Error",
                customBody: "Failed to generate backup phrase",
                position: 'top'
              });
            } finally {
              setShowPhraseLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateNewKeysFromLostPhrase = async () => {
    if (!user?.userId) return;

    Alert.alert(
      "Create New Keys - Lost Backup Phrase",
      "⚠️ WARNING: This will create completely new encryption keys. You will lose access to ALL previously encrypted messages and data. This action cannot be undone.\n\nOnly proceed if you have permanently lost your backup phrase and understand the consequences.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "I understand, create new keys",
          style: "destructive",
          onPress: async () => {
            Alert.alert(
              "Final Confirmation",
              "Are you absolutely certain you want to create new keys? This will permanently delete access to all your encrypted data.",
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Yes, create new keys",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setCreateKeysLoading(true);
                      
                      await cryptoService.clearPrivateKey(user.userId);
                      cryptoService.clearUserCache(user.userId);
                      
                      const result = await cryptoBackupService.setupE2EEWithBackup(user.userId);
                      
                      showNotificationToastNative({
                        type: LocalToastType.CustomSystemNotice,
                        customTitle: "New Keys Created",
                        customBody: "New encryption keys created! Save your backup phrase safely. You will be logged out to complete the process.",
                        position: 'top'
                      });

                      setCurrentBackupPhrase(result.backupPhrase);
                      setShowBackupPhrase(true);
                      setHasBackupPhrase(true);
                      
                      setTimeout(() => {
                        logout();
                      }, 3000);
                      
                    } catch (error) {
                      showNotificationToastNative({
                        type: LocalToastType.CustomSystemError,
                        customTitle: "Error",
                        customBody: `Failed to create new keys: ${error}`,
                        position: 'top'
                      });
                    } finally {
                      setCreateKeysLoading(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleVerifyRestore = async () => {
    try {
      if (restoreMode === 'normal') {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Restoration Successful", 
          customBody: "Your encryption keys have been restored from backup phrase! You will be logged out to complete the process.",
          position: 'top'
        });
      } else {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Old Keys Restored",
          customBody: "Your old encryption keys have been restored! You will be logged out to complete the process.",
          position: 'top'
        });
      }
      
      setShowRestoreModal(false);
      await checkBackupPhraseStatus();
      
      setTimeout(() => {
        logout();
      }, 2000);
      
    } catch (error) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: "Error",
        customBody: "Failed to restore keys",
        position: 'top'
      });
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  // Render error state if user loading failed
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title="Encryption Settings"
          subtitle="Manage your backup phrase and encryption"
          onBackPress={handleGoBack}
          backIcon={ArrowLeft}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show skeleton or message while user is loading
  if (loading || !user?.userId) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title="Encryption Settings"
          subtitle="Manage your backup phrase and encryption"
          onBackPress={handleGoBack}
          backIcon={ArrowLeft}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C6B1C" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show password verification screen if not verified
  if (!isPasswordVerified) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title="Encryption Settings"
          subtitle="Manage your backup phrase and encryption"
          onBackPress={handleGoBack}
          backIcon={ArrowLeft}
        />
        
        <View style={styles.passwordVerificationContainer}>
          <View style={styles.passwordVerificationContent}>
            <View style={styles.securityIconContainer}>
              <Shield size={48} color="#1C6B1C" />
            </View>
            
            <Text style={styles.passwordTitle}>Security Verification Required</Text>
            <Text style={styles.passwordSubtitle}>
              Please enter your password to access encryption settings. This ensures only you can view or modify your encryption keys.
            </Text>
            
            <View style={styles.passwordInputContainer}>
              <PasswordFieldNative
                id="currentPassword"
                label="Current Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(null);
                }}
                placeholder="Enter your password"
                error={passwordError || undefined}
                touched={!!passwordError}
              />
              
              <ButtonNative
                text={isVerifyingPassword ? "Verifying..." : "Verify Password"}
                onPress={handleVerifyPassword}
                variant="primary"
                size="large"
                fullWidth
                loading={isVerifyingPassword}
                disabled={isVerifyingPassword || !password}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Main encryption settings screen (only shown after password verification)
  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Encryption Settings"
        subtitle="Manage your backup phrase and encryption"
        onBackPress={handleGoBack}
        backIcon={ArrowLeft}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.fieldsContainer}>

            {/* Security Information */}
            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>About 24-Word Backup Phrases</Text>
              <Text style={styles.infoText}>
                Your backup phrase is a 24-word sequence that can restore your encryption keys on any device. 
                Store it safely offline and never share it with anyone.
              </Text>
              <Text style={styles.infoText}>
                • Losing this phrase can lose you access to your messages or attachments, especially between devices
              </Text>
              <Text style={styles.infoText}>
                • Write it down on paper and store in a secure location
              </Text>
              <Text style={styles.infoText}>
                • Try not to store it digitally or take screenshots
              </Text>
              <Text style={styles.infoText}>
                • Anyone with this phrase will be closer to decrypting your data
              </Text>
              <Text style={styles.infoText}>
                If you have lost your phrase or your old device, contact support@koptr.net
              </Text>
            </View>
            
            {/* Backup Phrase Status with individual loading */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Backup Phrase Status</Text>
              {backupStatusLoading ? (
                <View style={styles.statusIndicator}>
                  <ActivityIndicator size="small" color="#1C6B1C" />
                  <Text style={styles.statusText}>Checking status...</Text>
                </View>
              ) : hasBackupPhrase !== null ? (
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: hasBackupPhrase ? '#22c55e' : '#ef4444' }]} />
                  <Text style={styles.statusText}>
                    {hasBackupPhrase ? 'Backup phrase is set up' : 'No backup phrase found'}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Show Current Backup Phrase - Only if user has backup phrase */}
            {hasBackupPhrase && (
              <View style={styles.actionContainer}>
                <Text style={styles.actionTitle}>View Backup Phrase</Text>
                <Text style={styles.actionDescription}>
                  Display your current 24-word backup phrase. Make sure you're in a secure location.
                </Text>
                <ButtonNative
                  text={showBackupPhrase ? "Hide Backup Phrase" : "Show Backup Phrase"}
                  onPress={() => showBackupPhrase ? setShowBackupPhrase(false) : handleShowBackupPhrase()}
                  variant="secondary"
                  size="large"
                  fullWidth
                  loading={showPhraseLoading}
                />
              </View>
            )}

            {/* Display Backup Phrase */}
            {showBackupPhrase && currentBackupPhrase && (
              <View style={styles.backupPhraseContainer}>
                <Text style={styles.backupPhraseTitle}>Your 24-Word Backup Phrase</Text>
                <View style={styles.backupPhraseBox}>
                  <Text style={styles.backupPhraseText}>{currentBackupPhrase}</Text>
                </View>
                <Text style={styles.backupPhraseWarning}>
                  ⚠️ Keep this phrase secure and private. Store it safely offline and never share it.
                </Text>
                <ButtonNative
                  text="Copy to Clipboard"
                  onPress={async () => {
                    if (currentBackupPhrase) {
                      await Clipboard.setString(currentBackupPhrase);
                      showNotificationToastNative({
                        type: LocalToastType.CustomSystemNotice,
                        customTitle: "Copied",
                        customBody: "Backup phrase copied to clipboard",
                        position: 'top'
                      });
                    }
                  }}
                  variant="secondary"
                  size="medium"
                  fullWidth
                />
              </View>
            )}

            {/* Restore from Other Device */}
            {hasBackupPhrase === false && (
              <View style={styles.actionContainer}>
                <Text style={styles.actionTitle}>Set Up Encryption From Other Device</Text>
                <Text style={styles.actionDescription}>
                  If you have encryption set up on another device, enter your 24-word backup phrase to restore access on this device.
                </Text>
                <ButtonNative
                  text="Restore From Backup Phrase"
                  onPress={() => {
                    setRestoreMode('normal');
                    setShowRestoreModal(true);
                  }}
                  variant="primary"
                  size="large"
                  fullWidth
                />
              </View>
            )}

            {/* Restore Old Backup Phrase */}
            {hasBackupPhrase === true && (
              <View style={styles.actionContainer}>
                <Text style={styles.actionTitle}>Restore From Previous Backup Phrase</Text>
                <Text style={styles.actionDescription}>
                  If you found your old backup phrase and want to restore access to previously encrypted messages, enter it here. This will replace your current encryption keys.
                </Text>
                <ButtonNative
                  text="Restore From Old Backup Phrase"
                  onPress={() => {
                    setRestoreMode('old');
                    Alert.alert(
                      "Restore From Previous Backup Phrase",
                      "This will replace your current encryption keys with the ones from your old backup phrase. You'll lose access to messages encrypted with your current keys, but regain access to messages encrypted with the old keys. Are you sure?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Continue",
                          style: "destructive",
                          onPress: () => setShowRestoreModal(true)
                        }
                      ]
                    );
                  }}
                  variant="secondary"
                  size="large"
                  fullWidth
                />
              </View>
            )}

            {/* Create New Keys (Lost Phrase) */}
            <View style={styles.dangerContainer}>
              <Text style={styles.dangerTitle}>
                Lost Backup Phrase - Create New Keys
              </Text>
              <Text style={styles.dangerDescription}>
                ⚠️ Only use this if you have permanently lost your backup phrase. This will create completely new encryption keys and you will lose access to all previously encrypted messages.
              </Text>
              <ButtonNative
                text="Create New Keys (Lost Phrase)"
                onPress={handleCreateNewKeysFromLostPhrase}
                variant="danger"
                size="large"
                fullWidth
                loading={createKeysLoading}
              />
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Restore Modal */}
      <E2EERestoreModal
        visible={showRestoreModal}
        restoreMode={restoreMode}
        onRestore={handleVerifyRestore}
        onSkip={() => setShowRestoreModal(false)}
        onClose={() => setShowRestoreModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  
  content: {
    flex: 1,
    alignItems: 'center',
  },
  
  fieldsContainer: {
    width: '100%',
    maxWidth: 600,
    gap: 24,
  },
  
  // Password verification styles
  passwordVerificationContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  
  passwordVerificationContent: {
    alignItems: 'center',
    gap: 24,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  
  securityIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  
  passwordTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  
  passwordSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  
  passwordInputContainer: {
    width: '100%',
    gap: 16,
  },
  
  // Existing styles
  statusContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1C6B1C',
  },
  
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  
  statusText: {
    fontSize: 16,
    color: '#374151',
  },
  
  actionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    gap: 12,
  },
  
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  actionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  
  dangerContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 12,
  },
  
  dangerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
  },
  
  dangerDescription: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
    fontWeight: '500',
  },
  
  backupPhraseContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 16,
  },
  
  backupPhraseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  
  backupPhraseBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  
  backupPhraseText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'monospace',
  },
  
  backupPhraseWarning: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  
  infoContainer: {
    backgroundColor: '#1C6B1C',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1C6B1C',
    gap: 8,
  },
  
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 8,
  },
  
  infoText: {
    fontSize: 14,
    color: '#ffffffff',
    lineHeight: 20,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  
  loadingText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    lineHeight: 24,
  },
});