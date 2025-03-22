"use client";
import { useState } from "react";
import {useRouter} from "next/navigation";
import { useAuth} from "@/context/AuthContext"

export default function LoginPage() {

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [errorMessage, setErrorMessage] = useState("");
const router = useRouter();
const {login} = useAuth();
const [isSubmitting, setIsSubmitting] = useState(false);


const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMessage("");
  if (isSubmitting) return;


  // Sender en forespørsel til backenden, med email og password som er blitt gjort om til json.
  try {
    const response = await fetch(`https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({email, password }),
    });
    // Venter på svar og lagrer det i data
    const data = await response.json();

    // Hvis responsen er noe annet enn 200 ok så blir det en error
    if (!response.ok) {
      const errorMessage = data?.message || "Login failed.";
      throw new Error(errorMessage);
    }

    //Lagre tokenet i localStorage eller cookie for videre bruk
    try {
      if (data.token) {
        login(data.token);
      } else {
        throw new Error("Login successful, but no token received.");
      }
    } catch (error) {
      console.warn("Could not save token in localStorage:", error);
      setErrorMessage("Could not save login. Try again.");
    }
    

    //Omdiriger hjem etter vi har en suksessful innlogging
    router.push("/");
    // Fanger alle feil og skriver en message. Kanskje komme tilbake med spesifikke feil.
  } catch (error: unknown) {
    if (error instanceof Error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage("An unexpected error occurred.");
    }
  } finally {
    setIsSubmitting(false);
  }
}







    return (
      <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center mt-24">
        <h1 className="text-4xl font-bold text-[#1C6B1C]">Login</h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
          Login to continue.
        </p>
  
        {/* Enkel login-form */}
        <form className="mt-6 max-w-sm space-y-4" onSubmit={handleLogin}>
          <div className="text-left">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
              Email
            </label>
            <input id="email"
              type="email" name="email" autoComplete="email"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center"
              placeholder="Your email"
              //Her lagrer vi eposten i denne inputen-tilformen
              value={email}
              // Endrer eposten hvis vi forandrer i teksten igjen
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
  
          <div className="text-left">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
              Password
            </label>
            <input id="password"
              type="password" name="password" autoComplete="current-password"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && (
            <p className="text-red-500 text-sm">{errorMessage}</p>)}
  
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-[#166016] text-white py-2 rounded-md font-semibold transition ${
              isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-[#0F3D0F]"
            }`}
          >
           { isSubmitting ? "Logging in..." : "Logg inn"}
          </button>
        </form>
  
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-4">
          No account?{" "}
          <a href="/signup" className="text-[#1C6B1C] hover:text-[#0F3D0F] hover:underline">
            Sign up here!
          </a>
        </p>
      </div>
    );
  }
  