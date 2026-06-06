import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { MealProvider } from './src/context/MealContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import CameraScreen from './src/screens/CameraScreen';
import EstimateScreen from './src/screens/EstimateScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SearchScreen from './src/screens/SearchScreen';
import { AnalysisResult } from './src/services/visionService';

export type RootStackParamList = {
  Onboarding: undefined;
  Goals: undefined;
  Camera: undefined;
  Estimate: {
    analysisResult?: AnalysisResult;
    imageBase64?: string;
    source?: string;
    addedItem?: { name: string; cal: number; protein: number; carbs: number; fat: number };
  };
  History: undefined;
  Search: {
    query?: string;
    context?: string;
    editMode?: boolean;
    mealId?: string;
    itemIndex?: number;
    existingItem?: { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number };
  } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@dininglens_goals')
      .then(raw => setInitialRoute(raw ? 'Camera' : 'Onboarding'))
      .catch(() => setInitialRoute('Onboarding'));
  }, []);

  if (!initialRoute) {
    return <View style={{ flex: 1, backgroundColor: '#0F0F0F' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MealProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerStyle: { backgroundColor: '#1A1A1A' },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
            }}
          >
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Goals"
              component={GoalsScreen}
              options={{ title: 'Your Goal', headerShown: false }}
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
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ title: 'Food Search' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </MealProvider>
    </GestureHandlerRootView>
  );
}
