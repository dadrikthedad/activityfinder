import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, SafeAreaView } from 'react-native';
import E2EERestoreModal from '@/features/crypto/components/E2EERestoreModal';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { CryptoServiceBackup } from '@/components/ende-til-ende/CryptoServiceBackup';
import { useAuth } from '@/context/AuthContext';

interface CryptoTestScreenProps {
  navigation: any; // Replace with proper navigation type
}

export const CryptoTestScreen: React.FC<CryptoTestScreenProps> = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingGenerate, setIsTestingGenerate] = useState(false);
  const [isTestingRestore, setIsTestingRestore] = useState(false);
  const { userId } = useAuth();

  const testPhrase = "multiply rose cook milk panther female fit daughter fame dolphin hub simple echo park rose cup service noble vibrant universe unknown only grab cute";

  const handleShowModal = () => {
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleRestore = () => {
    console.log("User clicked Restore");
    // Handle restore logic here
  };

  const handleSkip = () => {
    console.log("User clicked Skip");
    // Handle skip logic here
  };

  const handleDeleteKeys = () => {
    Alert.alert(
      "Delete Encryption Keys",
      "This will delete your local encryption keys. You'll need to restore from backup phrase to access encrypted messages again. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDeleteKeys
        }
      ]
    );
  };

  const performDeleteKeys = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsDeleting(true);
    
    try {
      console.log(`🗑️ Clearing local keys for user ${userId}`);
      
      const cryptoService = CryptoService.getInstance();
      
      // Clear from memory and storage
      await cryptoService.clearPrivateKey(userId);
      
      // Also clear user cache to ensure complete reset
      cryptoService.clearUserCache(userId);
      
      console.log(`✅ Local keys cleared for user ${userId}`);
      
      Alert.alert(
        "Keys Cleared", 
        "Local encryption keys have been cleared from both memory and storage. You can now test restoring from backup phrase.",
        [{ text: "OK" }]
      );
      
    } catch (error) {
      console.error('Failed to clear keys:', error);
      Alert.alert(
        "Clear Failed", 
        `Failed to clear keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const testGenerateBackupPhrase = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsTestingGenerate(true);

    try {
      console.log('🧪 Testing generateBackupPhrase method...');
      
      const cryptoService = CryptoService.getInstance();
      const backupService = CryptoServiceBackup.getInstance();
      
      // First ensure we have a key pair
      const privateKey = await cryptoService.getPrivateKeySafe(userId);
      
      if (!privateKey) {
        Alert.alert("No Private Key", "Generate keys first by setting up E2EE");
        return;
      }

      // Test generate backup phrase
      const generatedPhrase = await backupService.generateBackupPhrase(privateKey);
      
      console.log('🧪 Generated phrase:', generatedPhrase);
      
      Alert.alert(
        "Generated Backup Phrase", 
        `Phrase: ${generatedPhrase}\n\nCheck console for debug info.`,
        [{ text: "OK" }]
      );
      
    } catch (error) {
      console.error('Failed to test generate backup phrase:', error);
      Alert.alert(
        "Generate Test Failed", 
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsTestingGenerate(false);
    }
  };

  const testRestoreFromPhrase = async () => {
    setIsTestingRestore(true);

    try {
      console.log('🧪 Testing restorePrivateKeyFromPhrase method...');
      
      const backupService = CryptoServiceBackup.getInstance();
      
      // Test restore from known phrase
      const restoredPrivateKey = await backupService.restorePrivateKeyFromPhrase(testPhrase);
      
      console.log('🧪 Restored private key:', restoredPrivateKey);
      
      // Generate public key from restored private key
      const restoredPublicKey = await backupService.getPublicKeyFromSeed(restoredPrivateKey);
      
      console.log('🧪 Restored public key:', restoredPublicKey);
      
      Alert.alert(
        "Restore Test Complete", 
        `Restored public key: ${restoredPublicKey}\n\nCheck console for debug info.`,
        [{ text: "OK" }]
      );
      
    } catch (error) {
      console.error('Failed to test restore from phrase:', error);
      Alert.alert(
        "Restore Test Failed", 
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsTestingRestore(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🔐 Crypto & E2EE Tests</Text>
          <Text style={styles.subtitle}>
            Test encryption keys, backup phrases, and restore functionality
          </Text>
        </View>

        {/* Main Tests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Main Tests</Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleShowModal}
          >
            <Text style={styles.buttonText}>Test E2EE Restore Modal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDeleteKeys}
            disabled={isDeleting}
          >
            <Text style={styles.buttonText}>
              {isDeleting ? 'Deleting...' : 'Delete Local Keys'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debug Methods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Methods</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={testGenerateBackupPhrase}
            disabled={isTestingGenerate}
          >
            <Text style={styles.buttonText}>
              {isTestingGenerate ? 'Testing...' : 'Test Generate Backup Phrase'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={testRestoreFromPhrase}
            disabled={isTestingRestore}
          >
            <Text style={styles.buttonText}>
              {isTestingRestore ? 'Testing...' : 'Test Restore From Phrase'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        {userId && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Test Information</Text>
            <Text style={styles.infoText}>Current User ID: {userId}</Text>
            <Text style={styles.infoSubtext}>
              Use "Delete Local Keys" to simulate a new device, then test restore
            </Text>
            <View style={styles.testPhraseContainer}>
              <Text style={styles.testPhraseLabel}>Test Phrase:</Text>
              <Text style={styles.testPhrase}>{testPhrase}</Text>
            </View>
          </View>
        )}

        <E2EERestoreModal
          visible={modalVisible}
          onRestore={handleRestore}
          onSkip={handleSkip}
          onClose={handleCloseModal}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  debugButton: {
    backgroundColor: '#7c3aed',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  testPhraseContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  testPhraseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  testPhrase: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});