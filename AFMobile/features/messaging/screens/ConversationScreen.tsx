import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  BackHandler,
} from "react-native";
import { ArrowBigLeft, ArrowBigDown, Settings, Search, X } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/store/useChatStore";
import { useConversationStore } from "@/store/useConversationStore";
import { MessageDTO } from "@shared/types/MessageDTO";
import { clearDraftFor } from "@/utils/draft/draft";
import { useSendMessage } from "@/features/messaging/hooks/useSendMessage";
import { useConversationHeader } from "@/features/conversation/hooks/useConversationHeader";
import { isGroupConversation } from "@/features/conversation/utils/conversationHelpers";
import MessageListNative from "@/features/messaging/components/MessageListNative";
import MessageInputNative from "@/features/messaging/components/MessageInputNative";
import { MessageSettingsModalNative } from "@/features/messaging/components/MessageSettingsModalNative";
import { ConversationScreenNavigationProp, ConversationScreenRouteProp } from "@/types/navigation";
import { useSearchMessages } from "@/features/messaging/hooks/useSearchMessages";
import { useModal } from "@/context/ModalContext";
import { backgroundDecryptionManager } from "@/features/cryptoAttachments/BackgroundDecrypt/BackgroundDecryptionManager";
import { useCurrentUser } from "@/store/useUserCacheStore";

interface MessageListRef {
  scrollToBottom: () => void;
}

interface ConversationScreenProps {
  navigation: ConversationScreenNavigationProp;
  route: ConversationScreenRouteProp;
}

export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { conversationId, fromNewMessage = false } = route.params;
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const currentUser = useCurrentUser();

  const { title, subtitle, showPendingWarning, showLockedWarning, conversation } =
    useConversationHeader(conversationId);

  const { searchMode, setSearchMode, searchResults } = useChatStore();
  const setCurrentConversationId = useChatStore(
    useCallback((s) => s.setCurrentConversationId, [])
  );

  const { isModalOpen } = useModal();

  const [conversationError, setConversationError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { loading, error, search, resetSearch } = useSearchMessages();
  const messageListRef = useRef<MessageListRef>(null);
  const { send } = useSendMessage();

  const hasConversationError = conversationError !== null;

  // Sett aktiv samtale ved mount, rydd opp ved unmount
  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    }

    return () => {
      const state = useChatStore.getState();

      if (conversationId) {
        state.convertOptimisticToReal(conversationId);

        setTimeout(() => {
          const updated = useChatStore.getState();
          const live = updated.liveMessages[conversationId] ?? [];
          const cached = updated.cachedMessages[conversationId] ?? [];
          const combined = [
            ...cached,
            ...live.filter((m) => !cached.some((c) => c.id === m.id)),
          ];
          updated.setCachedMessages(conversationId, combined);
          updated.clearLiveMessages(conversationId);
          updated.cleanupOptimisticForConversation(conversationId);
        }, 0);
      }

      setCurrentConversationId(null);
      state.setPendingLockedConversationId(null);
    };
  }, [conversationId, setCurrentConversationId]);

  // Oppdater pending-lås basert på pending-listen
  useEffect(() => {
    if (!conversationId) return;
    const state = useChatStore.getState();
    const isPending = useConversationStore.getState().pendingConversations.some(
      (c) => c.id === conversationId
    );
    if (isPending) {
      state.setPendingLockedConversationId(conversationId);
    } else if (state.pendingLockedConversationId === conversationId) {
      state.setPendingLockedConversationId(null);
    }
  }, [conversationId]);

  // Start bakgrunnsdekryptering av vedlegg
  useEffect(() => {
    if (!conversationId || !currentUser?.id || !conversation) return;

    backgroundDecryptionManager.setCurrentUser(currentUser.id);

    const chatState = useChatStore.getState();
    const allMessages = [
      ...(chatState.cachedMessages[conversationId] ?? []),
      ...(chatState.liveMessages[conversationId] ?? []),
    ].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    const attachmentsToDecrypt = allMessages
      .flatMap((m) => m.attachments ?? [])
      .filter((a) => a.needsDecryption);

    if (attachmentsToDecrypt.length > 0) {
      backgroundDecryptionManager.addConversationAttachments(
        attachmentsToDecrypt,
        conversationId,
        "low",
        false
      );
    }
  }, [conversationId, currentUser?.id, conversation]);

  // Nullstill kladd ved samtalefeil
  useEffect(() => {
    if (hasConversationError && conversationId) {
      clearDraftFor(conversationId);
    }
  }, [hasConversationError, conversationId]);

  // Debounce søkeord
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Utfør søk når debounced-spørring endres
  useEffect(() => {
    if (!conversationId || !searchMode) return;
    if (debouncedQuery.length >= 2) {
      search(conversationId, debouncedQuery);
    } else {
      resetSearch();
    }
  }, [conversationId, debouncedQuery, searchMode]);

  const handleReply = useCallback((message: MessageDTO) => {
    setReplyingTo(message);
  }, []);

  const handleRetryMessage = useCallback(
    async (failedMessage: MessageDTO) => {
      if (!failedMessage.optimisticId || !conversationId) return;

      useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
        ...failedMessage,
        isSending: true,
        sendError: null,
      });

      const result = await send({
        text: failedMessage.text || undefined,
        files: undefined,
        conversationId,
        receiverId: undefined,
        parentMessageId: failedMessage.parentMessageId,
      });

      if (!result) {
        useChatStore.getState().updateMessage(conversationId, failedMessage.id, {
          ...failedMessage,
          isSending: false,
          sendError: "Retry failed - please try again",
        });
      }
    },
    [send, conversationId]
  );

  const handleDeleteFailedMessage = useCallback(
    (failedMessage: MessageDTO) => {
      if (!conversationId) return;
      useChatStore.setState((state) => ({
        liveMessages: {
          ...state.liveMessages,
          [conversationId]: (state.liveMessages[conversationId] ?? []).filter(
            (m) => m.id !== failedMessage.id
          ),
        },
      }));
    },
    [conversationId]
  );

  const handleScrollToBottom = useCallback(() => {
    messageListRef.current?.scrollToBottom();
  }, []);

  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettings = useCallback(() => setShowSettingsModal(false), []);

  const handleCloseSearch = useCallback(() => {
    setSearchMode(false);
    setSearchQuery("");
    resetSearch();
    Keyboard.dismiss();
  }, [setSearchMode, resetSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    resetSearch();
  }, [resetSearch]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      const state = navigation.getState();
      if (state.routes[state.index].name !== "ConversationScreen") {
        navigation.goBack();
        return;
      }
    }

    if (isModalOpen) return;

    if (searchMode) {
      handleCloseSearch();
      return;
    }

    if (showSettingsModal) {
      setShowSettingsModal(false);
      return;
    }

    if (fromNewMessage) {
      navigation.reset({ index: 0, routes: [{ name: "MessagesScreen" }] });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: "MessagesScreen" }] });
    }
  }, [
    navigation,
    isModalOpen,
    searchMode,
    showSettingsModal,
    handleCloseSearch,
    fromNewMessage,
  ]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleBack]);

  if (!conversationId) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}
      >
        <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />
        <Text style={{ color: theme.colors.textMuted }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar backgroundColor={theme.colors.navbar} barStyle="light-content" />

      {/* Header */}
      <View
        style={{
          backgroundColor: theme.colors.navbar,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.onPrimary,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            paddingBottom: 6,
            gap: theme.spacing.md,
          }}
        >
          <TouchableOpacity
            onPress={searchMode ? handleCloseSearch : handleBack}
            style={{ padding: theme.spacing.sm, marginLeft: -theme.spacing.sm, borderRadius: theme.radii.sm }}
          >
            {searchMode ? (
              <X size={24} color={theme.colors.onPrimary} />
            ) : (
              <ArrowBigLeft size={24} color={theme.colors.onPrimary} />
            )}
          </TouchableOpacity>

          {searchMode ? (
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: theme.radii.full,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 6,
                marginHorizontal: theme.spacing.sm,
              }}
            >
              <Search size={20} color="rgba(255,255,255,0.7)" style={{ marginRight: theme.spacing.sm }} />
              <TextInput
                style={{ flex: 1, fontSize: theme.typography.md, color: theme.colors.onPrimary, paddingVertical: 0 }}
                placeholder={t("conversation.searchPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} style={{ padding: 4, marginLeft: 4 }}>
                  <X size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[
                  { fontSize: theme.typography.lg, fontWeight: "600", color: theme.colors.onPrimary },
                  !(conversation && isGroupConversation(conversation)) && { marginBottom: 2 },
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {conversation && isGroupConversation(conversation) && (
                <Text style={{ fontSize: theme.typography.sm, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}

          {!searchMode && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              {!atBottom && (
                <TouchableOpacity
                  style={{ padding: theme.spacing.sm, borderRadius: theme.radii.sm, backgroundColor: theme.colors.navbar }}
                  onPress={handleScrollToBottom}
                >
                  <ArrowBigDown size={20} color={theme.colors.onPrimary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ padding: theme.spacing.sm, borderRadius: theme.radii.sm, backgroundColor: theme.colors.navbar }}
                onPress={handleOpenSettings}
              >
                <Settings size={20} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Søkeresultat-header */}
      {searchMode && debouncedQuery.length >= 2 && (
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.backgroundAlt,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textMuted, fontWeight: "500" }}>
            {loading
              ? t("conversation.searching")
              : t("conversation.searchResultCount", { count: searchResults.length }) +
                (debouncedQuery ? t("conversation.searchResultFor", { query: debouncedQuery }) : "")}
          </Text>
        </View>
      )}

      {/* Søkefeil */}
      {searchMode && error && (
        <View
          style={{
            padding: theme.spacing.md,
            alignItems: "center",
            backgroundColor: "#FEF2F2",
            borderBottomWidth: 1,
            borderBottomColor: "#FECACA",
          }}
        >
          <Text style={{ fontSize: theme.typography.sm, color: theme.colors.error, textAlign: "center" }}>
            {error}
          </Text>
        </View>
      )}

      {/* Advarselsbannere */}
      {!searchMode && (
        <>
          {showPendingWarning && (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderBottomWidth: 1,
                borderBottomColor: "#F59E0B",
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <Text style={{ fontSize: theme.typography.xs, color: "#92400E", textAlign: "center" }}>
                {t("conversation.pendingWarning")}
              </Text>
            </View>
          )}

          {showLockedWarning && (
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderBottomWidth: 1,
                borderBottomColor: "#F59E0B",
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <Text style={{ fontSize: theme.typography.xs, color: "#92400E", textAlign: "center" }}>
                {t("conversation.lockedWarning")}
              </Text>
            </View>
          )}
        </>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Søkeveiledning */}
        {searchMode && debouncedQuery.length < 2 && !loading && (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: theme.spacing.xl,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Search size={48} color={theme.colors.textMuted} />
            <Text
              style={{
                fontSize: theme.typography.xl,
                fontWeight: "600",
                color: theme.colors.textPrimary,
                marginTop: theme.spacing.md,
                marginBottom: theme.spacing.sm,
              }}
            >
              {t("conversation.searchTitle")}
            </Text>
            <Text
              style={{
                fontSize: theme.typography.md,
                color: theme.colors.textMuted,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {t("conversation.searchHint")}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <MessageListNative
            ref={messageListRef}
            key={`${conversationId}-${searchMode ? "search" : "normal"}`}
            currentUser={currentUser}
            conversationVisible={!searchMode}
            onScrollPositionChange={setAtBottom}
            onReply={handleReply}
            onConversationError={setConversationError}
            onRetryMessage={handleRetryMessage}
            onDeleteFailedMessage={handleDeleteFailedMessage}
            conversationParticipants={(conversation?.participants ?? []).map((p) => p.user)}
            isSearchMode={searchMode}
            searchQuery={debouncedQuery}
            searchLoading={loading}
          />
        </View>

        {!searchMode && (
          <View
            style={{
              backgroundColor: theme.colors.navbar,
              borderTopWidth: 1,
              borderTopColor: theme.colors.onPrimary,
              paddingBottom: 14,
            }}
          >
            <MessageInputNative
              receiverId={undefined}
              onMessageSent={() => setReplyingTo(null)}
              atBottom={atBottom}
              replyingTo={replyingTo}
              onClearReply={() => setReplyingTo(null)}
              isDisabled={hasConversationError}
              hideToolbar={hasConversationError}
              conversationError={conversationError}
              autoFocus={false}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {!searchMode && (
        <MessageSettingsModalNative
          visible={showSettingsModal}
          onClose={handleCloseSettings}
          navigation={navigation}
        />
      )}
    </SafeAreaView>
  );
}
