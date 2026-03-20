export interface DeviceInfoRequest {
  deviceFingerprint: string;
  deviceName: string;
  deviceType?: number;       // 0 = Unknown, 1 = Mobile, 2 = Tablet, 3 = Desktop
  operatingSystem?: number;  // 0 = Unknown, 1 = Android, 2 = iOS, 3 = Windows, 4 = MacOS
  browser?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device: DeviceInfoRequest;
}
