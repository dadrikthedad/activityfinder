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
import ProfileAvatarNative from "@/components/ProfileAvatarNative";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import ProfileActionMenuNative from "@/components/profile/ProfileActionMenuNative";
import { PublicProfileDTO } from "@shared/types/PublicProfileDTO";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import authServiceNative from '@/services/user/authServiceNative';

interface PublicProfileViewProps {
  profile: PublicProfileDTO;
  isEditable?: boolean;
  isOwner?: boolean;
  publicProfile: boolean;
}

export default function PublicProfileViewNative({
  profile: initialProfile,
  isEditable = false,
  isOwner = false,
  publicProfile,
}: PublicProfileViewProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [reloadCounter] = useState(0);
  const { userId } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const isActuallyOwner = isOwner || (userId === profile.userId);

  const handleShowNewMessage = useCallback(() => {
    const receiver: UserSummaryDTO = {
      id: profile.userId,
      fullName: profile.fullName ?? "",
      profileImageUrl: profile.profileImageUrl ?? "/default-avatar.png"
    };
    navigation.navigate('NewConversationScreen', { initialReceiver: receiver });
  }, [navigation, profile.userId, profile.fullName, profile.profileImageUrl]);

  const refetchProfile = useCallback(async () => {
    const token = await authServiceNative.getAccessToken();
    if (!initialProfile?.userId || !token) return;
    try {
      const updated = await getUserProfile(initialProfile.userId, token);
      setProfile(updated);
    } catch (error) {
      console.error("❌ Failed to refetch profile", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  }, [initialProfile?.userId]);

  useEffect(() => {
    if (isEditable) {
      refetchProfile();
    }
  }, [reloadCounter, isEditable, refetchProfile]);

  if (!publicProfile && !isActuallyOwner) {
    const renderPrivateProfile = () => (
      <View style={styles.privateProfileContainer}>
        <ProfileAvatarNative
          imageUrl={profile.profileImageUrl ?? "/default-avatar.png"}
          isEditable={false}
        />
        <Text style={styles.userName}>
          {profile.fullName || "Unknown User"}
        </Text>
        <View style={styles.privateMessageContainer}>
          <Text style={styles.privateMessageTitle}>This user is set to private</Text>
          <Text style={styles.privateMessageText}>
            You cannot view this user's profile details.
          </Text>
        </View>
      </View>
    );

    return (
      <FlatList
        style={styles.container}
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={renderPrivateProfile}
        showsVerticalScrollIndicator={false}
        keyExtractor={() => 'private-profile-content'}
      />
    );
  }

  const renderContent = () => (
    <View style={styles.contentContainer}>
      <View style={styles.headerSection}>
        <ProfileAvatarNative
          imageUrl={profile.profileImageUrl ?? "/default-avatar.png"}
          isEditable={isEditable}
          refetchProfile={refetchProfile}
        />
        <Text style={styles.userName}>
          {profile.fullName || "Unknown User"}
        </Text>

        <View style={styles.actionsContainer}>
          {isActuallyOwner ? (
            isEditable ? (
              <>
                <ButtonNative
                  text="Back to Profile"
                  onPress={() => navigation.navigate('Profile', { id: profile.userId.toString() })}
                  variant="secondary"
                  fullWidth
                />
                <ButtonNative
                  text="Settings"
                  onPress={() => navigation.navigate('ProfileSettingsScreen')}
                  variant="primary"
                  fullWidth
                />
              </>
            ) : (
              <>
                <ButtonNative
                  text="Edit Profile"
                  onPress={() => navigation.navigate('EditProfileScreen')}
                  variant="primary"
                  fullWidth
                />
                <ButtonNative
                  text="Settings"
                  onPress={() => navigation.navigate('ProfileSettingsScreen')}
                  variant="primary"
                  fullWidth
                />
              </>
            )
          ) : (
            <>
              <ButtonNative
                text="Send Message"
                onPress={handleShowNewMessage}
                variant="primary"
                fullWidth
              />
              <View style={styles.moreOptionsContainer}>
                <ProfileActionMenuNative
                  userId={profile.userId}
                  userName={profile.fullName}
                />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.mainSection}>
        <View style={styles.profileInfoSection}>
          <ProfileInfoCardNative
            profile={profile}
            showEmail={profile.showEmail}
            isEditable={isEditable}
            refetchProfile={refetchProfile}
          />
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={[]}
      renderItem={() => null}
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
  privateProfileContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    minHeight: 400,
  },
  privateMessageContainer: {
    marginTop: 40,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    width: '100%',
  },
  privateMessageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    textAlign: 'center',
  },
  privateMessageText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
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
  moreOptionsContainer: {
    width: '60%',
    alignSelf: 'center',
  },
});
