"use client";
// Hovedinitializer som håndterer bootstrap ved app-oppstart
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap";
import { useBootstrapStore } from "@/store/useBootstrapStore";

export function AppInitializer() {
  const { userId, token } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Bootstrap hook som håndterer critical + secondary data
  const { 
    isBootstrapped, 
    criticalLoading, 
    criticalError,
    user,
    friends,
    settings,
    retryCritical 
  } = useBootstrap();

  // Reset stores ved brukerbytte
  useEffect(() => {
    /***** Ikke logget inn ennå? *****/
    if (!token || !userId) return;

    /***** Ny bruker i samme sesjon? Reset bootstrap store *****/
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      console.log("🔄 Bootstrap: Ny bruker detektert, resetter bootstrap store...");
      useBootstrapStore.getState().reset();
      
      // Reset retry counter for ny bruker
      retryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    }
    prevUserIdRef.current = userId;
    
    console.log("🚀 Bootstrap: AppInitializer startet for userId =", userId);
  }, [token, userId]);

  // Exponential backoff retry logic
  useEffect(() => {
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000]; // 1s, 2s, 4s, 8s, 16s

    if (criticalError) {
      if (retryCountRef.current < maxRetries) {
        const delay = retryDelays[retryCountRef.current] || 16000; // Fallback til 16s
        
        console.log(
          `❌ Bootstrap feil: ${criticalError}. ` +
          `Retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`
        );
        
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Bootstrap: Executing retry ${retryCountRef.current + 1}`);
          retryCountRef.current++;
          retryCritical();
        }, delay);
      } else {
        console.log("🛑 Bootstrap: Max retries reached. Manual intervention required.");
        console.log("💡 Bootstrap: User can manually retry via UI components");
      }
    } else if (isBootstrapped) {
      // Reset retry count on successful bootstrap
      if (retryCountRef.current > 0) {
        console.log("✅ Bootstrap successful, resetting retry counter");
        retryCountRef.current = 0;
      }
      
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    }

    // Cleanup on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [criticalError, isBootstrapped, retryCritical]);

  // Debug logging for bootstrap status
  useEffect(() => {
    if (criticalLoading) {
      console.log("⏳ Bootstrap: Laster kritisk data...");
    } else if (isBootstrapped && !criticalError) {
      console.log("✅ Bootstrap: Ferdig!", {
        user: user?.fullName,
        friends: friends.length,
        settings: settings?.language,
        retryCount: retryCountRef.current > 0 ? retryCountRef.current : "no retries needed"
      });
    }
  }, [criticalLoading, isBootstrapped, criticalError, user, friends, settings]);

  // Ikke render noe - dette er kun for side effects
  return null;
}