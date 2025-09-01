// AFMobile/context/AuthContext.tsx
// Oppdatert til å bruke den nye AuthService med refresh tokens
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import authServiceNative from "@/services/user/authServiceNative";
import { logoutUser } from "@/services/user/authService";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { clearAllDrafts } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { asyncStorage } from "@/store/indexedNotificationDBStorage";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { markOfflineWithDefaults } from "@/services/bootstrap/onlineStatusService";

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null; // Legacy - for bakoverkompatibilitet
  userId: number | null;
  login: (accessToken: string, refreshToken: string, redirectTo?: string) => void;
  logout: () => void;
  isLoading: boolean; // Nytt - for å håndtere initialization loading
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [token, setToken] = useState<string | null>(null); // Legacy support
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth state...");
        
        // Sjekk om AuthService har gyldige tokens
        const isAuthenticated = await authServiceNative.isAuthenticated();
        const currentAccessToken = await authServiceNative.getAccessToken();
        
        if (isAuthenticated && currentAccessToken) {
          const id = getUserIdFromToken(currentAccessToken);
          console.log("✅ User authenticated, ID:", id);
          
          setToken(currentAccessToken); // Legacy support
          setUserId(id);
          setIsLoggedIn(true);
        } else {
          console.log("❌ No valid authentication found");
          setToken(null);
          setUserId(null);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("❌ Error initializing auth state:", error);
        setToken(null);
        setUserId(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login: lagrer tokens via AuthService og redirecter
  const login = async (accessToken: string, refreshToken: string) => {
    
    try {
      // AuthService har allerede lagret tokens, vi trenger bare å oppdatere state
      const newUserId = getUserIdFromToken(accessToken);
      
      // Sjekk om bruker har endret seg
      const previousToken = await AsyncStorage.getItem("token"); // Legacy token
      const previousUserId = getUserIdFromToken(previousToken);

      // Fjern gammel samtale-ID hvis bruker har endret seg
      if (newUserId !== previousUserId) {
        await AsyncStorage.removeItem("dropdown_convo");
      }

      // Oppdater legacy token storage for bakoverkompatibilitet
      await AsyncStorage.setItem("token", accessToken);
      
      // Oppdater state
      setToken(accessToken);
      setIsLoggedIn(true);
      setUserId(newUserId);
      
      console.log("💾 Auth state updated");
    } catch (error) {
      console.error("❌ Error during login:", error);
    }
  };
 
  const logout = async () => {
    try {
      // Marker som offline først (før vi fjerner token)
      console.log("🔴 Marking user as offline...");
      await markOfflineWithDefaults();
      console.log("✅ User marked as offline");
    } catch (error) {
      console.warn("⚠️ Could not mark as offline during logout:", error);
    }

    try {
      // Bruk den nye logout service som håndterer server-side cleanup
      await logoutUser();
      
      // Fjern legacy token og andre sesjonsdata
      await AsyncStorage.multiRemove([
        "token", // Legacy token
        "messageDropdownSize", 
        "messageDropdownPosition",
        "dropdown_convo"
      ]);

      // Zustand stores cleanup
      useChatStore.getState().reset();
      useNotificationStore.getState().reset();       
      useMessageNotificationStore.getState().reset(); 
      useBootstrapStore.getState().reset();
      useUserCacheStore.getState().reset();              
      
      // Clear persistent storage
      await useChatStore.persist.clearStorage();
      await useNotificationStore.persist.clearStorage();
      await useMessageNotificationStore.persist.clearStorage();
      await useBootstrapStore.persist.clearStorage();
      await useUserCacheStore.persist.clearStorage();  

      // Fallback cleanup
      await asyncStorage.removeItem("chat-cache");
      await asyncStorage.removeItem("notif-cache");
      await asyncStorage.removeItem("message-notif-cache"); 
      await asyncStorage.removeItem("bootstrap-cache");           
      await asyncStorage.removeItem("user-cache-enhanced"); 

      // UI cleanup
      await clearAllDrafts();

      // Reset auth state
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);

      // Navigate to login
      navigation.navigate("Login" as never);
      
    } catch (error) {
      console.error("❌ Error during logout:", error);
      
      // Even if logout fails, clear local state
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);
      navigation.navigate("Login" as never);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      token, 
      userId, 
      login, 
      logout, 
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access to auth data
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within <AuthProvider>");
  return context;
};