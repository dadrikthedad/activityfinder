// components/messages/ParticipantsListNative.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView
} from 'react-native';
import { GroupRequestStatus } from '@shared/types/UserSummaryDTO';
import { ConversationParticipantDTO } from '@shared/types/ConversationDTO';
import { deriveGroupRequestStatus } from '@/features/conversation/utils/conversationHelpers';
import ClickableAvatarNative from '../common/ClickableAvatarNative';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types/navigation';

interface ParticipantsListNativeProps {
  participants: ConversationParticipantDTO[];
  showGroupRequestStatus?: boolean;
  closeModalOnAction?: boolean; // Controls if popover should close parent modal
}

export function ParticipantsListNative({
  participants,
  showGroupRequestStatus = false,
  closeModalOnAction = true,
}: ParticipantsListNativeProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>(); // Add navigation hook

  const getStatusInfo = (participant: ConversationParticipantDTO) => {
    if (!showGroupRequestStatus) return null;

    const status = deriveGroupRequestStatus(participant);

    if (status === GroupRequestStatus.Creator) {
      return { text: "(creator)", color: "#16A34A" };
    }
    if (status === GroupRequestStatus.Pending) {
      return { text: "(inv)", color: "#EAB308" };
    }
    return null;
  };

  const getStatusOrder = (status: GroupRequestStatus): number => {
    if (status === GroupRequestStatus.Creator) return 0;
    if (status === GroupRequestStatus.Approved) return 1;
    if (status === GroupRequestStatus.Pending) return 2;
    return 4;
  };

  const sortedParticipants = showGroupRequestStatus
    ? [...participants].sort(
        (a, b) => getStatusOrder(deriveGroupRequestStatus(a)) - getStatusOrder(deriveGroupRequestStatus(b)),
      )
    : participants;

  const renderParticipant = (participant: ConversationParticipantDTO) => {
    const statusInfo = getStatusInfo(participant);

    return (
      <View key={participant.user.id.toString()} style={styles.participantItem}>
        {/* Use ClickableAvatarNative instead of MiniAvatarNative + TouchableOpacity */}
        <ClickableAvatarNative
          user={participant.user}
          size={showGroupRequestStatus ? 32 : 24}
          isGroup={false}
          participants={[]}
          isPendingRequest={false}
          closeModalOnAction={closeModalOnAction}
          navigation={navigation}
        />

        <View style={styles.participantInfo}>
          <Text
            style={styles.participantName}
            numberOfLines={1}
          >
            {participant.user.fullName}
          </Text>
          {statusInfo && (
            <Text style={[styles.participantStatus, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.participantsList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {sortedParticipants.map(renderParticipant)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
  },
  participantsList: {
    // Fjernet flexGrow siden vi ikke bruker FlatList lenger
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  participantStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});