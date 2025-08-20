// screens/NotificationScreen.tsx
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
  FlatList,
} from 'react-native';
import { ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react-native';
import { useNotificationStore } from '@/store/useNotificationStore';
import FriendInvitations from '@/components/friends/FriendInvitations';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import type { NotificationDTO } from '@shared/types/NotificationEventDTO';

interface NotificationScreenProps {
  navigation: any;
}

export default function NotificationScreen({ navigation }: NotificationScreenProps) {
  // Store state
  const invitations = useNotificationStore((s) => s.friendRequests);
  const notifications = useNotificationStore((s) => s.notifications);

  // Filter out friend invitation notifications since we show them separately
  const regularNotifications = notifications.filter((n) => n.type !== "FriendInvitation");

  // Collapse state for friend requests section
  const [isFriendRequestsCollapsed, setIsFriendRequestsCollapsed] = useState(false);
  const [contentHeight, setContentHeight] = useState(200);
  const [animatedHeight] = useState(new Animated.Value(isFriendRequestsCollapsed ? 0 : 1));


  // Should show friend requests section if we have any
  const shouldShowFriendRequestsSection = invitations.length > 0;

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle navigation to profile
  const handleNavigateToProfile = useCallback((userId: number) => {
    navigation.navigate('Profile', { id: userId.toString() });
  }, [navigation]);

  // Handle navigation to FriendScreen to see all friend requests
  const handleViewAllFriendRequests = useCallback(() => {
    navigation.navigate('FriendScreen'); // Eller hva du kaller skjermen for alle venneforespørsler
  }, [navigation]);

  // Callback for measuring content height
  const onContentLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setContentHeight(height);
    }
  }, []);

  // Toggle friend requests section with animation
  const toggleFriendRequests = useCallback(() => {
    const newCollapsed = !isFriendRequestsCollapsed;
    setIsFriendRequestsCollapsed(newCollapsed);
    
    Animated.timing(animatedHeight, {
      toValue: newCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isFriendRequestsCollapsed, animatedHeight]);

  // Render individual notification item
  const renderNotification = useCallback(({ item }: { item: NotificationDTO }) => {
    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => {
          if (item.relatedUser) {
            handleNavigateToProfile(item.relatedUser.id);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          {item.relatedUser && (
            <ClickableAvatarNative
              user={item.relatedUser}
              size={50}
              navigation={navigation}
            />
          )}
          
          <View style={styles.notificationText}>
            <Text style={styles.notificationMessage}>
              {item.relatedUser ? (
                <>
                  <Text style={styles.userName}>{item.relatedUser.fullName}</Text>
                  {item.type === "FriendInvAccepted" 
                    ? " accepted your friend request." 
                    : " sent you a notification."
                  }
                </>
              ) : (
                "Someone sent you a notification."
              )}
            </Text>
            
            {item.createdAt && (
              <Text style={styles.notificationTime}>
                {new Date(item.createdAt).toLocaleDateString('no-NO', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            )}
          </View>
        </View>
        
        {item.type === "FriendInvAccepted" && (
          <View style={styles.acceptedBadge}>
            <Text style={styles.acceptedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [handleNavigateToProfile, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1C6B1C" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notifications</Text>
        
        {/* Spacer for centering title */}
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Friend Requests Section - Collapsible */}
        {shouldShowFriendRequestsSection && (
          <View style={styles.friendRequestsSection}>
            {/* Hidden copy for measuring height */}
            <View 
              style={[styles.friendRequestsInner, styles.hiddenMeasurement]}
              onLayout={onContentLayout}
            >
              <FriendInvitations
                navigation={navigation}
                showHeader={false}
                maxItems={10}
                showViewAllButton={invitations.length > 10}
                onViewAll={handleViewAllFriendRequests}
              />
            </View>
            
            {/* Visible animated content */}
            <Animated.View 
              style={[
                styles.friendRequestsContent, 
                { 
                  height: animatedHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, contentHeight],
                  }),
                }
              ]}
            >
              <View style={styles.friendRequestsInner}>
                <FriendInvitations
                  navigation={navigation}
                  showHeader={false}
                  maxItems={10}
                  showViewAllButton={invitations.length > 10}
                  onViewAll={handleViewAllFriendRequests}
                />
              </View>
            </Animated.View>
            
            {/* Toggle Button */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                onPress={toggleFriendRequests}
                style={styles.toggleButton}
              >
                <View style={styles.dragHandle} />
                <View style={styles.toggleButtonContent}>
                  {isFriendRequestsCollapsed && (
                    <Text style={styles.toggleButtonText}>
                      Friend Requests ({invitations.length})
                    </Text>
                  )}
                  {isFriendRequestsCollapsed ? (
                    <ChevronDown size={16} color="#6B7280" />
                  ) : (
                    <ChevronUp size={16} color="#6B7280" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Regular Notifications Section */}
        <View style={styles.notificationsSection}>
          {regularNotifications.length > 0 ? (
            <FlatList
              data={regularNotifications}
              keyExtractor={(item, index) => item.id?.toString() || index.toString()}
              renderItem={renderNotification}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.notificationsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No notifications</Text>
              <Text style={styles.emptyStateText}>
                You don't have any notifications yet.
              </Text>
            </View>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
    borderRadius: 8,
  },
  
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  
  content: {
    flex: 1,
  },
  
  // Friend Requests Section Styles
  friendRequestsSection: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  friendRequestsContent: {
    overflow: 'hidden',
  },
  
  friendRequestsInner: {
    // No padding here - FriendInvitations handles its own padding
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    width: '100%',
  },
  
  dragHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#1C6B1C',
    borderRadius: 2,
  },
  
  toggleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  // Regular Notifications Section Styles
  notificationsSection: {
    flex: 1,
    backgroundColor: 'white',
  },
  
  notificationsList: {
    paddingVertical: 8,
  },
  
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  notificationText: {
    flex: 1,
    gap: 4,
  },
  
  notificationMessage: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
  },
  
  userName: {
    fontWeight: '600',
    color: '#1C6B1C',
  },
  
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  acceptedBadge: {
    backgroundColor: '#1C6B1C',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  acceptedBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  
  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});