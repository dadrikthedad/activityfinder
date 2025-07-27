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

interface AuthContextType {
  isLoggedIn: boolean; // Sjekker om vi er logget inn eller ikke
  token: string | null; // Her lagres tokenet
  userId: number | null; //Lagrer bruker ID, brukes i navbar feks
  login: (token: string, redirectTo?: string) => void; // Setter token, oppdatere state og sender oss videre
  logout: () => void; // Fjerner token, nullstiller state og sender tilbake til login
}

const AuthContext = createContext<AuthContextType | undefined>(undefined); //Her oppretter vi selve contexten som holder auth-dataen.

export const AuthProvider = ({ children }: { children: React.ReactNode }) => { // Her sernder vi auth.data til barna
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [token, setToken] = useState<string | null>(null); // Nå riktig plass
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);


  useEffect(() => { //Ved første innlastning av siden, sjekker om vi er innlogget eller ikke.
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
    setIsLoggedIn(!!storedToken);
    const id = getUserIdFromToken(storedToken); // Henter userid fra token
    console.log("✅ User ID from token:", id); //Brukes for å debugge
    setUserId(id); // Lagerer brukerId-en til feks NavBar
  }, []);

  // Login: lagrer token og redirecter
  const login = (token: string, redirectTo = "/") => {
    console.log("🔑BOOT: AuthContext.login() startet", { token: token.substring(0, 20)});
    // 👈 OPPDATER STATE FØRST
    const newUserId = getUserIdFromToken(token);
    setToken(token);
    setIsLoggedIn(true);
    setUserId(newUserId);
    console.log("✅BOOT: Auth state oppdatert");
    
    if (typeof window !== "undefined") {
      const previousToken = localStorage.getItem("token");
      const previousUserId = getUserIdFromToken(previousToken);

      // 🔐 Fjern gammel samtale-ID hvis bruker har endret seg
      if (newUserId !== previousUserId) {
        localStorage.removeItem("dropdown_convo");
      }

      localStorage.setItem("token", token);
      setCookie("token", token);
      console.log("💾 BOOT: Token lagret i localStorage og cookie");
    }
    console.log("🚀 BOOT: Redirecter til:", redirectTo);
    router.push(redirectTo);
  };
 
  const logout = async () => {
    if (typeof window !== "undefined") {
      // Fjern kun sesjons­relaterte nøkler
      localStorage.removeItem("token");
      localStorage.removeItem("messageDropdownSize");
      localStorage.removeItem("messageDropdownPosition");
      localStorage.removeItem("dropdown_convo");
    }

    /* ---------- Zustand-stores ---------- */
    useChatStore.getState().reset();          // tømmer chat
    useNotificationStore.getState().reset();       // tømmer in-memory  (notifications & friendRequests)
    useMessageNotificationStore.getState().reset(); 
    useBootstrapStore.getState().reset();
    useUserCacheStore.getState().reset();              
    

    /* ---------- Slett IDB-snapshot helt ---------- */
    // 1) Zustand v4+ har .persist.clearStorage()
    await useChatStore.persist.clearStorage();
    await useNotificationStore.persist.clearStorage();
    await useMessageNotificationStore.persist.clearStorage();
    await useBootstrapStore.persist.clearStorage();
    await useUserCacheStore.persist.clearStorage();  

    // 2) fallback – slett direkte via idb-keyval (hvis du ønsker helt blank DB)
    await indexedDBStorage.removeItem("chat-cache");
    await indexedDBStorage.removeItem("notif-cache");
    await indexedDBStorage.removeItem("message-notif-cache"); 
    await indexedDBStorage.removeItem("bootstrap-cache");           
    await indexedDBStorage.removeItem("user-cache-enhanced"); 

    /* ---------- Annet UI-rot ---------- */
    clearAllDrafts();                              // f.eks. editor-drafts o.l.

    /* ---------- Auth-state i React-context ---------- */
    setToken(null);
    setUserId(null);
    setIsLoggedIn(false);

    /* ---------- Naviger til login ---------- */
    router.push("/login");
  };


  // Sync mellom tabs
  useEffect(() => {
    const syncAuth = () => {
      const storedToken = localStorage.getItem("token");
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

// Custom hook for enkel tilgang til å hente auth-data
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth må brukes inni <AuthProvider>");
  return context;
};