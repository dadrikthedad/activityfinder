import { RefreshTokenRequest } from "@shared/types/auth/RefreshTokenRequestDTO";
import { LoginResponseDTO } from "@shared/types/auth/LoginResponseDTO";
import { LoginRequest } from "@shared/types/auth/LoginRequestDTO";
import { API_BASE_URL } from "@/constants/api/routes";
import { AuthError } from "@shared/types/error/AuthError";

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
    
    // Auto-load tokens on initialization
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
      const expiresStr = localStorage.getItem('accessTokenExpires');
      
      if (this.accessToken && expiresStr) {
        const expires = new Date(expiresStr);
        if (expires > new Date()) {
          this.scheduleTokenRefresh(expires);
        }
      }
    }
  }

  async login(email: string, password: string): Promise<LoginResponseDTO> {
    const response = await fetch(`${this.baseURL}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    this.setTokens(data);
    return data;
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await fetch(`${this.baseURL}/api/user/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken } as RefreshTokenRequest)
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    // Check if token is expiring soon
    if (this.isTokenExpiringSoon()) {
      try {
        await this.refreshAccessToken();
      } catch {
        throw new Error('Session expired');
      }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
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
        this.clearTokens();
        throw new AuthError('Session expired'); // Endret fra Error til AuthError
      }
    }

    return response;
  }

  private setTokens(tokenData: LoginResponseDTO): void {
    this.accessToken = tokenData.accessToken;
    this.refreshToken = tokenData.refreshToken;
    
    this.saveTokens(tokenData);
    this.scheduleTokenRefresh(tokenData.accessTokenExpires);
  }

  private saveTokens(tokenData: LoginResponseDTO): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', tokenData.accessToken);
      localStorage.setItem('refreshToken', tokenData.refreshToken);
      localStorage.setItem('accessTokenExpires', tokenData.accessTokenExpires);
      localStorage.setItem('refreshTokenExpires', tokenData.refreshTokenExpires);
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
    throw new AuthError('No refresh token available'); // Endret til AuthError
  }

  const response = await fetch(`${this.baseURL}/api/user/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: this.refreshToken } as RefreshTokenRequest)
  });

  if (!response.ok) {
    this.clearTokens();
    throw new AuthError('Session expired'); // Endret til AuthError
  }

  const data: LoginResponseDTO = await response.json();
  this.setTokens(data);
  return data.accessToken;
}

  public isTokenExpiringSoon(): boolean {
    if (!this.accessToken) return true;
    
    const expiresStr = localStorage.getItem('accessTokenExpires');
    if (!expiresStr) return true;
    
    const expires = new Date(expiresStr);
    const now = new Date();
    const timeUntilExpiry = expires.getTime() - now.getTime();
    
    // Refresh if less than 2 minutes until expiry
    return timeUntilExpiry < (2 * 60 * 1000);
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('accessTokenExpires');
      localStorage.removeItem('refreshTokenExpires');
    }
  }
}

export default new AuthService();