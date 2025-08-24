// utils/api/deviceInfo.ts - Ny fil for device info håndtering
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';

interface DeviceInformation {
  deviceId: string;
  appVersion: string;
  platform: string;
  buildNumber: string;
  systemVersion: string;
  brand: string;
  model: string;
  deviceName: string;
  isTablet: boolean;
}

class DeviceInfoService {
  private deviceInfo: DeviceInformation | null = null;

  async getDeviceInfo(): Promise<DeviceInformation> {
    if (!this.deviceInfo) {
      await this.initDeviceInfo();
    }
    return this.deviceInfo!;
  }

  private async initDeviceInfo(): Promise<void> {
    try {
      this.deviceInfo = {
        deviceId: await DeviceInfo.getUniqueId(),
        appVersion: DeviceInfo.getVersion(),
        platform: Platform.OS,
        buildNumber: DeviceInfo.getBuildNumber(),
        systemVersion: DeviceInfo.getSystemVersion(),
        brand: DeviceInfo.getBrand(),
        model: DeviceInfo.getModel(),
        deviceName: await DeviceInfo.getDeviceName(),
        isTablet: DeviceInfo.isTablet(),
      };
    } catch (error) {
      console.warn('Could not get device info:', error);
      this.deviceInfo = {
        deviceId: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        appVersion: 'unknown',
        platform: Platform.OS,
        buildNumber: 'unknown',
        systemVersion: 'unknown',
        brand: 'unknown',
        model: 'unknown',
        deviceName: 'unknown',
        isTablet: false,
      };
    }
  }

  async getDeviceHeaders(): Promise<Record<string, string>> {
    const deviceInfo = await this.getDeviceInfo();
    const deviceFingerprint = this.generateDeviceFingerprint(deviceInfo);

    return {
      'X-Device-ID': deviceInfo.deviceId,
      'X-App-Version': deviceInfo.appVersion,
      'X-Device-Platform': deviceInfo.platform,
      'X-Build-Number': deviceInfo.buildNumber,
      'X-System-Version': deviceInfo.systemVersion,
      'X-Device-Fingerprint': deviceFingerprint,
      'X-Device-Brand': deviceInfo.brand,
      'X-Device-Model': deviceInfo.model,
      'X-Is-Tablet': deviceInfo.isTablet.toString(),
      'X-Request-Timestamp': Date.now().toString(),
      'User-Agent': this.generateUserAgent(deviceInfo),
    };
  }

  private generateDeviceFingerprint(deviceInfo: DeviceInformation): string {
    const fingerprintData = [
      deviceInfo.deviceId,
      deviceInfo.platform,
      deviceInfo.brand,
      deviceInfo.model,
      deviceInfo.systemVersion,
    ].join('|');
    
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }

  private generateUserAgent(deviceInfo: DeviceInformation): string {
    const { appVersion, platform, systemVersion, brand, model, isTablet } = deviceInfo;
    const deviceType = isTablet ? 'Tablet' : 'Phone';
    
    return `Koptr/${appVersion} (${platform}; ${systemVersion}; ${brand} ${model} ${deviceType}; Mobile)`;
  }
}

export const deviceInfoService = new DeviceInfoService();