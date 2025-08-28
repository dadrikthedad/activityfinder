// Login-siden
"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useModal } from "@/context/ModalContext";
import FormField from "@/components/FormField";
import FormButton from "@/components/FormButton";
import PasswordField from "@/components/PasswordField";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { showModal, hideModal } = useModal();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setShowVerificationPrompt(false);

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Bruk AuthService login direkte - ingen behov for manuell API-kall
      await login(email, password);
      console.log("Login successful, redirecting...");
    } catch (error: unknown) {
      console.error("Login error:", error);
      
      if (error instanceof Error) {
        const message = error.message;
        
        // Sjekk for email verification error
        if (message.includes("verify your email") || message.includes("emailVerificationRequired")) {
          setErrorMessage("");
          setShowVerificationPrompt(true);
          return;
        }
        
        setErrorMessage(message);
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = () => {
    router.push(`/verification?email=${encodeURIComponent(email)}`);
  };

  const handleResendVerificationEmail = async () => {
    setResendingEmail(true);
    setErrorMessage("");

    try {
      // Fortsatt bruk direkte API-kall for resend siden dette ikke er en del av AuthService
      const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/email/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showModal(
          <div className="bg-white dark:bg-[#1e2122] p-6 rounded-lg shadow-lg max-w-md border-1 borderColor-[#1C6B1C]">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Sent!</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              A new verification email has been sent! Check your inbox.
            </p>
            <button
              onClick={hideModal}
              className="w-full bg-[#1C6B1C] text-white py-2 px-4 rounded-md hover:bg-[#155a15] transition-colors font-medium"
            >
              OK
            </button>
          </div>
        );
      } else {
        setErrorMessage(data.message || "Failed to resend verification email.");
      }
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      setErrorMessage("Failed to resend verification email. Please try again.");
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center mt-24">
      <h1 className="text-4xl font-bold text-[#1C6B1C]">Login</h1>
      <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
        Login to continue.
      </p>

      {/* Email verification prompt */}
      {showVerificationPrompt && (
        <div className="mt-6 p-6 bg-[#1e2122] border border-[#1C6B1C] rounded-lg max-w-md">
          <h3 className="text-lg font-semibold items-center">Email Verification Required</h3>
          <p className="mb-4 text-sm leading-relaxed">
            Please verify your email address before logging in. Check your inbox for the verification link.
          </p>
          <div className="space-y-3 flex flex-col items-center">
            <button
              onClick={handleVerifyEmail}
              className="w-full bg-[#1C6B1C] text-white py-2 px-4 rounded-md hover:bg-[#155a15] transition-colors font-medium"
            >
              Go to Verification Page
            </button>
            <button
              onClick={handleResendVerificationEmail}
              disabled={resendingEmail}
              className="w-full bg-[#1C6B1C] text-white py-2 px-4 rounded-md hover:bg-[#155a15] transition-colors font-medium disabled:opacity-50"
            >
              {resendingEmail ? "Sending..." : "Resend Verification Email"}
            </button>
            <button
              onClick={() => setShowVerificationPrompt(false)}
              className="w-32 text-white py-2 px-3 rounded-md bg-gray-600 hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Normal login form */}
      {!showVerificationPrompt && (
        <form className="mt-6 max-w-sm space-y-4" onSubmit={handleLogin}>
          <FormField
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

          <FormButton
            text="Logg inn"
            submittingText="Logging in..."
            isSubmitting={isSubmitting}
          />

          {errorMessage && (
            <p className="text-red-500 text-sm mt-2 text-center">{errorMessage}</p>
          )}
        </form>
      )}

      {/* Link til signup-siden */}
      <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-6">
        No account?{" "}
        <a href="/signup" className="text-[#1C6B1C] hover:text-[#0F3D0F] hover:underline">
          Sign up here!
        </a>
      </p>

      {/* Forgot password link */}
      <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
        <a href="/resetpassword" className="text-[#1C6B1C] hover:text-[#0F3D0F] hover:underline">
          Forgot your password?
        </a>
      </p>
    </div>
  );
}