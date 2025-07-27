export interface OnlineStatusRequest {
  deviceId: string;
  platform: 'web' | 'mobile';
  lastBootstrapAt?: number;
  capabilities?: string[];
}

export interface OfflineStatusRequest {
  deviceId: string;
}

export interface OnlineStatusResponse {
  status: string;
  timestamp: number;
}