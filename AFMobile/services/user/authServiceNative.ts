// services/auth/authServiceNative.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefreshTokenRequest } from "@shared/types/auth/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import { LoginRequest } from "@shared/types/auth/LoginRequestDTO";
import { API_BASE_URL } from "@/constants/routes";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { AuthError } from '@shared/types/error/AuthError';
import { CryptoService } from '@/components/ende-til-ende/CryptoService';
import { cleanupManager } from '@/features/cleanup/CleanupManager';

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly baseURL: string;
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private isRefreshing = false;

  constructor() {
    this.baseURL = API_BASE_URL;
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
        
        console.log('⏰ Token timing:', {
          expires: expires.toISOString(),
          now: now.toISOString(),
          isExpired
        });
        
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
            console.log('🧹 Calling clearTokens from initializeTokens catch...');
            await this.clearTokens();
            console.log('✅ clearTokens completed from initializeTokens');
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

  async login(email: string, password: string): Promise<LoginResponseDTO> {
    // Get device headers for login request
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();

    const response = await fetch(`${this.baseURL}/api/user/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      body: JSON.stringify({ 
        email, 
        password,
      } as LoginRequest)
    });

    if (!response.ok) {
      const errorData = await response.json();
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
        
        await fetch(`${this.baseURL}/api/user/logout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...deviceHeaders
          },
          body: JSON.stringify({ refreshToken: this.refreshToken } as RefreshTokenRequest)
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

    // Check if token is expiring soon
    if (await this.isTokenExpiringSoon()) {
      try {
        await this.refreshAccessToken();
      } catch {
        throw new Error('Session expired');
      }
    }

    // Get device headers
    const deviceHeaders = await deviceInfoService.getDeviceHeaders();

    const isFormData = options.body instanceof FormData;

    const headers: HeadersInit = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...deviceHeaders,
      ...options.headers
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 automatically
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        // Retry request with new token
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
    
    // Hvis vi ikke har token i memory, prøv å hent fra storage
    if (!tokenToCheck) {
      try {
        console.log('🔍 No token in memory, checking AsyncStorage...');
        tokenToCheck = await AsyncStorage.getItem('accessToken');
      } catch (error) {
        console.log('⚠️ Could not read token from storage:', error);
        return null;
      }
    }

    if (!tokenToCheck) {
      console.log('ℹ️ No access token available for user ID extraction');
      return null;
    }

    try {
      console.log('🔍 Parsing JWT token for user ID...');
      // Parse JWT token payload
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      
      // JWT kan ha forskjellige field names for userId
      const userId = payload.sub || payload.userId || payload.id || payload.user_id;
      
      const parsedUserId = userId ? parseInt(userId.toString()) : null;
      console.log('👤 Extracted user ID:', parsedUserId);
      return parsedUserId;
    } catch (error) {
      console.error('❌ Failed to parse userId from token:', error);
      return null;
    }
  }

 async isAuthenticated(): Promise<boolean> {
  await this.ensureInitialized();
  
  // Hvis vi har refresh token men ikke access token, er vi fortsatt "authenticated"
  // fordi vi kan få ny access token
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
        ['refreshTokenExpires', tokenData.refreshTokenExpires]
      ]);
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  private scheduleTokenRefresh(expiryDate: string | Date): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const expires = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
    const refreshTime = expires.getTime() - Date.now() - (1 * 60 * 1000); // 1 minute before expiry
    
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
    // Hvis refresh allerede pågår, vent på den
    if (this.refreshPromise) {
      console.log('🔄 Refresh already in progress, waiting for completion...');
      return this.refreshPromise;
    }

    // Hvis vi allerede refresher, returner umiddelbart
    if (this.isRefreshing) {
      throw new Error('Refresh already in progress');
    }

    console.log('🔄 Starting token refresh process...');
    this.isRefreshing = true;
    
    this.refreshPromise = this._performActualRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
      this.isRefreshing = false;
    }
  }

  private async _performActualRefresh(): Promise<string> {
    if (!this.refreshToken) {
      console.error('❌ No refresh token available for refresh');
      throw new Error('No refresh token available');
    }

    console.log('📡 Making refresh token request...');
    
    try {
      const deviceHeaders = await deviceInfoService.getDeviceHeaders();
      
      const response = await fetch(`${this.baseURL}/api/user/refresh`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...deviceHeaders
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      console.log('📡 Refresh response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Refresh failed with status:', response.status, 'Error:', errorText);
        
        // Only clear tokens once
        if (!this.isRefreshing) {
          console.log('🧹 About to clear tokens due to failed refresh...');
          await this.clearTokens();
        }
        
        throw new Error(`Session expired (${response.status})`);
      }

      const data: LoginResponseDTO = await response.json();
      console.log('✅ Got new tokens, saving...');
      
      await this.setTokens(data);
      console.log('✅ Token refresh completed successfully');
      
      return data.accessToken;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      // Only clear tokens if we're the active refresh attempt
      if (!this.isRefreshing) {
        await this.clearTokens();
      }
      
      throw error;
    }
  }


  public async isTokenExpiringSoon(): Promise<boolean> {
    if (!this.accessToken) return true;
    
    try {
      const expiresStr = await AsyncStorage.getItem('accessTokenExpires');
      if (!expiresStr) return true;
      
      const expires = new Date(expiresStr);
      const now = new Date();
      const timeUntilExpiry = expires.getTime() - now.getTime();
      
      // Refresh if less than 2 minutes until expiry
      return timeUntilExpiry < (2 * 60 * 1000);
    } catch {
      return true;
    }
  }

  private async clearTokens(): Promise<void> {
    console.log('🧹 Starting clearTokens process...');
    
    // Clear tokens fra memory FØRST (dette kan ikke feile)
    console.log('🧠 Clearing tokens from memory...');
    this.accessToken = null;
    this.refreshToken = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      console.log('⏰ Refresh timer cleared');
    }

    // Prøv å få userId fra AsyncStorage direkte (uten å parse token)
    let userId: string | null = null;
    try {
      console.log('👤 Getting user ID from AsyncStorage...');
      userId = await AsyncStorage.getItem('userId');
      console.log('👤 Found stored user ID:', userId);
    } catch (error) {
      console.log('⚠️ Could not get stored user ID:', error);
    }

    // Clear E2EE cache hvis vi har userId
    if (userId) {
      try {
        console.log('🔐 Clearing E2EE cache...');
        const cryptoService = CryptoService.getInstance();
        cryptoService.clearUserCache(parseInt(userId));
        
        const { useBootstrapStore } = await import('@/store/useBootstrapStore');
        const { setE2EEState } = useBootstrapStore.getState();
        setE2EEState(false, false, null);
        
        console.log("✅ E2EE memory cache cleared for user:", userId);
      } catch (error) {
        console.error('⚠️ Failed to clear E2EE state (continuing anyway):', error);
      }
    } else {
      console.log('ℹ️ Skipping E2EE cleanup (no stored user ID)');
    }

    try {
      console.log('📁 Clearing file caches and temp storage...');
      await cleanupManager.clearCache('all');
      console.log('✅ File caches and temp storage cleared');
    } catch (error) {
      console.error('⚠️ Failed to clear file caches (continuing anyway):', error);
    }

    // Clear AsyncStorage (viktigst!)
    try {
      console.log('📱 Removing tokens from AsyncStorage...');
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'accessTokenExpires',
        'refreshTokenExpires',
        'userId'
      ]);
      console.log('🗑️ All auth tokens cleared from storage');
    } catch (error) {
      console.error('❌ Failed to clear tokens from storage:', error);
      
      // Prøv å clear individuelt
      try {
        console.log('🔄 Trying individual token removal...');
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('accessTokenExpires');
        await AsyncStorage.removeItem('refreshTokenExpires');
        await AsyncStorage.removeItem('userId');
        console.log('✅ Individual token removal successful');
      } catch (individualError) {
        console.error('❌ Individual token removal also failed:', individualError);
      }
    }
    
    console.log('✅ clearTokens process complete');
  }
}

export default new AuthService();