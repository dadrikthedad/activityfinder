// components/notifications/NotificationsModalNative.tsx
import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Image,
  SafeAreaView,
} from 'react-native';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useFriendRequestHandler } from '@/hooks/friends/useFriendInvitationsHandler';
import type { NotificationDTO } from '@shared/types/NotificationEventDTO';
import ButtonNative from '@/components/common/buttons/ButtonNative';

interface NotificationsModalNativeProps {
  visible: boolean;
  onClose: () => void;
  navigation?: any; // Replace with proper navigation type
}

export default function NotificationsModalNative({
  visible,
  onClose,
  navigation,
}: NotificationsModalNativeProps) {
  
  // Data from store
  const invitations = useNotificationStore((s) => s.friendRequests);
  const notifications = useNotificationStore((s) => s.notifications);
  const { handleResponse, handlingId } = useFriendRequestHandler();
  const totalFriendRequests = useNotificationStore((s) => s.friendRequestTotalCount);

  const handleNavigateToProfile = useCallback((userId: number) => {
    onClose();
    navigation?.navigate('Profile', { userId });
  }, [onClose, navigation]);

  const handleViewAllFriends = useCallback(() => {
    onClose();
    navigation?.navigate('Friends');
  }, [onClose, navigation]);

  const handleViewAllNotifications = useCallback(() => {
    onClose();
    navigation?.navigate('AllNotifications');
  }, [onClose, navigation]);

  const renderFriendRequest = ({ item: invite }: { item: any }) => (
    <View style={styles.friendRequestItem}>
      <TouchableOpacity
        style={styles.friendRequestContent}
        onPress={() => handleNavigateToProfile(invite.userSummary?.id)}
      >
        <Image
          source={{
            uri: invite.userSummary?.profileImageUrl ?? '/default-avatar.png'
          }}
          style={styles.avatar}
        />
        <View style={styles.friendRequestText}>
          <Text style={styles.friendName}>
            {invite.userSummary?.fullName}
          </Text>
          <Text style={styles.friendRequestMessage}>
            wants to be your friend
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.friendRequestButtons}>
        <View style={styles.buttonRow}>
          <ButtonNative
            text="Accept"
            onPress={() => handleResponse(invite.id, 'accept')}
            variant="primary"
            size="small"
            disabled={handlingId === invite.id}
            loading={handlingId === invite.id}
            style={styles.acceptButton}
          />
          <ButtonNative
            text="Decline"
            onPress={() => handleResponse(invite.id, 'decline')}
            variant="secondary"
            size="small"
            disabled={handlingId === invite.id}
            style={styles.declineButton}
          />
        </View>
      </View>
    </View>
  );

  const renderNotification = ({ item: notification }: { item: NotificationDTO }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => {
        if (notification.relatedUser?.id) {
          handleNavigateToProfile(notification.relatedUser.id);
        }
      }}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationText}>
          {notification.relatedUser ? (
            <Text style={styles.notificationName}>
              {notification.relatedUser.fullName}
            </Text>
          ) : (
            'Someone'
          )}
          {notification.type === 'FriendInvAccepted'
            ? ' accepted your friend request.'
            : ' sent you a notification.'}
        </Text>
        
        <Text style={styles.notificationTime}>
          {new Date(notification.createdAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const filteredNotifications = notifications.filter((n) => n.type !== 'FriendInvitation');

  const renderListHeader = () => (
    <View>
      {/* Friend Requests Section */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend Requests</Text>
          
          <FlatList
            data={invitations.slice(0, 3)}
            renderItem={renderFriendRequest}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
          />
          
          {totalFriendRequests > 3 && (
            <View style={styles.moreRequestsContainer}>
              <Text style={styles.moreRequestsText}>
                You have {totalFriendRequests} total friend requests
              </Text>
              <ButtonNative
                text="View All Friends"
                onPress={handleViewAllFriends}
                variant="secondary"
                size="small"
                style={styles.viewAllButton}
              />
            </View>
          )}
          
          <View style={styles.divider} />
        </View>
      )}
      
      {/* Notifications Section Header */}
      {filteredNotifications.length > 0 && (
        <Text style={styles.sectionTitle}>Recent Notifications</Text>
      )}
    </View>
  );

  const renderListFooter = () => (
    <View style={styles.footer}>
      <ButtonNative
        text="View All Notifications"
        onPress={handleViewAllNotifications}
        variant="primary"
        size="medium"
        style={styles.viewAllButton}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubtext}>
        You'll see friend requests and other notifications here
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Notifications</Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        {invitations.length === 0 && filteredNotifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotification}
            keyExtractor={item => item.id.toString()}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 60,
  },
  listContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  friendRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  friendRequestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  friendRequestText: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  friendRequestMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  friendRequestButtons: {
    marginLeft: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    minWidth: 70,
  },
  declineButton: {
    minWidth: 70,
  },
  moreRequestsContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  moreRequestsText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#1C6B1C',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  notificationName: {
    fontWeight: '600',
    color: '#1C6B1C',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  viewAllButton: {
    alignSelf: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});