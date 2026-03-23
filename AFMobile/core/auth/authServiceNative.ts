// core/auth/authServiceNative.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { RefreshTokenRequest } from "@/features/auth/models/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@/features/auth/models/LoginResponseDTO";
import { LoginRequest, DeviceInfoRequest } from "@/features/auth/models/LoginRequestDTO";
import { ApiRoutes } from "@/core/api/routes";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { AuthError } from '@shared/types/error/AuthError';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { cleanupManager } from '@/features/cleanup/CleanupManager';
import { Platform } from 'react-native';
import { throwProblemDetails } from '@/core/errors/ProblemDetails';

// Tjenestenavn for Keychain-entry (Android Keystore / iOS Secure Enclave)
const KEYCHAIN_SERVICE = 'AFMobile.auth';

interface StoredTokenData {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: string;
  refreshTokenExpires: string;
}

// Tilsvarer AFBack.Features.Auth.Enums.DeviceType
const DeviceType = { Unknown: 0, Desktop: 1, Mobile: 2, Tablet: 3 } as const;

// Tilsvarer AFBack.Features.Auth.Enums.OperatingSystemType
const OperatingSystemType = { Unknown: 0, Windows: 1, MacOS: 2, iOS: 10, Android: 11 } as const;

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private accessTokenExpires: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private isRefreshing = false;

  constructor() {
    this.initPromise = this.initializeTokens();
  }

  // --- Keychain-hjelpere ---

  private async loadFromKeychain(): Promise<StoredTokenData | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (!result) return null;
      return JSON.parse(result.password) as StoredTokenData;
    } catch {
      return null;
    }
  }

  private async saveToKeychain(data: StoredTokenData): Promise<void> {
    await Keychain.setGenericPassword('tokens', JSON.stringify(data), {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
  }

  private async clearKeychain(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    } catch {
      // best effort
    }
  }

  // --- Initialisering ---

  private async initializeTokens(): Promise<void> {
    console.log('🔄 Starting token initialization...');
    try {
      await this.migrateFromAsyncStorageIfNeeded();

      const stored = await this.loadFromKeychain();
      if (!stored) {
        console.log('ℹ️ Ingen lagrede tokens');
        return;
      }

      this.accessToken = stored.accessToken;
      this.refreshToken = stored.refreshToken;
      this.accessTokenExpires = stored.accessTokenExpires;

      if (this.accessToken && stored.accessTokenExpires) {
        const expires = new Date(stored.accessTokenExpires);
        const isExpired = expires <= new Date();

        if (!isExpired) {
          this.scheduleTokenRefresh(expires);
        } else if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
          } catch {
            await this.clearTokens();
          }
        } else {
          await this.clearTokens();
        }
      } else if (this.refreshToken && !this.accessToken) {
        try {
          await this.refreshAccessToken();
        } catch {
          await this.clearTokens();
        }
      }

      console.log('✅ Token initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize tokens:', error);
      await this.clearTokens();
    }
  }

  private async migrateFromAsyncStorageIfNeeded(): Promise<void> {
    try {
      const keychainAlreadyHasData = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (keychainAlreadyHasData) return;

      const [accessToken, refreshToken, accessTokenExpires, refreshTokenExpires] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('refreshToken'),
        AsyncStorage.getItem('accessTokenExpires'),
        AsyncStorage.getItem('refreshTokenExpires'),
      ]);

      if (accessToken && refreshToken && accessTokenExpires && refreshTokenExpires) {
        console.log('🔁 Migrerer tokens fra AsyncStorage → Keychain...');
        await this.saveToKeychain({ accessToken, refreshToken, accessTokenExpires, refreshTokenExpires });
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'accessTokenExpires', 'refreshTokenExpires']);
        console.log('✅ Migrasjon fullført');
      }
    } catch (error) {
      console.warn('⚠️ Migrasjon feilet (ufarlig):', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  // --- Device info ---

  private async buildDeviceInfo(): Promise<DeviceInfoRequest> {
    const deviceInfo = await deviceInfoService.getDeviceInfo();
    const headers = await deviceInfoService.getDeviceHeaders();
    const fingerprint = headers['X-Device-Fingerprint'];

    const deviceType = deviceInfo.isTablet ? DeviceType.Tablet : DeviceType.Mobile;
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

  // --- Offentlige metoder ---

  async login(email: string, password: string): Promise<LoginResponseDTO> {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    const device = await this.buildDeviceInfo();

    const response = await fetch(ApiRoutes.auth.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...deviceHeaders },
      body: JSON.stringify({ email, password, device } as LoginRequest),
    });

    if (!response.ok) {
      await throwProblemDetails(response);
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
    const tokenToCheck = this.accessToken;
    if (!tokenToCheck) return null;
    try {
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      const userId = payload.sub || payload.userId || payload.id || payload.user_id;
      return userId ? parseInt(userId.toString()) : null;
    } catch {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    await this.ensureInitialized();
    return !!(this.refreshToken && (this.accessToken || this.refreshToken));
  }

  // --- Intern token-håndtering ---

  private async setTokens(tokenData: LoginResponseDTO): Promise<void> {
    this.accessToken = tokenData.accessToken;
    this.refreshToken = tokenData.refreshToken;
    this.accessTokenExpires = tokenData.accessTokenExpires;
    await this.saveTokens(tokenData);
    this.scheduleTokenRefresh(tokenData.accessTokenExpires);
  }

  private async saveTokens(tokenData: LoginResponseDTO): Promise<void> {
    try {
      await this.saveToKeychain({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        accessTokenExpires: tokenData.accessTokenExpires,
        refreshTokenExpires: tokenData.refreshTokenExpires,
      });
    } catch (error) {
      console.error('Failed to save tokens to Keychain:', error);
    }
  }

  private scheduleTokenRefresh(expiryDate: string | Date): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const expires = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
    const refreshTime = expires.getTime() - Date.now() - 60_000;
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshAccessToken().catch(() => this.clearTokens());
      }, refreshTime);
    }
  }

  public async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
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
      const body: RefreshTokenRequest = {
        refreshToken: this.refreshToken,
        deviceFingerprint: deviceHeaders['X-Device-Fingerprint'],
      };

      const response = await fetch(ApiRoutes.token.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceHeaders },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        await this.clearTokens();
        throw new Error(`Session expired (${response.status})`);
      }

      const data: LoginResponseDTO = await response.json();
      await this.setTokens(data);
      return data.accessToken;
    } catch (error) {
      if (!this.isRefreshing) await this.clearTokens();
      throw error;
    }
  }

  public async isTokenExpiringSoon(): Promise<boolean> {
    if (!this.accessToken) return true;
    if (!this.accessTokenExpires) return true;
    return new Date(this.accessTokenExpires).getTime() - Date.now() < 120_000;
  }

  private async clearTokens(): Promise<void> {
    console.log('🧹 Clearing tokens...');
    this.accessToken = null;
    this.refreshToken = null;
    this.accessTokenExpires = null;
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }

    const userId = await AsyncStorage.getItem('userId').catch(() => null);
    if (userId) {
      try {
        CryptoService.getInstance().clearUserCache(parseInt(userId));
        const { useBootstrapStore } = await import('@/store/useBootstrapStore');
        useBootstrapStore.getState().setE2EEState(false, false, null);
      } catch (error) {
        console.error('⚠️ Failed to clear E2EE state:', error);
      }
    }

    try { await cleanupManager.clearCache('all'); } catch { /* best effort */ }

    await this.clearKeychain();

    try {
      await AsyncStorage.removeItem('userId');
    } catch (error) {
      console.error('❌ Failed to remove userId from AsyncStorage:', error);
    }
  }
}

export default new AuthService();
