import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useFriends } from "@/hooks/useFriends";
import { useFriendsOfUser } from "@/hooks/useFriendsOfUser";
import { useIsUserFriend } from "@/store/useUserCacheStore";
import ClickableAvatarNative from "../common/ClickableAvatarNative"; // Updated import path
import ButtonNative from "@/components/common/buttons/ButtonNative";
import SpinnerNative from "@/components/common/SpinnerNative";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "@/types/navigation";
import { FriendDTO } from "@shared/types/FriendDTO";

interface Props {
  userId?: number; // If provided, shows friends of this user. If not, shows current user's friends
  showSeeAllButton?: boolean; // Whether to show "See All Friends" button
  title?: string; // Optional title override
}

// Move FriendItem outside and memoize it
const FriendItem = React.memo(({ 
  friend, 
  showFriendBadge = false 
}: { 
  friend: FriendDTO; 
  showFriendBadge?: boolean;
}) => {
  const isFriend = useIsUserFriend(friend.friend.id);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>(); // Add navigation hook
  
  return (
    <View style={styles.friendItem}>
      <ClickableAvatarNative
        user={friend.friend}
        size={60}
        navigation={navigation} // Pass navigation prop
      />
     
      <View style={styles.friendTextContainer}>
        <Text style={styles.friendName}>{friend.friend.fullName}</Text>
        {showFriendBadge && isFriend && (
          <Text style={styles.friendBadge}>(Friend)</Text>
        )}
      </View>
    </View>
  );
});

FriendItem.displayName = 'FriendItem';

export default function ProfileFriendListNative({ 
  userId, 
  showSeeAllButton = false,
  title
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Use different hooks based on whether we have a userId
  const ownFriendsData = useFriends();
  const otherUserFriendsData = useFriendsOfUser(userId || 0);

  // Choose the appropriate data source
  const { friends, loading } = userId ? otherUserFriendsData : ownFriendsData;

  // Determine UI text based on context
  const isOtherUser = !!userId;
  const placeholderText = isOtherUser ? "Search their friends..." : "Search friends...";
  const emptyText = isOtherUser ? "This user has no visible friends" : "No friends found";
  const noResultsText = "No friends found matching your search";

  // Memoize filtered friends
  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return friends;
    
    return friends.filter((friend) =>
      friend.friend.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [friends, searchTerm]);

  // Calculate dynamic height based on content
  const getContainerStyle = () => {
    const baseHeight = 80; // Search input area
    const itemHeight = 80; // Height per friend item
    const buttonHeight = showSeeAllButton && friends.length > 0 ? 60 : 0;
    const emptyHeight = friends.length === 0 ? 120 : 0;
    
    if (friends.length === 0) {
      return [styles.container, { height: baseHeight + emptyHeight }];
    }
    
    const contentHeight = Math.min(filteredFriends.length * itemHeight, 400); // Max 400px for scroll area
    const totalHeight = baseHeight + contentHeight + buttonHeight;
    
    return [styles.container, { 
      height: totalHeight,
      maxHeight: 600 // Still keep a max for very long lists
    }];
  };

  const handleSeeAllFriends = () => {
    navigation.navigate('FriendScreen');
  };

  if (loading) {
    return (
      <View style={[styles.container, { height: 200 }]}>
        <View style={styles.loadingContainer}>
          <SpinnerNative text="Loading friends..." />
        </View>
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={getContainerStyle()}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={getContainerStyle()}>
      {/* Search Input - outside of ScrollView */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={placeholderText}
          placeholderTextColor="#9CA3AF"
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Friends List */}
      <View style={styles.scrollContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
        >
          {filteredFriends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchTerm ? noResultsText : emptyText}
              </Text>
            </View>
          ) : (
            filteredFriends.map((friend) => (
              <FriendItem 
                key={`friend-${friend.friend.id}`} 
                friend={friend}
                showFriendBadge={isOtherUser} // Only show badge when viewing other user's friends
              />
            ))
          )}
        </ScrollView>
      </View>
      
      {/* See All Friends Button - only for own friends */}
      {showSeeAllButton && friends.length > 0 && (
        <View style={styles.buttonContainer}>
          <ButtonNative
            text="See All Friends"
            onPress={handleSeeAllFriends}
            variant="primary"
            size="medium"
            fullWidth={true}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#1C6B1C',
    // Dynamic height based on content
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: '#1C6B1C',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  scrollContainer: {
    flex: 1,
    maxHeight: 400, // Max height for scroll area
  },
  scrollView: {
    flex: 1,
    borderRadius: 8,
  },
  scrollContent: {
    paddingBottom: 20,
    borderRadius: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderRadius: 8,
  },
  friendTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  friendBadge: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  buttonContainer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    justifyContent: 'center',
    // Fjern alignItems: 'center'
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});