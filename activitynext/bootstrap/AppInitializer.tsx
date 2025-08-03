"use client"
// AppInitializer med smart bootstrap/sync logikk
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/hooks/bootstrap/useBootstrap";
import { useOnlineStatus } from "@/hooks/bootstrap/useOnlineStatus";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUserCacheStore, useFriends, useBlockedUsers } from '@/store/useUserCacheStore';
import { useBootstrapDistributor } from "@/hooks/bootstrap/useBootstrapDistributor";
import { useSync } from "@/hooks/sync/useSync";

export function AppInitializer() {
  const { userId, token } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitializedOnlineRef = useRef(false);
  const initializationStrategyRef = useRef<'none' | 'bootstrap' | 'sync'>('none');
  
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

  const { 
    isSignalRConnected, 
    isFallbackActive, 
    lastSyncAt, 
    triggerSync,
    isInitialized: isSyncInitialized,
    hasToken: hasSyncToken
  } = useSync();

  // Reset stores ved brukerbytte
  useEffect(() => {
    console.log("🔍 BOOT: AppInitializer effect triggered:", { 
      token: token?.substring(0, 20), 
      userId,
      tokenExists: !!token,
      userIdExists: !!userId
    });
    
    if (!token || !userId) {
      console.log("⏸️ BOOT: No token or userId, skipping initialization");
      hasInitializedOnlineRef.current = false;
      initializationStrategyRef.current = 'none';

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

      // Reset states
      retryCountRef.current = 0;
      hasInitializedOnlineRef.current = false;
      initializationStrategyRef.current = 'none';

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }

      if (isOnline) {
        console.log("📡 BOOT: User switch - marking offline");
        markOffline();
      }
    }
    prevUserIdRef.current = userId;
    
    console.log("🚀 BOOT: AppInitializer ready for userId =", userId);
  }, [token, userId, isOnline, markOffline]);

  // 🔑 SMART INITIALIZATION LOGIC
  useEffect(() => {
    if (!token || !userId || criticalLoading) {
      return;
    }

    // Hvis vi allerede har bestemt strategi, ikke gjør noe mer
    if (initializationStrategyRef.current !== 'none') {
      return;
    }

    const criticalValid = isCriticalCacheValid();
    const secondaryValid = isSecondaryCacheValid();
    const hasCachedSyncToken = localStorage.getItem('lastSyncToken');
    
    console.log("🧠 BOOT: Determining initialization strategy:", {
      criticalValid,
      secondaryValid,
      hasCachedSyncToken: !!hasCachedSyncToken,
      isBootstrapped
    });

    // 🎯 BESLUTNINGSLOGIKK:
    
    // 1. Hvis vi har gyldig cache OG sync token → Bruk SYNC
    if (criticalValid && secondaryValid && hasCachedSyncToken && !isBootstrapped) {
      console.log("✨ BOOT: Valid cache + sync token found → Using SYNC strategy");
      initializationStrategyRef.current = 'sync';
      
      // Merk cache som loaded siden vi har gyldig data
      markCacheAsLoaded();
      
      // Start sync umiddelbart for å få latest changes
      console.log("🚀 SYNC: Starting immediate sync with cached token");
      triggerSync();
      return;
    }
    
    // 2. Hvis vi mangler cache eller token → Bruk BOOTSTRAP
    if (!criticalValid || !secondaryValid || !hasCachedSyncToken || !isBootstrapped) {
      console.log("🔄 BOOT: Missing cache or token → Using BOOTSTRAP strategy");
      initializationStrategyRef.current = 'bootstrap';
      
      console.log("🚀 BOOT: Triggering full bootstrap...");
      bootstrap();
      return;
    }
    
    // 3. Allerede bootstrapped og har alt vi trenger
    console.log("✅ BOOT: Already initialized, nothing to do");
    
  }, [
    token, 
    userId, 
    criticalLoading, 
    isCriticalCacheValid, 
    isSecondaryCacheValid, 
    isBootstrapped,
    bootstrap, 
    markCacheAsLoaded, 
    triggerSync
  ]);

  // Online status orchestration
  useEffect(() => {
    const shouldGoOnline = (
      token &&                
      userId &&               
      (isBootstrapped || initializationStrategyRef.current === 'sync') && // 🔧 Tillat online med sync strategy
      user &&                 
      !criticalError &&       
      !isConnecting          
    );

    if (shouldGoOnline && !isOnline) {
      console.log("✅ BOOT: Conditions met for going online - marking user online");
      markOnline();
    }
    
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

  // Page visibility handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!token || !userId || (!isBootstrapped && initializationStrategyRef.current !== 'sync') || !user) {
        return;
      }

      if (document.visibilityState === 'visible' && !isOnline && !isConnecting) {
        console.log("👁️ BOOT: Page became visible and we're offline - attempting to go online");
        markOnline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  // Network status handler
  useEffect(() => {
    const handleNetworkOnline = () => {
      if (!token || !userId || (!isBootstrapped && initializationStrategyRef.current !== 'sync') || !user) {
        return;
      }

      if (!isOnline && !isConnecting) {
        console.log("🌐 BOOT: Network came back online - attempting to go online");
        markOnline();
      }
    };

    window.addEventListener('online', handleNetworkOnline);
    return () => window.removeEventListener('online', handleNetworkOnline);
  }, [token, userId, isBootstrapped, user, isOnline, isConnecting, markOnline]);

  // 🆕 SYNC EVENT LISTENERS
  useEffect(() => {
    const handleFullRefreshRequired = (event: CustomEvent) => {
      console.log("🔄 SYNC: Full refresh required:", event.detail.reason);
      
      // Reset strategy og trigger bootstrap
      initializationStrategyRef.current = 'bootstrap';
      bootstrap();
    };

    const handleSyncError = (event: CustomEvent) => {
      console.error("❌ SYNC: Sync error:", event.detail);
      
      // Hvis sync feiler og vi ikke har bootstrap som fallback
      if (initializationStrategyRef.current === 'sync' && !isBootstrapped) {
        console.log("🔄 SYNC: Sync failed, falling back to bootstrap");
        initializationStrategyRef.current = 'bootstrap';
        bootstrap();
      }
    };

    window.addEventListener('sync:fullRefreshRequired', handleFullRefreshRequired as EventListener);
    window.addEventListener('sync:error', handleSyncError as EventListener);

    return () => {
      window.removeEventListener('sync:fullRefreshRequired', handleFullRefreshRequired as EventListener);
      window.removeEventListener('sync:error', handleSyncError as EventListener);
    };
  }, [bootstrap, isBootstrapped]);

  // Exponential backoff retry logic (kun for bootstrap errors)
  useEffect(() => {
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000];

    if (criticalError && initializationStrategyRef.current === 'bootstrap') {
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
      if (retryCountRef.current > 0) {
        console.log("✅ BOOT: Bootstrap successful, resetting retry counter");
        retryCountRef.current = 0;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [criticalError, isBootstrapped, retryCritical]);

  // Debug logging
  useEffect(() => {
    const strategy = initializationStrategyRef.current;
    
    if (strategy === 'bootstrap' && criticalLoading) {
      console.log("⏳ BOOT: Loading critical bootstrap data...");
    } else if (strategy === 'sync' && isSyncInitialized) {
      console.log("✅ SYNC: Sync-based initialization complete!");
    } else if (isBootstrapped && !criticalError) {
      console.log("✅ BOOT: Bootstrap complete!", {
        strategy,
        retryCount: retryCountRef.current > 0 ? retryCountRef.current : "no retries needed"
      });
    }
  }, [criticalLoading, isBootstrapped, criticalError, isSyncInitialized]);

  // 🆕 STRATEGY STATUS DEBUG
  useEffect(() => {
    const strategy = initializationStrategyRef.current;
    
    if (strategy !== 'none') {
      console.log("🎯 INIT: Strategy status:", {
        strategy,
        isBootstrapped: strategy === 'bootstrap' ? isBootstrapped : 'N/A',
        isSyncInitialized: strategy === 'sync' ? isSyncInitialized : 'N/A',
        signalRConnected: isSignalRConnected,
        fallbackActive: isFallbackActive,
        lastSyncAt: lastSyncAt?.toISOString(),
        hasSyncToken
      });
    }
  }, [isBootstrapped, isSyncInitialized, isSignalRConnected, isFallbackActive, lastSyncAt, hasSyncToken]);

  return null;
}

// 🔧 FORBEDRET: Debug component med sync info
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

  // 🆕 LEGG TIL SYNC STATUS
  const { 
    isSignalRConnected, 
    isFallbackActive, 
    lastSyncAt,
    isInitialized: isSyncInitialized,
    hasToken: hasSyncToken,
    triggerSync
  } = useSync();
  
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

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(0, 123, 255, 0.8)',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    cursor: 'pointer',
    marginTop: '4px',
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

      {/* 🆕 SYNC STATUS SECTION */}
      <div style={sectionStyle}>
        <strong>🔄 Sync Status</strong>
        <div>Initialized: {getStatusIcon(isSyncInitialized)}</div>
        <div>Has Token: {getStatusIcon(hasSyncToken)}</div>
        <div>SignalR: {getStatusIcon(isSignalRConnected)}</div>
        <div>Fallback: {getStatusIcon(isFallbackActive)}</div>
        {lastSyncAt && (
          <div>Last Sync: {new Date(lastSyncAt).toLocaleTimeString()}</div>
        )}
        <button style={buttonStyle} onClick={triggerSync}>
          Trigger Manual Sync
        </button>
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
        <div>Message Notifications: {messageNotifications?.length || 0}</div>
        <div>Friend Invitations: {pendingFriendInvitations?.length || 0}</div>
        <div>Notifications: {appNotifications?.length || 0}</div>
      </div>
    </div>
  );
}
