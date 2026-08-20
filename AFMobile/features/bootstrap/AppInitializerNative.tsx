import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { useBootstrap } from "@/features/bootstrap/hooks/useBootstrap";
import { useOnlineStatus } from "@/features/bootstrap/hooks/useOnlineStatus";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useE2EEStore } from "@/store/useE2EEStore";
import { useConversationStore } from "@/store/useConversationStore";
import { useChatStore } from "@/store/useChatStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useNotificationStore } from '@/store/useNotificationStore';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useSyncNative } from "@/features/sync/hooks/useSyncNative";
import { handleUserSwitch } from '@/utils/signalr/chatHub';
import authServiceNative from "@/core/auth/authServiceNative";
import { CryptoInitializer } from "@/components/ende-til-ende/CryptoInitializer";
import { useBackgroundImageDecryption } from "@/features/cryptoAttachments/BackgroundDecrypt/hooks/useBackgroundImageDecryption";
import { getSyncUpdates } from "@/features/sync/services/syncService";
import { processSyncEventNative } from "@/features/sync/eventProcessorNative";
import { getBlockedUsers } from "@/features/blocking/services/blockService";
import { RootStackNavigationProp } from "@/types/navigation";

export function AppInitializer() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { userId } = useAuth();

  const prevUserIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const initializationStrategyRef = useRef<'none' | 'bootstrap' | 'sync'>('none');
  const isInitializingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const hasStartedBackgroundDecryptionRef = useRef(false);

  const { startBackgroundDecryption } = useBackgroundImageDecryption();

  const {
    initialized: e2eeInitialized,
    hasKeyPair: e2eeHasKeyPair,
    error: e2eeError,
    setE2EEState,
  } = useE2EEStore();

  const { phase, errorMessage, runBootstrap } = useBootstrap();

  const {
    isBootstrapped,
    isCriticalCacheValid,
    isSecondaryCacheValid,
    markAllCacheAsLoaded,
    cleanupOldCache,
  } = useBootstrapStore();

  const { currentUser: user } = useUserCacheStore();

  const { markOnline, markOffline } = useOnlineStatus();
  const markOnlineRef = useRef(markOnline);
  useEffect(() => { markOnlineRef.current = markOnline; }, [markOnline]);
  const hasMarkedOnlineRef = useRef(false);

  const { isInitialized: isSyncInitialized } = useSyncNative();

  const isLoading = phase === 'critical' || phase === 'secondary' || phase === 'decrypting';
  const hasError = phase === 'error';

  const goHome = () => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };

  // Rydd utdatert cache ved oppstart
  useEffect(() => {
    cleanupOldCache();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset ved brukerbytte / utlogging
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await authServiceNative.isAuthenticated();

      if (!isAuthenticated || !userId) {
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false;
        hasNavigatedRef.current = false;
        hasMarkedOnlineRef.current = false;
        setE2EEState(false, false, null);
        markOffline();
        return;
      }

      if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
        console.log("🔄 BOOT: User switch detected, resetting stores...");
        handleUserSwitch().catch(console.error);
        useBootstrapStore.getState().reset();
        useE2EEStore.getState().reset();
        useChatStore.getState().reset();
        useConversationStore.getState().reset();
        useMessageNotificationStore.getState().reset();
        useNotificationStore.getState().reset();
        useUserCacheStore.getState().reset();
        retryCountRef.current = 0;
        initializationStrategyRef.current = 'none';
        isInitializingRef.current = false;
        hasNavigatedRef.current = false;
        hasMarkedOnlineRef.current = false;
        hasStartedBackgroundDecryptionRef.current = false;
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = undefined;
        }
        markOffline();
      }

      prevUserIdRef.current = userId;
    };

    checkAuth();
  }, [userId, markOffline, setE2EEState]);

  // Initialisering — venter på E2EE, velger strategi
  useEffect(() => {
    const initializeApp = async () => {
      if (!userId || isLoading || isInitializingRef.current) return;
      if (!e2eeInitialized) return;
      if (initializationStrategyRef.current !== 'none') return;

      isInitializingRef.current = true;

      try {
        const hasStaleData = !!useUserCacheStore.getState().currentUser;
        const isReturningUser = isBootstrapped || hasStaleData;

        if (isReturningUser) {
          // Returning user: alltid gå hjem umiddelbart med cachet data.
          // Bootstrap/sync skjer i bakgrunnen — feil er ikke kritiske.
          const reason = isBootstrapped ? "bootstrapped" : "stale-data";
          console.log(`🚀 BOOT: Returning user (${reason}) — navigating Home immediately`);
          initializationStrategyRef.current = 'sync';
          markAllCacheAsLoaded();
          useConversationStore.getState().setHasLoadedConversations(true);
          useConversationStore.getState().setHasLoadedPendingConversations(true);
          useConversationStore.getState().setHasLoadedUnreadConversationIds(true);
          useMessageNotificationStore.getState().setHasLoadedNotifications(true);

          goHome();

          // Refresh blokkerte brukere i bakgrunnen — persistert liste kan være utdatert
          getBlockedUsers().then(result => {
            if (result.success) {
              useUserCacheStore.getState().setBlockedUsers(result.data);
            }
          });

          // isBootstrapped kan være true fra forrige session selv om user-cache er tømt.
          // I så fall kjøres full bootstrap i bakgrunnen for å populere data på nytt.
          if (!hasStaleData) {
            console.log("🔄 BOOT: isBootstrapped=true men ingen cachet brukerdata — kjører bootstrap i bakgrunnen");
            runBootstrap().catch((err) => console.log("ℹ️ BOOT: Background bootstrap feilet:", err?.message ?? err));
          } else {
            // Bakgrunn: prøv sync, fall tilbake på full bootstrap ved behov
            getSyncUpdates()
              .then(async (response) => {
                if (response?.requiresFullRefresh) {
                  console.log("🔄 BOOT: Background sync requires full refresh — running bootstrap");
                  await runBootstrap();
                } else {
                  for (const event of response?.events ?? []) {
                    try { await processSyncEventNative(event); } catch { /* fortsett */ }
                  }
                }
              })
              .catch((err) => console.log("ℹ️ BOOT: Background sync unavailable (offline?):", err?.message ?? err));
          }

        } else {
          // Ekte førstegangbruker: ingen data å vise — must bootstrap
          console.log("🔄 BOOT: First-time user — running bootstrap");
          initializationStrategyRef.current = 'bootstrap';
          await runBootstrap();
          // goHome() trigges via phase === 'done' effekten under
        }
      } catch (error) {
        console.error("❌ BOOT: Initialization error:", error);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeApp();
  }, [userId, isLoading, isBootstrapped, e2eeInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Naviger til Home når bootstrap er ferdig
  useEffect(() => {
    if (phase === 'done') goHome();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gå online én gang når klar — ref-basert lås hindrer gjentatte kall
  useEffect(() => {
    const shouldGoOnline = (
      userId &&
      initializationStrategyRef.current !== 'none' &&
      user &&
      !hasError &&
      e2eeInitialized &&
      (e2eeHasKeyPair || e2eeError === 'network_error')
    );
    if (shouldGoOnline && !hasMarkedOnlineRef.current) {
      hasMarkedOnlineRef.current = true;
      markOnlineRef.current();
    }
  }, [userId, user, hasError, e2eeInitialized, e2eeHasKeyPair, e2eeError]); // markOnline via ref

  // Eksponentiell retry ved bootstrap-feil
  useEffect(() => {
    const maxRetries = 2;
    const retryDelays = [1000, 2000];

    if (hasError && initializationStrategyRef.current === 'bootstrap') {
      if (retryCountRef.current < maxRetries) {
        const delay = retryDelays[retryCountRef.current] || 16000;
        console.log(`❌ BOOT: ${errorMessage}. Retry ${retryCountRef.current + 1}/${maxRetries} in ${delay}ms`);
        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          isInitializingRef.current = false;
          runBootstrap();
        }, delay);
      } else {
        // Alle retries brukt opp — gå hjem med eventuell stale data
        const staleUser = useUserCacheStore.getState().currentUser;
        if (staleUser) {
          console.warn("⚠️ BOOT: All retries failed but stale data exists — navigating Home with cached data");
          useBootstrapStore.getState().markAllCacheAsLoaded();
          useConversationStore.getState().setHasLoadedConversations(true);
          useConversationStore.getState().setHasLoadedPendingConversations(true);
          useConversationStore.getState().setHasLoadedUnreadConversationIds(true);
          useMessageNotificationStore.getState().setHasLoadedNotifications(true);
          goHome();
        } else {
          console.error("❌ BOOT: All retries failed and no cached data — stuck offline");
        }
      }
    } else if (isBootstrapped) {
      retryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
    }

    return () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current); };
  }, [hasError, isBootstrapped, errorMessage, runBootstrap]);

  // Bakgrunnsdekryptering etter full initialisering
  useEffect(() => {
    const shouldRun = (
      userId && isBootstrapped && isSyncInitialized && !hasError && e2eeInitialized &&
      initializationStrategyRef.current !== 'none' && !hasStartedBackgroundDecryptionRef.current
    );
    if (shouldRun) {
      hasStartedBackgroundDecryptionRef.current = true;
      startBackgroundDecryption().catch(console.error);
    }
  }, [userId, isBootstrapped, isSyncInitialized, hasError, e2eeInitialized, startBackgroundDecryption]);

  return (
    <>
      <CryptoInitializer
        shouldInitialize={!!userId}
        onInitialized={(success) => {
          if (!success) console.log("🔐 BOOT: E2EE failed, continuing in limited mode");
        }}
      />
    </>
  );
}
