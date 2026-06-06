import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DiningLens</Text>
      <Text style={styles.subtitle}>Dining hall macro tracking made easy.</Text>

      <View style={styles.featureBox}>
        <Text style={styles.featureIcon}>📍</Text>
        <Text style={styles.featureTitle}>Smart Venue Detection</Text>
        <Text style={styles.featureBody}>
          DiningLens detects your location and uses it to make your macro estimates
          more accurate — automatically matching food items to the real menu at your
          dining hall or restaurant.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Camera')}
      >
        <Text style={styles.buttonText}>Enable Location</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => navigation.navigate('Camera')}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A8A',
    textAlign: 'center',
    marginBottom: 40,
  },
  featureBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featureBody: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#00E5A0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonText: {
    color: '#0F0F0F',
    fontSize: 18,
    fontWeight: '700',
  },
  skipLink: {
    padding: 8,
  },
  skipText: {
    color: '#8A8A8A',
    fontSize: 14,
  },
});
