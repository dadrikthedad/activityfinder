import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ThumbnailCacheService } from '@/features/cryptoAttachments/services/ThumbnailCacheService';

export const TestScreen: React.FC = () => {
  const handleClearCache = () => {
    Alert.alert(
      'Clear Thumbnail Cache',
      'This will delete all cached thumbnails. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              const cacheService = ThumbnailCacheService.getInstance();
              await cacheService.clearCache();
              Alert.alert('Success', 'Thumbnail cache cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
              console.error('Failed to clear cache:', error);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Screen</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleClearCache}
      >
        <Text style={styles.buttonText}>Clear Thumbnail Cache</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});