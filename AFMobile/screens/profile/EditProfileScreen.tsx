import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { getUserProfile } from '@/services/profile/profile';
import { useAuth } from '@/context/AuthContext';
import { PublicProfileDTO } from '@shared/types/PublicProfileDTO';
import PublicProfileViewNative from '@/components/profile/PublicProfileViewNative';
import SpinnerNative from '@/components/common/SpinnerNative';

export default function EditProfileScreen() {
  const { token, userId } = useAuth();
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
       
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

    if (userId && token) {
      fetchProfile();
    } else {
      setLoading(false);
      setError('Missing authentication or user ID');
    }
  }, [userId, token]);

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
          {/* Add your error UI here */}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <PublicProfileViewNative
        profile={profile}
        isEditable={true}
        isOwner={true}
      />
    </ScrollView>
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
});