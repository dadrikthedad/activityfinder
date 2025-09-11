// AFMobile/context/AuthContext.tsx
// Oppdatert til å bruke LogoutService for bedre debugging
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
  const logoutService = LogoutService.getInstance();

 useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth state...");
        
        // Sjekk om AuthService har gyldige tokens
        const isAuthenticated = await authServiceNative.isAuthenticated();
        const currentAccessToken = await authServiceNative.getAccessToken();
        
        console.log("🔍 Auth check result:", {
          isAuthenticated,
          hasAccessToken: !!currentAccessToken
        });
        
        if (isAuthenticated && currentAccessToken) {
          const id = getUserIdFromToken(currentAccessToken);
          console.log("✅ User authenticated, ID:", id);

          if (id) {
            await AsyncStorage.setItem("userId", id.toString());
          }
          
          setUserId(id);
          setIsLoggedIn(true);
        } else {
          console.log("❌ No valid authentication found - user needs to login");
          
          // Explicitly clear any remaining state
          await AsyncStorage.removeItem("userId");
          setToken(null);
          setUserId(null);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("❌ Error initializing auth state:", error);
        
        // Clear state on any error
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

  // Login: lagrer tokens via AuthService og redirecter
  const login = async (accessToken: string, refreshToken: string) => {
    try {
      const newUserId = getUserIdFromToken(accessToken);
      
      // Håndter null userId
      if (!newUserId) {
        console.error("❌ Could not extract user ID from access token");
        throw new Error("Invalid access token - no user ID found");
      }
      
      // Sjekk brukerbytte (bruk current state)
      const previousUserId = userId;
      
      if (newUserId !== previousUserId) {
        await AsyncStorage.removeItem("dropdown_convo");
      }
      
      // Lagre userId for SignalR - nå trygt å kalle toString()
      await AsyncStorage.setItem("userId", newUserId.toString());
      
      // Oppdater state
      setUserId(newUserId);
      setIsLoggedIn(true);
      
    } catch (error) {
      console.error("❌ Error during login:", error);
      // Her kan du også vise en toast eller navigere tilbake til login
    }
  };
 
  const logout = async () => {
    try {
      // ✅ Use dedicated LogoutService for complete cleanup
      await logoutService.performLogout();
      
      // Reset auth state AFTER successful logout
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);

      // Navigate to login
      navigation.navigate("LoginScreen" as never);
      
    } catch (error) {
      console.error("❌ Error during logout:", error);
      
      // Even if logout fails, clear local state
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);
      navigation.navigate("LoginScreen" as never);
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

