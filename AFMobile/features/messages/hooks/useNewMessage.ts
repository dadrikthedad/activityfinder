// features/messages/hooks/useNewMessage.ts
// ViewModel for NewMessageScreen. Holder valgt(e) mottaker(e), gruppe-felter og
// håndterer innsending (E2EE-kryptert) for både 1-til-1 og gruppe.

import { useCallback, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { RNFile } from "@/utils/files/FileFunctions";
import { RootStackNavigationProp } from "@/types/navigation";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { ConversationDTO } from "@shared/types/ConversationDTO";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { refreshConversationFromBackend } from "@/utils/messages/refreshConversationFromBackend";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";
import { sendMessageToUser } from "../services/newMessageService";
import { createGroupConversation, sendGroupInitialMessage } from "../services/groupConversationService";

interface UseNewMessageOptions {
  initialReceiver?: UserSearchResultDTO;
}

export function useNewMessage({ initialReceiver }: UseNewMessageOptions) {
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);

  const isPresetMode = !!initialReceiver;

  const [selectedUsers, setSelectedUsers] = useState<UserSearchResultDTO[]>(
    initialReceiver ? [initialReceiver] : [],
  );
  const [groupName, setGroupName] = useState("");
  const [groupImage, setGroupImage] = useState<RNFile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGroupMode = selectedUsers.length > 1 && !isPresetMode;

  const addUser = useCallback(
    (user: UserSearchResultDTO) => {
      setSelectedUsers((prev) =>
        prev.some((u) => u.id === user.id) ? prev : [...prev, user],
      );
    },
    [],
  );

  const removeUser = useCallback(
    (userId: string) => {
      if (isPresetMode && userId === initialReceiver?.id) return;
      setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
    },
    [isPresetMode, initialReceiver],
  );

  const showError = useCallback(
    (body: string) => {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemError,
        customTitle: t("newMessage.errorTitle"),
        customBody: body,
        position: "top",
      });
    },
    [t],
  );

  const messageForCode = useCallback(
    (code: MessagingErrorCode, fallback: string): string => {
      switch (code) {
        case MessagingErrorCode.RecipientNotFound:
          return t("newMessage.errorRecipientNotFound");
        case MessagingErrorCode.Blocked:
          return t("newMessage.errorBlocked");
        case MessagingErrorCode.AlreadyInGroup:
          return t("newMessage.errorAlreadyInGroup");
        case MessagingErrorCode.EncryptionFailed:
          return t("newMessage.errorEncryption");
        case MessagingErrorCode.RateLimited:
          return t("newMessage.errorRateLimited");
        case MessagingErrorCode.NetworkError:
          return t("newMessage.errorNetwork");
        default:
          return fallback;
      }
    },
    [t],
  );

  const goToConversation = useCallback(
    async (conversationId: number, conversation?: ConversationDTO) => {
      // 1-til-1: backend sender hele samtalen i responsen — legg den rett i listen.
      // Gruppe (ingen conversation): fall tilbake til å hente friskt fra backend.
      if (conversation) {
        useConversationStore.getState().addConversation(conversation);
      } else {
        await refreshConversationFromBackend(conversationId, "📨");
      }
      setCurrentConversationId(conversationId);
      navigation.navigate("ConversationScreen", { conversationId, fromNewMessage: true });
    },
    [navigation, setCurrentConversationId],
  );

  const submitDirect = useCallback(
    async (text: string) => {
      const receiver = selectedUsers[0];
      const result = await sendMessageToUser(receiver.id, text);
      if (!result.success) {
        showError(messageForCode(result.code, result.error));
        return;
      }
      await goToConversation(result.data.conversationId, result.data.conversation);
    },
    [selectedUsers, showError, messageForCode, goToConversation],
  );

  const submitGroup = useCallback(
    async (text: string) => {
      const result = await createGroupConversation({
        receiverIds: selectedUsers.map((u) => u.id),
        groupName: groupName.trim(),
        groupImage: groupImage ?? undefined,
      });
      if (!result.success) {
        showError(messageForCode(result.code, result.error));
        return;
      }

      const { conversationId } = result.data;

      // Valgfri førstemelding — best-effort, gruppen er allerede opprettet
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        const messageResult = await sendGroupInitialMessage(conversationId, trimmed);
        if (!messageResult.success) {
          showNotificationToastNative({
            type: LocalToastType.CustomSystemNotice,
            customTitle: t("newMessage.groupCreatedTitle"),
            customBody: t("newMessage.groupCreatedMessageFailed"),
            position: "top",
          });
        }
      }

      await goToConversation(conversationId);
    },
    [selectedUsers, groupName, groupImage, showError, messageForCode, goToConversation, t],
  );

  const submit = useCallback(
    async (text: string) => {
      if (selectedUsers.length === 0 || isSubmitting) return;

      const trimmed = text.trim();

      if (isGroupMode) {
        if (groupName.trim().length === 0) {
          showError(t("newMessage.validationGroupNameRequired"));
          return;
        }
      } else if (trimmed.length === 0) {
        showError(t("newMessage.validationMessageRequired"));
        return;
      }

      setIsSubmitting(true);
      try {
        if (isGroupMode) {
          await submitGroup(trimmed);
        } else {
          await submitDirect(trimmed);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedUsers, isSubmitting, isGroupMode, groupName, showError, t, submitGroup, submitDirect],
  );

  return useMemo(
    () => ({
      selectedUsers,
      groupName,
      setGroupName,
      groupImage,
      setGroupImage,
      isPresetMode,
      isGroupMode,
      isSubmitting,
      addUser,
      removeUser,
      submit,
    }),
    [
      selectedUsers,
      groupName,
      groupImage,
      isPresetMode,
      isGroupMode,
      isSubmitting,
      addUser,
      removeUser,
      submit,
    ],
  );
}
