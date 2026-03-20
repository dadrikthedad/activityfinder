// services/auth/authServiceNative.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefreshTokenRequest } from "@shared/types/auth/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import { LoginRequest, DeviceInfoRequest } from "@shared/types/auth/LoginRequestDTO";
import { ApiRoutes } from "@/constants/routes";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { AuthError } from '@shared/types/error/AuthError';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { cleanupManager } from '@/features/cleanup/CleanupManager';
import { Platform } from 'react-native';

// DeviceType enum — tilsvarer AFBack.Features.Auth.Enums.DeviceType
const DeviceType = {
  Unknown: 0,
  Desktop: 1,
  Mobile: 2,
  Tablet: 3,
} as const;

// OperatingSystemType enum — tilsvarer AFBack.Features.Auth.Enums.OperatingSystemType
const OperatingSystemType = {
  Unknown: 0,
  Windows: 1,
  MacOS: 2,
  iOS: 10,
  Android: 11,
} as const;

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private isRefreshing = false;

  constructor() {
    // Auto-initialize on startup
    this.initPromise = this.initializeTokens();
  }

  private async initializeTokens(): Promise<void> {
    console.log('🔄 Starting token initialization...');
    
    try {
      console.log('📱 Reading tokens from AsyncStorage...');
      this.accessToken = await AsyncStorage.getItem('accessToken');
      this.refreshToken = await AsyncStorage.getItem('refreshToken');
      const expiresStr = await AsyncStorage.getItem('accessTokenExpires');
      
      console.log('🔍 Token status:', {
        hasAccessToken: !!this.accessToken,
        hasRefreshToken: !!this.refreshToken,
        hasExpires: !!expiresStr
      });
      
      if (this.accessToken && expiresStr) {
        const expires = new Date(expiresStr);
        const now = new Date();
        const isExpired = expires <= now;
        
        if (!isExpired) {
          console.log('✅ Token is valid, scheduling refresh');
          this.scheduleTokenRefresh(expires);
        } else if (this.refreshToken) {
          console.log('🔄 Access token expired, auto-refreshing...');
          try {
            await this.refreshAccessToken();
            console.log('✅ Token successfully refreshed on startup');
          } catch (error) {
            console.error('❌ Failed to refresh token on startup, clearing all tokens');
            await this.clearTokens();
          }
        } else {
          console.log('❌ Token expired and no refresh token - clearing');
          await this.clearTokens();
        }
      } else if (this.refreshToken && !this.accessToken) {
        console.log('🔄 No access token but have refresh token, getting new access token...');
        try {
          await this.refreshAccessToken();
          console.log('✅ New access token obtained');
        } catch (error) {
          console.error('❌ Failed to get new access token, refresh token likely expired');
          await this.clearTokens();
        }
      } else {
        console.log('ℹ️ No tokens found - user needs to login');
      }
      
      console.log('✅ Token initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize tokens:', error);
      await this.clearTokens();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  // Bygger Device-objektet som backend krever
  private async buildDeviceInfo(): Promise<DeviceInfoRequest> {
    const deviceInfo = await deviceInfoService.getDeviceInfo();
    const fingerprint = await deviceInfoService.getDeviceHeaders()
      .then(h => h['X-Device-Fingerprint']);

    const isTablet = deviceInfo.isTablet;
    const deviceType = isTablet ? DeviceType.Tablet : DeviceType.Mobile;

    let operatingSystem = OperatingSystemType.Unknown;
    if (Platform.OS === 'android') operatingSystem = OperatingSystemType.Android;
    else if (Platform.OS === 'ios') operatingSystem = OperatingSystemType.iOS;

    return {
      deviceFingerprint: fingerprint,
      deviceName: `${deviceInfo.brand} ${deviceInfo.model}`,
      deviceType,
      operatingSystem,
    };
  }

  async login(email: string, password: string): Promise<LoginResponseDTO> {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    const device = await this.buildDeviceInfo();

    const response = await fetch(ApiRoutes.auth.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...deviceHeaders,
      },
      body: JSON.stringify({ email, password, device } as LoginRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Login failed');
    }

    const data: LoginResponseDTO = await response.json();
    await this.setTokens(data);
    return data;
  }

  async logout(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      if (this.refreshToken) {
        const deviceHeaders = await deviceInfoService.getDeviceHeaders();
        const device = await this.buildDeviceInfo();
        
        await fetch(ApiRoutes.auth.logout, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
            ...deviceHeaders,
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      await this.clearTokens();
    }
  }

  async setTokensFromRegistration(tokenData: LoginResponseDTO): Promise<void> {
    await this.setTokens(tokenData);
  }

  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    await this.ensureInitialized();

    if (await this.isTokenExpiringSoon()) {
      try {
        await this.refreshAccessToken();
      } catch {
        throw new Error('Session expired');
      }
    }

    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    const isFormData = options.body instanceof FormData;

    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...deviceHeaders,
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Håndter 401 automatisk — prøv refresh og retry
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(url, { ...options, headers });
      } catch {
        await this.clearTokens();
        throw new AuthError('Session expired - redirect to login');
      }
    }

    return response;
  }

  async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();
    return this.accessToken;
  }

  async getCurrentUserId(): Promise<number | null> {
    let tokenToCheck = this.accessToken;
    
    if (!tokenToCheck) {
      try {
        tokenToCheck = await AsyncStorage.getItem('accessToken');
      } catch (error) {
        console.log('⚠️ Could not read token from storage:', error);
        return null;
      }
    }

    if (!tokenToCheck) return null;

    try {
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      const userId = payload.sub || payload.userId || payload.id || payload.user_id;
      return userId ? parseInt(userId.toString()) : null;
    } catch (error) {
      console.error('❌ Failed to parse userId from token:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    await this.ensureInitialized();
    return !!(this.refreshToken && (this.accessToken || this.refreshToken));
  }

  private async setTokens(tokenData: LoginResponseDTO): Promise<void> {
    this.accessToken = tokenData.accessToken;
    this.refreshToken = tokenData.refreshToken;
    await this.saveTokens(tokenData);
    this.scheduleTokenRefresh(tokenData.accessTokenExpires);
  }

  private async saveTokens(tokenData: LoginResponseDTO): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        ['accessToken', tokenData.accessToken],
        ['refreshToken', tokenData.refreshToken],
        ['accessTokenExpires', tokenData.accessTokenExpires],
        ['refreshTokenExpires', tokenData.refreshTokenExpires],
      ]);
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  private scheduleTokenRefresh(expiryDate: string | Date): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    const expires = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
    const refreshTime = expires.getTime() - Date.now() - (1 * 60 * 1000); // 1 min før utløp
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshAccessToken().catch(error => {
          console.error('Scheduled token refresh failed:', error);
          this.clearTokens();
        });
      }, refreshTime);
    }
  }

  public async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      console.log('🔄 Refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    if (this.isRefreshing) throw new Error('Refresh already in progress');

    this.isRefreshing = true;
    this.refreshPromise = this._performActualRefresh();
    
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
      this.isRefreshing = false;
    }
  }

  private async _performActualRefresh(): Promise<string> {
    if (!this.refreshToken) throw new Error('No refresh token available');

    try {
      const deviceHeaders = await deviceInfoService.getDeviceHeaders();
      const fingerprint = deviceHeaders['X-Device-Fingerprint'];

      const body: RefreshTokenRequest = {
        refreshToken: this.refreshToken,
        deviceFingerprint: fingerprint,
      };

      const response = await fetch(ApiRoutes.token.refresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...deviceHeaders,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.clearTokens();
        throw new Error(`Session expired (${response.status})`);
      }

      const data: LoginResponseDTO = await response.json();
      await this.setTokens(data);
      console.log('✅ Token refresh completed successfully');
      return data.accessToken;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      if (!this.isRefreshing) await this.clearTokens();
      throw error;
    }
  }

  public async isTokenExpiringSoon(): Promise<boolean> {
    if (!this.accessToken) return true;
    
    try {
      const expiresStr = await AsyncStorage.getItem('accessTokenExpires');
      if (!expiresStr) return true;
      
      const expires = new Date(expiresStr);
      const timeUntilExpiry = expires.getTime() - Date.now();
      return timeUntilExpiry < (2 * 60 * 1000); // < 2 minutter
    } catch {
      return true;
    }
  }

  private async clearTokens(): Promise<void> {
    console.log('🧹 Clearing tokens...');
    
    this.accessToken = null;
    this.refreshToken = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    let userId: string | null = null;
    try {
      userId = await AsyncStorage.getItem('userId');
    } catch (error) {
      console.log('⚠️ Could not get stored user ID:', error);
    }

    if (userId) {
      try {
        const cryptoService = CryptoService.getInstance();
        cryptoService.clearUserCache(parseInt(userId));
        
        const { useBootstrapStore } = await import('@/store/useBootstrapStore');
        const { setE2EEState } = useBootstrapStore.getState();
        setE2EEState(false, false, null);
      } catch (error) {
        console.error('⚠️ Failed to clear E2EE state (continuing anyway):', error);
      }
    }

    try {
      await cleanupManager.clearCache('all');
    } catch (error) {
      console.error('⚠️ Failed to clear file caches (continuing anyway):', error);
    }

    try {
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'accessTokenExpires',
        'refreshTokenExpires',
        'userId',
      ]);
      console.log('✅ All tokens cleared');
    } catch (error) {
      console.error('❌ Failed to clear tokens from storage:', error);
    }
  }
}

export default new AuthService();
