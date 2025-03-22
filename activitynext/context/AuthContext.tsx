// Her henter vi token fra backend og sletter det fra backend.
"use client";
import React, {createContext, useState, useEffect, useContext } from "react";
import {useRouter} from "next/navigation";

interface AuthContextType {
    isLoggedIn: boolean;
    login: (token: string) => void;
    logout: () => void;
  }
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  
  export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();
  
    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("token");
            setIsLoggedIn(!!token);
        }
      
    }, []);
  
    // Lager en token ved logging
    const login = (token: string, redirectTo = "/") => {
      localStorage.setItem("token", token);
      setIsLoggedIn(true);
      router.push(redirectTo); // Eller /profile
    };
    
    // Sletter token ved logout
    const logout = () => {
      localStorage.removeItem("token");
      setIsLoggedIn(false);
      router.push("/login");
    };

    // Logger oss ut hvis vi logger ut i en annna fane
    useEffect(() => {
        const syncAuth = () => {
            setIsLoggedIn(!!localStorage.getItem("token"));
        };

        window.addEventListener("storage", syncAuth);
        return () => window.removeEventListener("storage", syncAuth);
    }, []);
  
    return (
      <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
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