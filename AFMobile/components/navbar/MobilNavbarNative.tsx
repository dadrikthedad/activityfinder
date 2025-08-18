// components/navigation/MobileNavbarNative.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  SafeAreaView,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { 
  Bell, 
  MessageSquare, 
  Menu, 
  X, 
  LogIn, 
  User, 
  Settings, 
  Home, 
  Trash2,
  Search // ✅ Added Search icon
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useUserSearch } from '@/hooks/useUserSearch'; // ✅ Import the search hook
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useCurrentUser } from '@/store/useUserCacheStore';
import MiniAvatarNative from '@/components/common/MiniAvatarNative'; // ✅ Import MiniAvatarNative

interface MobileNavbarNativeProps {
  onNavigateToMessages?: () => void;
  onNavigateToNotifications?: () => void;
}

export default function MobileNavbarNative({ 
  onNavigateToMessages,
  onNavigateToNotifications 
}: MobileNavbarNativeProps) {
  const { isLoggedIn, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false); // ✅ Search mode state
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const currentUser = useCurrentUser();
  
  // ✅ Use the search hook
  const { query, setQuery, results, loading } = useUserSearch();
  
  // General notification state for bell badge
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;
  
  // Message notification state for chat badge
  const unreadMessageNotifications = useMessageNotificationStore(
    (state) => state.messageNotifications.filter((n) => !n.isRead).length
  );

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // ✅ Search mode handlers
  const handleToggleSearch = useCallback(() => {
    setIsSearchMode(prev => {
      if (prev) {
        // Exiting search mode - clear search
        setQuery("");
      }
      return !prev;
    });
  }, [setQuery]);

  const handleUserSelect = useCallback((user: UserSummaryDTO) => {
    // Navigate to user's profile
    navigation.navigate('Profile', { id: user.id.toString() });
    // Exit search mode
    setIsSearchMode(false);
    setQuery("");
  }, [navigation, setQuery]);

  const handleNavigation = useCallback(
  <T extends keyof RootStackParamList>(screenName: T, params?: RootStackParamList[T]) => {
    handleCloseMenu();
    (navigation as any).navigate(screenName, params);;
  },
  [handleCloseMenu, navigation]
);

  const handleLogout = useCallback(() => {
    handleCloseMenu();
    logout();
  }, [handleCloseMenu, logout]);

  const handleMessagesPress = useCallback(() => {
    if (onNavigateToMessages) {
      onNavigateToMessages();
    } else {
      handleNavigation('MessagesScreen');
    }
  }, [onNavigateToMessages, handleNavigation]);

  const handleNotificationsPress = useCallback(() => {
    if (onNavigateToNotifications) {
      onNavigateToNotifications();
    } else {
      handleNavigation('Notifications');
    }
  }, [onNavigateToNotifications, handleNavigation]);

  // ✅ Render user search result item with MiniAvatarNative (like NewConversationScreen)
  const renderUserItem = ({ item }: { item: UserSummaryDTO }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
    >
      <MiniAvatarNative
        imageUrl={item.profileImageUrl ?? '/default-avatar.png'}
        alt={item.fullName}
        size={48}
        withBorder
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Main Navbar */}
      <View style={styles.navbar}>
        <StatusBar barStyle="light-content" backgroundColor="#1C6B1C" />
        
        {isSearchMode ? (
          // ✅ Search Mode Layout
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
            <TouchableOpacity
              onPress={handleToggleSearch}
              style={styles.iconButton}
            >
              <X size={20} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          // ✅ Normal Mode Layout
          <>
            {/* Logo */}
            <TouchableOpacity onPress={() => handleNavigation('Home')}>
              <Text style={styles.logo}>Magee.no</Text>
            </TouchableOpacity>

            {/* Right side icons */}
            <View style={styles.rightIcons}>
              {/* Search Icon - only visible when logged in */}
              {isLoggedIn && (
                <TouchableOpacity
                  onPress={handleToggleSearch}
                  style={styles.iconButton}
                >
                  <Search size={20} color="white" />
                </TouchableOpacity>
              )}

              {/* Messages Icon - only visible when logged in */}
              {isLoggedIn && (
                <TouchableOpacity
                  onPress={handleMessagesPress}
                  style={styles.iconButton}
                >
                  <MessageSquare size={20} color="white" />
                  {unreadMessageNotifications > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadMessageNotifications > 99 ? "99+" : unreadMessageNotifications.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Notifications Icon - only visible when logged in */}
              {isLoggedIn && (
                <TouchableOpacity
                  onPress={handleNotificationsPress}
                  style={styles.iconButton}
                >
                  <Bell size={20} color="white" />
                  {unreadNotifications > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadNotifications > 99 ? "99+" : unreadNotifications.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Menu Button */}
              <TouchableOpacity
                onPress={handleToggleMenu}
                style={styles.iconButton}
              >
                {isMenuOpen ? (
                  <X size={20} color="white" />
                ) : (
                  <Menu size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ✅ Search Results Dropdown - Updated to match NewConversationScreen style */}
      {isSearchMode && query.trim() && (
        <View style={styles.searchResults}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1C6B1C" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderUserItem}
              style={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No users found</Text>
            </View>
          )}
        </View>
      )}

      {/* Slide-out Menu Modal */}
      <Modal
        visible={isMenuOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseMenu}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop */}
          <TouchableOpacity 
            style={styles.backdrop}
            onPress={handleCloseMenu}
            activeOpacity={1}
          />
          
          {/* Menu Panel */}
          <SafeAreaView style={styles.menuPanel}>
            {/* Menu Header */}
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <TouchableOpacity
                onPress={handleCloseMenu}
                style={styles.closeButton}
              >
                <X size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Menu Content */}
            <ScrollView style={styles.menuContent} showsVerticalScrollIndicator={false}>
              {isLoggedIn ? (
                <>
                  {/* Logged in user - Profile first */}
                  <TouchableOpacity
                    onPress={() => {
                      if (currentUser?.id) {
                        handleNavigation('Profile', { id: currentUser.id.toString() });
                      } else {
                        // Fallback hvis ingen current user
                        console.warn('No current user found for profile navigation');
                      }
                    }}
                    style={styles.menuItem}
                  >
                    <User size={18} color="#374151" />
                    <Text style={styles.menuItemText}>My Profile</Text>
                  </TouchableOpacity>

                  <View style={styles.separator} />

                  {/* Navigation links */}
                  <TouchableOpacity
                    onPress={() => handleNavigation('Home')}
                    style={styles.menuItem}
                  >
                    <Home size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Home</Text>
                  </TouchableOpacity>

                  {/* Messages menu item for logged in users */}
                  <TouchableOpacity
                    onPress={() => handleNavigation('MessagesScreen')}
                    style={styles.menuItem}
                  >
                    <MessageSquare size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Messages</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleNavigation('TrashcanScreen')}
                    style={styles.menuItem}
                  >
                    <Trash2 size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Trashcan</Text>
                  </TouchableOpacity>

                  <View style={styles.separator} />
                  
                  {/* Settings */}
                  <TouchableOpacity
                    onPress={() => handleNavigation('EditProfile')}
                    style={styles.menuItem}
                  >
                    <User size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleNavigation('ProfileSettingsScreen')}
                    style={styles.menuItem}
                  >
                    <Settings size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Settings</Text>
                  </TouchableOpacity>

                  <View style={styles.separator} />

                  {/* Logout */}
                  <TouchableOpacity
                    onPress={handleLogout}
                    style={[styles.menuItem, styles.logoutItem]}
                  >
                    <LogIn size={18} color="white" />
                    <Text style={styles.logoutText}>Log Out</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Not logged in - navigation links first */}
                  <TouchableOpacity
                    onPress={() => handleNavigation('Home')}
                    style={styles.menuItem}
                  >
                    <Home size={18} color="#374151" />
                    <Text style={styles.menuItemText}>Home</Text>
                  </TouchableOpacity>

                  <View style={styles.separator} />

                  {/* Login and signup */}
                  <TouchableOpacity
                    onPress={() => handleNavigation('Login')}
                    style={styles.menuItem}
                  >
                    <LogIn size={18} color="#1C6B1C" />
                    <Text style={styles.loginText}>Log In</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleNavigation('Signup')}
                    style={[styles.menuItem, styles.signupItem]}
                  >
                    <User size={18} color="white" />
                    <Text style={styles.signupText}>Create Account</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#9CA3AF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // ✅ Search-related styles
  searchContainer: {
    flex: 1,
    marginRight: 12,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#374151',
  },
  searchResults: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resultsList: {
    maxHeight: 300,
  },
  // ✅ Updated user item styles to match NewConversationScreen
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  // Existing modal styles...
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuPanel: {
    width: 320,
    maxWidth: '85%',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  closeButton: {
    padding: 4,
    borderRadius: 4,
  },
  menuContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
    marginVertical: 2,
  },
  menuItemText: {
    fontSize: 16,
    color: '#374151',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  logoutItem: {
    backgroundColor: '#9CA3AF',
  },
  logoutText: {
    fontSize: 16,
    color: 'white',
  },
  loginText: {
    fontSize: 16,
    color: '#1C6B1C',
    fontWeight: '500',
  },
  signupItem: {
    backgroundColor: '#1C6B1C',
  },
  signupText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
});