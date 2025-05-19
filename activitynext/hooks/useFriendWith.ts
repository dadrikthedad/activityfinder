// Her har vi en gjenburkbar hook som kan brukes for å sjekke om vi er venn med brukeren vi besøker
// hooks/useFriendWith.ts
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { isFriendWith } from "@/services/friends/isFriendWith";

export function useFriendWith(userId?: number) {
  const { token } = useAuth();

  const shouldFetch = !!token && typeof userId === "number";

  const { data, error, isValidating } = useSWR(
    shouldFetch ? [`/friends/is-friend-with`, userId] : null,
    () => isFriendWith(userId!, token!),
    {
      // Unngå revalidate ved window.focus kun for denne fetchen:
      revalidateOnFocus: false,
    }
  );

  return {
    isFriend: data ?? null,
    loading: isValidating,
    error,
  };
}