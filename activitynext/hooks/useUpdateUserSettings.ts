// Denne hooken endrer brukerinnstillingene fra /profilesettings, bruker updateUserSettings fra services/settings.ts til å gjøre et API-kall med endringer sendt fra siden.
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateUserSettings } from "@/services/settings";
import { UserSettingsDTO } from "@shared/types/UserSettingsDTO";

export function useUpdateUserSettings() { 
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateSettings = async (values: Partial<UserSettingsDTO>) => { // Funksjon for å oppdatere usersettings til backend
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUserSettings(values, token); // her er API kallet itl backend som hetner da tilhørende patch til hvilket felt det er som blir oppdatert
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    updateSettings,
    loading,
    error,
    success,
  };
}
