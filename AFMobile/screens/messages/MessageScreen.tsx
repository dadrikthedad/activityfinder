// screens/MessagesScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator
} from 'react-native';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/store/useUserCacheStore';
import { useChatStore } from '@/store/useChatStore';
import ConversationListNative from '@/components/messages/ConversationListNative';
import { PendingRequestsListNative } from '@/components/messages/PendingRequestsListNative';
import { useBootstrapStore } from '@/store/useBootstrapStore';

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
  
  // Animation for collapse
  const [animatedHeight] = useState(new Animated.Value(isPendingCollapsed ? 0 : 200));

  // Handle conversation selection - navigate to individual conversation
  const handleSelectConversation = useCallback((conversationId: number) => {
    console.log('🎯 MessagesScreen: Setting conversation ID before navigation:', conversationId);
    
    // Sett conversation ID umiddelbart
    setCurrentConversationId(conversationId);
    
    // Deretter naviger
    navigation.navigate('ConversationScreen', { conversationId });
  }, [navigation, setCurrentConversationId]);

  // Toggle pending section with animation
  const togglePending = useCallback(() => {
    const newCollapsed = !isPendingCollapsed;
    setIsPendingCollapsed(newCollapsed);
    
    Animated.timing(animatedHeight, {
      toValue: newCollapsed ? 0 : 200,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isPendingCollapsed, setIsPendingCollapsed, animatedHeight]);

  // Navigate to new message
  const handleNewMessage = useCallback(() => {
    navigation.navigate('NewMessageScreen');
  }, [navigation]);

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
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
        <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meldinger</Text>
        </View>

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
      <StatusBar backgroundColor="#1C6B1C" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meldinger</Text>
      </View>

      <View style={styles.content}>
        {/* Pending Requests Section - Collapsible */}
        {shouldShowPendingSection && (
          <View style={styles.pendingSection}>
            {/* Pending Content - with smooth collapse animation */}
            <Animated.View style={[styles.pendingContent, { height: animatedHeight }]}>
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
          />
        </View>

        {/* Floating New Message Button */}
        <TouchableOpacity
          onPress={handleNewMessage}
          style={styles.floatingButton}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
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
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: '#1C6B1C',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});