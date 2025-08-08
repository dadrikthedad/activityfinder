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

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  // Håndter app state changes for SignalR
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('🛑 App going to background, stopping SignalR...');
        stopChatConnection().catch(err => 
          console.error('Error stopping SignalR connection:', err)
        );
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      // Cleanup SignalR når appen lukkes
      stopChatConnection().catch(err => 
        console.error('Error stopping SignalR connection on app close:', err)
      );
    };
  }, []);

  return (
    <NavigationContainer>
      <AuthProvider>
        <AppInitializer />
        <AuthenticatedApp />
      </AuthProvider>
    </NavigationContainer>
  );
}

function AuthenticatedApp() {
  const { isLoggedIn } = useAuth();
 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar style="auto" />
      
      {/* 🚀 SignalR kun når bruker er logget inn */}
      {isLoggedIn && <SignalRClientNative />}
     
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: 'white' },
        }}
      >
        {isLoggedIn ? (
          <>
            {/* Sider MED navbar */}
            <Stack.Screen name="Home">
              {() => (
                <>
                  <MobileNavbarNative />
                  <HomeScreen />
                </>
              )}
            </Stack.Screen>
            <Stack.Screen name="MessagesScreen">
              {({ navigation }) => (
                <>
                  <MobileNavbarNative />
                  <MessagesScreen navigation={navigation} />
                </>
              )}
            </Stack.Screen>
           
            {/* Sider UTEN navbar (fullscreen) */}
            <Stack.Screen name="ConversationScreen" component={ConversationScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}