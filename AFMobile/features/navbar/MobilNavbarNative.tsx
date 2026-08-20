import React from "react";
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
  ActivityIndicator,
  Animated,
  FlatList,
} from "react-native";
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
} from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import MiniAvatarNative from "@/components/common/MiniAvatarNative";
import { useNavbar } from "@/features/navbar/hooks/useNavbar";

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

  const {
    isLoggedIn,
    currentUser,
    isMenuOpen,
    isSearchMode,
    slideAnim,
    search,
    unreadNotifications,
    unreadMessageNotifications,
    handleOpenMenu,
    handleCloseMenu,
    handleToggleSearch,
    handleUserSelect,
    handleNavigate,
    handleLogout,
    handleMessagesPress,
    handleNotificationsPress,
  } = useNavbar({ onNavigateToMessages, onNavigateToNotifications });

  const renderUserItem = ({ item }: { item: UserSummaryDTO }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: theme.colors.border }]}
      onPress={() => handleUserSelect(item)}
    >
      <MiniAvatarNative
        imageUrl={item.profileImageUrl ?? "/default-avatar.png"}
        alt={item.fullName}
        size={48}
        withBorder
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.colors.textPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
          {item.fullName}
        </Text>
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
                  {
                    backgroundColor: theme.colors.backgroundInput,
                    color: theme.colors.textPrimary,
                    fontSize: theme.typography.md,
                  },
                ]}
                placeholder={t("navbar.search")}
                placeholderTextColor={theme.colors.textPlaceholder}
                value={search.query}
                onChangeText={search.setQuery}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity onPress={handleToggleSearch} style={styles.iconButton}>
              <X size={20} color={theme.colors.navbarText} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => handleNavigate("Home")}>
              <Text style={[styles.logo, { color: theme.colors.navbarText, fontSize: theme.typography.xl, fontWeight: theme.typography.bold }]}>
                Magee.no
              </Text>
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
                      <Text style={[styles.badgeText, { fontSize: theme.typography.xs, fontWeight: theme.typography.bold }]}>
                        {unreadMessageNotifications > 99 ? "99+" : unreadMessageNotifications.toString()}
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
                      <Text style={[styles.badgeText, { fontSize: theme.typography.xs, fontWeight: theme.typography.bold }]}>
                        {unreadNotifications > 99 ? "99+" : unreadNotifications.toString()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={handleOpenMenu} style={styles.iconButton}>
                <Menu size={20} color={theme.colors.navbarText} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {isSearchMode && search.query.trim().length > 0 && (
        <View style={[styles.searchResults, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {search.query.trim().length < 2 ? (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary, fontSize: theme.typography.sm }]}>
                {t("navbar.typeMoreChars")}
              </Text>
            </View>
          ) : search.loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary, fontSize: theme.typography.sm }]}>
                {t("navbar.searching")}
              </Text>
            </View>
          ) : search.results.length > 0 ? (
            <FlatList
              data={search.results}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderUserItem}
              showsVerticalScrollIndicator={false}
              style={styles.resultsList}
            />
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary, fontSize: theme.typography.sm }]}>
                {t("navbar.noUsersFound")}
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={isMenuOpen}
        animationType="none"
        transparent
        onRequestClose={handleCloseMenu}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdrop} onPress={handleCloseMenu} activeOpacity={1} />

          <Animated.View
            style={[
              styles.menuPanel,
              { backgroundColor: theme.colors.surface, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SafeAreaView style={styles.menuContent}>
              <View style={[styles.menuHeader, { backgroundColor: theme.colors.navbar }]}>
                <Text style={[styles.menuTitle, { color: theme.colors.navbarText, fontSize: theme.typography.lg, fontWeight: theme.typography.semibold }]}>
                  {t("navbar.menu")}
                </Text>
              </View>

              <ScrollView style={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity
                      onPress={() => handleNavigate("MyProfile")}
                      style={styles.menuItem}
                    >
                      <User size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.myProfile")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity onPress={() => handleNavigate("Home")} style={styles.menuItem}>
                      <Home size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.home")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleNavigate("MessagesScreen")} style={styles.menuItem}>
                      <MessageSquare size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.messages")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleNavigate("FriendScreen")} style={styles.menuItem}>
                      <Users size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.friends")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleNavigate("TrashcanScreen")} style={styles.menuItem}>
                      <Trash2 size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.trashcan")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity onPress={() => handleNavigate("EditProfileScreen")} style={styles.menuItem}>
                      <User size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.editProfile")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleNavigate("ProfileSettingsScreen")} style={styles.menuItem}>
                      <Settings size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.settings")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity onPress={() => handleNavigate("ReportBugScreen")} style={styles.menuItem}>
                      <Bug size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.reportProblem")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity
                      onPress={handleLogout}
                      style={[styles.menuItem, { backgroundColor: theme.colors.error }]}
                    >
                      <LogOut size={18} color={theme.colors.onPrimary} />
                      <Text style={[styles.actionText, { color: theme.colors.onPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
                        {t("navbar.logOut")}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => handleNavigate("Home")} style={styles.menuItem}>
                      <Home size={18} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary, fontSize: theme.typography.md }]}>
                        {t("navbar.home")}
                      </Text>
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

                    <TouchableOpacity onPress={() => handleNavigate("Login")} style={styles.menuItem}>
                      <LogIn size={18} color={theme.colors.primary} />
                      <Text style={[styles.actionText, { color: theme.colors.primary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
                        {t("navbar.logIn")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleNavigate("Signup")}
                      style={[styles.menuItem, { backgroundColor: theme.colors.primary }]}
                    >
                      <User size={18} color={theme.colors.onPrimary} />
                      <Text style={[styles.actionText, { color: theme.colors.onPrimary, fontSize: theme.typography.md, fontWeight: theme.typography.medium }]}>
                        {t("navbar.createAccount")}
                      </Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logo: {
    // fontSize og fontWeight settes via theme
  },
  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
  },
  searchContainer: {
    flex: 1,
    marginRight: 12,
  },
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchResults: {
    borderBottomWidth: 1,
    maxHeight: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {},
  resultsList: {
    maxHeight: 300,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {},
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noResultsText: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "85%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  menuContent: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuTitle: {},
  menuScrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
    marginVertical: 2,
  },
  menuItemText: {},
  actionText: {},
  separator: {
    height: 1,
    marginVertical: 12,
  },
});
