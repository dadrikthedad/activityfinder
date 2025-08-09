// components/reactions/ReactionUsersModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { ReactionDTO } from '@shared/types/MessageDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useModal } from '@/context/ModalContext';
import MiniAvatarNative from '../common/MiniAvatarNative';

interface ReactionUsersModalProps {
  emoji: string; // Dette brukes ikke lenger, men beholder for bakoverkompatibilitet
  reactions: ReactionDTO[];
  visible: boolean;
  onClose: () => void;
  onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void;
  conversationParticipants?: UserSummaryDTO[];
}

interface GroupedReaction {
  emoji: string;
  users: UserSummaryDTO[];
}

export const ReactionUsersModal: React.FC<ReactionUsersModalProps> = ({
  emoji, // Ikke brukt lenger, men beholder for bakoverkompatibilitet
  reactions,
  visible,
  onClose,
  onShowUserPopover,
  conversationParticipants = []
}) => {
  // Grupper reaksjoner etter emoji og filtrer ut removed reactions
  const groupedReactions = React.useMemo(() => {
    const reactionMap = new Map<string, Array<UserSummaryDTO>>();
    
    reactions
      .filter(reaction => !reaction.isRemoved)
      .forEach(reaction => {
        const emojiKey = reaction.emoji;
        if (!reactionMap.has(emojiKey)) {
          reactionMap.set(emojiKey, []);
        }
        
        const users = reactionMap.get(emojiKey)!;
        // Sjekk om bruker allerede er lagt til (unngå duplikater)
        if (!users.some(user => user.id === reaction.userId)) {
          // Finn komplett brukerdata fra participants
          const completeUser = conversationParticipants.find(p => p.id === reaction.userId);
          
          if (completeUser) {
            // Bruk den komplette UserSummaryDTO fra participants
            users.push(completeUser);
          } else {
            // Fallback: Lag minimal UserSummaryDTO hvis bruker ikke finnes i participants
            const fallbackUser: UserSummaryDTO = {
              id: reaction.userId,
              fullName: reaction.userFullName || `User ${reaction.userId}`,
              profileImageUrl: null,
              isFriend: undefined,
              isBlocked: undefined,
              hasBlockedMe: undefined,
              lastUpdated: undefined,
              groupRequestStatus: undefined
            };
            users.push(fallbackUser);
          }
        }
      });
    
    return Array.from(reactionMap.entries())
      .map(([emoji, users]) => ({
        emoji,
        users: users.sort((a, b) => a.fullName.localeCompare(b.fullName))
      }))
      .sort((a, b) => b.users.length - a.users.length); // Sorter etter popularitet (mest brukte først)
  }, [reactions, conversationParticipants]);

  // Beregn totalt antall personer som har reagert
  const totalReactions = groupedReactions.reduce((sum, group) => sum + group.users.length, 0);

  // Håndter bruker-klikk
  const handleUserPress = (user: UserSummaryDTO) => {
    if (onShowUserPopover) {
      // Vis popover i sentrum av skjermen
      onShowUserPopover(user, { x: 150, y: 300 });
      
      // Lukk modal etter å ha åpnet popover
      onClose();
    }
  };

  if (!visible || groupedReactions.length === 0) {
    return null;
  }

  return (
    <View style={styles.modalContainer}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            Alle reaksjoner ({totalReactions})
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.usersList} showsVerticalScrollIndicator={false}>
        {groupedReactions.map((group, groupIndex) => (
          <View key={group.emoji} style={styles.emojiGroup}>
            {/* Emoji header */}
            <View style={styles.emojiHeader}>
              <Text style={styles.emoji}>{group.emoji}</Text>
              <Text style={styles.emojiCount}>
                {group.users.length} {group.users.length === 1 ? 'person' : 'personer'}
              </Text>
            </View>
            
            {/* Brukere for denne emoji-en */}
            {group.users.map((user) => (
              <TouchableOpacity 
                key={`${group.emoji}-${user.id}`}
                style={styles.userItem}
                onPress={() => {
                  console.log('🖱️ User pressed:', user.fullName);
                  handleUserPress(user);
                }}
                activeOpacity={0.7}
              >
                <MiniAvatarNative
                  imageUrl={user.profileImageUrl || "/default-avatar.png"}
                  size={32}
                />
                <Text style={styles.userName}>{user.fullName}</Text>
              </TouchableOpacity>
            ))}
            
            {/* Separator mellom emoji-grupper (ikke på siste) */}
            {groupIndex < groupedReactions.length - 1 && (
              <View style={styles.groupSeparator} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// Hook for enkel bruk av ReactionUsersModal
export const useReactionUsersModal = () => {
  const { showModal, hideModal } = useModal();

  const showReactionUsers = (
    emoji: string, 
    reactions: ReactionDTO[], 
    onShowUserPopover?: (user: UserSummaryDTO, pos: { x: number; y: number }) => void,
    conversationParticipants?: UserSummaryDTO[]
  ) => {
    const modalContent = (
      <ReactionUsersModal
        emoji={emoji}
        reactions={reactions}
        visible={true}
        onClose={hideModal}
        onShowUserPopover={onShowUserPopover}
        conversationParticipants={conversationParticipants}
      />
    );

    showModal(modalContent, {
      blurBackground: true,
      dismissOnBackdrop: true
    });
  };

  return { showReactionUsers };
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxWidth: 320,
    width: 300,
    maxHeight: 500, // Økt høyde for flere reaksjoner
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  usersList: {
    maxHeight: 360, // Økt høyde
    paddingHorizontal: 16,
  },
  emojiGroup: {
    marginBottom: 8,
  },
  emojiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emoji: {
    fontSize: 20,
  },
  emojiCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
    borderRadius: 8,
    marginLeft: 8, // Innrykk under emoji
  },
  userName: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  groupSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
    marginHorizontal: 4,
  },
});