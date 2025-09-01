import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";
import { User } from "@shared/types/UserDTO";
import authServiceNative from "@/services/user/authServiceNative";

export function useFullCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await authServiceNative.getAccessToken();
        if (!token) {
          setError("No authentication token available");
          return;
        }

        const data = await fetchWithAuth<User>(`${API_BASE_URL}/api/user/me`, {}, token);
        console.log("✅ Full current user fetched:", data);
        setUser(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error) {
          console.error("❌ Error fetching full current user:", err.message);
          setError(err.message);
        } else {
          setError("Unknown error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []); // Tom dependency array siden vi ikke er avhengige av props

  return { user, loading, error };
}