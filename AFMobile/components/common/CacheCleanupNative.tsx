// Rydder opp i cachen hvert 10 minutt.
"use client"
import { useEffect, PropsWithChildren } from "react";
import { useChatStore } from "@/store/useChatStore";

export default function CacheCleanupNative({ children }: PropsWithChildren) {
  useEffect(() => {
    // Kjør cleanup ved oppstart
    useChatStore.getState().cleanupOldCache();

    // Rydd automatisk hvert 5. minutt
    const interval = setInterval(() => {
      useChatStore.getState().cleanupOldCache();
    }, 1000 * 60 * 10);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}