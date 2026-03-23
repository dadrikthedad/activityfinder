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
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useAuth } from '@/context/AuthContext';
import BlockedUsersSection from '@/components/trashcan/BlockedUsersSection';
import DeletedConversationsSection from '@/components/trashcan/DeletedConversationsSection';
import RejectedConversationsSection from '@/components/trashcan/RejectedConversationsSection';
import { showNotificationToastNative, LocalToastType } from '@/components/toast/NotificationToastNative';

interface TrashcanScreenProps {
  navigation: any;
}

export default function TrashcanScreen({ navigation }: TrashcanScreenProps) {
  const [deletedGroupRequestMessage, setDeletedGroupRequestMessage] = useState<string | null>(null);
  
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

  const allUsers = useUserCacheStore(state => state.users);
  const blockedUsers = useMemo(() => {
    return Object.values(allUsers).filter(user => user.isBlocked === true);
  }, [allUsers]);

  const { userId: currentUserId } = useAuth();

  const showErrorToast = useCallback((message: string) => {
    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: "Error",
      customBody: message,
      position: 'top'
    });
  }, []);

  const handleDeletedGroupRequestMessage = useCallback((message: string) => {
    setDeletedGroupRequestMessage(message);
    setTimeout(() => setDeletedGroupRequestMessage(null), 5000);
  }, []);

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
    rejectedError,
  ]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            <BlockedUsersSection
              blockedUsers={blockedUsers}
              navigation={navigation}
              onError={showErrorToast}
            />

            <DeletedConversationsSection
              deletedConversations={deletedConversations}
              isLoading={deletedLoading}
              error={deletedError}
              currentUserId={currentUserId ?? undefined}
              navigation={navigation}
              onError={showErrorToast}
              onRefetch={refetchDeleted}
            />
            
            <RejectedConversationsSection
              rejectedConversations={rejectedConversations}
              isLoading={rejectedLoading}
              error={rejectedError}
              deleteError={null}
              currentUserId={currentUserId ?? undefined}
              navigation={navigation}
              onError={showErrorToast}
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
