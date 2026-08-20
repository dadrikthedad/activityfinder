import React from "react";
import { useTranslation } from "react-i18next";
import ActionSheetModalNative from "../common/modal/ActionSheetModalNative";
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative";
import { useBlockUser } from "@/features/blocking/hooks/useBlockUser";
import { useUnblockUser } from "@/features/blocking/hooks/useUnblockUser";
import { BlockingErrorCode } from "@/core/errors/ErrorCode";
import { useIsUserBlockedByGuid } from "@/store/useUserCacheStore";
import { showNotificationToastNative, LocalToastType } from "../toast/NotificationToastNative";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";

interface Props {
  userId: string;
  userName?: string;
}

export default function ProfileActionMenuNative({ userId, userName }: Props) {
  const { t } = useTranslation();
  const { confirm } = useConfirmModalNative();
  const { blockUser, isLoading: isBlocking } = useBlockUser();
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const isBlocked = useIsUserBlockedByGuid(userId);

  const handleBlockUser = async () => {
    const confirmed = await confirm({
      title: t("profile.blockConfirmTitle"),
      message: t("profile.blockConfirmMessage"),
    });
    if (!confirmed) return;

    const result = await blockUser(userId, { fullName: userName ?? userId });
    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.blockedTitle"),
        customBody: t("profile.blockedBody"),
        position: "top",
      });
    } else if (result.code === BlockingErrorCode.AlreadyBlocked) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.blockErrorTitle"),
        customBody: t("profile.alreadyBlockedBody"),
        position: "top",
      });
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.blockErrorTitle"),
        customBody: result.error,
        position: "top",
      });
    }
  };

  const handleUnblockUser = async () => {
    const confirmed = await confirm({
      title: t("profile.unblockConfirmTitle"),
      message: t("profile.unblockConfirmMessage"),
    });
    if (!confirmed) return;

    const result = await unblockUser(userId);
    if (result.success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.unblockedTitle"),
        customBody: t("profile.unblockedBody"),
        position: "top",
      });
    } else if (result.code === BlockingErrorCode.AlreadyBlocked) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.unblockErrorTitle"),
        customBody: t("profile.notBlockedBody"),
        position: "top",
      });
    } else {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: t("profile.unblockErrorTitle"),
        customBody: result.error,
        position: "top",
      });
    }
  };

  const handleReportUser = () => {
    navigation.navigate("ReportUserScreen", {
      reportedUserId: userId,
      reportedUserName: userName,
    });
  };

  const actions = [
    {
      label: isBlocked ? t("profile.unblockUser") : t("profile.blockUser"),
      onPress: isBlocked ? handleUnblockUser : handleBlockUser,
      variant: "muted" as const,
      loading: isBlocking || isUnblocking,
    },
    {
      label: t("profile.reportUser"),
      onPress: handleReportUser,
      variant: "muted" as const,
    },
  ];

  return (
    <ActionSheetModalNative
      title={t("profile.moreOptions")}
      actions={actions}
      trigger={{
        type: "button",
        text: t("profile.moreOptions"),
        variant: "primary",
        fullWidth: true,
      }}
      blurBackground={false}
    />
  );
}
