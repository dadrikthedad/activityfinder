"use client";
import { useState, useEffect } from "react";
import EditableEmailField from "@/components/settings/EditableEmailField";
import EditablePasswordFields from "@/components/settings/EditablePasswordFields";
import FormButton from "@/components/FormButton";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";





export default function SecurityCredsPage() {
  const { user, loading, error } = useCurrentUser();
    const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-white">
        Loading login credentials...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center">
      <div className="max-w-4xl mx-auto mt-12 px-4">
        <h1 className="text-4xl font-bold text-[#1C6B1C]">Change Login Credentials</h1>

        <div className="mt-12 grid grid-cols-1 gap-y-8">
          <EditableEmailField 
          email={email ?? ""}
          onEmailUpdated={(newEmail) => setEmail(newEmail)} />
          <EditablePasswordFields />
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
          <Link href="/profile" passHref>
            <FormButton
              text="Back to Profile"
              type="button"
              fullWidth={false}
              className="text-base font-medium px-10 py-3 min-w-[260px]"
            />
          </Link>
          <Link href="/profilesettings" passHref>
            <FormButton
              text="Go to Profile Settings"
              type="button"
              fullWidth={false}
              className="text-base font-medium px-10 py-3 min-w-[260px]"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
