// screens/PendingConversationsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  FlatList,
} from 'react-native';
import { ArrowBigLeft, Check, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useChatStore } from '@/store/useChatStore';
import { usePendingMessageRequests } from '@/hooks/messages/usePendingMessageRequests';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useRejectMessageRequest } from '@/hooks/messages/useRejectMessageRequest';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { MessageRequestDTO } from '@shared/types/MessageReqeustDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { ConversationListItemNative } from '@/components/messages/ConversationListItemNative';
import SpinnerNative from '@/components/common/SpinnerNative';

interface PendingConversationsScreenProps {
  navigation: any;
}

export default function PendingConversationsScreen({ navigation }: PendingConversationsScreenProps) {
  const { isLoggedIn } = useAuth();
  const { setCurrentConversationId } = useChatStore();
  
  const { 
    requests, 
    isLoading, 
    error,
    removeRequest 
  } = usePendingMessageRequests();
  
  const { approve, loading: approving } = useApproveMessageRequest();
  const { reject, loading: rejecting } = useRejectMessageRequest();
  const { confirm } = useConfirmModalNative();
  
  // Track which specific request is being processed
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [processingType, setProcessingType] = useState<'approve' | 'reject' | null>(null);
  
  const conversations = useChatStore((s) => s.conversations);

  // Handle back navigation
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true; // Prevent default back action
    });

    return () => backHandler.remove();
  }, [handleGoBack]);

  // Handle conversation selection - navigate to individual conversation
  const handleSelectConversation = useCallback((conversationId: number) => {
    console.log('🎯 PendingConversationsScreen: Setting conversation ID before navigation:', conversationId);
    
    // Set conversation ID immediately
    setCurrentConversationId(conversationId);
    
    // Navigate to conversation
    navigation.navigate('ConversationScreen', { conversationId });
  }, [navigation, setCurrentConversationId]);

  // Handle reject request
  const handleReject = async (r: MessageRequestDTO) => {
    if (r.conversationId == null) return;

    const requestType = r.isGroup ? "group invitation" : "message request";
    const actionText = r.isGroup ? "decline" : "reject";

    const confirmed = await confirm({
      title: r.isGroup ? "Decline Group Invitation" : "Reject Message Request",
      message: `Are you sure you want to ${actionText} the ${requestType} from ${r.senderName}${r.isGroup && r.groupName ? ` to join ${r.groupName}` : ''}?`
    });

    if (confirmed) {
      setProcessingRequestId(r.conversationId!);
      setProcessingType('reject');
      
      try {
        await reject(r.senderId, r.conversationId!, r.isGroup || false);
        removeRequest(r.conversationId!);
      } catch (error) {
        console.error('❌ Error rejecting request:', error);
      } finally {
        setProcessingRequestId(null);
        setProcessingType(null);
      }
    }
  };

  // Handle approve request
  const handleApprove = async (r: MessageRequestDTO) => {
    if (r.conversationId !== null && r.conversationId !== undefined) {
      setProcessingRequestId(r.conversationId);
      setProcessingType('approve');
      
      try {
        await approve(r.conversationId);
        console.log("✔ Approved conversation:", r.conversationId);
        removeRequest(r.conversationId);
      } catch (error) {
        console.error('❌ Error approving request:', error);
      } finally {
        setProcessingRequestId(null);
        setProcessingType(null);
      }
    }
  };

  // Check if a specific request is being processed
  const isRequestProcessing = (conversationId: number) => {
    return processingRequestId === conversationId;
  };

  // Render pending request item
  const renderPendingRequest = ({ item: r }: { item: MessageRequestDTO }) => {
    const conversationFromStore = r.conversationId ? conversations.find(c => c.id === r.conversationId) : null;
    const storeParticipants = conversationFromStore?.participants || [];
    
    let participants: UserSummaryDTO[] = [];
    if (r.participants && Array.isArray(r.participants) && r.participants.length > 0) {
      participants = r.participants;
    } else if (storeParticipants.length > 0) {
      participants = storeParticipants;
    }
    
    const memberCount = r.isGroup ? (participants.length > 0 ? participants.length : 2) : undefined;
    const isProcessing = isRequestProcessing(r.conversationId!);

    return (
      <View style={styles.pendingRequestContainer}>
        {/* Loading overlay */}
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.loadingOverlayText}>
                {processingType === 'approve' ? 'Accepting...' : 'Declining...'}
              </Text>
            </View>
          </View>
        )}
        
        {/* Main container with conversation and action buttons side by side */}
        <View style={[styles.conversationWithActions, isProcessing && styles.processingRequest]}>
          {/* Conversation card - takes up most of the space */}
          <View style={styles.conversationSection}>
            <ConversationListItemNative
              user={{
                id: r.isGroup ? r.conversationId ?? 0 : r.senderId,
                fullName: r.isGroup ? r.groupName ?? "Gruppe" : r.senderName,
                profileImageUrl: r.isGroup
                  ? r.groupImageUrl || null
                  : r.profileImageUrl || null,
              }}
              isClickable={!isProcessing}
              isPendingApproval={true}
              onClick={() => {
                if (!isProcessing) {
                  console.log("✅ Clicked on conversation:", r.conversationId);
                  if (r.conversationId) {
                    handleSelectConversation(r.conversationId);
                  }
                }
              }}
              isGroup={r.isGroup || false}
              memberCount={memberCount}
              participants={participants}
              navigation={navigation}
            />
          </View>
          
          {/* Action buttons to the right */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.approveButton,
                isProcessing && styles.disabledButton
              ]}
              onPress={() => handleApprove(r)}
              disabled={isProcessing}
            >
              {isProcessing && processingType === 'approve' ? (
                <ActivityIndicator size={16} color="white" />
              ) : (
                <Check size={20} color="white" strokeWidth={3} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.rejectButton,
                isProcessing && styles.disabledButton
              ]}
              onPress={() => handleReject(r)}
              disabled={isProcessing}
            >
              {isProcessing && processingType === 'reject' ? (
                <ActivityIndicator size={16} color="white" />
              ) : (
                <X size={20} color="white" strokeWidth={3} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Show full screen spinner when initially loading or when all requests are being processed
  if (isLoading && requests.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
          >
            <ArrowBigLeft size={24} color="#1C6B1C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pending Requests</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <SpinnerNative text="Loading requests..." />
      </SafeAreaView>
    );
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>Logg inn for å se forespørsler</Text>
          <Text style={styles.loginSubtitle}>
            Du må være innlogget för å få tilgang til meldingsforespørsler.
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <ArrowBigLeft size={24} color="#1C6B1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{requests.length} {requests.length === 1 ? 'request' : 'requests'} pending</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error Loading Requests</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : !requests || requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You don't have any pending message requests or group invitations at the moment.
            </Text>
          </View>
        ) : (
          <>
            {/* Requests list */}
            <FlatList
              data={requests}
              renderItem={renderPendingRequest}
              keyExtractor={(item) => `${item.senderId}-${item.conversationId ?? "private"}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              scrollEnabled={!processingRequestId} // Disable scrolling when processing
            />
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center title
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
  },
  countHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center', // Sentrer innholdet
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center', // Sentrer teksten
  },
  listContainer: {
    paddingVertical: 8,
  },
  pendingRequestContainer: {
    backgroundColor: 'white',
    position: 'relative',
  },
  conversationWithActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  processingRequest: {
    opacity: 0.6,
  },
  conversationSection: {
    flex: 1, // Takes up most of the space
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  approveButton: {
    backgroundColor: '#1C6B1C',
  },
  rejectButton: {
    backgroundColor: '#9CA3AF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingOverlayText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1C6B1C',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
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
});