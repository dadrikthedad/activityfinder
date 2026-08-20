// KRITISK: Dette må være første import!
import './components/ende-til-ende/polyfills';
import { initializePolyfills } from './components/ende-til-ende/polyfills';

// KRITISK: Unistyles og i18n må initialiseres før første render
import './core/theme/unistyles';
import './core/i18n';

import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { View, Text } from 'react-native';
import * as GestureHandler from 'react-native-gesture-handler';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import { UserActionPopoverProvider } from './context/UserActionPopoverContext';

// Stores — synkroniser persisterte preferanser ved oppstart
import { useLanguageStore } from './store/useLanguageStore';

// Auth screens
import LoginScreen from './features/auth/screens/LoginScreen';
import SignupScreen from './features/auth/screens/SignupScreen';
import VerificationScreen from './features/auth/screens/VerificationScreen';
import PhoneSmsVerificationScreen from './features/auth/screens/PhoneSmsVerificationScreen';
import LoginMfaScreen from './features/auth/screens/LoginMfaScreen';
import ResetPasswordScreen from './features/auth/screens/ResetPasswordScreen';
import CryptationScreen from './features/auth/screens/CryptationScreen';
import E2EESetupScreen from './features/auth/screens/E2EESetupScreen';
import DevUserListScreen from './features/dev/screens/DevUserListScreen';
import { BootstrapLoadingScreen } from './features/bootstrap/screens/BootstrapLoadingScreen';

// App screens
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './features/conversation/screens/MessageScreen';
import ConversationScreen from './features/messaging/screens/ConversationScreen';
import GroupSettingsScreen from './screens/messages/GroupSettingsScreen';
import NewMessageScreen from './features/messages/screens/NewMessageScreen';
import MessageNotificationScreen from './screens/messages/MessageNotificationScreen';
import TrashcanScreen from './screens/messages/TrashcanScreen';
import PendingConversationsScreen from './screens/messages/PendingConversationsScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import MyProfileScreen from './features/profile/screens/MyProfileScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import ProfileSettingsScreen from './features/profile/screens/ProfileSettingsScreen';
import ChangeEmailScreen from './features/account/screens/ChangeEmailScreen';
import VerifyCurrentEmailForChangeScreen from './features/account/screens/VerifyCurrentEmailForChangeScreen';
import VerifyNewEmailScreen from './features/account/screens/VerifyNewEmailScreen';
import ChangePhoneScreen from './features/account/screens/ChangePhoneScreen';
import VerifyEmailForPhoneChangeScreen from './features/account/screens/VerifyEmailForPhoneChangeScreen';
import VerifyNewPhoneScreen from './features/account/screens/VerifyNewPhoneScreen';
import ReportUserScreen from './features/reporting/screens/ReportUserScreen';
import ReportBugScreen from './features/reporting/screens/ReportBugScreen';
import MediaViewerScreen from './screens/files/MediaViewerScreen';
import { TestNavigator } from './screens/test/TestNavigation';

// Shared components
import MobileNavbarNative from './features/navbar/MobilNavbarNative';
import { AppInitializer } from './features/bootstrap/AppInitializerNative';
import SignalRClientNative from './components/signalr/SignalRClientNative';
import { toastConfig } from './components/toast/NotificationToastNative';

// Utils
import { stopChatConnection } from './utils/signalr/chatHub';
import { useChatStore } from './store/useChatStore';
import Logger from './Logger';
import appInsights from './AppInsights';
import i18n from './core/i18n';

import { RootStackParamList } from './types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  // Synkroniser persistert språkpreferanse → i18next ved oppstart
  const { language } = useLanguageStore();

  useEffect(() => {
    initializePolyfills();
  }, []);

  useEffect(() => {
    // Overskriver auto-detektert språk med brukerens lagrede preferanse
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        const store = useChatStore.getState();
        const currentConversationId = store.currentConversationId;

        if (currentConversationId) {
          Logger.info('App backgrounded - cleaning conversation', {
            conversationId: currentConversationId,
            action: 'cleanup',
          });
          store.convertOptimisticToReal(currentConversationId);
          store.cleanupOptimisticForConversation(currentConversationId);
        }

        store.cleanupOptimisticMappings();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      stopChatConnection().catch(err =>
        Logger.error('Error stopping SignalR connection on app close', err, {
          context: 'app_shutdown',
        })
      );
    };
  }, []);

  return (
    <NavigationContainer>
      <AuthProvider>
        <ModalProvider>
          <UserActionPopoverProvider>
            <AuthenticatedApp />
          </UserActionPopoverProvider>
        </ModalProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

function AuthenticatedApp() {
  const { isLoggedIn, isLoading, userId } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar style="auto" />

      {isLoggedIn && (
        <>
          <AppInitializer key={`app-init-${userId}`} />
          <SignalRClientNative />
        </>
      )}

      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: 'white' },
        }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="BootstrapLoadingScreen" component={BootstrapLoadingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MessagesScreen">
              {({ navigation }) => (<><MobileNavbarNative /><MessagesScreen navigation={navigation} /></>)}
            </Stack.Screen>
            <Stack.Screen name="Home">
              {() => (<><MobileNavbarNative /><HomeScreen /></>)}
            </Stack.Screen>
            <Stack.Screen name="MyProfile">
              {() => (<><MobileNavbarNative /><MyProfileScreen /></>)}
            </Stack.Screen>
            <Stack.Screen name="Profile">
              {() => (<><MobileNavbarNative /><ProfileScreen /></>)}
            </Stack.Screen>
            <Stack.Screen name="PendingConversationsScreen">
              {({ navigation }) => (<><MobileNavbarNative /><PendingConversationsScreen navigation={navigation} /></>)}
            </Stack.Screen>
            <Stack.Screen name="EditProfileScreen">
              {() => (<><MobileNavbarNative /><EditProfileScreen /></>)}
            </Stack.Screen>
            <Stack.Screen name="ProfileSettingsScreen">
              {() => (<><MobileNavbarNative /><ProfileSettingsScreen /></>)}
            </Stack.Screen>
            <Stack.Screen name="TrashcanScreen">
              {({ navigation }) => (<><MobileNavbarNative /><TrashcanScreen navigation={navigation} /></>)}
            </Stack.Screen>
            <Stack.Screen name="ConversationScreen" component={ConversationScreen} options={{ cardStyleInterpolator: () => ({}) }} />
            <Stack.Screen name="MediaViewer" component={MediaViewerScreen} options={{ headerShown: false, cardStyleInterpolator: ({ current: { progress } }) => ({ cardStyle: { opacity: progress, backgroundColor: 'black' } }) }} />
            <Stack.Screen name="GroupSettingsScreen" component={GroupSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewMessageScreen" component={NewMessageScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MessageNotificationScreen" component={MessageNotificationScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ReportUserScreen" component={ReportUserScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ReportBugScreen" component={ReportBugScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TestNavigator" component={TestNavigator} />
            <Stack.Screen name="CryptationScreen" component={CryptationScreen} />
            <Stack.Screen name="ChangeEmailScreen" component={ChangeEmailScreen} />
            <Stack.Screen name="VerifyCurrentEmailForChangeScreen" component={VerifyCurrentEmailForChangeScreen} />
            <Stack.Screen name="VerifyNewEmailScreen" component={VerifyNewEmailScreen} />
            <Stack.Screen name="ChangePhoneScreen" component={ChangePhoneScreen} />
            <Stack.Screen name="VerifyEmailForPhoneChangeScreen" component={VerifyEmailForPhoneChangeScreen} />
            <Stack.Screen name="VerifyNewPhoneScreen" component={VerifyNewPhoneScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
            <Stack.Screen name="PhoneSmsVerificationScreen" component={PhoneSmsVerificationScreen} />
            <Stack.Screen name="LoginMfaScreen" component={LoginMfaScreen} />
            <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />
            <Stack.Screen name="E2EESetupScreen" component={E2EESetupScreen} />
            {__DEV__ && <Stack.Screen name="DevUserListScreen" component={DevUserListScreen} />}
          </>
        )}
      </Stack.Navigator>
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
}

export default function App() {
  const { GestureHandlerRootView } = GestureHandler;
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
