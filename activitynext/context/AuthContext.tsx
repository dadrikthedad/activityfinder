// Brukes for login og logout. Lager en token på login og sletter på logout, sikrer også at alle API-kall som trenger det kan bruke token.
"use client";
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
} from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  login: (token: string, redirectTo?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null); // ✅ Nå riktig plass
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
    setIsLoggedIn(!!storedToken);
  }, []);

  // Login: lagrer token og redirecter
  const login = (token: string, redirectTo = "/") => {
    localStorage.setItem("token", token);
    setToken(token);
    setIsLoggedIn(true);
    router.push(redirectTo);
  };

  // Logout: fjerner token
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setIsLoggedIn(false);
    router.push("/login");
  };

  // Sync mellom tabs
  useEffect(() => {
    const syncAuth = () => {
      const storedToken = localStorage.getItem("token");
      setToken(storedToken);
      setIsLoggedIn(!!storedToken);
    };

    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, login, logout }}>
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