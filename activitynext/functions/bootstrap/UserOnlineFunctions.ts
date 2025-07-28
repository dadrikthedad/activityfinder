// @/utils/deviceUtils.ts

// Helper function to generate device ID (consistent across sessions)
export function generateDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Get platform type
export function getPlatform(): 'web' | 'mobile' {
  if (typeof window === 'undefined') return 'web';
  return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'web';
}

// Browser beacon for reliable offline marking during page unload
export function markOfflineBeacon(apiBaseUrl: string): void {
  const deviceId = generateDeviceId();
  
  if (navigator.sendBeacon) {
    const url = `${apiBaseUrl}/api/me/offline`;
    const data = JSON.stringify({ deviceId });
    const blob = new Blob([data], { type: 'application/json' });
    
    navigator.sendBeacon(url, blob);
    console.log("📡 Sent offline beacon:", { deviceId });
  }
}

// Få capabilities (kun denne trenger du i tillegg)
export function getCapabilities(): string[] {
  const capabilities = [];
  
  if ('Notification' in window) capabilities.push('notifications');
  if ('serviceWorker' in navigator) capabilities.push('service-worker');
  if (navigator.onLine !== undefined) capabilities.push('online-detection');
  
  return capabilities;
}
// Utility function for getting current device info (bruker eksisterende utils)
export function getCurrentDeviceInfo() {
  return {
    deviceId: generateDeviceId(),
    platform: getPlatform(),
    capabilities: getCapabilities()
  };
}