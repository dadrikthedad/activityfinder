import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  Alert
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/services/profile/profile";
import ProfileInfoCardNative from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatarNative";
import ButtonNative from "@/components/common/ButtonNative";
import ProfileActionMenuNative from "@/components/profile/ProfileActionMenuNative";
import { PublicProfileDTO } from "@shared/types/PublicProfileDTO";
import { useIsUserFriend } from "@/store/useUserCacheStore";
import { useSendFriendInvitation } from "@/hooks/useSendFriendInvitation";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import ProfileFriendListNative from "../friends/ProfileFriendListNative";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";

interface PublicProfileViewProps {
  profile: PublicProfileDTO;
  isEditable?: boolean;
  isOwner?: boolean;
}

export default function PublicProfileViewNative({
  profile: initialProfile,
  isEditable = false,
  isOwner = false,
}: PublicProfileViewProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [reloadCounter] = useState(0);
  const { token, userId } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  // ✅ Use store directly - no API call needed
  const isFriend = useIsUserFriend(profile.userId);
  
  const { sendInvitation, sending, error } = useSendFriendInvitation();
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const isActuallyOwner = isOwner || (userId === profile.userId);

  const imageUrl =
    profile.profileImageUrl?.trim() !== ""
      ? profile.profileImageUrl
      : "/default-avatar.png";

  // Handle new message navigation
  const handleShowNewMessage = useCallback(() => {
    const receiver: UserSummaryDTO = {
      id: profile.userId,
      fullName: profile.fullName ?? "",
      profileImageUrl: profile.profileImageUrl ?? "/default-avatar.png"
    };
    
    // Navigate to NewConversationScreen with preselected user
    navigation.navigate('NewConversationScreen', {
      initialReceiver: receiver
    });
  }, [navigation, profile.userId, profile.fullName, profile.profileImageUrl]);

  const refetchProfile = useCallback(async () => {
    if (!initialProfile?.userId || !token) return;
    try {
      const updated = await getUserProfile(initialProfile.userId, token);
      setProfile(updated);
    } catch (error) {
      console.error("❌ Failed to refetch profile", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  }, [initialProfile?.userId, token]);

  const handleRemove = useCallback(async () => {
    await confirmAndRemove(profile.userId, profile.fullName ?? "this user", async () => {
      await refetchProfile();
      // Store will be updated automatically by confirmAndRemove
    });
  }, [confirmAndRemove, profile.userId, profile.fullName, refetchProfile]);

  const handleSendInvitation = useCallback(async () => {
    if (friendRequestSent) return;
    try {
      await sendInvitation(profile.userId);
      setFriendRequestSent(true);
    } catch (err) {
      console.error("❌ Failed to send friend invitation:", err);
      Alert.alert("Error", "Failed to send friend request. Please try again.");
    }
  }, [friendRequestSent, sendInvitation, profile.userId]);

  useEffect(() => {
    if (isEditable) {
      refetchProfile();
    }
  }, [reloadCounter, isEditable, refetchProfile]);

  // ✅ Create sections for FlatList
  const renderContent = () => {
    return (
      <View style={styles.contentContainer}>
        {/* Header with Avatar, Name and Actions */}
        <View style={styles.headerSection}>
          <ProfileAvatar
            imageUrl={imageUrl ?? "/default-avatar.png"}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />
          <Text style={styles.userName}>
            {profile.fullName || "Unknown User"}
          </Text>
          
          {/* Actions Section directly under name */}
          <View style={styles.actionsContainer}>
            {isActuallyOwner ? (
              // Owner actions
              isEditable ? (
                <>
                  <ButtonNative
                    text="Back to Profile"
                    onPress={() => navigation.navigate('Profile', { id: profile.userId.toString() })}
                    variant="outline"
                    fullWidth
                  />
                  <ButtonNative
                    text="Settings"
                    onPress={() => navigation.navigate('Settings')}
                    variant="secondary"
                    fullWidth
                  />
                </>
              ) : (
                <>
                  <ButtonNative
                    text="Edit Profile"
                    onPress={() => navigation.navigate('EditProfile')}
                    variant="primary"
                    fullWidth
                  />
                  <ButtonNative
                    text="Settings"
                    onPress={() => navigation.navigate('Settings')}
                    variant="secondary"
                    fullWidth
                  />
                </>
              )
            ) : (
              // Other user actions
              <>
                {isFriend ? (
                  <>
                    {/* Row with two buttons side by side */}
                    <View style={styles.buttonRow}>
                      <View style={styles.buttonHalf}>
                        <ButtonNative
                          text="Send Message"
                          onPress={handleShowNewMessage}
                          variant="primary"
                          fullWidth
                        />
                      </View>
                      <View style={styles.buttonHalf}>
                        <ButtonNative
                          text="Add as Friend"
                          onPress={() => {/* Already friends, maybe show different action */}}
                          variant="primary"
                          fullWidth
                          disabled
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Row with two buttons side by side */}
                   <View style={styles.buttonRow}>
                      <View style={styles.buttonHalf}>
                        <ButtonNative
                          text={
                            error === "A friend request is already pending between these users."
                              ? "Pending"  // Error: Allerede pending
                              : friendRequestSent
                              ? "Request Sent"  // Suksess: Vi sendte akkurat
                              : "Add as Friend"  // Normal state
                          }
                          onPress={handleSendInvitation}
                          variant={
                            error === "A friend request is already pending between these users." || friendRequestSent
                              ? "danger"  // Annen variant når forespørsel er sendt/pending
                              : "primary"
                          }
                          disabled={
                            sending ||
                            friendRequestSent ||
                            error === "A friend request is already pending between these users."
                          }
                          loading={sending}
                          loadingText="Sending..."
                          fullWidth
                        />
                      </View>
                      <View style={styles.buttonHalf}>
                        <ButtonNative
                          text="Send Message"
                          onPress={handleShowNewMessage}
                          variant="primary"
                          fullWidth
                        />
                      </View>
                    </View>
                  </>
                )}
                {/* More Options as regular button centered below */}
                <View style={styles.moreOptionsContainer}>
                  <ProfileActionMenuNative
                    isFriend={isFriend ?? false}
                    onRemoveFriend={handleRemove}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Main Profile Section */}
        <View style={styles.mainSection}>
          {/* Profile Info Card */}
          <View style={styles.profileInfoSection}>
            <ProfileInfoCardNative
              profile={profile}
              showEmail={profile.showEmail}
              isEditable={isEditable}
              refetchProfile={refetchProfile}
            />
          </View>
        </View>

        {/* Friends Section */}
        {!isEditable && (
          <View style={styles.friendsSection}>
            <Text style={styles.friendsTitle}>
              {isActuallyOwner ? "Your Friends" : "Friends"}
            </Text>
            <ProfileFriendListNative 
              userId={isActuallyOwner ? undefined : profile.userId}
              showSeeAllButton={isActuallyOwner}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={[]} // Empty data array
      renderItem={() => null} // Not used
      ListHeaderComponent={renderContent}
      showsVerticalScrollIndicator={false}
      keyExtractor={() => 'profile-content'}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#145214',
    marginTop: 16,
    marginBottom: 20,
  },
  mainSection: {
    flexDirection: 'column',
    gap: 20,
    marginBottom: 32,
  },
  profileInfoSection: {
    flex: 1,
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
  moreOptionsContainer: {
    width: '60%',
    alignSelf: 'center',
  },
  friendsSection: {
    marginTop: 40,
    width: '100%',
  },
  friendsTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#145214',
  },
});