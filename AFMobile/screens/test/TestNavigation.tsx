import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TestScreen } from '@/screens/test/TestScreen';
import { CryptoTestScreen } from '@/screens/test/CryptoTestScreen';
export type TestStackParamList = {
  TestHub: undefined;
  CryptoTestScreen: undefined;
};
const Stack = createStackNavigator<TestStackParamList>();
export const TestNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TestHub"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1C6B1C',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Stack.Screen
        name="TestHub"
        component={TestScreen}
        options={{
          title: '🧪 Test Hub',
          headerShown: false, // TestScreen has its own header
        }}
      />
     
      <Stack.Screen
        name="CryptoTestScreen"
        component={CryptoTestScreen}
        options={{
          title: '🔐 Crypto Tests',
          headerShown: false, // CryptoTestScreen has its own header with back button
        }}
      />
      {/* Future test screens /}
      {/
      <Stack.Screen
        name="APITestScreen"
        component={APITestScreen}
        options={{ title: '🌐 API Tests' }}
      />
      */}
    </Stack.Navigator>
  );
};