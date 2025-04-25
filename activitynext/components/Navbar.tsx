// Navbaren, sier seg selv. To forskjellige moduser, innlogget eller ikke. Søkefeltet er i midten
"use client"; // Gjør Navbar til en klientkomponent

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Settings, Bell, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProfileLink from "@/components/profile/ProfileLink";
import NavbarSearch from "@/components/NavbarSearch";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";


export default function Navbar() {
  
  const [showDropDown, setShowDropdown] = useState(false); // Her brukes vi dropdown
  const router = useRouter(); // sende oss videre til de forskjellige linkene
  const dropdownRef = useRef<HTMLDivElement>(null); // referanse i minnet til dopdown-elementet
  const { isLoggedIn, logout } = useAuth(); // Her henter vi en sjekk om vi er innlogget eller ikke, da Navbaren endres
  const unreadCount = useUnreadNotifications(); // Her teller vi antall uleste notifications
  const [showNotifications, setShowNotifications] = useState(false); // Her viser vi notifications og skjuler de ved at vi har trykket på den

  useEffect(() => {
    console.log("🌐 Current URL is:", window.location.href);
  }, []);

  const handleLogout = () => { // Ved logout så lukke vi dropboxen og kjører logout funksjonen fra AuthContext
    setShowDropdown(false);
    logout();
  };

  useEffect(() => { // Denne brukes til å lukke dropdown boxen hvis vi trykker på utsiden
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropDown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropDown]);


  return (
    <nav className="flex justify-between items-center bg-[#145214] p-4 text-white shadow-md">
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
             {/* Messages her kommer meldinger*/}
            <li>
              <Link href="/inbox" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2">
                <Mail size={18} />
                <span>Messages</span>
              </Link>
            </li>

            {/* Notifications */}
            <div className="relative"> {/* Ikke bruk <li> hvis det ikke skal være en navigasjonslenke */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNotifications((prev) => !prev);
                }}
                className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2"
              >
                <Bell size={18} />
                <span className="relative">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-3 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </span>
              </button>

              {showNotifications && (
                  <NotificationDropdown onClose={() => setShowNotifications(false)} />
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
                  ref={dropdownRef}
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
            <li>
              <Link href="/login" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
                Login
              </Link>
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

          
          
    
