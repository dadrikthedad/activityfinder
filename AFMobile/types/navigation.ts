// types/navigation.ts
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RNFile } from '@/utils/files/FileFunctions';

// Define all your app screens and their parameters here
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  SignUp: undefined; // Alternative name used in navbar
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  About: undefined;
  Weather: undefined;
  MessagesScreen: undefined;
  ConversationScreen: { conversationId: number }; // Added with optional conversationId param
   MediaViewer: {  // 👈 LEGG TIL DENNE
    files: RNFile[];
    initialIndex: number;
    conversationId?: number;
  };
  Notifications: undefined;
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

export type MessageScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MessagesScreen'
>;

export type ConversationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ConversationScreen'
>;

export type MediaViewerScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MediaViewer'
>;

// Route prop types for each screen (if you need route params)
export type LoginScreenRouteProp = RouteProp<RootStackParamList, 'Login'>;
export type SignupScreenRouteProp = RouteProp<RootStackParamList, 'Signup'>;
export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;
export type MessagesScreenRouteProp = RouteProp<RootStackParamList, 'MessagesScreen'>;
export type ConversationScreenRouteProp = RouteProp<RootStackParamList, 'ConversationScreen'>;
export type MediaViewerScreenRouteProp = RouteProp<RootStackParamList, 'MediaViewer'>;

// Generic navigation prop (useful for components that can navigate to multiple screens)
export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;