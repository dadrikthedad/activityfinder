import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { BackgroundAttachmentDecryptionService } from '@/features/cryptoAttachments/BackgroundDecrypt/BackgrundAttachmentDecryptionService';
import BackgroundKotlinDecrypt from '@/features/cryptoAttachments/BackgroundDecrypt/Android/BackgroundKotlinDecrypt';
import ExpoVideoDecryptionModule from '@/modules/expo-video-decryption/src/ExpoVideoDecryptionModule';

export const TestScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // Test 1: Basic Kotlin module connectivity
  const testKotlinModule = async () => {
    setIsLoading(true);
    addResult("Testing Kotlin module...");
    
    try {
      const stats = await ExpoVideoDecryptionModule.getDecryptionStats();
      addResult(`✅ Kotlin module connected! Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult(`❌ Kotlin module failed: ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  // Test 2: Background Kotlin service
  const testBackgroundKotlin = async () => {
    setIsLoading(true);
    addResult("Testing BackgroundKotlinDecrypt...");
    
    try {
      const bgKotlin = BackgroundKotlinDecrypt;
      const stats = await bgKotlin.getDecryptionStats();
      addResult(`✅ BackgroundKotlin loaded! Active: ${stats.activeDecryptions}`);
      
      // Test with fake data to see if the flow works
      const fakeResult = await bgKotlin.decryptAttachment(
  "SGVsbG8gV29ybGQhSGVsbG8gV29ybGQhSGVsbG8gV29ybGQhSGVsbG8gVw==", // 48 bytes (32 + 16 MAC)
  "VGhpcyBpcyBhIDY0LWJ5dGUga2V5IHBhY2thZ2UgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seSE=", // 64 bytes (32+32)
  "VGhpcyBpcyBhIDI0LWJ5dGUgbm9uY2U=", // 24 bytes 
  "VGhpcyBpcyBhIDY0LWJ5dGUgc2VjcmV0IGtleSBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5ISEh", // 64 bytes
  "VGhpcyBpcyBhIDMyLWJ5dGUgcHVibGljIGtleQ==", // 32 bytes
  (progress, message) => {
    addResult(`Progress: ${progress}% - ${message}`);
  }
);
      
      addResult(`✅ BackgroundKotlin completed! TaskId: ${fakeResult.taskId}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult(`❌ BackgroundKotlin failed: ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  // Test 3: Full background service (will likely fail due to missing crypto keys)
  const testBackgroundService = async () => {
    setIsLoading(true);
    addResult("Testing BackgroundAttachmentDecryptionService...");
    
    try {
      const backgroundService = BackgroundAttachmentDecryptionService.getBackgroundInstance();
     
      // Test with dummy data (will fail but should give us useful error info)
      const dummyAttachment = {
        encryptedFileUrl: "https://httpbin.org/base64/iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 pixel PNG
        fileName: "test.png",
        fileType: "image/png",
        fileSize: 100,
        keyInfo: { "123": "dummyKeyPackageBase64EncodedString" },
        iv: "dummyIVBase64String",
        version: 1
      };
      
      addResult("Starting background decryption test...");
     
      const result = await backgroundService.decryptAttachment(
        dummyAttachment, 
        123,
        (progress, message) => {
          addResult(`📊 Progress: ${progress}% - ${message}`);
        }
      );
      
      addResult(`✅ Background service completed! File: ${result.fileName}`);
     
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult(`❌ Background service failed: ${errorMessage}`);
      
      // This is expected since we don't have real crypto keys
      if (errorMessage.includes('CryptoService') || errorMessage.includes('keys')) {
        addResult("ℹ️  This error is expected - no real crypto keys available");
      }
    }
    
    setIsLoading(false);
  };

  // Test 4: Performance test
  const testPerformance = async () => {
    setIsLoading(true);
    addResult("Testing performance...");
    
    try {
      const startTime = Date.now();
      
      // Run multiple stats calls to test responsiveness
      for (let i = 0; i < 5; i++) {
        const stats = await ExpoVideoDecryptionModule.getDecryptionStats();
        addResult(`Stats call ${i + 1}: ${stats.activeThreads} active threads`);
      }
      
      const endTime = Date.now();
      addResult(`✅ Performance test completed in ${endTime - startTime}ms`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult(`❌ Performance test failed: ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Background Decryption Tests</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#0066CC' }]}
          onPress={testKotlinModule}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>1. Test Kotlin Module</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#9333EA' }]}
          onPress={testBackgroundKotlin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>2. Test Background Kotlin</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#059669' }]}
          onPress={testBackgroundService}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>3. Test Full Service</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#DC2626' }]}
          onPress={testPerformance}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>4. Test Performance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#6B7280' }]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>
      
      {isLoading && (
        <Text style={styles.loading}>Running test...</Text>
      )}
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 4,
    opacity: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#6B7280',
    marginBottom: 20,
  },
  resultsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    marginVertical: 2,
    fontFamily: 'monospace',
    color: '#374151',
  },
});