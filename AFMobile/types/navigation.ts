// types/navigation.ts
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RNFile } from '@/utils/files/FileFunctions';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';

// Define all your app screens and their parameters here
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  SignUp: undefined; // Alternative name used in navbar
  Home: undefined;
  Profile: { id: string };
  EditProfile: undefined;
  Settings: undefined;
  MessagesScreen: undefined;
  ConversationScreen: { 
    conversationId: number;
    fromNewMessage?: boolean; // 👈 LEGG TIL DENNE
  };// Added with optional conversationId param
  MediaViewer: {
    files: RNFile[];
    initialIndex: number;
    conversationId?: number;
    viewerOptions?: {
      showDownload?: boolean;
      showShare?: boolean;
    };
  };
  Notifications: undefined;
  GroupSettingsScreen: {
    user: UserSummaryDTO;
    conversationId: number;
  };
  NewConversationScreen: {
    initialReceiver?: UserSummaryDTO;
  };
  MessageNotificationScreen: undefined;
  TrashcanScreen: undefined;
  EditProfileScreen: undefined;
  ProfileSettingsScreen: undefined;
  PendingConversationsScreen: undefined;
  FriendScreen: undefined;
  NotificationScreen: undefined;
  ReportScreen: { 
    type?: 'bug' | 'user'; 
    userId?: string; 
    userName?: string; 
  } | undefined;
  SecurityCredsScreen: undefined;
};

// Navigation prop types for each screen
export type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Login'
>;

export type SignupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Signup'
>;

export type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Home'
>;

export type ProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Profile'
>;

export type EditProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'EditProfileScreen'
>;

export type ProfileSettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ProfileSettingsScreen'
>;

export type SecurityCredsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SecurityCredsScreen'
>;

export type NotificationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NotificationScreen'
>;

export type MessageScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MessagesScreen'
>;

export type ConversationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ConversationScreen'
>;

export type PendingConversationsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PendingConversationsScreen'
>;

export type MediaViewerScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MediaViewer'
>;

export type GroupSettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'GroupSettingsScreen'
>;

export type NewConversationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NewConversationScreen'
>;

export type MessageNotificationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MessageNotificationScreen'
>;

export type TrashcanScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'TrashcanScreen'
>;

export type FriendScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'FriendScreen'
>;

export type ReportScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ReportScreen'
>;


// Route prop types for each screen (if you need route params)
export type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;
export type SignupScreenRouteProp = RouteProp<RootStackParamList, 'Signup'>;
export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;
export type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'Profile'>;
export type EditProfileScreenRouteProp = RouteProp<RootStackParamList, 'EditProfileScreen'>;
export type ProfileSettingsScreenRouteProp = RouteProp<RootStackParamList, 'ProfileSettingsScreen'>;
export type SecurityCredsScreenRouteProp = RouteProp<RootStackParamList, 'SecurityCredsScreen'>;
export type MessagesScreenRouteProp = RouteProp<RootStackParamList, 'MessagesScreen'>;
export type ConversationScreenRouteProp = RouteProp<RootStackParamList, 'ConversationScreen'>;
export type PendingConversationsScreenRouteProp = RouteProp<RootStackParamList, 'PendingConversationsScreen'>;
export type MediaViewerScreenRouteProp = RouteProp<RootStackParamList, 'MediaViewer'>;
export type GroupSettingsScreenRouteProp = RouteProp<RootStackParamList, 'GroupSettingsScreen'>;
export type NewConversationScreenRouteProp = RouteProp<RootStackParamList, 'NewConversationScreen'>;
export type MessageNotificationScreenRouteProp = RouteProp<RootStackParamList, 'MessageNotificationScreen'>;
export type TrashcanScreenRouteProp = RouteProp<RootStackParamList, 'TrashcanScreen'>;
export type FriendScreenRouteProp = RouteProp<RootStackParamList, 'FriendScreen'>;
export type NotificationScreenRouteProp = RouteProp<RootStackParamList, 'NotificationScreen'>;
export type ReportScreenRouteProp = RouteProp<RootStackParamList, 'ReportScreen'>;

// Generic navigation prop (useful for components that can navigate to multiple screens)
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;