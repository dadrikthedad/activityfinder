"use client";
// Hovedinitializer som håndterer bootstrap ved app-oppstart
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useChatStore } from "@/store/useChatStore"; // 👈 LEGG TIL

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
    conversations,
    bootstrap,
    retryCritical 
  } = useBootstrap();

  // 👈 LEGG TIL - ChatStore actions
  const { 
    setConversations, 
    setHasLoadedConversations,
    reset: resetChatStore 
  } = useChatStore();

  // Reset stores ved brukerbytte
  useEffect(() => {
  console.log("🔍 BOOT: AppInitializer effect triggered:", { 
    token: token?.substring(0, 20), 
    userId,
    tokenExists: !!token,
    userIdExists: !!userId
  });
  
  const condition = !token || !userId;
  console.log("🔍 BOOT: Condition details:", {
    token,                    // 👈 FULL TOKEN
    userId,                   // 👈 FULL USERID  
    notToken: !token,
    notUserId: !userId,
    condition: condition
  });
  
  console.log("🔍 BOOT: About to check if statement...");
  
  if (condition) {
    console.log("⏸️ BOOT: Condition is TRUE, returning...");
    return;
  }
  
  console.log("🚀 BOOT: Condition is FALSE, continuing...");
  
  /***** Ny bruker i samme sesjon? Reset alle stores *****/
  if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
    console.log("🔄 BOOT: Ny bruker detektert, resetter alle stores...");
    useBootstrapStore.getState().reset();
    resetChatStore();
    
    // Reset retry counter for ny bruker
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
  }
  prevUserIdRef.current = userId;
  
  console.log("🚀 BOOT: AppInitializer startet for userId =", userId);
}, [token, userId, resetChatStore]);

  // 👈 SYNC conversations fra bootstrap til ChatStore
  useEffect(() => {
  if (isBootstrapped && user) {
    // 🎯 KUN sync hvis vi faktisk har conversations fra bootstrap
    if (conversations && conversations.length > 0) {
      console.log("💬 Synkroniserer conversations fra bootstrap til ChatStore...");
      console.log(`📊 Fant ${conversations.length} samtaler fra bootstrap`);
      
      // Sett conversations i ChatStore
      setConversations(conversations);
      setHasLoadedConversations(true);
      
      console.log("✅ Conversations synkronisert til ChatStore");
    } else if (conversations && conversations.length === 0) {
      // 👈 ENDRE DENNE: Ikke overskrive hvis ChatStore allerede har data
      const currentConversations = useChatStore.getState().conversations;
      
      if (currentConversations.length === 0) {
        console.log("📭 Ingen conversations fra bootstrap og ChatStore er tom, setter empty state");
        setConversations([]);
        setHasLoadedConversations(true);
      } else {
        console.log("📭 Ingen conversations fra bootstrap, men ChatStore har allerede data - beholder eksisterende");
      }
    }
  }
}, [isBootstrapped, user, conversations, setConversations, setHasLoadedConversations]);

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
          console.log(`🔄 Executing retry ${retryCountRef.current + 1}`);
          retryCountRef.current++;
          retryCritical();
        }, delay);
      } else {
        console.log("🛑 Max retries reached. Manual intervention required.");
        console.log("💡 User can manually retry via UI components");
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

  useEffect(() => {
  if (token && userId && !isBootstrapped) {
    console.log("🚀 BOOT: Manually triggering bootstrap...");
    bootstrap();
  }
}, [token, userId, isBootstrapped, bootstrap]);

  // Ikke render noe - dette er kun for side effects
  return null;
}