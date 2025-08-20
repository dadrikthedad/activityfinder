// FriendScreen.tsx - Med søk i FriendInvitations
import React, { useState, useCallback } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  Alert,
  ListRenderItem,
  TouchableOpacity
} from "react-native";
import { useFriends } from "@/hooks/useFriends";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import { useOptimisticFriends } from "@/hooks/friends/useOptimisticFriends";
import { useBlockUser } from "@/hooks/block/useBlockUser";
import { useUnblockUser } from "@/hooks/block/useUnblockUser";
import { useIsUserBlocked } from "@/store/useUserCacheStore";
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative";
import { showNotificationToastNative } from "@/components/toast/NotificationToastNative";
import { LocalToastType } from "@/components/toast/NotificationToastNative";
import FriendInvitations from "@/components/friends/FriendInvitations";
import ClickableAvatarNative from "@/components/common/ClickableAvatarNative";
import ActionSheetModalNative from "@/components/common/modal/ActionSheetModalNative";
import Spinner from "@/components/common/SpinnerNative";
import { FriendDTO } from "@shared/types/FriendDTO";

// Simplified list item type (kun for venner)
type ListItem = 
  | { type: 'friend'; id: string; data: FriendDTO; isOptimistic?: boolean }
  | { type: 'loadMore'; id: string; onPress: () => void; loading: boolean; text: string }
  | { type: 'empty'; id: string; text: string };

interface FriendScreenProps {
  navigation: any;
}

export default function FriendScreen({ navigation }: FriendScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Friends data (actual friends from API)
  const { 
    friends: actualFriends, 
    loading: loadingFriends, 
    loadMore: loadMoreFriends, 
    hasMore: hasMoreFriends, 
    loadingMore: loadingMoreFriends, 
    removeFriend
  } = useFriends();

  // Optimistic friends hook
  const { 
    friends: combinedFriends, 
    optimisticFriendIds 
  } = useOptimisticFriends(actualFriends);

  // ✅ Block/unblock hooks
  const { blockUser, isLoading: isBlocking } = useBlockUser();
  const { unblockUser, isLoading: isUnblocking } = useUnblockUser();
  const { confirm } = useConfirmModalNative();

  // Handlers
  const { confirmAndRemove } = useConfirmRemoveFriend();

  // ✅ Block user handler
  const handleBlockUser = useCallback(async (userId: number, userName: string) => {
    const confirmed = await confirm({
      title: "Block User",
      message: `Are you sure you want to block ${userName}? They will no longer be able to contact you, and you won't see their content.`
    });
   
    if (confirmed) {
      const result = await blockUser(userId);
      
      if (result) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "User Blocked",
          customBody: `${userName} has been blocked successfully! 🚫`,
          position: 'top'
        });
      }
    }
  }, [blockUser, confirm]);

  // ✅ Unblock user handler
  const handleUnblockUser = useCallback(async (userId: number, userName: string) => {
    const confirmed = await confirm({
      title: "Unblock User",
      message: `Are you sure you want to unblock ${userName}? They will be able to contact you again.`
    });
   
    if (confirmed) {
      const result = await unblockUser(userId);
      
      if (result) {
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "User Unblocked",
          customBody: `${userName} has been unblocked successfully! ✅`,
          position: 'top'
        });
      }
    }
  }, [unblockUser, confirm]);

  // ✅ Report user handler with toast
  const handleReportUser = useCallback(async (userName: string) => {
    // First confirm they want to report
    const wantToReport = await confirm({
      title: "Report User",
      message: `Do you want to report ${userName} for inappropriate behavior?`
    });
   
    if (wantToReport) {
      // Show reason selection
      const isSpam = await confirm({
        title: "Report Reason",
        message: "Is this user sending spam or unwanted messages?"
      });
     
      let reason = "other";
      if (isSpam) {
        reason = "spam";
      } else {
        const isHarassment = await confirm({
          title: "Report Reason",
          message: "Is this user harassing or bullying you or others?"
        });
       
        if (isHarassment) {
          reason = "harassment";
        } else {
          const isInappropriate = await confirm({
            title: "Report Reason",
            message: "Is this user posting inappropriate content?"
          });
         
          if (isInappropriate) {
            reason = "inappropriate";
          }
        }
      }

      console.log(`🚨 Report user for: ${reason}`);
      // TODO: Implement report functionality
     
      // Show success toast
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Report Submitted",
        customBody: "Thank you for your report. We will review it shortly! 📝",
        position: 'top'
      });
    }
  }, [confirm]);

  // Filter friends based on search
  const normalizedSearch = (searchTerm ?? '').toLowerCase();

  const filteredFriends = combinedFriends.filter((f) => {
    const name =
      (f?.friend?.fullName ??
      (f as any)?.friend?.userName ??
      (f as any)?.friend?.email ??
      '').toLowerCase();

    return name.includes(normalizedSearch);
  });

  // Calculate days since friendship
  const getDaysSinceFriendship = (createdAt: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(createdAt).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    return days === 0
      ? "You became friends today"
      : `You have been friends for ${days} day${days > 1 ? "s" : ""}`;
  };

  // Create friends list data
  const createFriendsListData = useCallback((): ListItem[] => {
    const items: ListItem[] = [];

    if (filteredFriends.length === 0 && combinedFriends.length === 0) {
      items.push({ type: 'empty', id: 'empty-friends', text: 'You have no friends yet' });
    } else if (filteredFriends.length === 0 && searchTerm) {
      items.push({ type: 'empty', id: 'empty-search', text: 'No friends found' });
    } else {
      // Deduplicate friends and create unique keys
      const seenFriendIds = new Set<number>();
      
      filteredFriends.forEach((friend) => {
        if (seenFriendIds.has(friend.friend.id)) {
          return;
        }
        
        seenFriendIds.add(friend.friend.id);
        
        const isOptimistic = optimisticFriendIds.includes(friend.friend.id);
        
        // Create unique key including optimistic status
        const uniqueKey = isOptimistic ? 
          `friend-${friend.friend.id}-optimistic` : 
          `friend-${friend.friend.id}-actual`;
          
        items.push({ 
          type: 'friend', 
          id: uniqueKey,
          data: friend,
          isOptimistic
        });
      });

      // Show "Load more" if not searching
      if (hasMoreFriends && !searchTerm) {
        items.push({
          type: 'loadMore',
          id: 'load-more-friends',
          onPress: loadMoreFriends,
          loading: loadingMoreFriends,
          text: 'Load more friends'
        });
      }
    }

    return items;
  }, [
    combinedFriends, filteredFriends, hasMoreFriends, loadingMoreFriends,
    searchTerm, optimisticFriendIds
  ]);

  // Render friend list item
  const renderFriendItem: ListRenderItem<ListItem> = ({ item }) => {
    switch (item.type) {
      case 'friend':
        const friend = item.data;
        const isOptimistic = item.isOptimistic || false;
        
        // ✅ Check if user is blocked (using hook inside component)
        const BlockedIndicator = () => {
          const isBlocked = useIsUserBlocked(friend.friend.id);
          
          // Create actions array for the friend
          const friendActions = [
            {
              label: "View Profile",
              onPress: () => {
                navigation.push('Profile', {
                  id: friend.friend.id.toString()
                });
              },
              variant: "primary" as const
            },
            {
              label: "Remove Friend",
              onPress: () =>
                confirmAndRemove(friend.friend.id, friend.friend.fullName, () => {
                  removeFriend(friend.friend.id);
                }),
              variant: "danger" as const
            },
            {
              label: isBlocked ? "Unblock" : "Block",
              onPress: () => isBlocked 
                ? handleUnblockUser(friend.friend.id, friend.friend.fullName)
                : handleBlockUser(friend.friend.id, friend.friend.fullName),
              variant: "danger" as const,
              loading: isBlocking || isUnblocking
            },
            { 
              label: "Report", 
              onPress: () => handleReportUser(friend.friend.fullName),
              variant: "danger" as const
            },
          ];

          return (
            <TouchableOpacity 
              style={[
                styles.friendItem,
                isOptimistic && styles.optimisticFriendItem
              ]} 
              activeOpacity={0.7}
            >
              <View style={styles.friendContent}>
                <ClickableAvatarNative
                  user={friend.friend}
                  size={60}
                  navigation={navigation}
                />
                
                <View style={styles.friendInfo}>
                  <View style={styles.friendNameContainer}>
                    <Text style={styles.friendName}>{friend.friend.fullName}</Text>
                    {isOptimistic && (
                      <View style={styles.newFriendBadge}>
                        <Text style={styles.newFriendBadgeText}>NEW</Text>
                      </View>
                    )}
                    {isBlocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedBadgeText}>BLOCKED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.friendshipDuration}>
                    {isOptimistic 
                      ? "You became friends today" 
                      : getDaysSinceFriendship(friend.createdAt)
                    }
                  </Text>
                </View>
              </View>
              
              <View style={styles.friendActions}>
                <ActionSheetModalNative
                  title="Friend Options"
                  actions={friendActions}
                  trigger={{
                    type: "dots",
                    size: "small"
                  }}
                  blurBackground={false}
                />
              </View>
            </TouchableOpacity>
          );
        };

        return <BlockedIndicator />;

      case 'loadMore':
        return (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={item.onPress}
            disabled={item.loading}
          >
            <Text style={styles.loadMoreText}>{item.text}</Text>
          </TouchableOpacity>
        );

      case 'empty':
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{item.text}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (loadingFriends) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" text="Loading..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Friend Invitations Component - Now with separate search field */}
      <FriendInvitations 
        navigation={navigation}
        maxHeight="35%"
        showHeader={true}
        showSearchField={true}
      />

      {/* Friends Header Section */}
      <View style={styles.friendsHeaderSection}>
        <Text style={styles.friendsHeaderText}>Friends</Text>
      </View>

      {/* Search Section - Now only for friends */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#9CA3AF"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Friends Section */}
      <View style={styles.friendsSection}>
        <FlatList
          data={createFriendsListData()}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.friendsListContainer}
          ItemSeparatorComponent={() => <View />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  
  // Friends Header Section
  friendsHeaderSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  friendsHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  
  // Search Section
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  
  searchInput: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  // Friends Section
  friendsSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  friendsListContainer: {
    paddingBottom: 40,
  },
  
  friendItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  optimisticFriendItem: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  
  friendInfo: {
    flex: 1,
  },

  friendNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },

  newFriendBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  newFriendBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ✅ New blocked badge styles
  blockedBadge: {
    backgroundColor: '#9CA3AF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  blockedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  friendshipDuration: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  friendActions: {
    marginLeft: 8,
  },
  
  loadMoreButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C6B1C',
  },
  
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
});