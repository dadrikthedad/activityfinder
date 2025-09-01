import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { getUserProfile } from '@/services/profile/profile';
import { useAuth } from '@/context/AuthContext';
import { PublicProfileDTO } from '@shared/types/PublicProfileDTO';
import PublicProfileViewNative from '@/components/profile/PublicProfileViewNative';
import SpinnerNative from '@/components/common/SpinnerNative';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import authServiceNative from '@/services/user/authServiceNative';

export default function EditProfileScreen() {
  const { userId } = useAuth();
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
     
      const token = await authServiceNative.getAccessToken();
      if (!token || !userId) {
        throw new Error('No authentication token or user ID available');
      }

      const profileData = await getUserProfile(userId, token);
      setProfile(profileData as PublicProfileDTO);
    } catch (err) {
      console.error('❌ Failed to fetch profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
     
      // Show user-friendly error
      Alert.alert(
        'Error',
        'Failed to load your profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setLoading(false);
      setError('Missing authentication or user ID');
    }
  }, [userId]);

  // Show loading state
  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <SpinnerNative text="Loading your profile..." />
      </View>
    );
  }

  // Show error state
  if (error || !profile) {
  return (
    <View style={styles.centeredContainer}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {error || 'Failed to load profile'}
        </Text>
         <ButtonNative
            text="Try Again"
            onPress={fetchProfile} // Bruk samme funksjon
            variant="primary"
          />
      </View>
    </View>
  );
}

// Normal render - flytt denne utenfor error-blokken
return (
  <View style={styles.container}>
    <PublicProfileViewNative
      profile={profile}
      isEditable={true}
      isOwner={true}
      publicProfile={false} 
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
    errorText: {
    fontSize: 16,
    color: '#dc2626', // Tailwind red-600
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    fontWeight: '500',
    lineHeight: 24,
  },
});