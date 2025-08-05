// MobileNavbarOverlay.tsx - Legges til OVER eksisterende navbar
"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { Bell, MessageSquare, Menu, X, LogIn, User, Settings, Home, Cloud, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function MobileNavbarOverlay() {
  const { isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Notification state for badge
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleNavigation = useCallback((path: string) => {
    handleCloseMenu();
    router.push(path);
  }, [handleCloseMenu, router]);

  const handleLogout = useCallback(() => {
    handleCloseMenu();
    logout();
  }, [handleCloseMenu, logout]);

  return (
    <>
      {/* Mobile/Tablet Navbar Overlay - kun synlig på mobil/tablet */}
      <div className="md:hidden">
        <nav className="sticky top-0 z-50 flex justify-between items-center bg-[#1C6B1C] px-4 py-3 text-white shadow-md">
          {/* Logo */}
          <div className="text-xl font-bold">
            <Link href="/" onClick={handleCloseMenu}>
              Magee.no
            </Link>
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-3">
            {/* Messages Icon - kun synlig når innlogget */}
            {isLoggedIn && (
              <button
                onClick={() => handleNavigation("/messages")}
                className="p-2 hover:bg-[#0F3D0F] rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Meldinger"
              >
                <MessageSquare size={20} />
              </button>
            )}

            {/* Notifications Icon - kun synlig når innlogget */}
            {isLoggedIn && (
              <button
                onClick={() => handleNavigation("/notifications")}
                className="relative p-2 hover:bg-[#0F3D0F] rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Varsler"
              >
                <Bell size={20} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
            )}

            {/* Burger Menu */}
            <button
              onClick={handleToggleMenu}
              className="p-2 hover:bg-[#0F3D0F] rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Meny"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-40">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={handleCloseMenu}
            />
            
            {/* Menu Panel */}
            <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white dark:bg-[#1e2122] shadow-xl">
              {/* Menu Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-600 bg-[#1C6B1C] text-white">
                <h2 className="text-lg font-semibold">Meny</h2>
                <button
                  onClick={handleCloseMenu}
                  className="p-1 hover:bg-[#0F3D0F] rounded-md transition"
                  aria-label="Lukk meny"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Menu Content */}
              <div className="p-4 space-y-2">
                {isLoggedIn ? (
                  <>
                    {/* Innlogget bruker - Profil først */}
                    <button
                      onClick={() => handleNavigation("/profile")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <User size={18} />
                      <span>My Profile</span>
                    </button>

                    <hr className="border-gray-200 dark:border-gray-600 my-2" />

                    {/* Navigasjonslenker */}
                    <button
                      onClick={() => handleNavigation("/")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Home size={18} />
                      <span>Home</span>
                    </button>

                    <button
                      onClick={() => handleNavigation("/about")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Info size={18} />
                      <span>Om oss</span>
                    </button>

                    <hr className="border-gray-200 dark:border-gray-600 my-2" />

                    {/* Settings dropdown innhold */}
                    <button
                      onClick={() => handleNavigation("/editprofile")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <User size={18} />
                      <span>Edit profile</span>
                    </button>

                    <button
                      onClick={() => handleNavigation("/profilesettings")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Settings size={18} />
                      <span>Settings</span>
                    </button>

                    <hr className="border-gray-200 dark:border-gray-600 my-2" />

                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition text-red-600 dark:text-red-400"
                    >
                      <LogIn size={18} />
                      <span>Log out</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Ikke innlogget - navigasjonslenker først */}
                    <button
                      onClick={() => handleNavigation("/")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Home size={18} />
                      <span>Home</span>
                    </button>

                    <button
                      onClick={() => handleNavigation("/weather")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Cloud size={18} />
                      <span>Backend sjekk</span>
                    </button>

                    <button
                      onClick={() => handleNavigation("/about")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition text-gray-800 dark:text-gray-200"
                    >
                      <Info size={18} />
                      <span>Om oss</span>
                    </button>

                    <hr className="border-gray-200 dark:border-gray-600 my-2" />

                    {/* Login og signup */}
                    <button
                      onClick={() => handleNavigation("/login")}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-[#1C6B1C] hover:text-white rounded-md transition text-[#1C6B1C] font-medium"
                    >
                      <LogIn size={18} />
                      <span>Log in</span>
                    </button>

                    <button
                      onClick={() => handleNavigation("/signup")}
                      className="flex items-center gap-3 w-full p-3 text-left bg-[#1C6B1C] text-white hover:bg-[#0F3D0F] rounded-md transition font-medium"
                    >
                      <User size={18} />
                      <span>Create account</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}