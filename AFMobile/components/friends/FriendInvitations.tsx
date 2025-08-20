// components/friends/FriendInvitations.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput
} from 'react-native';
import { useFriendRequestHandlerNative } from '@/hooks/friends/useFriendInvitationsHandlerNative';
import { useFriendInvitations } from '@/hooks/useFriendInvitations';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import { FriendInvitationDTO } from '@shared/types/FriendInvitationDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { showNotificationToastNative, LocalToastType } from '../toast/NotificationToastNative';

// Interface for ghost invitation (akseptert invitasjon som vises i 10 sek)
interface GhostInvitation {
  id: number;
  userSummary: UserSummaryDTO;
  acceptedAt: number;
  type: 'accepted';
}

interface FriendInvitationsProps {
  navigation: any;
  maxHeight?: string | number; // For å kontrollere høyde
  showHeader?: boolean; // Om vi skal vise "Friend requests" header
  maxItems?: number; // Nytt: maksimalt antall invitasjoner som vises
  showViewAllButton?: boolean; // Nytt: om vi skal vise "Se alle" knapp
  onViewAll?: () => void; // Nytt: callback for når "Se alle" trykkes
  showSearchField?: boolean; // Nytt: viser eget søkefelt for friend requests
}

export default function FriendInvitations({ 
  navigation, 
  maxHeight = '35%', 
  showHeader = true,
  maxItems,
  showViewAllButton = false,
  onViewAll,
  showSearchField = false
}: FriendInvitationsProps) {
  const [ghostInvitations, setGhostInvitations] = useState<GhostInvitation[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const screenHeight = Dimensions.get('window').height;

  // Hooks
  const { invitations, loading: loadingInvitations } = useFriendInvitations();
  const { handleResponse, handlingId } = useFriendRequestHandlerNative();
  const setUserFriendStatus = useUserCacheStore(state => state.setUserFriendStatus);

  // Clean up expired ghost invitations every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setGhostInvitations(prev => {
        const filtered = prev.filter(ghost => now - ghost.acceptedAt < 10000); // 10 sekunder
        
        if (filtered.length !== prev.length) {
          console.log(`👻 Cleaned up ${prev.length - filtered.length} expired ghost invitations`);
        }
        
        return filtered;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle accepting invitations
  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      
      if (!invitation?.userSummary) {
        console.error('Cannot accept invitation - no user data found');
        return;
      }

      // Create ghost invitation FIRST (before API call)
      const ghostInvitation: GhostInvitation = {
        id: invitationId,
        userSummary: invitation.userSummary,
        acceptedAt: Date.now(),
        type: 'accepted'
      };

      setGhostInvitations(prev => [
        ...prev.filter(ghost => ghost.id !== invitationId),
        ghostInvitation
      ]);

      // Set friend status optimistically
      setUserFriendStatus(invitation.userSummary.id, true, false);
      console.log('👥 Optimistically set friend status for:', invitation.userSummary.fullName);
      
      // API call - this will remove invitation from store immediately
      await handleResponse(invitationId, "accept");
      
      console.log('✅ Friend request accepted successfully');

      showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Friend Request Accepted",
          customBody: `You are now friends with ${invitation.userSummary.fullName}!`,
          position: 'top'
        });
      
    } catch (error) {
      console.error('Error accepting invitation:', error);
      
      // Revert all changes on error
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (invitation?.userSummary) {
        setUserFriendStatus(invitation.userSummary.id, false, false);
        console.log('❌ Reverted optimistic friend status');
      }
      
      // Remove ghost invitation
      setGhostInvitations(prev => prev.filter(ghost => ghost.id !== invitationId));
    }
  };

  // Handle closing ghost invitation manually
  const handleCloseGhostInvitation = (invitationId: number) => {
    setGhostInvitations(prev => prev.filter(ghost => ghost.id !== invitationId));
  };

  // Combine real invitations with ghost invitations for rendering
  const allInvitations = [
    ...invitations.map(inv => ({ type: 'real' as const, data: inv })),
    ...ghostInvitations.map(ghost => ({ type: 'ghost' as const, data: ghost }))
  ];

  // Apply search filter if search field is shown and there's a search term
  const filteredInvitations = showSearchField && localSearchTerm ? 
    allInvitations.filter(item => {
      const name = item.data.userSummary?.fullName?.toLowerCase() || '';
      return name.includes(localSearchTerm.toLowerCase());
    }) : allInvitations;

  // Apply maxItems limit if specified
  const displayedInvitations = maxItems ? filteredInvitations.slice(0, maxItems) : filteredInvitations;
  const hasMoreInvitations = maxItems && filteredInvitations.length > maxItems;

  // Render individual invitation item
  const renderInvitation = ({ item }: { item: { type: 'real' | 'ghost', data: any } }) => {
    if (item.type === 'real') {
      const invite: FriendInvitationDTO = item.data;
      
      return (
        <View style={styles.invitationItem}>
          {invite.userSummary && (
            <>
              <View style={styles.invitationContent}>
                <ClickableAvatarNative
                  user={invite.userSummary}
                  size={50}
                  navigation={navigation}
                />
                <View style={styles.invitationText}>
                  <Text style={styles.invitationName}>{invite.userSummary.fullName}</Text>
                  <Text style={styles.invitationSubtext}>wants to be your friend</Text>
                </View>
              </View>
              
              <View style={styles.invitationButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAcceptInvitation(invite.id)}
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
      );
    } else {
      // Ghost invitation
      const ghost: GhostInvitation = item.data;
      
      return (
        <View style={[styles.invitationItem, styles.acceptedInvitationItem]}>
          <View style={styles.invitationContent}>
            <ClickableAvatarNative
              user={ghost.userSummary}
              size={50}
              navigation={navigation}
            />
            <View style={styles.invitationText}>
              <Text style={styles.invitationName}>{ghost.userSummary.fullName}</Text>
              <View style={styles.invitationSubtextContainer}>
                <Text style={[styles.invitationSubtext, styles.acceptedText]}>
                  Friend accepted!
                </Text>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.invitationButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.visitProfileButton]}
              onPress={() => {
                navigation.push('Profile', {
                  id: ghost.userSummary.id.toString()
                });
              }}
            >
              <Text style={styles.visitProfileButtonText}>Visit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton]}
              onPress={() => handleCloseGhostInvitation(ghost.id)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  // Don't render if loading or no invitations
  if (loadingInvitations || allInvitations.length === 0) {
    return null;
  }

  // Show empty state when searching with no results
  if (showSearchField && localSearchTerm && filteredInvitations.length === 0 && allInvitations.length > 0) {
    const calculatedMaxHeight = typeof maxHeight === 'string' 
      ? screenHeight * (parseFloat(maxHeight.replace('%', '')) / 100)
      : maxHeight;

    return (
      <View style={[styles.container, { maxHeight: calculatedMaxHeight }]}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.headerText}>Friend requests</Text>
          </View>
        )}
        
        {showSearchField && (
          <View style={styles.searchSection}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search friend requests..."
              placeholderTextColor="#9CA3AF"
              value={localSearchTerm}
              onChangeText={setLocalSearchTerm}
            />
          </View>
        )}
        
        <View style={styles.emptySearchState}>
          <Text style={styles.emptySearchText}>No friend requests found</Text>
          <Text style={styles.emptySearchSubtext}>
            Try searching for a different name
          </Text>
        </View>
      </View>
    );
  }

  const calculatedMaxHeight = typeof maxHeight === 'string' 
    ? screenHeight * (parseFloat(maxHeight.replace('%', '')) / 100)
    : maxHeight;

  return (
    <View style={[styles.container, { maxHeight: calculatedMaxHeight }]}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.headerText}>Friend requests</Text>
        </View>
      )}
      
      {/* Search Section - only shown if showSearchField is true */}
      {showSearchField && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search friend requests..."
            placeholderTextColor="#9CA3AF"
            value={localSearchTerm}
            onChangeText={setLocalSearchTerm}
          />
        </View>
      )}
      
      <FlatList
        data={displayedInvitations}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        renderItem={renderInvitation}
        showsVerticalScrollIndicator={true}
        ItemSeparatorComponent={() => <View />}
        contentContainerStyle={styles.listContainer}
      />

      {/* View All Button */}
      {showViewAllButton && hasMoreInvitations && (
        <View style={styles.viewAllButtonContainer}>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={onViewAll}
            activeOpacity={0.8}
          >
            <Text style={styles.viewAllButtonText}>
              View all {showSearchField && localSearchTerm ? filteredInvitations.length : allInvitations.length} friend requests
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  
  listContainer: {
    paddingBottom: 8,
  },
  
  invitationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'column',
    gap: 12,
  },

  acceptedInvitationItem: {
    backgroundColor: '#ffffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#1C6B1C',
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

  invitationSubtextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  invitationSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },

  acceptedText: {
    color: '#1C6B1C',
    fontWeight: '600',
  },

  checkmark: {
    fontSize: 14,
    color: '#1C6B1C',
    fontWeight: 'bold',
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
    backgroundColor: '#9CA3AF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  
  declineButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  visitProfileButton: {
    backgroundColor: '#1C6B1C',
  },

  visitProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },

  closeButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

  // New styles for View All button
  viewAllButtonContainer: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  viewAllButton: {
    backgroundColor: '#1C6B1C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Empty search state styles
  emptySearchState: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  emptySearchText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },

  emptySearchSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Search section styles
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  searchInput: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});