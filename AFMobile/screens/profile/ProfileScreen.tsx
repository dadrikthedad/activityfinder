import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Text  } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getUserProfile } from '@/services/profile/profile';
import { useAuth } from '@/context/AuthContext';
import { PublicProfileDTO } from '@shared/types/PublicProfileDTO';
import PublicProfileViewNative from '@/components/profile/PublicProfileViewNative';
import SpinnerNative from '@/components/common/SpinnerNative';
import { ProfileScreenRouteProp } from '@/types/navigation';

export default function ProfileScreen() {
  const route = useRoute<ProfileScreenRouteProp>();
  const { id } = route.params;
  const userId = Number(id);
 
  const { token, userId: currentUserId } = useAuth();
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOwner = currentUserId === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
       
        if (!token) {
          throw new Error('No authentication token available');
        }
        const profileData = await getUserProfile(userId, token);
        setProfile(profileData as PublicProfileDTO);
      } catch (err) {
        console.error('❌ Failed to fetch profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
       
        Alert.alert(
          'Error',
          'Failed to load user profile. Please try again.',
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
      setError('Invalid user ID or missing authentication');
    }
  }, [userId, token]);

  // Show loading state
  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <SpinnerNative text="Loading profile..." />
      </View>
    );
  }

  // Show error state
  if (error || !profile) {
  return (
    <View style={styles.centeredContainer}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {error || "Failed to load profile"}
        </Text>
      </View>
    </View>
  );
}
{/* ✅ Changed from ScrollView to View */}
  return (
    <View style={styles.container}> 
      <PublicProfileViewNative
        profile={profile}
        isEditable={false}
        isOwner={isOwner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // ✅ Removed contentContainer since no ScrollView
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
    color: '#dc2626',
    textAlign: 'center',
  },
});