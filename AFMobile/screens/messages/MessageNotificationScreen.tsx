// screens/MessageNotificationScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MessageNotificationScreenNavigationProp } from '@/types/navigation';
import { useMessageNotificationActions } from '@/hooks/messages/useMessageNotificationActions';
import { MessageNotificationDTO } from '@shared/types/MessageNotificationDTO';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useModal } from '@/context/ModalContext';
import { formatNotificationTextNative } from '@/utils/messages/FormatNotificationsTextNative';
import { shouldShowSenderName } from '@/utils/messages/shouldShowSenderName';
import ButtonNative from '@/components/common/ButtonNative';
import AppHeader from '@/components/common/AppHeader';
import { ArrowBigLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useMarkConversationNotificationsAsRead } from '@/hooks/messages/useMarkConversationNotificationAsRead';

export default function MessageNotificationScreen() {
  const navigation = useNavigation<MessageNotificationScreenNavigationProp>();
  const notifications = useMessageNotificationStore((s) => s.messageNotifications);
  const { markAllAsRead, loading: markAllLoading } = useMessageNotificationActions();
  const setScrollToMessageId = useChatStore((s) => s.setScrollToMessageId);
  const hasLoaded = useMessageNotificationStore((s) => s.hasLoadedNotifications);
  const { showModal, hideModal } = useModal();

  // State for tracking which notifications are expanded
  const [expandedNotifications, setExpandedNotifications] = useState<Set<number>>(new Set());

 const handleNotificationPress = useCallback((n: MessageNotificationDTO) => {
    // Hvis samtalen er avslått, ikke gjør noe
    if (n.isConversationRejected || !n.conversationId) {
        return;
    }

    // Set scroll target og naviger til samtalen
    setScrollToMessageId(n.messageId ?? null);
    navigation.navigate('ConversationScreen', { conversationId: n.conversationId });
    }, [setScrollToMessageId, navigation]);

  const toggleExpanded = useCallback((notificationId: number) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  }, []);

  const renderNotificationItem = ({ item: n }: { item: MessageNotificationDTO }) => {
    const isGroupEvent = n.type === 'GroupEvent' || n.type === 8;
    const hasDetails = isGroupEvent && n.eventSummaries && n.eventSummaries.length > 0;
    const isExpanded = expandedNotifications.has(n.id);

    return (
      <View
        style={[
          styles.notificationItem,
          n.isConversationRejected 
            ? styles.rejectedNotification
            : n.isRead 
              ? styles.readNotification 
              : styles.unreadNotification
        ]}
      >
        {/* Unread indicator */}
        {!n.isConversationRejected && !n.isRead && (
          <View style={styles.unreadIndicator} />
        )}
        
        {/* Main notification content - clickable to go to chat */}
        <TouchableOpacity
          style={styles.mainNotificationArea}
          onPress={() => handleNotificationPress(n)}
          disabled={n.isConversationRejected}
        >
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
            
            <Text style={styles.timestamp}>
              {new Date(n.createdAt).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short'
              })}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Group event details section */}
        {hasDetails && (
          <View style={styles.detailsSection}>
            {/* Show/hide details button */}
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => toggleExpanded(n.id)}
            >
              <Text style={styles.detailsToggleText}>
                {isExpanded ? 'Hide' : 'Show'} {n.eventSummaries?.length || 0} activit{(n.eventSummaries?.length || 0) === 1 ? 'y' : 'ies'}
              </Text>
              {isExpanded ? (
                <ChevronUp size={16} color="#6b7280" />
              ) : (
                <ChevronDown size={16} color="#6b7280" />
              )}
            </TouchableOpacity>

            {/* Expanded content */}
            {isExpanded && (
              <View style={styles.expandedContent}>
                {(n.eventSummaries?.length || 0) <= 4 ? (
                  // Show all items directly if 4 or fewer
                  n.eventSummaries?.map((event, index) => (
                    <View key={index} style={styles.eventItem}>
                      <View style={styles.eventBullet} />
                      <Text style={styles.eventText}>{event}</Text>
                    </View>
                  ))
                ) : (
                  // Use ScrollView for many items
                  <ScrollView 
                    style={styles.eventsScrollContainer}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {n.eventSummaries?.map((event, index) => (
                      <View key={index} style={styles.eventItem}>
                        <View style={styles.eventBullet} />
                        <Text style={styles.eventText}>{event}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderListHeader = () => null; // Remove header from FlatList

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
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Notifications"
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowBigLeft}
      />
      
      
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item, index) => {
            // 🔧 Sikker keyExtractor som håndterer undefined IDs
            if (item?.id != null) {
            return item.id.toString();
            }
            // Fallback til index hvis ID mangler
            return `notification-${index}`;
        }}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
        />

      {/* Mark all as read button - outside FlatList */}
      {notifications.length > 0 && (
        <View style={styles.buttonSection}>
          <ButtonNative
            text={markAllLoading ? 'Marking...' : 'Mark all as read'}
            onPress={markAllAsRead}
            variant="secondary"
            size="small"
            disabled={markAllLoading}
            loading={markAllLoading}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  buttonSection: {
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  notificationItem: {
    flexDirection: 'column',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
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
  mainNotificationArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  unreadIndicator: {
    position: 'absolute',
    top: 12,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    zIndex: 1,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 16, // Space for unread indicator
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
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  detailsToggleText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  eventsScrollContainer: {
    maxHeight: 120, // Limit height for scrolling
    paddingRight: 8, // Space for scroll indicator
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 10,
  },
  eventBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16a34a',
    marginTop: 7,
  },
  eventText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
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