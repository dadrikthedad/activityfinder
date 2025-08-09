// AFMobile/context/AuthContext.tsx
// Brukes for login og logout. Lager en token på login og sletter på logout, sikrer også at alle API-kall som trenger det kan bruke token.
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
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
  isLoggedIn: boolean; // Sjekker om vi er logget inn eller ikke
  token: string | null; // Her lagres tokenet
  userId: number | null; //Lagrer bruker ID, brukes i navbar feks
  login: (token: string, redirectTo?: string) => void; // Setter token, oppdatere state og sender oss videre
  logout: () => void; // Fjerner token, nullstiller state og sender tilbake til login
}

const AuthContext = createContext<AuthContextType | undefined>(undefined); //Her oppretter vi selve contexten som holder auth-dataen.

export const AuthProvider = ({ children }: { children: React.ReactNode }) => { // Her sender vi auth.data til barna
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [token, setToken] = useState<string | null>(null);
  const navigation = useNavigation();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => { //Ved første innlastning av appen, sjekker om vi er innlogget eller ikke.
    const loadAuthState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("token");
        setToken(storedToken);
        setIsLoggedIn(!!storedToken);
        const id = getUserIdFromToken(storedToken);
        console.log("✅ User ID from token:", id);
        setUserId(id);
      } catch (error) {
        console.error("❌ Error loading auth state:", error);
      }
    };

    loadAuthState();
  }, []);

  // Login: lagrer token og redirecter
  const login = async (token: string, redirectTo = "Home") => {
    console.log("🔑BOOT: AuthContext.login() startet", { token: token.substring(0, 20)});
    
    try {
      // 👈 OPPDATER STATE FØRST
      const newUserId = getUserIdFromToken(token);
      setToken(token);
      setIsLoggedIn(true);
      setUserId(newUserId);
      
      const previousToken = await AsyncStorage.getItem("token");
      const previousUserId = getUserIdFromToken(previousToken);

      // 🔐 Fjern gammel samtale-ID hvis bruker har endret seg
      if (newUserId !== previousUserId) {
        await AsyncStorage.removeItem("dropdown_convo");
      }

      await AsyncStorage.setItem("token", token);
      console.log("💾 BOOT: Token lagret i AsyncStorage");
      
      console.log("🚀 BOOT: Navigerer til:", redirectTo);
      navigation.navigate(redirectTo as never);
    } catch (error) {
      console.error("❌ Error during login:", error);
    }
  };
 
  const logout = async () => {
    try {
      // 🔴 MARKER SOM OFFLINE FØRST (før vi fjerner token)
      console.log("🔴 Markerer bruker som offline ved utlogging...");
      await markOfflineWithDefaults();
      console.log("✅ Bruker markert som offline");
    } catch (error) {
      console.warn("⚠️ Kunne ikke markere som offline ved utlogging:", error);
      // Fortsett med logout selv om offline-markering feiler
    }

    try {
      // Fjern kun sesjons­relaterte nøkler
      await AsyncStorage.multiRemove([
        "token",
        "messageDropdownSize", 
        "messageDropdownPosition",
        "dropdown_convo"
      ]);

      /* ---------- Zustand-stores ---------- */
      useChatStore.getState().reset();          // tømmer chat
      useNotificationStore.getState().reset();       // tømmer in-memory  (notifications & friendRequests)
      useMessageNotificationStore.getState().reset(); 
      useBootstrapStore.getState().reset();
      useUserCacheStore.getState().reset();              
      
      /* ---------- Slett AsyncStorage-snapshot helt ---------- */
      // 1) Zustand v4+ har .persist.clearStorage()
      await useChatStore.persist.clearStorage();
      await useNotificationStore.persist.clearStorage();
      await useMessageNotificationStore.persist.clearStorage();
      await useBootstrapStore.persist.clearStorage();
      await useUserCacheStore.persist.clearStorage();  

      // 2) fallback – slett direkte via asyncStorage
      await asyncStorage.removeItem("chat-cache");
      await asyncStorage.removeItem("notif-cache");
      await asyncStorage.removeItem("message-notif-cache"); 
      await asyncStorage.removeItem("bootstrap-cache");           
      await asyncStorage.removeItem("user-cache-enhanced"); 

      /* ---------- Annet UI-rot ---------- */
      await clearAllDrafts(); // Async versjon for RN

      /* ---------- Auth-state i React-context ---------- */
      setToken(null);
      setUserId(null);
      setIsLoggedIn(false);

      /* ---------- Naviger til login ---------- */
      navigation.navigate("Login" as never);
      
    } catch (error) {
      console.error("❌ Error during logout:", error);
    }
  };

  // Merk: Ingen sync mellom tabs i React Native siden det ikke er relevant

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for enkel tilgang til å hente auth-data
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth må brukes inni <AuthProvider>");
  return context;
};