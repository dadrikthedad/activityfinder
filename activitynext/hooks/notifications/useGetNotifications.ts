"use client";

// Her henter vi 15 notificaitons til navbaren ved å bruke en fetch til backend
import { getNotifications } from "@/services/notifications/getNotifications";
import { useNotificationStore } from "@/store/useNotificationStore";

/**
 * Henter én side med notifikasjoner og legger dem i zustand-store.
 *   – side 1   ⇒ replace (setNotifications)
 *   – side > 1 ⇒ append via addNotification
 */
export async function fetchAndSetNotifications(
  page = 1,
  pageSize = 50,
) {
  try {
    const list = (await getNotifications(page, pageSize)) ?? [];

    const store = useNotificationStore.getState();

    if (page === 1) {
      store.setNotifications(list);
    } else {
      list.forEach(store.addNotification); // skip duplikater
    }

    console.log(
      `🔔 Notifications fetched: page=${page}, items=${list.length}`,
    );
  } catch (err) {
    console.error("❌ Failed to load notifications:", err);
  }
}