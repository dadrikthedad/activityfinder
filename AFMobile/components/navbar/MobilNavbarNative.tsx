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
  Cloud, 
  Info 
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types/navigation';

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  // Notification state for badge
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

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
      // Navigate to MessagesScreen instead of Messages
      handleNavigation('MessagesScreen');
    }
  }, [onNavigateToMessages, handleNavigation]);

  const handleNotificationsPress = useCallback(() => {
    if (onNavigateToNotifications) {
      onNavigateToNotifications();
    } else {
      // Open notifications modal using ModalContext
      // You can implement this with useModal hook
      handleNavigation('Notifications');
    }
  }, [onNavigateToNotifications, handleNavigation]);

  return (
    <>
      {/* Main Navbar */}
      <View style={styles.navbar}>
        <StatusBar barStyle="light-content" backgroundColor="#1C6B1C" />
        
        {/* Logo */}
        <TouchableOpacity onPress={() => handleNavigation('Home')}>
          <Text style={styles.logo}>Magee.no</Text>
        </TouchableOpacity>

        {/* Right side icons */}
        <View style={styles.rightIcons}>
          {/* Messages Icon - only visible when logged in */}
          {isLoggedIn && (
            <TouchableOpacity
              onPress={handleMessagesPress}
              style={styles.iconButton}
            >
              <MessageSquare size={20} color="white" />
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
      </View>

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
                    onPress={() => handleNavigation('Profile')}
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
                    onPress={() => handleNavigation('Settings')}
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
                    <LogIn size={18} color="#dc2626" />
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
    backgroundColor: '#dc2626',
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
    backgroundColor: '#fef2f2',
  },
  logoutText: {
    fontSize: 16,
    color: '#dc2626',
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