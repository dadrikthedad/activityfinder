// services/auth/authServiceNative.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefreshTokenRequest } from "@shared/types/auth/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import { LoginRequest } from "@shared/types/auth/LoginRequestDTO";
import { API_BASE_URL } from "@/constants/routes";
import { deviceInfoService } from "@/utils/api/deviceInfo";
import { AuthError } from '@shared/types/error/AuthError';

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly baseURL: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
    // Auto-initialize on startup
    this.initPromise = this.initializeTokens();
  }

  private async initializeTokens(): Promise<void> {
    try {
      this.accessToken = await AsyncStorage.getItem('accessToken');
      this.refreshToken = await AsyncStorage.getItem('refreshToken');
      const expiresStr = await AsyncStorage.getItem('accessTokenExpires');
      
      if (this.accessToken && expiresStr) {
        const expires = new Date(expiresStr);
        if (expires > new Date()) {
          this.scheduleTokenRefresh(expires);
        } else {
          // Token is expired, try to refresh if we have refresh token
          if (this.refreshToken) {
            try {
              await this.refreshAccessToken();
            } catch {
              this.clearTokens();
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize tokens:', error);
      this.clearTokens();
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
        throw new AuthError('Session expired - redirect to login'); // 🆕 Spesiell error
      }
    }

    return response;
  }

  async getAccessToken(): Promise<string | null> {
    await this.ensureInitialized();
    return this.accessToken;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.ensureInitialized();
    return !!this.accessToken && !!this.refreshToken;
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
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const deviceHeaders = await deviceInfoService.getDeviceHeaders();

    const response = await fetch(`${this.baseURL}/api/user/refresh`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...deviceHeaders
      },
      body: JSON.stringify({ refreshToken: this.refreshToken } as RefreshTokenRequest)
    });

    if (!response.ok) {
      await this.clearTokens();
      throw new Error('Session expired');
    }

    const data: LoginResponseDTO = await response.json();
    await this.setTokens(data);
    return data.accessToken;
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
    this.accessToken = null;
    this.refreshToken = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    try {
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken', 
        'accessTokenExpires',
        'refreshTokenExpires'
      ]);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}

export default new AuthService();