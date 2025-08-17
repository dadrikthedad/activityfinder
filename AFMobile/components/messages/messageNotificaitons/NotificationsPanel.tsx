// components/notifications/NotificationsPanelNative.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useMessageNotificationActions } from '@/hooks/messages/useMessageNotificationActions';
import { MessageNotificationDTO } from '@shared/types/MessageNotificationDTO';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useModal } from '@/context/ModalContext';
import { formatNotificationTextNative } from '../../utils/messages/FormatNotificationsTextNative';
import { shouldShowSenderName } from '../../utils/messages/shouldShowSenderName';
import ButtonNative from '../common/ButtonNative';
import GroupEventModalNative from './GroupEventModalNative';

interface NotificationsPanelNativeProps {
  onOpenConversation: (conversationId: number) => void;
}

export default function NotificationsPanelNative({ onOpenConversation }: NotificationsPanelNativeProps) {
  const notifications = useMessageNotificationStore((s) => s.messageNotifications);
  const { markOneAsRead, markAllAsRead, loading: markAllLoading } = useMessageNotificationActions();
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const hasLoaded = useMessageNotificationStore((s) => s.hasLoadedNotifications);
  const { showModal, hideModal } = useModal();

  const totalNotifications = useMessageNotificationStore((s) => s.messageNotifications.length);
  const canGoToChat = totalNotifications >= 20;

  const handleNotificationPress = useCallback((n: MessageNotificationDTO) => {
    // Hvis samtalen er avslått, ikke gjør noe
    if (n.isConversationRejected) {
      return;
    }

    if (!n.isRead) {
      markOneAsRead(n.id);
      if (n.conversationId) {
        setScrollToMessageId(n.messageId ?? null);
        onOpenConversation(n.conversationId);
      }
    } else {
      if (n.conversationId) {
        setScrollToMessageId(n.messageId ?? null);
        onOpenConversation(n.conversationId);
      }
    }
  }, [markOneAsRead, setScrollToMessageId, onOpenConversation]);

  // Long press handler for group events
  const handleNotificationLongPress = useCallback((n: MessageNotificationDTO) => {
    const shouldShowDetails = (n.type === 'GroupEvent' || n.type === 8) && 
                              n.eventSummaries && 
                              n.eventSummaries.length > 0;

    if (shouldShowDetails) {
      showModal(
        <GroupEventModalNative
          visible={true}
          eventSummaries={n.eventSummaries || []}
          groupName={n.groupName || 'Unknown Group'}
          eventCount={n.messageCount || 0}
          onClose={hideModal}
        />,
        {
          blurBackground: true,
          dismissOnBackdrop: true,
        }
      );
    } else {
      // Fallback: Show simple info alert
      Alert.alert(
        'Notification Info',
        `From: ${n.senderName}\nTime: ${new Date(n.createdAt).toLocaleString()}`,
        [{ text: 'OK' }]
      );
    }
  }, [showModal, hideModal]);

  const renderNotificationItem = ({ item: n }: { item: MessageNotificationDTO }) => {
    const isGroupEvent = n.type === 'GroupEvent' || n.type === 8;
    const hasDetails = isGroupEvent && n.eventSummaries && n.eventSummaries.length > 0;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          n.isConversationRejected 
            ? styles.rejectedNotification
            : n.isRead 
              ? styles.readNotification 
              : styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(n)}
        onLongPress={() => handleNotificationLongPress(n)}
        disabled={n.isConversationRejected}
      >
        {/* Unread indicator */}
        {!n.isConversationRejected && !n.isRead && (
          <View style={styles.unreadIndicator} />
        )}
        
        {/* Notification content */}
        <View style={styles.notificationContent}>
          <Text style={[
            styles.notificationText,
            n.isConversationRejected && styles.rejectedText,
            n.isRead && styles.readText,
            !n.isRead && !n.isConversationRejected && styles.unreadText
          ]}>
            {shouldShowSenderName(n) && (
              <Text style={styles.senderName}>{n.senderName} </Text>
            )}
            {formatNotificationTextNative(n)}
          </Text>
          
          {/* Long press hint for group events */}
          {hasDetails && (
            <Text style={styles.longPressHint}>
              Long press for details
            </Text>
          )}
          
          <Text style={styles.timestamp}>
            {new Date(n.createdAt).toLocaleString(undefined, {
              dateStyle: 'short',
              timeStyle: 'short'
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View style={styles.header}>
      {notifications.length > 0 && (
        <ButtonNative
          text={markAllLoading ? 'Marking...' : 'Mark all as read'}
          onPress={markAllAsRead}
          variant="secondary"
          size="small"
          disabled={markAllLoading}
          loading={markAllLoading}
        />
      )}
    </View>
  );

  const renderListFooter = () => (
    <View style={styles.footer}>
      <ButtonNative
        text="See more..."
        onPress={() => {
          if (canGoToChat) {
            // Navigate to chat page - implement navigation
            console.log('Navigate to chat page');
          }
        }}
        variant="ghost"
        size="small"
        disabled={!canGoToChat}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      {!hasLoaded ? (
        <Text style={styles.emptyText}>Loading notifications...</Text>
      ) : (
        <Text style={styles.emptyText}>No recent notifications</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  unreadNotification: {
    backgroundColor: '#f0fdf4',
    borderColor: '#1C6B1C',
  },
  readNotification: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  rejectedNotification: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    opacity: 0.6,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginTop: 6,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadText: {
    color: '#111827',
    fontWeight: '600',
  },
  readText: {
    color: '#6b7280',
  },
  rejectedText: {
    color: '#92400e',
  },
  senderName: {
    fontWeight: 'bold',
  },
  longPressHint: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
});