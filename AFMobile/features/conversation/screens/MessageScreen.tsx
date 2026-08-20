import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  TextInput,
  BackHandler,
} from 'react-native';
import { ChevronUp, ChevronDown, Plus, Search, Bell, ArrowBigLeft } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { useChatStore } from '@/store/useChatStore';
import { useConversationStore } from '@/store/useConversationStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import ConversationListNative from '@/features/conversation/components/ConversationListNative';
import { ConversationListItemNative } from '@/features/conversation/components/ConversationListItemNative';
import { PendingRequestsListNative } from '@/features/conversation/components/PendingRequestsListNative';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConversationSearch } from '@/features/conversation/hooks/useSearchConversations';
import { ConversationDTO } from '@shared/types/ConversationDTO';
import {
  isGroupConversation,
  isPendingConversation,
  getOtherParticipant,
} from '@/features/conversation/utils/conversationHelpers';

interface MessagesScreenProps {
  navigation: any;
}

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const currentUser = useCurrentUser();

  const isBootstrapped = useBootstrapStore(state => state.isBootstrapped);
  const { setCurrentConversationId } = useChatStore();

  const unreadNotificationCount = useMessageNotificationStore(
    (state) => state.messageNotifications.filter((n) => !n.isRead).length
  );

  const isPendingCollapsed = useConversationStore(state => state.isPendingCollapsed);
  const setIsPendingCollapsed = useConversationStore(state => state.setIsPendingCollapsed);
  const pending = useConversationStore(state => state.pendingConversations);
  const hasLoadedPending = useConversationStore(state => state.hasLoadedPendingConversations);

  const shouldShowPendingSection = !hasLoadedPending || pending.length > 0;

  const [contentHeight, setContentHeight] = useState(225);
  const [animatedHeight] = useState(new Animated.Value(isPendingCollapsed ? 0 : 1));

  const [isSearchActive, setIsSearchActive] = useState(false);
  const { query, setQuery, results, loading } = useConversationSearch();
  const searchInputRef = useRef<TextInput>(null);
  const contentRef = useRef<View>(null);

  const handleSelectConversation = useCallback((conversationId: number) => {
    if (isSearchActive) {
      setIsSearchActive(false);
      setQuery('');
    }
    setCurrentConversationId(conversationId);
    navigation.navigate('ConversationScreen', { conversationId });
  }, [navigation, setCurrentConversationId, isSearchActive, setQuery]);

  const handleShowMorePending = useCallback(() => {
    navigation.navigate('PendingConversationsScreen');
  }, [navigation]);

  const onContentLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) setContentHeight(height);
  }, []);

  const togglePending = useCallback(() => {
    const newCollapsed = !isPendingCollapsed;
    setIsPendingCollapsed(newCollapsed);
    Animated.timing(animatedHeight, {
      toValue: newCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isPendingCollapsed, setIsPendingCollapsed, animatedHeight]);

  const handleNewMessage = useCallback(() => {
    navigation.navigate('NewMessageScreen');
  }, [navigation]);

  const handleSearchToggle = useCallback(() => {
    if (isSearchActive) {
      setIsSearchActive(false);
      setQuery('');
    } else {
      setIsSearchActive(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchActive, setQuery]);

  const handleNotifications = useCallback(() => {
    navigation.navigate('MessageNotificationScreen');
  }, [navigation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearchActive) {
        setIsSearchActive(false);
        setQuery('');
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isSearchActive, setQuery]);

  const renderSearchResult = useCallback(({ item }: { item: ConversationDTO }) => {
    const isPending = isPendingConversation(item);
    if (isGroupConversation(item)) {
      return (
        <ConversationListItemNative
          user={{
            id: String(item.id),
            fullName: item.groupName || t('conversation.unknownGroup'),
            profileImageUrl: item.groupImageUrl || null,
          }}
          selected={false}
          isPendingApproval={isPending}
          hasUnread={false}
          onClick={() => handleSelectConversation(item.id)}
          isGroup={true}
          memberCount={item.participants?.length ?? 0}
          participants={(item.participants ?? []).map((p) => p.user)}
          navigation={navigation}
        />
      );
    }
    const otherParticipant = getOtherParticipant(item, currentUser?.id);
    if (!otherParticipant) return null;
    return (
      <ConversationListItemNative
        user={otherParticipant.user}
        selected={false}
        isPendingApproval={isPending}
        hasUnread={false}
        onClick={() => handleSelectConversation(item.id)}
        isGroup={false}
        navigation={navigation}
      />
    );
  }, [handleSelectConversation, currentUser, navigation, t]);

  if (!isBootstrapped) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.backgroundAlt }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ fontSize: theme.typography.md, color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
            {t('conversation.initializing')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.backgroundAlt }}>
      <View style={{ flex: 1, position: 'relative' }}>

        {/* Søk-overlay */}
        {isSearchActive && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 80,
            backgroundColor: theme.colors.surface, zIndex: 1000,
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: theme.spacing.md, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}>
              <TouchableOpacity onPress={handleSearchToggle} style={{ marginRight: 12, padding: 8 }}>
                <ArrowBigLeft size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TextInput
                ref={searchInputRef}
                style={{
                  flex: 1, height: 40,
                  backgroundColor: theme.colors.backgroundInput,
                  borderRadius: theme.radii.full,
                  paddingHorizontal: theme.spacing.md,
                  fontSize: theme.typography.md,
                  color: theme.colors.textPrimary,
                }}
                placeholder={t('conversation.listSearchPlaceholder')}
                placeholderTextColor={theme.colors.textPlaceholder}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>

            <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
              {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.md, color: theme.colors.textMuted }}>
                    {t('conversation.searching')}
                  </Text>
                </View>
              ) : query.trim() === '' ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: theme.typography.md, color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('conversation.listSearchWriteHint')}
                  </Text>
                </View>
              ) : results.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: theme.typography.md, color: theme.colors.textMuted, textAlign: 'center' }}>
                    {t('conversation.listSearchNoResults')}
                  </Text>
                </View>
              ) : (
                <FlashList
                  data={results}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderSearchResult}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        )}

        {/* Hovedinnhold */}
        {!isSearchActive && (
          <>
            {shouldShowPendingSection && (
              <View style={{
                backgroundColor: theme.colors.surface,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
                elevation: 2,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}>
                {/* Skjult kopi for høydemåling */}
                <View
                  ref={contentRef}
                  style={{ padding: theme.spacing.md, position: 'absolute', opacity: 0, zIndex: -1 }}
                  onLayout={onContentLayout}
                >
                  <PendingRequestsListNative
                    limit={2}
                    showMoreLink={true}
                    onSelectConversation={handleSelectConversation}
                    onShowMore={handleShowMorePending}
                    navigation={navigation}
                  />
                </View>

                <Animated.View style={{
                  overflow: 'hidden',
                  height: animatedHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, contentHeight],
                  }),
                }}>
                  <View style={{ padding: theme.spacing.md }}>
                    <PendingRequestsListNative
                      limit={2}
                      showMoreLink={true}
                      onSelectConversation={handleSelectConversation}
                      onShowMore={handleShowMorePending}
                      navigation={navigation}
                    />
                  </View>
                </Animated.View>

                <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <TouchableOpacity
                    onPress={togglePending}
                    style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 4 }}
                  >
                    <View style={{ width: 32, height: 4, backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm }} />
                    {isPendingCollapsed
                      ? <ChevronDown size={16} color={theme.colors.textMuted} />
                      : <ChevronUp size={16} color={theme.colors.textMuted} />
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
              <ConversationListNative
                selectedId={null}
                onSelect={handleSelectConversation}
                currentUser={currentUser}
                navigation={navigation}
              />
            </View>
          </>
        )}

        {/* Footer */}
        <View style={{
          backgroundColor: theme.colors.navbar,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 6,
          paddingHorizontal: theme.spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        }}>
          <TouchableOpacity onPress={handleSearchToggle} style={{ padding: 12, borderRadius: theme.radii.md }}>
            <Search size={24} color={theme.colors.navbarText} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNotifications}
            style={{ padding: 12, borderRadius: theme.radii.md, position: 'relative' }}
          >
            <Bell size={24} color={theme.colors.navbarText} />
            {unreadNotificationCount > 0 && (
              <View style={{
                position: 'absolute', top: 6, right: 6,
                backgroundColor: theme.colors.textMuted,
                borderRadius: theme.radii.full,
                minWidth: 20, height: 20,
                justifyContent: 'center', alignItems: 'center',
                paddingHorizontal: 6,
                borderWidth: 2, borderColor: theme.colors.navbar,
              }}>
                <Text style={{
                  color: theme.colors.navbarText,
                  fontSize: theme.typography.xs,
                  fontWeight: theme.typography.bold,
                  textAlign: 'center',
                }}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNewMessage} style={{ padding: 12, borderRadius: theme.radii.md }}>
            <Plus size={24} color={theme.colors.navbarText} />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
