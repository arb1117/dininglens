import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { MealProvider } from './src/context/MealContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/screens/CameraScreen';
import EstimateScreen from './src/screens/EstimateScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { AnalysisResult } from './src/services/visionService';

export type RootStackParamList = {
  Onboarding: undefined;
  Camera: undefined;
  Estimate: { analysisResult?: AnalysisResult };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <MealProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Onboarding"
          screenOptions={{
            headerStyle: { backgroundColor: '#500000' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Estimate"
            component={EstimateScreen}
            options={{ title: 'Meal Estimate' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'Meal History' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </MealProvider>
  );
}
