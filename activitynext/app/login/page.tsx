// Login-siden
"use client";
import { useState } from "react";
import { useAuth} from "@/context/AuthContext"
import FormField from "@/components/FormField";
import FormButton from "@/components/FormButton";
import PasswordField from "@/components/PasswordField";

export default function LoginPage() {
// Tilstand for email, passord, feilmelding og submit-status
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [errorMessage, setErrorMessage] = useState("");
const {login} = useAuth(); // Henter login-funksjon fra AuthContext
const [isSubmitting, setIsSubmitting] = useState(false);

const handleLogin = async (e: React.FormEvent) => { // Håndterer innsending av login-skjema
  e.preventDefault();
  setErrorMessage("");

  if (isSubmitting) return;
  setIsSubmitting(true);

  try {
    // Hent IP og lokasjon (valgfritt men nyttig for sikkerhet/logg)
    const locationRes = await fetch("https://ipapi.co/json/");
    const locationData = await locationRes.json();

    const loginPayload = {
      email,
      password,
      ip: locationData.ip || "",
      city: locationData.city || "",
      region: locationData.region || "",
      country: locationData.country || "", // ISO2
      country_name: locationData.country_name || "",
    };
    
    // Her gir vi API fra backend og som vi har lagret som loginPaylod
    const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginPayload),
    });

    const data = await response.json();
    // Hvis feil så gir vi error
    if (!response.ok) {
      const errorMessage = data?.message || "Login failed.";
      throw new Error(errorMessage);
    }
    // Lagrer token i localstorage
    if (data.token) {
      try {
        login(data.token); // f.eks. lagre til localStorage eller context
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
      <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center mt-24">
        <h1 className="text-4xl font-bold text-[#1C6B1C]">Login</h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
          Login to continue.
        </p>
  
        {/* Enkel login-form */}
        <form className="mt-6 max-w-sm space-y-4" onSubmit={handleLogin}>
        <FormField //Epost feltet
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          disabled={isSubmitting}
        />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          disabled={isSubmitting}
        />
  
        <FormButton // Submit feltet
          text="Logg inn"
          submittingText="Logging in..."
          isSubmitting={isSubmitting}
        />
        {errorMessage && (
          <p className="text-red-500 text-sm mt-2 text-center">{errorMessage}</p>
        )}
        </form>
        {/* Link til signup-siden hvis vi ikke har en bruker */}
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-4">
          No account?{" "}
          <a href="/signup" className="text-[#1C6B1C] hover:text-[#0F3D0F] hover:underline">
            Sign up here!
          </a>
        </p>
      </div>
    );
  }
  