// Forenklet Navbar.tsx - Bruker egen NavbarSettingsDropdown komponent
"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ProfileLink from "@/components/profile/ProfileLink";
import NavbarSearch from "@/components/NavbarSearch";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import NavbarNotifications from "@/components/notifications/NavbarNotifications";
import { useMarkAllNotificationsAsRead } from "@/hooks/notifications/useMarkAllNotificationsAsRead";
import MessageDropdown from "@/components/messages/MessageDropdown";
import { useCurrentUserSummary } from "@/hooks/user/useCurrentUserSummary";
import NavbarMessageNotifications from "./messages/NavbarMessageNotificaitons";
import { useNotificationStore } from "@/store/useNotificationStore";
import NavbarLoginDropdown from "./navbar/NavbarLoginDropdown";
import NavbarSettingsDropdown from "./navbar/NavbarSettingsDropdown"; // ✅ NEW: Import new component
import { useChatStore } from "@/store/useChatStore";

export default function Navbar() {
  const { isLoggedIn } = useAuth();
  
  // Chat store state
  const showMessages = useChatStore((s) => s.showMessages);
  const setShowMessages = useChatStore((s) => s.setShowMessages);
  
  // ✅ ENKEL STATE - minimal overlay footprint
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  
  // Notification state
  const notifications = useNotificationStore((s) => s.notifications);
  const { markAllAsRead } = useMarkAllNotificationsAsRead();
  const markAllNotificationsRead = useNotificationStore((s) => s.markAllNotificationsRead);
  
  // Message state
  const { user: currentUser } = useCurrentUserSummary();
  const [messagePos, setMessagePos] = useState<{ x: number; y: number } | null>(null);
  
  const DROPDOWN_WIDTH = 1200;

  const handleToggleMessages = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(window.innerWidth - DROPDOWN_WIDTH - 16, rect.right - DROPDOWN_WIDTH + 32);
    const y = rect.bottom + 8;

    setMessagePos({ x, y });
    setShowMessages(!showMessages); 
  }, [setShowMessages, showMessages]);

  const handleToggleNotifications = useCallback(() => {
    const unread = notifications.filter((n) => !n.isRead);
    const opening = !showNotificationDropdown;

    if (opening && unread.length > 0) {
      markAllAsRead();
      markAllNotificationsRead();
    }

    setShowNotificationDropdown(prev => !prev);
  }, [
    showNotificationDropdown,
    notifications,
    markAllAsRead,
    markAllNotificationsRead,
  ]);

  const handleToggleLogin = useCallback(() => {
    setShowLoginDropdown(prev => !prev);
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center bg-[#145214] p-4 text-white shadow-md">
      {/* Venstre del: Logo + lenker */}
      <div className="flex items-center gap-8">
        <div className="text-2xl font-bold">Magee.no</div>
        <ul className="flex gap-6">
          <li>
            <Link href="/" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Home
            </Link>
          </li>
          <li>
            <Link href="/weather" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Backend sjekk
            </Link>
          </li>
          <li>
            <Link href="/about" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              About us
            </Link>
          </li>
        </ul>
      </div>

      {/* MIDTEN: Søkefelt */}
      <div className="flex-1 mx-8 hidden md:block">
        <NavbarSearch />
      </div>

      {/* Høyre del: Login/Profile og dropdown meny*/}
      <ul className="flex gap-6 items-center relative">
        {isLoggedIn ? (
          <>
            
            {/* Messages - ✅ FORENKLET */}
            <li className="relative">
              <NavbarMessageNotifications onClick={handleToggleMessages} />

              {showMessages && (
                <MessageDropdown 
                  currentUser={currentUser} 
                  onCloseDropdown={() => setShowMessages(false)}
                  initialPosition={messagePos ?? undefined}
                />
              )}
            </li>

            {/* Notifications - ✅ FORENKLET */}
            <li className="relative">
              <NavbarNotifications
                onClick={handleToggleNotifications}
                unreadCount={notifications.filter((n) => !n.isRead).length}
              />

              {showNotificationDropdown && (
                <div style={{ zIndex: 1100 }}>
                  <NotificationDropdown onClose={() => setShowNotificationDropdown(false)} />
                </div>
              )}
            </li>
                          
            <li>
              <ProfileLink />
            </li>
            
            {/* ✅ NEW: Use standalone NavbarSettingsDropdown component */}
            <li>
              <NavbarSettingsDropdown />
            </li>
          </>
        ) : (
          <>
            {/* Login Dropdown - ✅ FORENKLET */}
            <li className="relative">
              <button
                onClick={handleToggleLogin}
                className="flex items-center gap-2 hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Login"
              >
                <LogIn size={16} />
                Login
              </button>

              {showLoginDropdown && (
                <div style={{ zIndex: 1100 }}>
                  <NavbarLoginDropdown onClose={() => setShowLoginDropdown(false)} />
                </div>
              )}
            </li>
            <li>
              <Link href="/signup" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
                Sign up
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}