import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import MobileNavbarNative from './components/navbar/MobilNavbarNative';
import { RootStackParamList } from './types/navigation';
import { toastConfig } from './components/toast/NotificationToastNative';
import { View, Text } from 'react-native';
import MessagesScreen from './screens/messages/MessageScreen';
import ConversationScreen from './screens/messages/ConversationScreen';
import { AppInitializer } from './components/bootstrap/AppInitializerNative';
import { stopChatConnection } from './utils/signalr/chatHub'; 
import SignalRClientNative from './components/signalr/SignalRClientNative';
import { ModalProvider } from './context/ModalContext'; 
import * as GestureHandler from 'react-native-gesture-handler';
import MediaViewerScreen from './screens/files/MediaViewerScreen';
import { useChatStore } from './store/useChatStore'; 
import GroupSettingsScreen from './screens/messages/GroupSettingsScreen';
import NewConversationScreen from './screens/messages/NewConversationScreen';
import MessageNotificationScreen from './screens/messages/MessageNotificationScreen';
import TrashcanScreen from './screens/messages/TrashcanScreen';
import { UserActionPopoverProvider } from './context/UserActionPopoverContext';
import ProfileScreen from './screens/profile/ProfileScreen';
import EditProfileScreen from './screens/profile/EditProfileScreen';
import ProfileSettingsScreen from './screens/profile/ProfileSettingsScreen';
import PendingConversationsScreen from './screens/messages/PendingConversationsScreen';
import FriendScreen from './screens/friends/FriendScreen';
import appInsights from './AppInsights';
import Logger from './Logger';
import NotificationScreen from './screens/notification/NotificationScreen';
import ReportScreen from './screens/support/ReportScreen';
import SecurityCredsScreen from './screens/profile/SecurityCredsScreen';
import VerificationScreen from './screens/auth/VerificationScreen'
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen'

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  useEffect(() => {
    Logger.info('Application Insights initialized', {
      platform: 'react-native',
      appVersion: '1.0.0'
    });
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        // App går i bakgrunnen - clean up current conversation
        const store = useChatStore.getState();
        const currentConversationId = store.currentConversationId;
        
        if (currentConversationId) {
          Logger.info('App backgrounded - cleaning conversation', {
            conversationId: currentConversationId,
            action: 'cleanup'
          });
          
          // All-in-one cleanup for current conversation
          store.convertOptimisticToReal(currentConversationId);
          store.cleanupOptimisticForConversation(currentConversationId);
        }
        
        // Clean old mappings globally  
        store.cleanupOptimisticMappings();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      stopChatConnection().catch(err =>
        Logger.error('Error stopping SignalR connection on app close', err, {
          context: 'app_shutdown'
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
  const { isLoggedIn, isLoading, userId  } = useAuth();
 
  // Show loading screen while initializing auth
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
            {/* Sider MED navbar */}
            <Stack.Screen name="MessagesScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <MessagesScreen navigation={navigation} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Home">
              {() => (
                <>
                  <MobileNavbarNative />
                  <HomeScreen />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="Profile">
              {({ route }) => (
                <>
                  <MobileNavbarNative />
                  <ProfileScreen />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="NotificationScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <NotificationScreen navigation={navigation} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="PendingConversationsScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <PendingConversationsScreen navigation={navigation} /> 
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="EditProfileScreen">
              {({ route }) => (
                <>
                  <MobileNavbarNative />
                  <EditProfileScreen />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="ProfileSettingsScreen">
              {({ route }) => (
                <>
                  <MobileNavbarNative />
                  <ProfileSettingsScreen />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="TrashcanScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <TrashcanScreen navigation={navigation} />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="FriendScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <FriendScreen navigation={navigation} />
                </>
              )}
            </Stack.Screen>

            {/* Sider UTEN navbar (fullscreen) */}
            <Stack.Screen
              name="ConversationScreen"
              component={ConversationScreen}
              options={{
                cardStyleInterpolator: () => ({}), // Tom interpolator = ingen animasjon
              }}
            />
            <Stack.Screen
              name="MediaViewer"
              component={MediaViewerScreen}
              options={{
                headerShown: false, // Gir modal-følelse
                cardStyleInterpolator: ({ current: { progress } }) => ({
                  cardStyle: {
                    opacity: progress,
                    backgroundColor: 'black'
                  },
                }),
              }}
            />
            <Stack.Screen 
              name="GroupSettingsScreen" 
              component={GroupSettingsScreen}
              options={{ headerShown: false }} // Vi har egen header
            />
            <Stack.Screen
              name="NewConversationScreen"
              component={NewConversationScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="MessageNotificationScreen"
              component={MessageNotificationScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen name="ReportScreen" component={ReportScreen} />
            <Stack.Screen name="SecurityCredsScreen" component={SecurityCredsScreen} />
          </>
        ) : (
          <>
            {/* 🔐 Auth screens - INGEN AppInitializer eller SignalR her */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
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