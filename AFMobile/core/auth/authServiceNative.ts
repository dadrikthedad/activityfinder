// core/auth/authServiceNative.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { RefreshTokenRequest } from "@/features/auth/models/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@/features/auth/models/LoginResponseDTO";
import { LoginRequest } from "@/features/auth/models/LoginRequestDTO";
import { DeviceInfoRequest } from "@/core/models/DeviceInfoRequest";
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
          } catch (error) {
            // clearTokens() kalles kun inne i _performActualRefresh ved 401
            // Her logger vi bare feilen og fortsetter med eksisterende tokens
            console.warn('⚠️ Token refresh ved oppstart feilet (keeping tokens):', (error as Error).message);
          }
        } else {
          await this.clearTokens();
        }
      } else if (this.refreshToken && !this.accessToken) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.warn('⚠️ Token refresh ved oppstart feilet (keeping tokens):', (error as Error).message);
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

  /**
   * Steg 1 av innlogging — sender passord og får 200 OK hvis MFA-kode er sendt på epost.
   * Backend returnerer ikke tokens her — kall verifyMfa() for å fullføre innloggingen.
   */
  async login(email: string, password: string): Promise<void> {
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
    // 200 OK — MFA-kode sendt, ingen body å parse
  }

  /**
   * Steg 2 av innlogging — verifiserer MFA-koden og henter tokens.
   * Lagrer tokens i Keychain ved suksess.
   */
  async verifyMfa(email: string, code: string): Promise<LoginResponseDTO> {
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    const device = await this.buildDeviceInfo();

    const response = await fetch(ApiRoutes.auth.verifyMfa, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...deviceHeaders },
      body: JSON.stringify({ email, code, device }),
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

  /**
   * DEV ONLY — logger inn som vilkårlig bruker uten passord/MFA.
   * Speiler verifyMfa: bygger device-info, henter token-par fra dev-endepunktet
   * og lagrer det i Keychain. Backend-endepunktet finnes kun i Development
   * (DevController fjernes fra ruting i prod), men vi gater også her som ekstra sikring.
   */
  async devLoginAs(email: string): Promise<LoginResponseDTO> {
    if (!__DEV__) {
      throw new Error('devLoginAs er kun tilgjengelig i development');
    }

    const deviceHeaders = await deviceInfoService.getDeviceHeaders();
    const device = await this.buildDeviceInfo();

    const response = await fetch(ApiRoutes.dev.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...deviceHeaders },
      // Backend bruker VerifyMfaRequest — code er påkrevd av serialiseringen men ignoreres
      body: JSON.stringify({ email, code: '000000', device }),
    });

    if (!response.ok) {
      await throwProblemDetails(response);
    }

    const data: LoginResponseDTO = await response.json();
    await this.setTokens(data);
    return data;
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
      } catch (error) {
        // Hvis _performActualRefresh kastet pga 401 har clearTokens() allerede kjørt
        // Hvis det var nettverksfeil kaster vi bare videre uten å logge ut
        throw new AuthError((error as Error).message);
      }
    }

    return response;
  }

  async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();
    return this.accessToken;
  }

  async getCurrentUserId(): Promise<string | null> {
    const tokenToCheck = this.accessToken;
    if (!tokenToCheck) return null;
    try {
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      const userId = payload.sub || payload.userId || payload.id || payload.user_id;
      return userId ? userId.toString() : null;
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
        this.refreshAccessToken().catch((error) => {
          console.warn('⚠️ Scheduled token refresh failed (keeping tokens):', error.message);
        });
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

    let response: Response;
    try {
      const deviceHeaders = await deviceInfoService.getDeviceHeaders();
      const body: RefreshTokenRequest = {
        refreshToken: this.refreshToken,
        deviceFingerprint: deviceHeaders['X-Device-Fingerprint'],
      };

      response = await fetch(ApiRoutes.token.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceHeaders },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      // Nettverksfeil, timeout, DNS-feil — backend har ikke avvist tokenet
      throw new Error('Network error during token refresh — keeping tokens');
    }

    if (response.status === 401) {
      // Backend sier eksplisitt at refresh token er ugyldig/revokert
      await this.clearTokens();
      throw new Error('Refresh token rejected by server (401) — logging out');
    }

    if (!response.ok) {
      // 5xx, 503 osv — serverproblemer, ikke vår feil, behold tokens
      throw new Error(`Token refresh failed with status ${response.status} — keeping tokens`);
    }

    const data: LoginResponseDTO = await response.json();
    await this.setTokens(data);
    return data.accessToken;
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
        CryptoService.getInstance().clearUserCache(userId);
        const { useE2EEStore } = await import('@/store/useE2EEStore');
        useE2EEStore.getState().setE2EEState(false, false, null);
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
