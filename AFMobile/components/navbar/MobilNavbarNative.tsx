// components/navbar/MobilNavbarNative.tsx
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
  LogOut,
  User,
  Settings,
  Home,
  Trash2,
  Search,
  Users,
  Bug,
} from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
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
  onNavigateToNotifications,
}: MobileNavbarNativeProps) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const { isLoggedIn, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH));
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
      setIsMenuOpen(true);
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH * 0.15,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
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
    setIsSearchMode((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  }, [setQuery]);

  const handleUserSelect = useCallback(
    (user: UserSummaryDTO) => {
      navigation.navigate('Profile', { id: user.id.toString() });
      setIsSearchMode(false);
      setQuery('');
    },
    [navigation, setQuery]
  );

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
      style={[styles.userItem, { borderBottomColor: theme.colors.border }]}
      onPress={() => handleUserSelect(item)}
    >
      <MiniAvatarNative
        imageUrl={item.profileImageUrl ?? '/default-avatar.png'}
        alt={item.fullName}
        size={48}
        withBorder
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.colors.textPrimary }]}>{item.fullName}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={[styles.navbar, { backgroundColor: theme.colors.navbar }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.navbar} />

        {isSearchMode ? (
          <>
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  { backgroundColor: theme.colors.backgroundInput, color: theme.colors.textPrimary },
                ]}
                placeholder={t('navbar.search')}
                placeholderTextColor={theme.colors.textPlaceholder}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
            </View>
            <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton}>
              <X size={20} color={theme.colors.navbarText} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => handleNavigation('Home')}>
              <Text style={[styles.logo, { color: theme.colors.navbarText }]}>Magee.no</Text>
            </TouchableOpacity>

            <View style={styles.rightIcons}>
              {isLoggedIn && (
                <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton}>
                  <Search size={20} color={theme.colors.navbarText} />
                </TouchableOpacity>
              )}

              {isLoggedIn && (
                <TouchableOpacity onPress={handleMessagesPress} style={styles.iconButton}>
                  <MessageSquare size={20} color={theme.colors.navbarText} />
                  {unreadMessageNotifications > 0 && (
                    <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                      <Text style={styles.badgeText}>
                        {unreadMessageNotifications > 99 ? '99+' : unreadMessageNotifications.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {isLoggedIn && (
                <TouchableOpacity onPress={handleNotificationsPress} style={styles.iconButton}>
                  <Bell size={20} color={theme.colors.navbarText} />
                  {unreadNotifications > 0 && (
                    <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                      <Text style={styles.badgeText}>
                        {unreadNotifications > 99 ? '99+' : unreadNotifications.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={handleToggleMenu} style={styles.iconButton}>
                {isMenuOpen ? (
                  <X size={20} color={theme.colors.navbarText} />
                ) : (
                  <Menu size={20} color={theme.colors.navbarText} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {isSearchMode && query.trim() && (
        <View style={[styles.searchResults, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                {t('navbar.searching')}
              </Text>
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
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
                {t('navbar.noUsersFound')}
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={isMenuOpen}
        animationType="none"
        transparent={true}
        onRequestClose={handleCloseMenu}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            onPress={handleCloseMenu}
            activeOpacity={1}
          />

          <Animated.View
            style={[
              styles.menuPanel,
              { backgroundColor: theme.colors.surface, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SafeAreaView style={styles.menuContent}>
              <View style={[styles.menuHeader, { backgroundColor: theme.colors.navbar }]}>
                <Text style={[styles.menuTitle, { color: theme.colors.navbarText }]}>
                  {t('navbar.menu')}
                </Text>
                <TouchableOpacity onPress={handleCloseMenu} style={styles.closeButton}>
                  <X size={20} color={theme.colors.navbarText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        if (currentUser?.id) {
                          handleNavigation('Profile', { id: currentUser.id.toString() });
                        }
                      }}
                      style={styles.menuItem}
                    >
                      <User size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.myProfile')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={() => handleNavigation('Home')}
                      style={styles.menuItem}
                    >
                      <Home size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.home')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('MessagesScreen')}
                      style={styles.menuItem}
                    >
                      <MessageSquare size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.messages')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('FriendScreen')}
                      style={styles.menuItem}
                    >
                      <Users size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.friends')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('TrashcanScreen')}
                      style={styles.menuItem}
                    >
                      <Trash2 size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.trashcan')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={() => handleNavigation('EditProfileScreen')}
                      style={styles.menuItem}
                    >
                      <User size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.editProfile')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('ProfileSettingsScreen')}
                      style={styles.menuItem}
                    >
                      <Settings size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.settings')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={() => handleNavigation('ReportScreen', { type: 'bug' })}
                      style={styles.menuItem}
                    >
                      <Bug size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.reportProblem')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={handleLogout}
                      style={[styles.menuItem, styles.logoutItem, { backgroundColor: theme.colors.error }]}
                    >
                      <LogOut size={18} color="white" />
                      <Text style={styles.logoutText}>{t('navbar.logOut')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => handleNavigation('Home')}
                      style={styles.menuItem}
                    >
                      <Home size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {t('navbar.home')}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={() => handleNavigation('Login')}
                      style={styles.menuItem}
                    >
                      <LogIn size={18} color={theme.colors.primary} />
                      <Text style={[styles.loginText, { color: theme.colors.primary }]}>
                        {t('navbar.logIn')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigation('Signup')}
                      style={[styles.menuItem, styles.signupItem, { backgroundColor: theme.colors.primary }]}
                    >
                      <User size={18} color="white" />
                      <Text style={styles.signupText}>{t('navbar.createAccount')}</Text>
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  searchResults: {
    borderBottomWidth: 1,
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
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    width: '85%',
    maxWidth: 320,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  },
  separator: {
    height: 1,
    marginVertical: 12,
  },
  logoutItem: {
    // backgroundColor settes dynamisk via theme.colors.error
  },
  logoutText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  loginText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signupItem: {
    // backgroundColor settes dynamisk via theme.colors.primary
  },
  signupText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
});
