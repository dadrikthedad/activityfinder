import { useState, useCallback } from "react";
import { Animated, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/types/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useMessageNotificationStore } from "@/store/useMessageNotificationStore";
import { useCurrentUser } from "@/store/useUserCacheStore";
import { useUserSearch } from "@/features/navbar/hooks/useUserSearch";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface UseNavbarOptions {
  onNavigateToMessages?: () => void;
  onNavigateToNotifications?: () => void;
}

export function useNavbar({ onNavigateToMessages, onNavigateToNotifications }: UseNavbarOptions) {
  const { isLoggedIn, logout } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentUser = useCurrentUser();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH));

  const search = useUserSearch();

  const unreadNotifications = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.isRead).length
  );
  const unreadMessageNotifications = useMessageNotificationStore(
    (s) => s.messageNotifications.filter((n) => !n.isRead).length
  );

  const handleOpenMenu = useCallback(() => {
    setIsMenuOpen(true);
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH * 0.15,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [slideAnim]);

  const handleCloseMenu = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: false,
    }).start(() => setIsMenuOpen(false));
  }, [slideAnim]);

  const handleToggleSearch = useCallback(() => {
    setIsSearchMode((prev) => {
      if (prev) search.setQuery("");
      return !prev;
    });
  }, [search]);

  const handleUserSelect = useCallback(
    (user: UserSummaryDTO) => {
      navigation.navigate("Profile", { id: user.id.toString() });
      setIsSearchMode(false);
      search.setQuery("");
    },
    [navigation, search]
  );

  const handleNavigate = useCallback(
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
    if (onNavigateToMessages) onNavigateToMessages();
    else handleNavigate("MessagesScreen");
  }, [onNavigateToMessages, handleNavigate]);

  const handleNotificationsPress = useCallback(() => {
    if (onNavigateToNotifications) onNavigateToNotifications();
    else handleNavigate("NotificationScreen");
  }, [onNavigateToNotifications, handleNavigate]);

  return {
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
  };
}
