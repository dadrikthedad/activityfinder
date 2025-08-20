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
  Animated,
  Dimensions,
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
  Search,
  Users
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { useUserSearch } from '@/hooks/useUserSearch';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { useCurrentUser } from '@/store/useUserCacheStore';
import MiniAvatarNative from '@/components/common/MiniAvatarNative';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH)); // Start helt til høyre
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const currentUser = useCurrentUser();
  
  const { query, setQuery, results, loading } = useUserSearch();
  
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;
  
  const unreadMessageNotifications = useMessageNotificationStore(
    (state) => state.messageNotifications.filter((n) => !n.isRead).length
  );

  const handleToggleMenu = useCallback(() => {
    if (!isMenuOpen) {
      // Åpne menu - slide inn fra høyre
      setIsMenuOpen(true);
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH * 0.15, // Slide til 15% fra venstre (85% bredde)
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Lukk menu - slide ut til høyre
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setIsMenuOpen(false);
      });
    }
  }, [isMenuOpen, slideAnim]);

  const handleCloseMenu = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsMenuOpen(false);
    });
  }, [slideAnim]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchMode(prev => {
      if (prev) {
        setQuery("");
      }
      return !prev;
    });
  }, [setQuery]);

  const handleUserSelect = useCallback((user: UserSummaryDTO) => {
    navigation.navigate('Profile', { id: user.id.toString() });
    setIsSearchMode(false);
    setQuery("");
  }, [navigation, setQuery]);

  const handleNavigation = useCallback(
  <T extends keyof RootStackParamList>(screenName: T, params?: RootStackParamList[T]) => {
    handleCloseMenu();
    (navigation as any).navigate(screenName, params);
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
      handleNavigation('NotificationScreen');
    }
  }, [onNavigateToNotifications, handleNavigation]);

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
          <>
            <TouchableOpacity onPress={() => handleNavigation('Home')}>
              <Text style={styles.logo}>Magee.no</Text>
            </TouchableOpacity>

            <View style={styles.rightIcons}>
              {isLoggedIn && (
                <TouchableOpacity
                  onPress={handleToggleSearch}
                  style={styles.iconButton}
                >
                  <Search size={20} color="white" />
                </TouchableOpacity>
              )}

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

      {/* Search Results Dropdown */}
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

      {/* Slide-out Menu Modal - Animert fra høyre */}
      <Modal
        visible={isMenuOpen}
        animationType="none" // Bruker vår egen animasjon
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
          
          {/* Animert Menu Panel */}
          <Animated.View 
            style={[
              styles.menuPanel,
              {
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            <SafeAreaView style={styles.menuContent}>
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
              <ScrollView style={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        if (currentUser?.id) {
                          handleNavigation('Profile', { id: currentUser.id.toString() });
                        } else {
                          console.warn('No current user found for profile navigation');
                        }
                      }}
                      style={styles.menuItem}
                    >
                      <User size={18} color="#374151" />
                      <Text style={styles.menuItemText}>My Profile</Text>
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                      onPress={() => handleNavigation('Home')}
                      style={styles.menuItem}
                    >
                      <Home size={18} color="#374151" />
                      <Text style={styles.menuItemText}>Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('MessagesScreen')}
                      style={styles.menuItem}
                    >
                      <MessageSquare size={18} color="#374151" />
                      <Text style={styles.menuItemText}>Messages</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('FriendScreen')}
                      style={styles.menuItem}
                    >
                      <Users size={18} color="#374151" />
                      <Text style={styles.menuItemText}>Friends</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('TrashcanScreen')}
                      style={styles.menuItem}
                    >
                      <Trash2 size={18} color="#374151" />
                      <Text style={styles.menuItemText}>Trashcan</Text>
                    </TouchableOpacity>

                    <View style={styles.separator} />
                    
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
                    <TouchableOpacity
                      onPress={() => handleNavigation('Home')}
                      style={styles.menuItem}
                    >
                      <Home size={18} color="#374151" />
                      <Text style={styles.menuItemText}>Home</Text>
                    </TouchableOpacity>

                    <View style={styles.separator} />

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
          </Animated.View>
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
  // Oppdaterte modal styles for høyre-til-venstre slide
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent backdrop
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '85%', // Tar 85% av skjermen
    maxWidth: 320,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuContent: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  menuScrollContent: {
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