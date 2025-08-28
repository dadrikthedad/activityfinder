// Brukes for login og logout. Lager en token på login og sletter på logout, sikrer også at alle API-kall som trenger det kan bruke token.
"use client";
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import { useRouter } from "next/navigation";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { setCookie } from "cookies-next";
import { clearAllDrafts } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { indexedDBStorage } from "@/store/indexedNotificationDBStorage";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { markOfflineWithDefaults } from "@/services/onlineStatusService";
import authService from "@/services/auth/authService";

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  userId: number | null;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>; // Endret til async med email/password
  logout: () => Promise<void>; // Allerede async
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    // Sjekk både gammel localStorage token og nye accessToken
    const storedToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
    setToken(storedToken);
    setIsLoggedIn(!!storedToken);
    const id = getUserIdFromToken(storedToken);
    console.log("User ID from token:", id);
    setUserId(id);
  }, []);

  // Oppdatert login funksjon som bruker AuthService
  const login = async (email: string, password: string, redirectTo = "/") => {
    try {
      console.log("AuthContext.login() startet");
      
      const loginResponse = await authService.login(email, password);
      
      // Oppdater context state
      const newUserId = getUserIdFromToken(loginResponse.accessToken);
      setToken(loginResponse.accessToken);
      setIsLoggedIn(true);
      setUserId(newUserId);
      console.log("Auth state oppdatert");
      
      if (typeof window !== "undefined") {
        const previousToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
        const previousUserId = getUserIdFromToken(previousToken);

        // Fjern gammel samtale-ID hvis bruker har endret seg
        if (newUserId !== previousUserId) {
          localStorage.removeItem("dropdown_convo");
        }

        // Bakoverkompatibilitet - lagre også i gammel token key
        localStorage.setItem("token", loginResponse.accessToken);
        setCookie("token", loginResponse.accessToken);
        console.log("Token lagret i localStorage og cookie");
      }
      
      console.log("Redirecter til:", redirectTo);
      router.push(redirectTo);
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // La komponenten som kaller login håndtere feilen
    }
  };
 
  const logout = async () => {
    try {
      console.log("Markerer bruker som offline ved utlogging...");
      await markOfflineWithDefaults();
      console.log("Bruker markert som offline");
    } catch (error) {
      console.warn("Kunne ikke markere som offline ved utlogging:", error);
    }

    try {
      // Bruk AuthService for server-side logout
      await authService.logout();
    } catch (error) {
      console.warn("Server logout failed:", error);
    }

    if (typeof window !== "undefined") {
      // Fjern alle sesjonsrelaterte nøkler (både nye og gamle)
      localStorage.removeItem("token"); // Gammel
      localStorage.removeItem("accessToken"); // Ny
      localStorage.removeItem("refreshToken"); // Ny
      localStorage.removeItem("accessTokenExpires"); // Ny
      localStorage.removeItem("refreshTokenExpires"); // Ny
      localStorage.removeItem("messageDropdownSize");
      localStorage.removeItem("messageDropdownPosition");
      localStorage.removeItem("dropdown_convo");
    }

    /* ---------- Zustand-stores ---------- */
    useChatStore.getState().reset();
    useNotificationStore.getState().reset();
    useMessageNotificationStore.getState().reset(); 
    useBootstrapStore.getState().reset();
    useUserCacheStore.getState().reset();

    /* ---------- Slett IDB-snapshot helt ---------- */
    await useChatStore.persist.clearStorage();
    await useNotificationStore.persist.clearStorage();
    await useMessageNotificationStore.persist.clearStorage();
    await useBootstrapStore.persist.clearStorage();
    await useUserCacheStore.persist.clearStorage();

    await indexedDBStorage.removeItem("chat-cache");
    await indexedDBStorage.removeItem("notif-cache");
    await indexedDBStorage.removeItem("message-notif-cache"); 
    await indexedDBStorage.removeItem("bootstrap-cache");           
    await indexedDBStorage.removeItem("user-cache-enhanced"); 

    /* ---------- Annet UI-rot ---------- */
    clearAllDrafts();

    /* ---------- Auth-state i React-context ---------- */
    setToken(null);
    setUserId(null);
    setIsLoggedIn(false);

    /* ---------- Naviger til login ---------- */
    router.push("/login");
  };

  // Oppdatert sync for å håndtere både gamle og nye token keys
  useEffect(() => {
    const syncAuth = () => {
      const storedToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
      setToken(storedToken);
      setIsLoggedIn(!!storedToken);
      setUserId(getUserIdFromToken(storedToken));
    };

    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth må brukes inni <AuthProvider>");
  return context;
};