// components/friends/FriendInvitations.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { useFriendRequestHandler } from '@/hooks/friends/useFriendInvitationsHandler';
import { useFriendInvitations } from '@/hooks/useFriendInvitations';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import ClickableAvatarNative from '@/components/common/ClickableAvatarNative';
import { FriendInvitationDTO } from '@shared/types/FriendInvitationDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';

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
}

export default function FriendInvitations({ 
  navigation, 
  maxHeight = '35%', 
  showHeader = true 
}: FriendInvitationsProps) {
  const [ghostInvitations, setGhostInvitations] = useState<GhostInvitation[]>([]);
  const screenHeight = Dimensions.get('window').height;

  // Hooks
  const { invitations, loading: loadingInvitations } = useFriendInvitations();
  const { handleResponse, handlingId } = useFriendRequestHandler();
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
      
      <FlatList
        data={allInvitations}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        renderItem={renderInvitation}
        showsVerticalScrollIndicator={true}
        ItemSeparatorComponent={() => <View />}
        contentContainerStyle={styles.listContainer}
      />
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
});