// features/dev/hooks/useDevLogin.ts
// ViewModel for DevUserListScreen (kun Development).
// Laster brukere ved mount og logger inn som valgt bruker.

import { useState, useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { RootStackNavigationProp } from "@/types/navigation";
import { getDevUsers, devLoginAsUser } from "@/features/dev/services/devService";
import { DevUserDTO } from "@/features/dev/models/DevUserDTO";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";

export interface UseDevLoginReturn {
  users: DevUserDTO[];
  isLoading: boolean;
  loggingInUserId: string | null;
  errorMessage: string | null;
  reload: () => Promise<void>;
  handleSelectUser: (user: DevUserDTO) => Promise<void>;
}

export const useDevLogin = (): UseDevLoginReturn => {
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();

  const [users, setUsers] = useState<DevUserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loggingInUserId, setLoggingInUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await getDevUsers();
    if (result.success) {
      setUsers(result.data);
    } else {
      setErrorMessage(t("dev.loadFailed"));
    }

    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSelectUser = async (user: DevUserDTO) => {
    if (loggingInUserId) return;
    setLoggingInUserId(user.id);

    const result = await devLoginAsUser(user.email);
    if (result.success) {
      // Tokens er lagret i Keychain — E2EESetupScreen kaller login() etter nøkkeloppsett,
      // identisk med vanlig innlogging.
      navigation.navigate("E2EESetupScreen", {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("dev.loginFailed"),
        customBody: result.error,
        position: "top",
      });
    }

    setLoggingInUserId(null);
  };

  return { users, isLoading, loggingInUserId, errorMessage, reload, handleSelectUser };
};
