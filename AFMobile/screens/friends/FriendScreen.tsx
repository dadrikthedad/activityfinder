// FriendScreen.tsx - Med separert Friends header og search
import React, { useEffect, useState, useCallback } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  Alert,
  ListRenderItem,
  TouchableOpacity,
  Dimensions 
} from "react-native";
import { useFriendRequestHandler } from "@/hooks/friends/useFriendInvitationsHandler";
import { useFriends } from "@/hooks/useFriends";
import { useFriendInvitations } from "@/hooks/useFriendInvitations";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import ClickableAvatarNative from "@/components/common/ClickableAvatarNative";
import FriendOptionsModalNative from "@/components/FriendOptionsModalNative";
import Spinner from "@/components/common/SpinnerNative";
import { FriendDTO } from "@shared/types/FriendDTO";
import { FriendInvitationDTO } from "@shared/types/FriendInvitationDTO";

// Combined list item type
type ListItem = 
  | { type: 'header'; id: string; title: string }
  | { type: 'invitation'; id: string; data: FriendInvitationDTO }
  | { type: 'friend'; id: string; data: FriendDTO }
  | { type: 'searchHeader'; id: string }
  | { type: 'loadMore'; id: string; onPress: () => void; loading: boolean; text: string }
  | { type: 'empty'; id: string; text: string };

interface FriendScreenProps {
  navigation: any; // Add navigation prop
}

export default function FriendScreen({ navigation }: FriendScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const screenHeight = Dimensions.get('window').height;

  // Invitations data
  const {
    invitations,
    loading: loadingInvitations
  } = useFriendInvitations();

  // Friends data
  const { 
    friends, 
    loading: loadingFriends, 
    loadMore: loadMoreFriends, 
    hasMore: hasMoreFriends, 
    loadingMore: loadingMoreFriends, 
    removeFriend 
  } = useFriends();

  // Handlers
  const { handleResponse, handlingId } = useFriendRequestHandler();
  const { confirmAndRemove } = useConfirmRemoveFriend();

  // Filter friends based on search
  const filteredFriends = friends.filter((friend) =>
    friend.friend.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  // Create combined data array
  const createListData = useCallback((): ListItem[] => {
    const items: ListItem[] = [];

    // Add invitations section - show all invitations if any exist
    if (!loadingInvitations && invitations.length > 0) {
      items.push({ type: 'header', id: 'invitations-header', title: 'Friend requests' });
      
      invitations.forEach((invitation) => {
        items.push({ 
          type: 'invitation', 
          id: `invitation-${invitation.id}`, 
          data: invitation 
        });
      });
    }

    // Add search header for friends
    if (!loadingFriends) {
      items.push({ type: 'searchHeader', id: 'search-header' });
    }

    // Add friends section
    if (!loadingFriends) {
      if (filteredFriends.length === 0 && friends.length === 0) {
        items.push({ type: 'empty', id: 'empty-friends', text: 'You have no friends yet' });
      } else if (filteredFriends.length === 0 && searchTerm) {
        items.push({ type: 'empty', id: 'empty-search', text: 'No friends found' });
      } else {
        filteredFriends.forEach((friend) => {
          items.push({ 
            type: 'friend', 
            id: `friend-${friend.friend.id}`, 
            data: friend 
          });
        });

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
    }

    return items;
  }, [
    invitations, loadingInvitations,
    friends, filteredFriends, loadingFriends, hasMoreFriends, loadingMoreFriends,
    searchTerm
  ]);

  // Render list item (only for friends section now)
  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    switch (item.type) {
      case 'friend':
        const friend = item.data;
        return (
          <TouchableOpacity style={styles.friendItem} activeOpacity={0.7}>
            <View style={styles.friendContent}>
              <ClickableAvatarNative
                user={friend.friend}
                size={60}
                navigation={navigation} // Pass navigation prop
              />
              
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.friend.fullName}</Text>
                <Text style={styles.friendshipDuration}>
                  {getDaysSinceFriendship(friend.createdAt)}
                </Text>
              </View>
            </View>
            
            <View style={styles.friendActions}>
              <FriendOptionsModalNative
                text="⋯"
                variant="primary"
                size="small"
                actions={[
                  {
                    label: "View Profile",
                    onClick: () => {
                      // Navigate to profile using navigation prop
                      navigation.push('Profile', {
                        id: friend.friend.id.toString()
                      });
                    },
                  },
                  {
                    label: "Remove Friend",
                    onClick: () =>
                      confirmAndRemove(friend.friend.id, friend.friend.fullName, () => {
                        removeFriend(friend.friend.id);
                      }),
                    destructive: true,
                  },
                  { 
                    label: "Block", 
                    onClick: () => Alert.alert("Block", `Block ${friend.friend.fullName}?`) 
                  },
                  { 
                    label: "Report", 
                    onClick: () => Alert.alert("Report", `Report ${friend.friend.fullName}?`) 
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
        );

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
  if (loadingInvitations && loadingFriends) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" text="Loading..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Friend Requests Section - Fixed height with scrolling */}
      {!loadingInvitations && invitations.length > 0 && (
        <View style={[styles.friendRequestsSection, { maxHeight: screenHeight * 0.35 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Friend requests</Text>
          </View>
          <FlatList
            data={invitations}
            keyExtractor={(item) => `invitation-${item.id}`}
            renderItem={({ item: invite }) => (
              <View style={styles.invitationItem}>
                {invite.userSummary && (
                  <>
                    <View style={styles.invitationContent}>
                      <ClickableAvatarNative
                        user={invite.userSummary}
                        size={50}
                        navigation={navigation} // Pass navigation prop
                      />
                      <View style={styles.invitationText}>
                        <Text style={styles.invitationName}>{invite.userSummary.fullName}</Text>
                        <Text style={styles.invitationSubtext}>wants to be your friend</Text>
                      </View>
                    </View>
                    
                    <View style={styles.invitationButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleResponse(invite.id, "accept")}
                        disabled={handlingId === invite.id}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.actionButton, styles.declineButton]}
                        onPress={() => handleResponse(invite.id, "decline")}
                        disabled={handlingId === invite.id}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
            showsVerticalScrollIndicator={true}
            ItemSeparatorComponent={() => <View />}
            contentContainerStyle={styles.invitationsListContainer}
          />
        </View>
      )}

      {/* Friends Header Section - Separated from search */}
      {!loadingFriends && (
        <View style={styles.friendsHeaderSection}>
          <Text style={styles.friendsHeaderText}>Friends</Text>
        </View>
      )}

      {/* Search Section - Only contains search input */}
      {!loadingFriends && (
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor="#9CA3AF"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
        </View>
      )}

      {/* Friends Section - Flexible height */}
      <View style={styles.friendsSection}>
        <FlatList
          data={createListData()}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
  
  // Friend Requests Section
  friendRequestsSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  invitationsListContainer: {
    paddingBottom: 8,
  },
  
  // Friends Header Section - NEW
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
  
  // Search Section - Updated
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  
  searchInputContainer: {
    // Container for search input only
  },
  
  // Friends Section
  friendsSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  friendsListContainer: {
    paddingBottom: 40,
  },
  
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
    textAlign: 'center',
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
  
  invitationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'column',
    gap: 12,
  },
  
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  invitationText: {
    flex: 1,
  },
  
  invitationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  
  invitationSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  
  invitationButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  
  acceptButton: {
    backgroundColor: '#1C6B1C',
  },
  
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  
  declineButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  
  friendItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
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