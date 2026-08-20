// types/navigation.ts
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RNFile } from '@/utils/files/FileFunctions';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { AttachmentDto } from '@shared/types/MessageDTO';
import { UserSearchResultDTO } from '@/features/messages/models/UserSearchResultDTO';

export type RootStackParamList = {
  Login: { fromVerification?: boolean } | undefined;
  Signup: undefined;
  VerificationScreen: { email: string; fromRegistration?: boolean };
  PhoneSmsVerificationScreen: { email: string };
  LoginMfaScreen: { email: string };
  ResetPasswordScreen: undefined;
  E2EESetupScreen: { accessToken: string; refreshToken: string };
  DevUserListScreen: undefined;
  BootstrapLoadingScreen: undefined;
  Home: undefined;
  MyProfile: undefined;
  Profile: { id: string };
  EditProfile: undefined;
  Settings: undefined;
  MessagesScreen: undefined;
  ConversationScreen: {
    conversationId: number;
    fromNewMessage?: boolean;
  };
  MediaViewer: {
    files: RNFile[];
    attachments?: AttachmentDto[];
    initialIndex: number;
    viewerOptions?: {
      showDownload?: boolean;
      showShare?: boolean;
      isDecrypting?: boolean;
      decryptingFileUrl?: string;
      decryptingFileName?: string;
    };
  };
  GroupSettingsScreen: {
    user: UserSummaryDTO;
    conversationId: number;
  };
  NewMessageScreen: {
    initialReceiver?: UserSearchResultDTO;
  };
  MessageNotificationScreen: undefined;
  TrashcanScreen: undefined;
  EditProfileScreen: undefined;
  ProfileSettingsScreen: undefined;
  PendingConversationsScreen: undefined;
  TestNavigator: undefined;
  CryptationScreen: undefined;
  ChangeEmailScreen: undefined;
  VerifyCurrentEmailForChangeScreen: { newEmail: string; currentPassword: string };
  VerifyNewEmailScreen: { newEmail: string };
  ChangePhoneScreen: undefined;
  VerifyEmailForPhoneChangeScreen: { newPhone: string; currentPassword: string };
  VerifyNewPhoneScreen: { newPhone: string };
  ReportUserScreen: { reportedUserId: string; reportedUserName?: string };
  ReportBugScreen: undefined;
};

//////////////////////////// AUTH ////////////////////////////

export type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;
export type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;
export type VerificationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VerificationScreen'>;
export type PhoneSmsVerificationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PhoneSmsVerificationScreen'>;
export type LoginMfaScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginMfaScreen'>;
export type ResetPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ResetPasswordScreen'>;
export type E2EESetupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'E2EESetupScreen'>;
export type DevUserListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'DevUserListScreen'>;

//////////////////////////// APP ////////////////////////////

export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type MyProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MyProfile'>;
export type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;
export type EditProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EditProfileScreen'>;
export type ProfileSettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileSettingsScreen'>;
export type MessageScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MessagesScreen'>;
export type ConversationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ConversationScreen'>;
export type PendingConversationsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PendingConversationsScreen'>;
export type MediaViewerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MediaViewer'>;
export type GroupSettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GroupSettingsScreen'>;
export type NewMessageScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NewMessageScreen'>;
export type MessageNotificationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MessageNotificationScreen'>;
export type TrashcanScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TrashcanScreen'>;
export type TestNavigatorNavigationProp = StackNavigationProp<RootStackParamList, 'TestNavigator'>;
export type CryptationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CryptationScreen'>;
export type ChangeEmailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChangeEmailScreen'>;
export type VerifyCurrentEmailForChangeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VerifyCurrentEmailForChangeScreen'>;
export type VerifyNewEmailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VerifyNewEmailScreen'>;

//////////////////////////// ROUTE PROPS ////////////////////////////

export type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;
export type SignupScreenRouteProp = RouteProp<RootStackParamList, 'Signup'>;
export type VerificationScreenRouteProp = RouteProp<RootStackParamList, 'VerificationScreen'>;
export type PhoneSmsVerificationScreenRouteProp = RouteProp<RootStackParamList, 'PhoneSmsVerificationScreen'>;
export type LoginMfaScreenRouteProp = RouteProp<RootStackParamList, 'LoginMfaScreen'>;
export type ResetPasswordScreenRouteProp = RouteProp<RootStackParamList, 'ResetPasswordScreen'>;
export type E2EESetupScreenRouteProp = RouteProp<RootStackParamList, 'E2EESetupScreen'>;
export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;
export type ProfileScreenRouteProp = RouteProp<RootStackParamList, 'Profile'>;
export type EditProfileScreenRouteProp = RouteProp<RootStackParamList, 'EditProfileScreen'>;
export type ProfileSettingsScreenRouteProp = RouteProp<RootStackParamList, 'ProfileSettingsScreen'>;
export type MessagesScreenRouteProp = RouteProp<RootStackParamList, 'MessagesScreen'>;
export type ConversationScreenRouteProp = RouteProp<RootStackParamList, 'ConversationScreen'>;
export type PendingConversationsScreenRouteProp = RouteProp<RootStackParamList, 'PendingConversationsScreen'>;
export type MediaViewerScreenRouteProp = RouteProp<RootStackParamList, 'MediaViewer'>;
export type GroupSettingsScreenRouteProp = RouteProp<RootStackParamList, 'GroupSettingsScreen'>;
export type NewMessageScreenRouteProp = RouteProp<RootStackParamList, 'NewMessageScreen'>;
export type MessageNotificationScreenRouteProp = RouteProp<RootStackParamList, 'MessageNotificationScreen'>;
export type TrashcanScreenRouteProp = RouteProp<RootStackParamList, 'TrashcanScreen'>;
export type TestNavigatorRouteProp = RouteProp<RootStackParamList, 'TestNavigator'>;
export type CryptationScreenRouteProp = RouteProp<RootStackParamList, 'CryptationScreen'>;
export type VerifyCurrentEmailForChangeScreenRouteProp = RouteProp<RootStackParamList, 'VerifyCurrentEmailForChangeScreen'>;
export type VerifyNewEmailScreenRouteProp = RouteProp<RootStackParamList, 'VerifyNewEmailScreen'>;

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
