import { useTranslation } from "react-i18next";
import { useConversationStore } from "@/store/useConversationStore";
import { useChatStore } from "@/store/useChatStore";
import { useCurrentUser } from "@/store/useUserCacheStore";
import {
  isGroupConversation,
  isPendingConversation,
  getOtherParticipant,
} from "@/features/conversation/utils/conversationHelpers";

export function useConversationHeader(conversationId: number) {
  const { t } = useTranslation();
  const currentUser = useCurrentUser();

  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === conversationId) ??
    s.pendingConversations.find((c) => c.id === conversationId)
  );

  const pendingConversations = useConversationStore((s) => s.pendingConversations);
  const pendingLockedId = useChatStore((s) => s.pendingLockedConversationId);

  const title = (() => {
    if (!conversation) return t("conversation.pendingConversation");
    if (isGroupConversation(conversation)) return conversation.groupName || t("conversation.unknownGroup");
    const other = getOtherParticipant(conversation, currentUser?.id);
    return other?.user.fullName || t("conversation.unknownUser");
  })();

  const subtitle =
    conversation && isGroupConversation(conversation)
      ? t("conversation.memberCount", { count: conversation.participants?.length ?? 0 })
      : "";

  const showPendingWarning =
    !!conversation && isPendingConversation(conversation) && conversationId !== pendingLockedId;

  const showLockedWarning =
    pendingConversations.some((c) => c.id === conversationId) &&
    conversationId === pendingLockedId;

  return { title, subtitle, showPendingWarning, showLockedWarning, conversation };
}
