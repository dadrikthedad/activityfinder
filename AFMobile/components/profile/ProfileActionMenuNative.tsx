import React from "react";
import ActionSheetModalNative from "../common/modal/ActionSheetModalNative";
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative";
import { useBlockUser } from "@/hooks/block/useBlockUser";
import { useUnblockUser } from "@/hooks/block/useUnblockUser";// You'll need to create this hook
import { useIsUserBlocked } from "@/store/useUserCacheStore";
import { showNotificationToastNative } from "../toast/NotificationToastNative";
import { LocalToastType } from "../toast/NotificationToastNative";

interface Props {
  isFriend: boolean;
  userId: number; // ✅ Add userId prop
  onRemoveFriend?: () => void;
}

export default function ProfileActionMenuNative({
  isFriend,
  userId,
  onRemoveFriend
}: Props) {
  const { confirm } = useConfirmModalNative();
  const { blockUser, isLoading: isBlocking } = useBlockUser();
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();
  
  // ✅ Check if user is currently blocked
  const isBlocked = useIsUserBlocked(userId);
  
  // ✅ Fjernet bekreftelse - overlater det til useConfirmRemoveFriend
  const handleRemoveFriend = () => {
    onRemoveFriend?.();
  };

  const handleBlockUser = async () => {
    const confirmed = await confirm({
      title: "Block User",
      message: "Are you sure you want to block this user? They will no longer be able to contact you, and you won't see their content."
    });
   
    if (confirmed) {
      console.log("🚫 Block user confirmed");
      
      const result = await blockUser(userId);
      
      if (result) {
        // ✅ Show success toast instead of modal
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "User Blocked",
          customBody: "User has been blocked successfully! 🚫",
          position: 'top'
        });
      }
    }
  };

  const handleUnblockUser = async () => {
    const confirmed = await confirm({
      title: "Unblock User",
      message: "Are you sure you want to unblock this user? They will be able to contact you again."
    });
   
    if (confirmed) {
      console.log("✅ Unblock user confirmed");
      
      const result = await unblockUser(userId);
      
      if (result) {
        // ✅ Show success toast
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "User Unblocked",
          customBody: "User has been unblocked successfully! ✅",
          position: 'top'
        });
      }
    }
  };

  const handleReportUser = async () => {
    // First confirm they want to report
    const wantToReport = await confirm({
      title: "Report User",
      message: "Do you want to report this user for inappropriate behavior?"
    });
   
    if (wantToReport) {
      // Show reason selection - since we can't easily do multiple options with this modal,
      // we'll ask for the most common reason first
      const isSpam = await confirm({
        title: "Report Reason",
        message: "Is this user sending spam or unwanted messages?"
      });
     
      if (isSpam) {
        submitReport("spam");
      } else {
        const isHarassment = await confirm({
          title: "Report Reason",
          message: "Is this user harassing or bullying you or others?"
        });
       
        if (isHarassment) {
          submitReport("harassment");
        } else {
          const isInappropriate = await confirm({
            title: "Report Reason",
            message: "Is this user posting inappropriate content?"
          });
         
          if (isInappropriate) {
            submitReport("inappropriate");
          } else {
            submitReport("other");
          }
        }
      }
    }
  };

  const submitReport = async (reason: string) => {
    console.log(`🚨 Report user for: ${reason}`);
    // TODO: Implement report functionality
   
    // Show success confirmation with toast
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: "Report Submitted",
      customBody: "Thank you for your report. We will review it shortly! 📝",
      position: 'top'
    });
  };

  // ✅ Create actions array with conditional block/unblock
  const actions = [
    ...(isFriend && onRemoveFriend ? [{
      label: "Remove Friend",
      onPress: handleRemoveFriend,
      variant: "danger" as const
    }] : []),
    {
      label: isBlocked ? "Unblock User" : "Block User",
      onPress: isBlocked ? handleUnblockUser : handleBlockUser,
      variant: "danger" as const,
      loading: isBlocking || isUnblocking
    },
    {
      label: "Report User",
      onPress: handleReportUser,
      variant: "danger" as const
    }
  ];

  return (
    <ActionSheetModalNative
      title="More Options"
      actions={actions}
      trigger={{
        type: "button",
        text: "More Options",
        variant: "primary",
        fullWidth: true
      }}
      blurBackground={false}
    />
  );
}