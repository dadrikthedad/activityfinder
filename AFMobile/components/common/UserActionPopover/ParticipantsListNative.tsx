// ParticipantsListNative.tsx - Stack navigation approach
import React, { useCallback } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  StyleSheet,
  Alert 
} from "react-native";
import { UserSummaryDTO, GroupRequestStatus } from "@shared/types/UserSummaryDTO";

interface ParticipantsListNativeProps {
  participants: UserSummaryDTO[];
  navigation: any; // React Navigation
  onSendMessageToUser?: (user: UserSummaryDTO) => void;
}

export default function ParticipantsListNative({
  participants,
  navigation,
  onSendMessageToUser
}: ParticipantsListNativeProps) {


  const showUserActionSheet = useCallback((user: UserSummaryDTO) => {
    Alert.alert(
      user.fullName || 'User Actions',
      'Choose an action',
      [
        { 
          text: 'Visit Profile', 
          onPress: () => navigation.navigate('Profile', { userId: user.id }) // Consistent naming
        },
        { 
          text: 'Send Message', 
          onPress: () => {
            if (onSendMessageToUser) {
              onSendMessageToUser(user);
            } else {
              navigation.navigate('Chat', { user });
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [navigation, onSendMessageToUser]);

  const getStatusInfo = (participant: UserSummaryDTO) => {
    const status = participant.groupRequestStatus;
   
    if (status === "Creator" || status === GroupRequestStatus.Creator) {
      return { text: "(creator)", style: styles.creatorText };
    }
    if (status === "Pending" || status === GroupRequestStatus.Pending) {
      return { text: "(inv)", style: styles.pendingText };
    }
    return null;
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    const getStatusOrder = (status: GroupRequestStatus | string | null | undefined): number => {
      if (status === "Creator" || status === GroupRequestStatus.Creator) return 0;
      if (status === "Approved" || status === GroupRequestStatus.Approved) return 1;
      if (status === "Pending" || status === GroupRequestStatus.Pending) return 2;
      return 4;
    };
    
    return getStatusOrder(a.groupRequestStatus) - getStatusOrder(b.groupRequestStatus);
  });

  const renderParticipant = useCallback(({ item: participant }: { item: UserSummaryDTO }) => {
    const statusInfo = getStatusInfo(participant);

    return (
      <TouchableOpacity
        style={styles.participantItem}
        onPress={() => showUserActionSheet(participant)} // Use action sheet instead
      >
        <Image
          source={{ 
            uri: participant.profileImageUrl || "/default-avatar.png" 
          }}
          style={styles.avatar}
        />
        
        <View style={styles.participantInfo}>
          <View style={styles.nameContainer}>
            <Text style={styles.participantName} numberOfLines={1}>
              {participant.fullName}
            </Text>
            {statusInfo && (
              <Text style={[styles.statusText, statusInfo.style]}>
                {statusInfo.text}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [showUserActionSheet]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Group Members ({participants.length})</Text>
      
      <FlatList
        data={sortedParticipants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    color: '#1C6B1C',
  },
  list: {
    flex: 1,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  creatorText: {
    color: '#059669',
  },
  pendingText: {
    color: '#6b7280',
  },
});