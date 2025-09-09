// services/auth/LogoutService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import authServiceNative from "@/services/user/authServiceNative";
import { clearAllDrafts } from "@/utils/draft/draft";
import { useChatStore } from "@/store/useChatStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { asyncStorage } from "@/store/indexedNotificationDBStorage";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { useUserCacheStore } from "@/store/useUserCacheStore";
import { markOfflineWithDefaults } from "@/services/bootstrap/onlineStatusService";
import { CryptoService } from '@/components/ende-til-ende/CryptoService';

export class LogoutService {
  private static instance: LogoutService;

  static getInstance(): LogoutService {
    if (!LogoutService.instance) {
      LogoutService.instance = new LogoutService();
    }
    return LogoutService.instance;
  }

  async performLogout(): Promise<void> {
    console.log("🚪 === LOGOUT SEQUENCE STARTING ===");
    
    let currentUserId: number | null = null;

    try {
      // Step 1: Get current user ID before clearing anything - try multiple sources
      currentUserId = await authServiceNative.getCurrentUserId();
      
      // If getCurrentUserId fails, try AsyncStorage as fallback
      if (!currentUserId) {
        const storedUserId = await AsyncStorage.getItem("userId");
        if (storedUserId) {
          currentUserId = parseInt(storedUserId);
          console.log("🔍 Got userId from AsyncStorage fallback:", currentUserId);
        }
      }
      
      console.log("🔍 Current user ID:", currentUserId);

      // Step 2: Mark user as offline
      await this.markUserOffline();

      // Step 3: Debug E2EE state BEFORE clearing
      await this.debugE2EEStateBefore(currentUserId);

      // Step 4: Clear E2EE manually and verify
      if (currentUserId) {
        await this.clearE2EEManually(currentUserId);
      }

      // Step 5: Clear auth tokens (this will also try to clear E2EE again)
      await this.clearAuthTokens();

      // Step 6: Clear all app stores and storage
      await this.clearAppStores();

      // Step 7: Clear AsyncStorage items
      await this.clearAsyncStorage();

      // Step 8: Clear drafts
      await this.clearDrafts();

      // Step 9: Debug E2EE state AFTER clearing
      await this.debugE2EEStateAfter(currentUserId);

      console.log("✅ === LOGOUT SEQUENCE COMPLETED ===");

    } catch (error) {
      console.error("❌ Error during logout sequence:", error);
      
      // Even if logout fails, clear local state as fallback
      await this.emergencyCleanup(currentUserId);
      throw error;
    }
  }

  private async markUserOffline(): Promise<void> {
    try {
      console.log("🔴 Step 1: Marking user as offline...");
      await markOfflineWithDefaults();
      console.log("✅ User marked as offline");
    } catch (error) {
      console.warn("⚠️ Could not mark as offline during logout:", error);
    }
  }

  private async debugE2EEStateBefore(userId: number | null): Promise<void> {
    if (!userId) return;
    
    console.log("🔍 Step 2: E2EE Debug BEFORE clearing:");
    
    try {
      const cryptoService = CryptoService.getInstance();
      
      // Check if we can get access token to verify user session
      const token = await authServiceNative.getAccessToken();
      console.log("🔍 Access token exists:", !!token);
      
      // Check bootstrap store state
      const { useBootstrapStore } = await import('@/store/useBootstrapStore');
      const bootstrapState = useBootstrapStore.getState();
      console.log("🔍 Bootstrap E2EE state:", {
        initialized: bootstrapState.e2eeInitialized,
        hasKeyPair: bootstrapState.e2eeHasKeyPair,
        error: bootstrapState.e2eeError
      });

      console.log("🔍 E2EE Debug complete");
    } catch (error) {
      console.error("❌ E2EE debug failed:", error);
    }
  }

  private async clearE2EEManually(userId: number): Promise<void> {
    console.log("🔐 Step 3: Manual E2EE clearing for user:", userId);
    
    try {
      const cryptoService = CryptoService.getInstance();
      
      // Clear memory cache only - keep keychain for same device
      console.log("🔐 Clearing memory cache...");
      cryptoService.clearUserCache(userId);
      console.log("✅ Memory cache cleared");
      
      // DON'T clear keychain on normal logout - only clear memory
      // Private key stays in keychain for same-device re-login
      console.log("🔐 Keeping keychain intact for same-device re-login");
      
      // Clear bootstrap store E2EE state
      console.log("🔐 Clearing bootstrap E2EE state...");
      const { useBootstrapStore } = await import('@/store/useBootstrapStore');
      const { setE2EEState } = useBootstrapStore.getState();
      setE2EEState(false, false, null);
      console.log("✅ Bootstrap E2EE state cleared");
      
    } catch (error) {
      console.error("❌ Manual E2EE clearing failed:", error);
    }
  }

  private async clearAuthTokens(): Promise<void> {
    console.log("🔑 Step 4: Clearing auth tokens...");
    
    try {
      // This handles both server-side logout AND local token clearing
      await authServiceNative.logout();
      console.log("✅ Auth tokens cleared (both server and local)");
    } catch (error) {
      console.error("❌ Auth token clearing failed:", error);
    }
  }

  private async clearAppStores(): Promise<void> {
    console.log("📦 Step 5: Clearing app stores...");
    
    try {
      // Reset Zustand stores
      useChatStore.getState().reset();
      useNotificationStore.getState().reset();       
      useMessageNotificationStore.getState().reset(); 
      useBootstrapStore.getState().reset();
      useUserCacheStore.getState().reset();

      // Clear persistent storage
      await Promise.all([
        useChatStore.persist.clearStorage(),
        useNotificationStore.persist.clearStorage(),
        useMessageNotificationStore.persist.clearStorage(),
        useBootstrapStore.persist.clearStorage(),
        useUserCacheStore.persist.clearStorage()
      ]);

      console.log("✅ App stores cleared");
    } catch (error) {
      console.error("❌ App store clearing failed:", error);
    }
  }

  private async clearAsyncStorage(): Promise<void> {
    console.log("💾 Step 6: Clearing AsyncStorage...");
    
    try {
      // Remove specific keys
      await AsyncStorage.multiRemove([
        "userId",
        "messageDropdownSize", 
        "messageDropdownPosition",
        "dropdown_convo"
      ]);

      // Fallback cleanup for persistent storage
      await Promise.all([
        asyncStorage.removeItem("chat-cache"),
        asyncStorage.removeItem("notif-cache"),
        asyncStorage.removeItem("message-notif-cache"),
        asyncStorage.removeItem("bootstrap-cache"),
        asyncStorage.removeItem("user-cache-enhanced")
      ]);

      console.log("✅ AsyncStorage cleared");
    } catch (error) {
      console.error("❌ AsyncStorage clearing failed:", error);
    }
  }

  private async clearDrafts(): Promise<void> {
    console.log("📝 Step 7: Clearing drafts...");
    
    try {
      await clearAllDrafts();
      console.log("✅ Drafts cleared");
    } catch (error) {
      console.error("❌ Draft clearing failed:", error);
    }
  }

  private async debugE2EEStateAfter(userId: number | null): Promise<void> {
    if (!userId) return;
    
    console.log("🔍 Step 8: E2EE Debug AFTER clearing:");
    
    try {
      // Check bootstrap store state
      const { useBootstrapStore } = await import('@/store/useBootstrapStore');
      const bootstrapState = useBootstrapStore.getState();
      console.log("🔍 Bootstrap E2EE state AFTER:", {
        initialized: bootstrapState.e2eeInitialized,
        hasKeyPair: bootstrapState.e2eeHasKeyPair,
        error: bootstrapState.e2eeError
      });

      // Verify no tokens exist
      const token = await authServiceNative.getAccessToken();
      console.log("🔍 Access token exists AFTER:", !!token);

      console.log("🔍 E2EE Debug AFTER complete");
    } catch (error) {
      console.error("❌ E2EE debug AFTER failed:", error);
    }
  }

  private async emergencyCleanup(userId: number | null): Promise<void> {
    console.log("🚨 Emergency cleanup started");
    
    try {
      // Force clear everything we can
      if (userId) {
        const cryptoService = CryptoService.getInstance();
        cryptoService.clearUserCache(userId);
        await cryptoService.clearPrivateKey(userId).catch(() => {});
      }

      // Force clear stores
      try {
        useChatStore.getState().reset();
        useNotificationStore.getState().reset();
        useMessageNotificationStore.getState().reset();
        useBootstrapStore.getState().reset();
        useUserCacheStore.getState().reset();
      } catch (e) {}

      // Force clear AsyncStorage
      try {
        await AsyncStorage.multiRemove([
          "userId", "accessToken", "refreshToken", 
          "accessTokenExpires", "refreshTokenExpires"
        ]);
      } catch (e) {}

      console.log("✅ Emergency cleanup completed");
    } catch (error) {
      console.error("❌ Emergency cleanup failed:", error);
    }
  }
}