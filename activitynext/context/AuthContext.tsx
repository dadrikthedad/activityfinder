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
  const [token, setToken] = useState<string | null>(null); // ✅ Nå riktig plass
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
    if (typeof window !== "undefined") {
      const newUserId = getUserIdFromToken(token);
      const previousToken = localStorage.getItem("token");
      const previousUserId = getUserIdFromToken(previousToken);
  
      // 🔐 Fjern gammel samtale-ID hvis bruker har endret seg
      if (newUserId !== previousUserId) {
        localStorage.removeItem("dropdown_convo");
      }
  
      localStorage.setItem("token", token);
      setCookie("token", token);
    }
  
    setToken(token);
    setIsLoggedIn(true);
    setUserId(getUserIdFromToken(token));
  
    router.push(redirectTo);
  };

  // Logout: fjerner token og resetter bruker
  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("dropdown_convo");
    }
  
    setToken(null);
    setUserId(null);
    setIsLoggedIn(false);
  
    setTimeout(() => {
      router.push("/login");
    }, 50);
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