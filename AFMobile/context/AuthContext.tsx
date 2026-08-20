// AFMobile/context/AuthContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import authServiceNative from "@/core/auth/authServiceNative";
import { logoutUser } from "@/features/auth/services/logoutService";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useE2EEStore } from "@/store/useE2EEStore";

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  userId: string | null;
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const isAuthenticated = await authServiceNative.isAuthenticated();
        const currentAccessToken = await authServiceNative.getAccessToken();

        if (isAuthenticated && currentAccessToken) {
          const id = getUserIdFromToken(currentAccessToken);

          if (id) {
            await AsyncStorage.setItem("userId", id);
          }

          setUserId(id);
          setIsLoggedIn(true);
        } else {
          await AsyncStorage.removeItem("userId");
          setToken(null);
          setUserId(null);
          setIsLoggedIn(false);
        }
      } catch {
        await AsyncStorage.removeItem("userId");
        setToken(null);
        setUserId(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (accessToken: string, refreshToken: string) => {
    const newUserId = getUserIdFromToken(accessToken);

    if (!newUserId) {
      throw new Error("Invalid access token - no user ID found");
    }

    if (newUserId !== userId) {
      await AsyncStorage.removeItem("dropdown_convo");
    }

    await AsyncStorage.setItem("userId", newUserId);
    setUserId(newUserId);
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await logoutUser(userId);

    // Tøm all brukerdata fra storer — privat E2EE-nøkkel i Keychain beholdes
    useUserCacheStore.getState().reset();
    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useBootstrapStore.getState().reset();
    useMessageNotificationStore.getState().reset();
    useNotificationStore.getState().reset();
    useE2EEStore.getState().reset();

    setToken(null);
    setUserId(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, userId, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
};
