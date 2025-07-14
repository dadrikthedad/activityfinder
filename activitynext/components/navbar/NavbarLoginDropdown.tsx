// NavbarLoginDropdown.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import FormField from "@/components/FormField";
import FormButton from "@/components/FormButton";
import PasswordField from "@/components/PasswordField";

interface NavbarLoginDropdownProps {
  onClose: () => void;
}

export default function NavbarLoginDropdown({ onClose }: NavbarLoginDropdownProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pathname = usePathname();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Hent IP og lokasjon
      const locationRes = await fetch("https://ipapi.co/json/");
      const locationData = await locationRes.json();
      
      const loginPayload = {
        email,
        password,
        ip: locationData.ip || "",
        city: locationData.city || "",
        region: locationData.region || "",
        country: locationData.country || "",
        country_name: locationData.country_name || "",
      };

      const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginPayload),
      });
      
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || "Login failed.";
        throw new Error(errorMessage);
      }

      if (data.token) {
        try {
          console.log("🔑 NAVBAR: Token mottatt, kaller login()...", data.token.substring(0, 20));
          
          // 👈 LOGIN MED CURRENT PATH (forblir på samme side)
          login(data.token, pathname);
          
          console.log("✅ NAVBAR: Login() kalt for", pathname);
          onClose();
          
          // 👈 FORCE REFRESH for å trigge AppInitializer
          setTimeout(() => {
            window.location.href = pathname; // Gentle refresh til samme side
          }, 100);
          
          return;
        } catch (error) {
          console.warn("Could not save token in localStorage:", error);
          setErrorMessage("Could not save login. Try again.");
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute right-0 top-12 bg-white dark:bg-[#1e2122] rounded-lg shadow-lg border-2 border-[#1C6B1C] p-4 z-50 w-80">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-[#1C6B1C] dark:text-white">Login</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Enter your credentials</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3 flex flex-col items-center">
        <div className="w-full">
          <FormField
            id="navbar-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="w-full">
          <PasswordField
            id="navbar-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            disabled={isSubmitting}
          />
        </div>

        <div className="w-full flex justify-center">
          <FormButton
            text="Login"
            submittingText="Logging in..."
            isSubmitting={isSubmitting}
          />
        </div>

        {errorMessage && (
          <p className="text-red-500 text-sm text-center">{errorMessage}</p>
        )}
      </form>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">
          No account?{" "}
          <a 
            href="/signup" 
            className="text-[#1C6B1C] hover:text-[#0F3D0F] hover:underline"
            onClick={onClose}
          >
            Sign up here!
          </a>
        </p>
      </div>
    </div>
  );
}