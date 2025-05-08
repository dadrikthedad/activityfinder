// Her henter vi 15 notificaitons til navbaren ved å bruke en fetch til backend
import useSWR from "swr";
import { NotificationDTO } from "@/types/NotificationEventDTO";
import { useAuth } from "@/context/AuthContext";
import { getNavbarNotifications } from "@/services/notifications/getNavbarNotifications";

export function useGetNavbarNotifications() {
  const { token } = useAuth();

  const fetcher = async (): Promise<NotificationDTO[]> => {
    if (!token) return [];
    return await getNavbarNotifications(token);
  };

  const { data, error, isLoading, mutate } = useSWR(
    token ? "/notifications/navbar" : null, // null = ikke kjør før token er klart
    fetcher,
    {
      revalidateOnFocus: false, // henter ny data når bruker bytter tilbake til tab
    }
  );

  return {
    notifications: data ?? [],
    loading: isLoading,
    error,
    setNotifications: mutate, // oppdater data manuelt
    refetch: mutate, // alias
  };
}