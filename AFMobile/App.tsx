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
import ResetPasswordScreen from './features/auth/screens/ResetPasswordScreen';
import CryptationScreen from './features/auth/screens/CryptationScreen';

// App screens
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './screens/messages/MessageScreen';
import ConversationScreen from './screens/messages/ConversationScreen';
import GroupSettingsScreen from './screens/messages/GroupSettingsScreen';
import NewConversationScreen from './screens/messages/NewConversationScreen';
import MessageNotificationScreen from './screens/messages/MessageNotificationScreen';
import TrashcanScreen from './screens/messages/TrashcanScreen';
import PendingConversationsScreen from './screens/messages/PendingConversationsScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import ProfileSettingsScreen from './screens/profile/ProfileSettingsScreen';
import SecurityCredsScreen from './screens/profile/SecurityCredsScreen';
import ReportScreen from './screens/support/ReportScreen';
import MediaViewerScreen from './screens/files/MediaViewerScreen';
import { TestNavigator } from './screens/test/TestNavigation';

// Shared components
import MobileNavbarNative from './components/navbar/MobilNavbarNative';
import { AppInitializer } from './components/bootstrap/AppInitializerNative';
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
            <Stack.Screen name="MessagesScreen">
              {({ navigation }) => (<><MobileNavbarNative /><MessagesScreen navigation={navigation} /></>)}
            </Stack.Screen>
            <Stack.Screen name="Home">
              {() => (<><MobileNavbarNative /><HomeScreen /></>)}
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
            <Stack.Screen name="NewConversationScreen" component={NewConversationScreen} options={{ headerShown: false }} />
            <Stack.Screen name="MessageNotificationScreen" component={MessageNotificationScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ReportScreen" component={ReportScreen} />
            <Stack.Screen name="SecurityCredsScreen" component={SecurityCredsScreen} />
            <Stack.Screen name="TestNavigator" component={TestNavigator} />
            <Stack.Screen name="CryptationScreen" component={CryptationScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
            <Stack.Screen name="PhoneSmsVerificationScreen" component={PhoneSmsVerificationScreen} />
            <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />
            <Stack.Screen name="ReportScreen" component={ReportScreen} />
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
