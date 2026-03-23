// core/models/DeviceInfoRequest.ts
// Delt DTO for device-informasjon som sendes med alle auth-requests.
// Tilsvarer DeviceInfoRequest i AFBack.
// Brukes av LoginRequest og andre requests som krever device-kontekst.

export interface DeviceInfoRequest {
  deviceFingerprint: string;
  deviceName: string;
  deviceType?: number;       // 0 = Unknown, 1 = Desktop, 2 = Mobile, 3 = Tablet
  operatingSystem?: number;  // 0 = Unknown, 1 = Windows, 2 = MacOS, 10 = iOS, 11 = Android
  browser?: string;
}
