// screens/MessagesScreen.tsx
import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator,
  TextInput,
  FlatList,
  BackHandler
} from 'react-native';
import { ChevronUp, ChevronDown, Plus, Search, Bell, ArrowBigLeft } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { useChatStore } from '@/store/useChatStore';
import ConversationListNative from '@/components/messages/ConversationListNative';
import { ConversationListItemNative } from '@/components/messages/ConversationListItemNative';
import { PendingRequestsListNative } from '@/components/messages/PendingRequestsListNative';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useConversationSearch } from '@/hooks/messages/useSearchConversations';
import { ConversationDTO } from '@shared/types/ConversationDTO';

interface MessagesScreenProps {
  navigation: any;
}

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const { isLoggedIn } = useAuth();
  const currentUser = useCurrentUser();

  const isBootstrapped = useBootstrapStore(state => state.isBootstrapped);

  const { setCurrentConversationId } = useChatStore();
  
  // Pending collapse state - from store
  const isPendingCollapsed = useChatStore(state => state.isPendingCollapsed);
  const setIsPendingCollapsed = useChatStore(state => state.setIsPendingCollapsed);
 
  // Chat store state
  const pending = useChatStore(state => state.pendingMessageRequests);
  const hasLoadedPending = useChatStore(state => state.hasLoadedPendingRequests);
 
  const shouldShowPendingSection = !hasLoadedPending || pending.length > 0;
  
  // For dynamisk høyde basert på innhold
  const [contentHeight, setContentHeight] = useState(225);
  const [animatedHeight] = useState(new Animated.Value(isPendingCollapsed ? 0 : 1));
  
  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const { query, setQuery, results, loading } = useConversationSearch();
  const searchInputRef = useRef<TextInput>(null);
  
  // Referanse til innholdet for å måle høyde
  const contentRef = useRef<View>(null);

  // Handle conversation selection - navigate to individual conversation
  const handleSelectConversation = useCallback((conversationId: number) => {
    console.log('🎯 MessagesScreen: Setting conversation ID before navigation:', conversationId);
    
    // Lukk søk hvis aktivt
    if (isSearchActive) {
      setIsSearchActive(false);
      setQuery('');
    }
    
    // Sett conversation ID umiddelbart
    setCurrentConversationId(conversationId);
    
    // Deretter naviger
    navigation.navigate('ConversationScreen', { conversationId });
  }, [navigation, setCurrentConversationId, isSearchActive, setQuery]);

  // Callback for å måle innholdets høyde
  const onContentLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setContentHeight(height);
    }
  }, []);

  // Toggle pending section with animation
  const togglePending = useCallback(() => {
    const newCollapsed = !isPendingCollapsed;
    setIsPendingCollapsed(newCollapsed);
    
    Animated.timing(animatedHeight, {
      toValue: newCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isPendingCollapsed, setIsPendingCollapsed, animatedHeight]);

  // Navigate to new message
  const handleNewMessage = useCallback(() => {
    navigation.navigate('NewConversationScreen');
  }, [navigation]);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    if (isSearchActive) {
      setIsSearchActive(false);
      setQuery('');
    } else {
      setIsSearchActive(true);
      // Focus på input etter en kort delay for animasjon
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchActive, setQuery]);

  // Handle bell/notifications
  const handleNotifications = useCallback(() => {
    navigation.navigate('MessageNotificationScreen');
  }, [navigation]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearchActive) {
        // Hvis søk er aktivt, lukk søket i stedet for å gå tilbake
        setIsSearchActive(false);
        setQuery('');
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    });

    return () => backHandler.remove();
  }, [isSearchActive, setQuery]);

  // Render search result item using ConversationListItemNative
  const renderSearchResult = useCallback(({ item }: { item: ConversationDTO }) => {
    const isGroup = item.isGroup;
    
    if (isGroup) {
      // For group conversations
      return (
        <ConversationListItemNative
          user={{
            id: item.id,
            fullName: item.groupName || "Navnløs gruppe",
            profileImageUrl: item.groupImageUrl || null,
          }}
          selected={false}
          isPendingApproval={item.isPendingApproval}
          hasUnread={false} // Vi har ikke unread info i søkeresultater
          onClick={() => handleSelectConversation(item.id)}
          isGroup={true}
          memberCount={item.participants.length}
          participants={item.participants}
          navigation={navigation}
        />
      );
    } else {
      // For private conversations - find the other user
      const otherUser = item.participants.find(p => p.id !== currentUser?.id);
      
      if (!otherUser) return null;
      
      return (
        <ConversationListItemNative
          user={otherUser}
          selected={false}
          isPendingApproval={item.isPendingApproval}
          hasUnread={false} // Vi har ikke unread info i søkeresultater
          onClick={() => handleSelectConversation(item.id)}
          isGroup={false}
          navigation={navigation}
        />
      );
    }
  }, [handleSelectConversation, currentUser, navigation]);

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>Logg inn for å se meldinger</Text>
          <Text style={styles.loginSubtitle}>
            Du må være innlogget för å få tilgang til meldingssystemet.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginButton}
          >
            <Text style={styles.loginButtonText}>Logg inn</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isBootstrapped) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#1C6B1C" />
          <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 8 }}>
            Initializing...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Search Overlay */}
        {isSearchActive && (
          <View style={styles.searchOverlay}>
            <View style={styles.searchHeader}>
              <TouchableOpacity
                onPress={handleSearchToggle}
                style={styles.searchBackButton}
              >
                <ArrowBigLeft size={24} color="#1C6B1C" />
              </TouchableOpacity>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Søk i samtaler..."
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
            
            {/* Search Results */}
            <View style={styles.searchResults}>
              {loading ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color="#1C6B1C" />
                  <Text style={styles.searchLoadingText}>Søker...</Text>
                </View>
              ) : query.trim() === '' ? (
                <View style={styles.searchEmpty}>
                  <Text style={styles.searchEmptyText}>Skriv for å søke i samtaler</Text>
                </View>
              ) : results.length === 0 ? (
                <View style={styles.searchEmpty}>
                  <Text style={styles.searchEmptyText}>Ingen samtaler funnet</Text>
                </View>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderSearchResult}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        )}

        {/* Main Content - Only visible when search is not active */}
        {!isSearchActive && (
          <>
            {/* Pending Requests Section - Collapsible */}
            {shouldShowPendingSection && (
              <View style={styles.pendingSection}>
                {/* Skjult kopi av innholdet for å måle høyde */}
                <View 
                  style={[styles.pendingInner, styles.hiddenMeasurement]}
                  onLayout={onContentLayout}
                >
                  <PendingRequestsListNative
                    limit={2}
                    showMoreLink={true}
                    onSelectConversation={handleSelectConversation}
                  />
                </View>
                
                {/* Synlig animert innhold */}
                <Animated.View 
                  style={[
                    styles.pendingContent, 
                    { 
                      height: animatedHeight.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, contentHeight],
                      }),
                    }
                  ]}
                >
                  <View style={styles.pendingInner}>
                    <PendingRequestsListNative
                      limit={2}
                      showMoreLink={true}
                      onSelectConversation={handleSelectConversation}
                    />
                  </View>
                </Animated.View>
                
                {/* Toggle Button */}
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    onPress={togglePending}
                    style={styles.toggleButton}
                  >
                    <View style={styles.dragHandle} />
                    {isPendingCollapsed ? (
                      <ChevronDown size={16} color="#6B7280" />
                    ) : (
                      <ChevronUp size={16} color="#6B7280" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ConversationList - Takes remaining space */}
            <View style={styles.conversationContainer}>
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
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleSearchToggle}
            style={styles.footerButton}
          >
            <Search size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNotifications}
            style={styles.footerButton}
          >
            <Bell size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNewMessage}
            style={styles.footerButtonPrimary}
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F9FAFB',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  pendingSection: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pendingContent: {
    overflow: 'hidden',
  },
  pendingInner: {
    padding: 16,
  },
  hiddenMeasurement: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  toggleContainer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  toggleButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  dragHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1C6B1C',
    borderRadius: 2,
  },
  conversationContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  footer: {
    backgroundColor: '#1C6B1C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  footerButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  footerButtonPrimary: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1C6B1C',
  },
  // Search overlay styles
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 80, // Leave space for footer
    backgroundColor: 'white',
    zIndex: 1000,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  searchBackButton: {
    marginRight: 12,
    padding: 8,
  },
  searchResults: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  searchLoadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
  },
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  searchEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  searchResultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  searchResultTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});