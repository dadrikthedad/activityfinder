// AFMobile/utils/deviceUtils.ts - Oppdatert med device headers
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import NetInfo from '@react-native-community/netinfo';
import { markOfflineWithDefaults } from '@/services/bootstrap/onlineStatusService';

// Helper function to generate device ID (consistent across sessions)
export async function generateDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      // Bruk tilgjengelige unique identifiers for mobile
      const uniqueId = Application.applicationId || Device.osInternalBuildId || Device.modelId ||
                       `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      deviceId = `device_${uniqueId}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Error generating device ID:', error);
    // Fallback
    return `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Get platform type
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Platform.OS as 'ios' | 'android' | 'web';
}

// ✅ Oppdatert til å bruke OnlineStatusService som sender device headers
export async function markOfflineAPI(apiBaseUrl: string): Promise<void> {
  try {
    console.log("📡 Marking user offline via service...");
    
    // ✅ Bruk service som automatisk sender device headers
    await markOfflineWithDefaults();
    
    console.log("✅ Successfully marked offline with device headers");
  } catch (error) {
    console.warn("⚠️ Failed to mark offline via service:", error);
    
    // ✅ Fallback til manuell fetch med timeout (uten device headers som fallback)
    try {
      const deviceId = await generateDeviceId();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      await fetch(`${apiBaseUrl}/api/me/offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("📡 Fallback offline API call sent:", { deviceId });
    } catch (fallbackError) {
      console.warn("⚠️ Fallback offline call also failed:", fallbackError);
    }
    
    // Don't throw - app should continue even if offline marking fails
  }
}

// Get capabilities for React Native
export function getCapabilities(): string[] {
  const capabilities = ['push-notifications']; // Most RN apps support this
  
  // Add platform-specific capabilities
  if (Platform.OS === 'ios') {
    capabilities.push('ios-native', 'background-app-refresh');
  } else if (Platform.OS === 'android') {
    capabilities.push('android-native', 'background-tasks');
  }
  
  return capabilities;
}

// Get network connection status
export async function getNetworkInfo() {
  try {
    const netInfo = await NetInfo.fetch();
    return {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isWifi: netInfo.type === 'wifi',
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    return {
      isConnected: true, // Assume connected as fallback
      type: 'unknown',
      isWifi: false,
    };
  }
}

// Get device information
export function getDeviceInfo() {
  return {
    brand: Device.brand,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    platform: Platform.OS,
    isDevice: Device.isDevice, // false for simulator/emulator
  };
}

// Utility function for getting current device info
export async function getCurrentDeviceInfo() {
  const networkInfo = await getNetworkInfo();
  
  return {
    deviceId: await generateDeviceId(),
    platform: getPlatform(),
    capabilities: getCapabilities(),
    deviceInfo: getDeviceInfo(),
    networkInfo,
  };
}

// Setup app state change listeners for automatic offline marking
export function setupAppStateHandlers(apiBaseUrl: string) {
  const { AppState } = require('react-native');
  
  const handleAppStateChange = async (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('📱 App going to background, marking offline...');
      await markOfflineAPI(apiBaseUrl); // ✅ Nå sender denne device headers
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    AppState.removeEventListener('change', handleAppStateChange);
  };
}