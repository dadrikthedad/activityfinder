import React, { useState, useCallback, useMemo } from 'react';
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useGetDeletedConversations } from '@/hooks/messages/useGetDeletedConversations';
import { useGetRejectedConversations } from '@/hooks/messages/useGetRejectedConversations';
import { useUserCacheStore, useBlockedUsers } from '@/store/useUserCacheStore';
import { useAuth } from '@/context/AuthContext';
import BlockedUsersSection from '@/components/trashcan/BlockedUsersSection';
import DeletedConversationsSection from '@/components/trashcan/DeletedConversationsSection';
import RejectedConversationsSection from '@/components/trashcan/RejectedConversationsSection';

interface TrashcanScreenProps {
  navigation: any;
}

export default function TrashcanScreen({ navigation }: TrashcanScreenProps) {
  const [deletedGroupRequestMessage, setDeletedGroupRequestMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { 
    deletedConversations, 
    isLoading: deletedLoading, 
    error: deletedError, 
    refetch: refetchDeleted 
  } = useGetDeletedConversations();
  
  const { 
    rejectedConversations, 
    isLoading: rejectedLoading, 
    error: rejectedError, 
    refetch: refetchRejected 
  } = useGetRejectedConversations();
  
  // ✅ FIX: Use useMemo to cache the filtered array and prevent infinite re-renders
  const allUsers = useUserCacheStore(state => state.users);
  const blockedUsers = useMemo(() => {
    return Object.values(allUsers).filter(user => user.isBlocked === true);
  }, [allUsers]);

  const { userId: currentUserId } = useAuth();

  // ✅ Shared message handlers
  const showSuccessMessage = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const showErrorMessage = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  }, []);

  const handleDeletedGroupRequestMessage = useCallback((message: string) => {
    setDeletedGroupRequestMessage(message);
    setTimeout(() => setDeletedGroupRequestMessage(null), 5000);
  }, []);

  // ✅ Check if completely empty (for main empty state)
  const isCompletelyEmpty = useMemo(() => {
    return !deletedLoading && 
           !rejectedLoading && 
           deletedConversations.length === 0 && 
           rejectedConversations.length === 0 && 
           blockedUsers.length === 0 && 
           !deletedError && 
           !rejectedError;
  }, [
    deletedLoading, 
    rejectedLoading, 
    deletedConversations.length, 
    rejectedConversations.length, 
    blockedUsers.length, 
    deletedError, 
    rejectedError
  ]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Message */}
        {(deletedGroupRequestMessage || successMessage) && (
          <View style={styles.successMessage}>
            <View style={styles.successIndicator} />
            <Text style={styles.successText}>
              {deletedGroupRequestMessage || successMessage}
            </Text>
          </View>
        )}

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorMessage}>
            <View style={styles.errorIndicator} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Show empty state if all sections are empty */}
        {isCompletelyEmpty ? (
          <View style={styles.emptyTrashcanContainer}>
            <View style={styles.emptyTrashcanIcon}>
              <Trash2 size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTrashcanTitle}>Your trashcan is empty</Text>
            <Text style={styles.emptyTrashcanSubtitle}>
              Deleted conversations, rejected invitations, and blocked users will appear here
            </Text>
          </View>
        ) : (
          <>
            {/* ✅ Blocked Users Section */}
            <BlockedUsersSection
              blockedUsers={blockedUsers}
              navigation={navigation}
              onSuccess={showSuccessMessage}
              onError={showErrorMessage}
            />

            {/* ✅ Deleted Conversations Section */}
            <DeletedConversationsSection
              deletedConversations={deletedConversations}
              isLoading={deletedLoading}
              error={deletedError}
              currentUserId={currentUserId ?? undefined}
              navigation={navigation}
              onSuccess={showSuccessMessage}
              onError={showErrorMessage}
              onRefetch={refetchDeleted}
            />
            
            {/* ✅ Rejected Conversations Section */}
            <RejectedConversationsSection
              rejectedConversations={rejectedConversations}
              isLoading={rejectedLoading}
              error={rejectedError}
              deleteError={null} // You might need to get this from useDeleteGroupRequest
              currentUserId={currentUserId ?? undefined}
              navigation={navigation}
              onSuccess={showSuccessMessage}
              onError={showErrorMessage}
              onRefetch={refetchRejected}
              onDeletedGroupRequestMessage={handleDeletedGroupRequestMessage}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#047857',
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  emptyTrashcanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTrashcanIcon: {
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTrashcanTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyTrashcanSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});