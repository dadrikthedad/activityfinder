"use client";
// AppInitializer som håndterer bootstrap ved app-oppstart
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap";
import { useOnlineStatus } from "@/hooks/bootstrap/useOnlineStatus";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUserCacheStore, useFriends, useBlockedUsers } from '@/store/useUserCacheStore';
import { useBootstrapDistributor  } from "@/hooks/bootstrap/useBootstrapDistributor";

export function AppInitializer() {
  const { userId, token } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedOnlineRef = useRef(false); 
  const { markCacheAsLoaded } = useBootstrapDistributor();
  
  const { 
    isBootstrapped, 
    criticalLoading, 
    criticalError,
    bootstrap,
    retryCritical,
    isCriticalCacheValid,
    isSecondaryCacheValid,
    user
  } = useBootstrap();

  const { 
    isOnline, 
    isConnecting, 
    markOnline,
    markOffline 
  } = useOnlineStatus();

  // Reset stores ved brukerbytte
  useEffect(() => {
    console.log("🔍 BOOT: AppInitializer effect triggered:", { 
      token: token?.substring(0, 20), 
      userId,
      tokenExists: !!token,
      userIdExists: !!userId
    });
    
    if (!token || !userId) {
      console.log("⏸️ BOOT: No token or userId, skipping bootstrap");
      hasInitializedOnlineRef.current = false;

      // Mark offline when not authenticated
      if (isOnline) {
        console.log("📡 BOOT: Not authenticated - marking offline");
        markOffline();
      }
      return;
    }
    
    // Ny bruker i samme sesjon? Reset alle stores
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      console.log("🔄 BOOT: User switch detected, resetting all stores...");
      useBootstrapStore.getState().reset();
      useChatStore.getState().reset();
      useMessageNotificationStore.getState().reset();
      useNotificationStore.getState().reset();
      useUserCacheStore.getState().reset();

      const criticalValid = isCriticalCacheValid();
      const secondaryValid = isSecondaryCacheValid();

      if (criticalValid && secondaryValid) {
        console.log("🔧 BOOT: Marking cache as loaded after store reset");
        markCacheAsLoaded();
      }
      
      // Reset retry counter for ny bruker
      retryCountRef.current = 0;
      hasInitializedOnlineRef.current = false; 

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }

      // Mark offline when switching users
      if (isOnline) {
        console.log("📡 BOOT: User switch - marking offline");
        markOffline();
      }
    }
    prevUserIdRef.current = userId;
    
    console.log("🚀 BOOT: AppInitializer ready for userId =", userId);
    }, [token, userId, isOnline, markOffline, isCriticalCacheValid, isSecondaryCacheValid, markCacheAsLoaded]);

  

  // Enklere bootstrap trigger logikk
  useEffect(() => {
    if (!token || !userId || criticalLoading) {
      return;
    }

    const criticalValid = isCriticalCacheValid();
    const secondaryValid = isSecondaryCacheValid();
    
    console.log("🔍 BOOT: Cache status:", {
      criticalValid,
      secondaryValid,
      isBootstrapped,
      criticalLoading
    });
    
    //  useBootstrap håndterer cache validation internt
    // Vi kaller bare bootstrap() hvis vi ikke er ferdig ennå
    if (!isBootstrapped) {
      console.log("🚀 BOOT: Triggering bootstrap...");
      bootstrap();
    } else {
      console.log("✅ BOOT: Already bootstrapped, skipping");
    }
  }, [token, userId, isBootstrapped, criticalLoading, bootstrap, isCriticalCacheValid, isSecondaryCacheValid]);

  // ✅ FORBEDRET: Online status orchestration med heartbeat restart
  useEffect(() => {
    // Sjekk om vi kan/skal gå online
    const shouldGoOnline = (
      token &&                // User is authenticated
      userId &&               // User ID exists
      isBootstrapped &&       // Bootstrap is complete
      user &&                 // User data is loaded
      !criticalError &&       // No critical errors
      !isConnecting          // Not currently connecting
    );

    // 🔑 LØSNING: Alltid prøv å gå online hvis vi skal være det, men ikke er det
    if (shouldGoOnline && !isOnline) {
      console.log("✅ BOOT: Conditions met for going online - marking user online");
      markOnline();
    }
    
    // 🔑 INITIAL SETUP: Merk at vi har prøvd å gå online første gang
    if (shouldGoOnline && !hasInitializedOnlineRef.current) {
      hasInitializedOnlineRef.current = true;
      console.log("🎯 BOOT: Initial online setup complete");
    }
  }, [
    token,
    userId,
    isBootstrapped, 
    user, 
    criticalError,
    isOnline, 
    isConnecting,
    markOnline
  ]);

  // ✅ NYTT: Page visibility handler for å restarte heartbeat
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Kun håndter hvis vi er bootstrapped og autentisert
      if (!token || !userId || !isBootstrapped || !user) {
        return;
      }

      if (document.visibilityState === 'visible' && !isOnline && !isConnecting) {
        console.log("👁️ BOOT: Page became visible and we're offline - attempting to go online");
        markOnline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  // ✅ NYTT: Network status handler for å restarte heartbeat
  useEffect(() => {
    const handleNetworkOnline = () => {
      // Kun håndter hvis vi er bootstrapped og autentisert
      if (!token || !userId || !isBootstrapped || !user) {
        return;
      }

      if (!isOnline && !isConnecting) {
        console.log("🌐 BOOT: Network came back online - attempting to go online");
        markOnline();
      }
    };

    window.addEventListener('online', handleNetworkOnline);
    
    return () => {
      window.removeEventListener('online', handleNetworkOnline);
    };
  }, [token, userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  //  Exponential backoff retry logic
  useEffect(() => {
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000];

    if (criticalError) {
      if (retryCountRef.current < maxRetries) {
        const delay = retryDelays[retryCountRef.current] || 16000;
        
        console.log(
          `❌ BOOT: Bootstrap error: ${criticalError}. ` +
          `Retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`
        );
        
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 BOOT: Executing retry ${retryCountRef.current + 1}`);
          retryCountRef.current++;
          retryCritical();
        }, delay);
      } else {
        console.log("🛑 BOOT: Max retries reached. Manual intervention required.");
      }
    } else if (isBootstrapped) {
      // Reset retry count on successful bootstrap
      if (retryCountRef.current > 0) {
        console.log("✅ BOOT: Bootstrap successful, resetting retry counter");
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

  // Debug logging
  useEffect(() => {
    if (criticalLoading) {
      console.log("⏳ BOOT: Loading critical bootstrap data...");
    } else if (isBootstrapped && !criticalError) {
      console.log("✅ BOOT: Bootstrap complete!", {
        retryCount: retryCountRef.current > 0 ? retryCountRef.current : "no retries needed"
      });
    }
  }, [criticalLoading, isBootstrapped, criticalError]);

  return null;
}

// 🔧 FORBEDRET: Debug component med bedre styling og mer info
export function BootstrapDebugInfo() {
  const { 
    isBootstrapped, 
    criticalLoading, 
    secondaryLoading,
    criticalError,
    secondaryError,
    user,
    settings,
    conversations,
    messageNotifications,
    pendingFriendInvitations,
    appNotifications,
    isCriticalCacheValid,
    isSecondaryCacheValid,
  } = useBootstrap();

  const { 
    isOnline, 
    isConnecting, 
    connectionError 
  } = useOnlineStatus();
  
  const { unreadConversationIds } = useChatStore();

  const friends = useFriends();
  const blockedUsers = useBlockedUsers();
  

  // 🔧 Kun vis i development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // 🎨 Forbedret styling
  const debugStyle: React.CSSProperties = {
    position: 'fixed',
    top: 10,
    right: 10,
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '11px',
    fontFamily: 'monospace',
    zIndex: 9999,
    maxWidth: '320px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  };

  const getStatusIcon = (condition: boolean, loading = false) => {
    if (loading) return '⏳';
    return condition ? '✅' : '❌';
  };

  return (
    <div style={debugStyle}>
      <div style={sectionStyle}>
        <strong>🚀 Bootstrap Status</strong>
        <div>Bootstrapped: {getStatusIcon(isBootstrapped)}</div>
        <div>Critical: {getStatusIcon(!criticalError && !criticalLoading, criticalLoading)}</div>
        <div>Secondary: {getStatusIcon(!secondaryError && !secondaryLoading, secondaryLoading)}</div>
      </div>

      {/* Online Status Section */}
      <div style={sectionStyle}>
        <strong>🌐 Online Status</strong>
        <div>Online: {getStatusIcon(isOnline, isConnecting)}</div>
        <div>Connecting: {getStatusIcon(isConnecting)}</div>
        {connectionError && <div>Error: {connectionError.substring(0, 20)}...</div>}
      </div>
      
      <div style={sectionStyle}>
        <strong>🏪 Cache Status</strong>
        <div>Critical: {getStatusIcon(isCriticalCacheValid())}</div>
        <div>Secondary: {getStatusIcon(isSecondaryCacheValid())}</div>
      </div>
      
      {(criticalError || secondaryError) && (
        <div style={sectionStyle}>
          <strong>❌ Errors</strong>
          {criticalError && <div>Critical: {criticalError.substring(0, 30)}...</div>}
          {secondaryError && <div>Secondary: {secondaryError.substring(0, 30)}...</div>}
        </div>
      )}
      
      <div>
        <strong>📊 Data Counts</strong>
        <div>User: {getStatusIcon(!!user)}</div>
        <div>Friends: {friends?.length || 0}</div>
        <div>Blocked Users: {blockedUsers?.length || 0}</div>
        <div>Settings: {getStatusIcon(!!settings)}</div>
        <div>Conversations: {conversations?.length || 0}</div>
        <div>Unread IDs: {unreadConversationIds?.length || 0}</div>
        <div>Message Notifications: {messageNotifications?.length || 0}</div> {/* 🆕 LEGG TIL */}
        <div>Friend Invitations: {pendingFriendInvitations?.length || 0}</div>
        <div>Notifications: {appNotifications?.length || 0}</div>
      </div>
    </div>
  );
}

// Hook for manuell bootstrap trigger (for debug/testing)
export function useManualBootstrap() {
  const { bootstrap, retryCritical, retrySecondary } = useBootstrap();
  
  return {
    triggerFullBootstrap: bootstrap,
    retryCritical,
    retrySecondary,
  };
}