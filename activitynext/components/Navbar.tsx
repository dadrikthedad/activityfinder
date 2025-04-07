"use client"; // Gjør Navbar til en klientkomponent

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Settings, Bell, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProfileLink from "@/components/profile/ProfileLink";

export default function Navbar() {
  
  const [showDropDown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn, logout } = useAuth();

  

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
  };

  useEffect(() => {
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
  
      {/* Høyre del: Login/Profile/Settings */}
      <ul className="flex gap-6 items-center relative">
        {isLoggedIn ? (
          <>
             {/* Messages */}
            <li>
              <Link href="/inbox" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2">
                <Mail size={18} />
                <span>Messages</span>
              </Link>
            </li>

            {/* Notifications */}
            <li>
              <Link href="/notifications" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition flex items-center gap-2">
                <Bell size={18} />
                <span>Notifications</span>
              </Link>
            </li>
              
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
  
              {showDropDown && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 top-12 bg-white text-black rounded-md shadow-md p-2 z-10 w-32"
                >

                <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setShowDropdown(false);
                      router.push("/editprofile");
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setShowDropdown(false);
                      router.push("/profilesettings");
                    }}
                  >
                    Settings
                  </button>
                  
                  
                  <button
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
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

          
          
    
