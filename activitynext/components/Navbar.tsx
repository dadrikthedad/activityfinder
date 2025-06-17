// Navbaren, sier seg selv. To forskjellige moduser, innlogget eller ikke. Søkefeltet er i midten
"use client"; // Gjør Navbar til en klientkomponent

import Link from "next/link";
import {  useState, useRef, useEffect, useCallback } from "react";
import { Settings, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProfileLink from "@/components/profile/ProfileLink";
import NavbarSearch from "@/components/NavbarSearch";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import NavbarNotifications from "@/components/notifications/NavbarNotifications";
import { useMarkAllNotificationsAsRead } from "@/hooks/notifications/useMarkAllNotificationsAsRead";
import MessageDropdown from "@/components/messages/MessageDropdown";
import { useClickOutsideGroups } from "@/hooks/mouseAndKeyboard/useClickOutside";
import { useCurrentUserSummary } from "@/hooks/user/useCurrentUserSummary";
import { useChatStore } from "@/store/useChatStore";
import { SetGenericElementRef } from "@/types/ui/PopoverRefs";
import { useDropdown } from "@/context/DropdownContext";
import { MessageDropdownInitializer } from "@/services/helpfunctions/messageDropdownInitializer";
import NavbarMessageNotifications from "./messages/NavbarMessageNotificaitons";
import { useNotificationStore } from "@/store/useNotificationStore";
import NavbarLoginDropdown from "./navbar/NavbarLoginDropdown";



export default function Navbar() {
  
  const [showDropDown, setShowDropdown] = useState(false); // Her brukes vi dropdown
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const router = useRouter(); // sende oss videre til de forskjellige linkene
  const { isLoggedIn, logout } = useAuth(); // Her henter vi en sjekk om vi er innlogget eller ikke, da Navbaren endres
  const showNotifications = useNotificationStore((s) => s.showNotificationDropdown);
  const setShowNotifications = useNotificationStore((s) => s.setShowNotificationDropdown); // Her viser vi notifications og skjuler de ved at vi har trykket på den
  const markAllNotificationsRead = useNotificationStore(
    (s) => s.markAllNotificationsRead,
  );

  const notifications = useNotificationStore(
    (s) => s.notifications,      // samme array-referanse til listen
  );

  const handleCloseNotif = useCallback(() => setShowNotifications(false), []);

  const { markAllAsRead } = useMarkAllNotificationsAsRead();
  const showMessages = useChatStore((s) => s.showMessages);
  const setShowMessages = useChatStore((s) => s.setShowMessages);
 
  const { user: currentUser } = useCurrentUserSummary(); // For å hente current user med UserSummary  popoverRef: React.RefObject<>;
  const [messagePos, setMessagePos] = useState<{ x: number; y: number } | null>(null); // For å se hvor messageDropdownen var lagret
  const handleToggleMessages = (e: React.MouseEvent) => {
    if (recentlyClosedMessage) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(window.innerWidth - DROPDOWN_WIDTH - 16, rect.right - DROPDOWN_WIDTH + 32);
    const y = rect.bottom + 8;

    setMessagePos({ x, y });
      setShowMessages(!showMessages);
  };
  
  const DROPDOWN_WIDTH = 1200;
  const [openUserPopoverId, setOpenUserPopoverId] = useState<number | null>(null);
  const messageDropdownRef = useRef<HTMLDivElement>(null);// For å sende ref til Popover for å ikke lukke ved trykk i UserActionPopover
   const loginDropdownRef = useRef<HTMLDivElement>(null)
  const [userPopoverRef, setUserPopoverRef] = useState<React.RefObject<HTMLDivElement> | null>(null);
  const dropdownContext = useDropdown();
  const [recentlyClosed, setRecentlyClosed] = useState(false);
  const [recentlyClosedMessage, setRecentlyClosedMessage] = useState(false);
  const [recentlyClosedLogin, setRecentlyClosedLogin] = useState(false); 

  // Message Dropdown
  useEffect(() => {
    if (!showMessages) {
      setRecentlyClosedMessage(true);
      const timer = setTimeout(() => setRecentlyClosedMessage(false), 200);
      return () => clearTimeout(timer);
    }
  }, [showMessages]);

  // LoginDropdown
  useEffect(() => {
    if (!showLoginDropdown) {
      setRecentlyClosedLogin(true);
      const timer = setTimeout(() => setRecentlyClosedLogin(false), 200);
      return () => clearTimeout(timer);
    }
  }, [showLoginDropdown]);

  // Notificaitons Dropdown
  useEffect(() => {
    if (!showDropDown) return;

    const id = "navbar-profile-menu";
    const close = () => setShowDropdown(false);

    dropdownContext.register({ id, close });
    return () => dropdownContext.unregister(id);
  }, [showDropDown, dropdownContext]);

  useEffect(() => {
    if (!showLoginDropdown) return;

    const id = "navbar-login-menu";
    const close = () => setShowLoginDropdown(false);

    dropdownContext.register({ id, close });
    return () => dropdownContext.unregister(id);
  }, [showLoginDropdown, dropdownContext]);

    // Ny toggle handler for login dropdown
  const handleToggleLogin = useCallback(() => {
    if (recentlyClosedLogin) return;
    setShowLoginDropdown(!showLoginDropdown);
  }, [recentlyClosedLogin, showLoginDropdown]);

      /* ---- MEMOISERT toggle-handler ---- */
  const handleToggleNotifications = useCallback(() => {
    if (recentlyClosed) return;

    const unread = notifications.filter((n) => !n.isRead);
    const opening = !showNotifications;

    if (opening && unread.length > 0) {
      // Async sideeffekter, ikke blokk UI
      markAllAsRead();
      markAllNotificationsRead();
    }

    setShowNotifications(opening);
  }, [
    recentlyClosed,
    showNotifications,
    notifications,
    markAllAsRead,
    markAllNotificationsRead,
    setShowNotifications
  ]);

    useEffect(() => {
    if (!showNotifications) {
      setRecentlyClosed(true);
      const t = setTimeout(() => setRecentlyClosed(false), 200);
      return () => clearTimeout(t);
    }
  }, [showNotifications]);

  const handleLogout = () => { // Ved logout så lukke vi dropboxen og kjører logout funksjonen fra AuthContext
    setShowDropdown(false);
    logout();
  };

  const addUserPopoverRef: SetGenericElementRef<HTMLDivElement> = (newRef) => {
    setUserPopoverRef(newRef);
  };

  const toggleUserPopover = (id: number | null) => {
      setOpenUserPopoverId((prev) => (prev === id ? null : id));
    };

  // Lukker hele meldingsdropdownen
   useClickOutsideGroups({
    includeRefs: userPopoverRef ? [userPopoverRef, messageDropdownRef] : [messageDropdownRef],
    excludeRefs: [],
    excludeClassNames: ["li[data-sonner-toast]", ".new-message-modal"],
    onOutsideClick: () => {
      setShowMessages(false); // 👈 Lukk hele dropdownen
      toggleUserPopover(null); // 👈 Lukk aktiv popover hvis åpen
    },
    isActive: showMessages,
    dropdownId: "message-dropdown",
  });

   // Ny click outside for login dropdown
  useClickOutsideGroups({
    includeRefs: [loginDropdownRef],
    excludeRefs: [],
    excludeClassNames: [],
    onOutsideClick: () => {
      setShowLoginDropdown(false);
    },
    isActive: showLoginDropdown,
    dropdownId: "login-dropdown",
  });




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
            <MessageDropdownInitializer /> {/* 👈 Initialiserer notifikasjoner kun hvis innlogget */}
             {/* Messages her kommer meldinger*/}
             <li className="relative">
                <NavbarMessageNotifications onClick={handleToggleMessages} />

                {showMessages && (
                <div ref={messageDropdownRef}>
                  <MessageDropdown 
                    currentUser={currentUser} 
                    onCloseDropdown={() => setShowMessages(false)} 
                    initialPosition={messagePos ?? undefined}
                    setUserPopoverRef={addUserPopoverRef}
                    openUserPopoverId={openUserPopoverId}
                    toggleUserPopover={toggleUserPopover}
                  />
                </div>
              )}
              </li>

            {/* Notifications */}
            <div className="relative"> {/* Ikke bruk <li> hvis det ikke skal være en navigasjonslenke */}
            <NavbarNotifications
              onClick={handleToggleNotifications}
              unreadCount={notifications.filter((n) => !n.isRead).length}
            />

            {showNotifications && (
              <NotificationDropdown onClose={handleCloseNotif} />
            )}
            </div>
                          
            <li>
              <ProfileLink />
            </li>
            <li className="relative">
              <button
                onClick={() => setShowDropdown((prev) => !prev)}
                className="hover:bg-[#0F3D0F] p-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Settings"
              >
                <Settings size={20} />
              </button>
  
              {showDropDown && ( // bg-white dark:bg-[#1e2122] p-6 
                <div
                  className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] text-white rounded-lg shadow-md p-2 z-10 w-32  border-2 border-[#1C6B1C]"
                > 

                <button // Dropdown
                    className="block w-full text-left px-4 py-2 hover:bg-gray-700 "
                    onClick={() => {
                      setShowDropdown(false);
                      router.push("/editprofile");
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-700"
                    onClick={() => {
                      setShowDropdown(false);
                      router.push("/profilesettings");
                    }}
                  >
                    Settings
                  </button>
                  
                  
                  <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-700"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </li>
          </>
        ) : (
           <>
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
                <div ref={loginDropdownRef}>
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

          
          
 
