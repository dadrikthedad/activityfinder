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
  isLoggedIn: boolean;
  token: string | null;
  userId: number | null; //Lagrer bruker ID, brukes i navbar feks
  login: (token: string, redirectTo?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null); // ✅ Nå riktig plass
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);


  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
    setIsLoggedIn(!!storedToken);
    const id = getUserIdFromToken(storedToken);
    console.log("✅ User ID from token:", id); // 👈 Debug
    setUserId(id); // Lagerer brukerId-en til feks NavBar
  }, []);

  // Login: lagrer token og redirecter
  const login = (token: string, redirectTo = "/") => {
    localStorage.setItem("token", token);
    setCookie("token", token); 
    setToken(token);
    setIsLoggedIn(true);
    setUserId(getUserIdFromToken(token)); 
    router.push(redirectTo);
  };

  // Logout: fjerner token
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUserId(null);    
    setIsLoggedIn(false);
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

// 👇 Custom hook for enkel tilgang
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth må brukes inni <AuthProvider>");
  return context;
};