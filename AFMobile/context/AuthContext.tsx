// AFMobile/context/AuthContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import authServiceNative from "@/services/user/authServiceNative";
import { LogoutService } from "@/auth/services/logoutService";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  userId: string | null;  // GUID-streng fra AFBack, ikke tall
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();
  const logoutService = LogoutService.getInstance();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth state...");

        const isAuthenticated = await authServiceNative.isAuthenticated();
        const currentAccessToken = await authServiceNative.getAccessToken();

        console.log("🔍 Auth check result:", {
          isAuthenticated,
          hasAccessToken: !!currentAccessToken,
        });

        if (isAuthenticated && currentAccessToken) {
          const id = getUserIdFromToken(currentAccessToken);
          console.log("✅ User authenticated, ID:", id);

          if (id) {
            await AsyncStorage.setItem("userId", id);
          }

          setUserId(id);
          setIsLoggedIn(true);
        } else {
          console.log("❌ No valid authentication found - user needs to login");
          await AsyncStorage.removeItem("userId");
          setToken(null);
          setUserId(null);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("❌ Error initializing auth state:", error);
        await AsyncStorage.removeItem("userId");
        setToken(null);
        setUserId(null);
        setIsLoggedIn(false);
      } finally {
        console.log("✅ Auth initialization complete, setting loading to false");
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (accessToken: string, refreshToken: string) => {
    try {
      const newUserId = getUserIdFromToken(accessToken);

      if (!newUserId) {
        console.error("❌ Could not extract user ID from access token");
        throw new Error("Invalid access token - no user ID found");
      }

      const previousUserId = userId;
      if (newUserId !== previousUserId) {
        await AsyncStorage.removeItem("dropdown_convo");
      }

      await AsyncStorage.setItem("userId", newUserId);

      setUserId(newUserId);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("❌ Error during login:", error);
    }
  };

  const logout = async () => {
    try {
      await logoutService.performLogout();
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error("❌ Error during logout:", error);
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      isLoggedIn,
      token,
      userId,
      login,
      logout,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
};
